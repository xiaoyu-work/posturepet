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
 * The pet sits still in the lower-right corner.
 *
 * Two reasons we dropped the original animated motion:
 *
 *   1. BLE throughput to G2 can't sustain frequent raw-image writes — any
 *      per-frame change forces another push, which was the direct cause of
 *      'Image update: sendFailed'. A static pet lets the frame signature
 *      only change when state changes, so pushes become sporadic.
 *   2. The lens view is tiny; a corner-anchored pet stays out of the way of
 *      text content and is less visually fatiguing.
 *
 * The numbers below are relative to the G2 image container (288×100). Scale
 * halves the pet's linear size (user request: "缩小一倍"). `STATIC_TIME` is
 * a fixed value passed as `now` to the pet draw functions so their internal
 * tail/wing/flipper animations freeze on a specific frame.
 */
const PET_CENTER_X = 250
const PET_CENTER_Y = 72
const PET_SCALE = 0.5
const STATIC_TIME = 1234

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

function drawPet(ctx: CanvasRenderingContext2D, petType: PetType, pose: PetPose): void {
  ctx.save()
  ctx.translate(pose.x, pose.y)
  ctx.scale(PET_SCALE, PET_SCALE)
  const localPose: PetPose = { x: 0, y: 0, facing: pose.facing, tilt: pose.tilt }
  const args = { ctx, pose: localPose, now: STATIC_TIME }
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
    const vitals = vitalsFor(posture.state)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    if (visible) {
      drawPet(ctx, petType, staticPose(posture.state))
      drawOverlay(ctx, {
        vitals,
        deviationDeg: posture.deviationDeg,
        calibrated: posture.calibrated,
      })
    }

    // Signature deliberately excludes `now` / time step — the scene is static
    // except when posture state or visibility changes. This keeps the BLE
    // push rate near zero during steady-state, avoiding `sendFailed`.
    const signature = [
      petType,
      visible ? 1 : 0,
      posture.state,
      posture.calibrated ? 1 : 0,
      Math.round(vitals.hp),
      Math.round(vitals.mood),
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
