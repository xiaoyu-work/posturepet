import type { MovementParams, PetType } from './types'
import { drawBubbles, type PetPose } from './pets/common'
import { drawFish } from './pets/fish'
import { drawJellyfish } from './pets/jellyfish'
import { drawTurtle } from './pets/turtle'
import { drawButterfly } from './pets/butterfly'
import { vitalsFor, type PetVitals } from '../posture/mood'
import type { PostureSnapshot } from '../posture/types'
import { drawOverlay } from './overlay'

export interface RenderedFrame {
  canvas: HTMLCanvasElement
  /** Lazily PNG-encodes the scene as a single base64 string for the G2 push. */
  imageBase64: () => string
  /** A compact signature that changes iff the visual output changes. */
  signature: string
  vitals: PetVitals
}

export interface RenderOptions {
  petType: PetType
  visible: boolean
  posture: PostureSnapshot
  now?: number
}

export const MOVEMENT: Record<PetType, MovementParams> = {
  fish: {
    fx1: 0.21,
    fx2: 0.67,
    fy1: 0.34,
    fy2: 0.53,
    ax1: 0.38,
    ax2: 0.12,
    ay1: 0.32,
    ay2: 0.13,
    px2: 1.5,
    py1: 0.9,
    py2: 2.3,
  },
  jellyfish: {
    fx1: 0.13,
    fx2: 0.41,
    fy1: 0.28,
    fy2: 0.61,
    ax1: 0.2,
    ax2: 0.1,
    ay1: 0.35,
    ay2: 0.15,
    px2: 2.0,
    py1: 0.5,
    py2: 1.8,
  },
  turtle: {
    fx1: 0.12,
    fx2: 0.37,
    fy1: 0.19,
    fy2: 0.43,
    ax1: 0.4,
    ax2: 0.1,
    ay1: 0.15,
    ay2: 0.1,
    px2: 1.2,
    py1: 0.7,
    py2: 2.5,
  },
  butterfly: {
    fx1: 0.27,
    fx2: 0.73,
    fy1: 0.41,
    fy2: 0.89,
    ax1: 0.3,
    ax2: 0.15,
    ay1: 0.3,
    ay2: 0.15,
    px2: 0.8,
    py1: 1.2,
    py2: 2.4,
  },
}

export function getPosition(now: number, w: number, h: number, m: MovementParams): PetPose {
  const t = now / 1000
  const mx = 44
  const my = 16

  const x = mx + (w - 2 * mx) * (0.5 + m.ax1 * Math.sin(t * m.fx1) + m.ax2 * Math.sin(t * m.fx2 + m.px2))
  const y =
    my + (h - 2 * my) * (0.5 + m.ay1 * Math.sin(t * m.fy1 + m.py1) + m.ay2 * Math.sin(t * m.fy2 + m.py2))

  const vx = m.ax1 * m.fx1 * Math.cos(t * m.fx1) + m.ax2 * m.fx2 * Math.cos(t * m.fx2 + m.px2)
  const vy = m.ay1 * m.fy1 * Math.cos(t * m.fy1 + m.py1) + m.ay2 * m.fy2 * Math.cos(t * m.fy2 + m.py2)

  const facing: 1 | -1 = vx >= 0 ? 1 : -1
  const tilt = Math.atan2(vy, Math.abs(vx)) * 0.25
  return { x, y, facing, tilt }
}

function biasPose(pose: PetPose, state: PostureSnapshot['state'], sceneHeight: number): PetPose {
  switch (state) {
    case 'unwell':
      return { ...pose, y: Math.min(sceneHeight - 20, pose.y + 14), tilt: pose.tilt + 0.25 }
    case 'sick':
      return { ...pose, y: sceneHeight - 18, tilt: 0.45 }
    case 'asleep':
      return { ...pose, y: sceneHeight - 16, tilt: 0 }
    case 'alert':
      return { ...pose, y: pose.y + 6, tilt: pose.tilt + 0.1 }
    default:
      return pose
  }
}

function drawPet(ctx: CanvasRenderingContext2D, petType: PetType, pose: PetPose, now: number): void {
  const args = { ctx, pose, now }
  switch (petType) {
    case 'fish':
      drawFish(args)
      return
    case 'jellyfish':
      drawJellyfish(args)
      return
    case 'turtle':
      drawTurtle(args)
      return
    case 'butterfly':
      drawButterfly(args)
      return
  }
}

function isAquatic(petType: PetType): boolean {
  return petType !== 'butterfly'
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export class PetRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.canvas = createCanvas(width, height)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable.')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
  }

  render(opts: RenderOptions): RenderedFrame {
    const { ctx, width, height } = this
    const { petType, visible, posture } = opts
    const now = opts.now ?? Date.now()
    const vitals = vitalsFor(posture.state)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    let step = -1
    if (visible) {
      const pose = getPosition(now, width, height, MOVEMENT[petType])
      // Pose adjusts to mood — sagging when sick, vertical flip when sleeping.
      const biased = biasPose(pose, posture.state, height)
      drawPet(ctx, petType, biased, now)
      if (isAquatic(petType)) drawBubbles(ctx, biased.x, biased.y, biased.facing, now)
      drawOverlay(ctx, {
        vitals,
        deviationDeg: posture.deviationDeg,
        calibrated: posture.calibrated,
      })
      step = Math.floor(now / 80)
    }

    const signature = `${petType}|${visible ? 1 : 0}|${posture.state}|${Math.round(vitals.hp)}|${Math.round(vitals.mood)}|${step}`

    return {
      canvas: this.canvas,
      signature,
      imageBase64: () => this.encodeImage(),
      vitals,
    }
  }

  private encodeImage(): string {
    return this.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  }
}
