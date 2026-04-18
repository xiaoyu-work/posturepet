import type { PetDrawContext } from './common'

/**
 * Pixel-art skull drawn in place of the pet when HP has dropped to zero
 * (posture state = `sick`). The renderer swaps this in for the usual pet
 * art; when the user straightens up the state machine flips back to
 * `healthy` and the normal pet is drawn again automatically — no special
 * "revive" code path needed, just a state-driven render.
 *
 * Drawn at the pet's local origin (the caller applies translate + scale),
 * so coordinates here are in "pet space" — same scale as the fish body
 * ellipse so the skull reads as the same size of creature.
 */
export function drawSkull({ ctx }: PetDrawContext): void {
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.5

  // Cranium
  ctx.beginPath()
  ctx.ellipse(0, -2, 14, 12, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Eye sockets — filled circles contrast on the black background so they
  // read as holes even before the outline is noticed.
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath()
  ctx.arc(-5, -2, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(5, -2, 3, 0, Math.PI * 2)
  ctx.fill()

  // Dead-eye X marks inside each socket, so it reads as dead, not sleeping.
  ctx.strokeStyle = '#202020'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-7, -4)
  ctx.lineTo(-3, 0)
  ctx.moveTo(-7, 0)
  ctx.lineTo(-3, -4)
  ctx.moveTo(3, -4)
  ctx.lineTo(7, 0)
  ctx.moveTo(3, 0)
  ctx.lineTo(7, -4)
  ctx.stroke()

  // Nose (inverted triangle)
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-2, 4)
  ctx.lineTo(2, 4)
  ctx.lineTo(0, 7)
  ctx.closePath()
  ctx.stroke()

  // Jaw — separate ellipse below, with teeth ticks
  ctx.strokeStyle = '#b0b0b0'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(0, 11, 8, 3, 0, 0, Math.PI * 2)
  ctx.stroke()

  for (let i = -6; i <= 6; i += 3) {
    ctx.beginPath()
    ctx.moveTo(i, 9)
    ctx.lineTo(i, 13)
    ctx.stroke()
  }
}
