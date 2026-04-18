import type { PetType } from './types'
import type { PetPose } from './pets/common'
import { drawFish } from './pets/fish'
import { drawJellyfish } from './pets/jellyfish'
import { drawTurtle } from './pets/turtle'
import { drawButterfly } from './pets/butterfly'
import { vitalsFor, type PetVitals } from '../posture/mood'
import type { PostureSnapshot } from '../posture/types'
import { drawOverlay } from './overlay'

export interface RenderedFrame {
  canvas: HTMLCanvasElement
  /** Lazily PNG-encodes the scene as a `Uint8Array` of raw PNG bytes. The
   *  Even SDK accepts both base64 and byte arrays; the official `image`
   *  scaffold at `even-realities/evenhub-templates` uses bytes, so we match
   *  — the extra base64-decode step on the host side was a likely stressor
   *  for the memory-constrained G2 image pipeline. */
  imageBytes: () => Uint8Array
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

/**
 * The pet is anchored in the lower-right corner and plays its internal
 * animation (fish tail flapping, jellyfish pulsing, etc) in place. Scale
 * halves linear size (user request: "缩小一倍"). We no longer freeze `now`
 * — signature includes a coarse time step so the image push rate is still
 * bounded but the lens sees the pet actually move.
 */
const PET_CENTER_X = 250
const PET_CENTER_Y = 72
const PET_SCALE = 0.5
/** Coarsens `now` into animation frames so tiny sub-millisecond changes
 *  don't spam the G2 with identical frames. 150 ms/frame pairs well with
 *  the image-push throttle downstream. */
const ANIM_STEP_MS = 150

function staticPose(state: PostureSnapshot['state']): PetPose {
  const base = { x: PET_CENTER_X, y: PET_CENTER_Y, facing: 1 as const, tilt: 0 }
  switch (state) {
    case 'alert':
      return { ...base, y: base.y + 3, tilt: 0.1 }
    case 'unwell':
      return { ...base, y: base.y + 6, tilt: 0.22 }
    case 'sick':
      return { ...base, y: base.y + 10, tilt: 0.35 }
    case 'asleep':
      return { ...base, y: base.y + 8, tilt: 0 }
    default:
      return base
  }
}

function drawPet(
  ctx: CanvasRenderingContext2D,
  petType: PetType,
  pose: PetPose,
  now: number,
): void {
  ctx.save()
  ctx.translate(pose.x, pose.y)
  ctx.scale(PET_SCALE, PET_SCALE)
  const localPose: PetPose = { x: 0, y: 0, facing: pose.facing, tilt: pose.tilt }
  const args = { ctx, pose: localPose, now }
  switch (petType) {
    case 'fish':
      drawFish(args)
      break
    case 'jellyfish':
      drawJellyfish(args)
      break
    case 'turtle':
      drawTurtle(args)
      break
    case 'butterfly':
      drawButterfly(args)
      break
  }
  ctx.restore()
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
    const animTime = Math.floor(now / ANIM_STEP_MS) * ANIM_STEP_MS
    const vitals = vitalsFor(posture.state)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    if (visible) {
      drawPet(ctx, petType, staticPose(posture.state), animTime)
      drawOverlay(ctx, {
        vitals,
        deviationDeg: posture.deviationDeg,
        calibrated: posture.calibrated,
      })
    }

    // Signature advances each ANIM_STEP_MS so we only push a new image when
    // the animation actually progresses to a new frame. `renderTick` still
    // throttles the final push by G2_PUSH_INTERVAL_MS on top of this.
    const animStep = visible ? Math.floor(now / ANIM_STEP_MS) : -1
    const signature = [
      petType,
      visible ? 1 : 0,
      posture.state,
      posture.calibrated ? 1 : 0,
      Math.round(vitals.hp),
      Math.round(vitals.mood),
      animStep,
    ].join('|')

    return {
      canvas: this.canvas,
      signature,
      imageBytes: () => this.encodeImage(),
      vitals,
    }
  }

  private encodeImage(): Uint8Array {
    const dataUrl = this.canvas.toDataURL('image/png')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
}
