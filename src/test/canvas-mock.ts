/**
 * Minimal HTMLCanvasElement 2D context mock for jsdom.
 *
 * jsdom doesn't implement the canvas 2D API, but a surprising amount of our
 * renderer logic only *needs* the calls to succeed — it's correctness we care
 * about (pet pose, posture signatures, overlay fill ratios), not the final
 * pixel output. This mock provides a no-op surface plus a tiny image-data
 * fake so `getImageData` returns a usable Uint8ClampedArray.
 */

function createMockContext(width: number, height: number): CanvasRenderingContext2D {
  const pixels = new Uint8ClampedArray(width * height * 4)
  let fillStyle = '#000000'
  const ctx: Partial<CanvasRenderingContext2D> = {
    canvas: { width, height } as HTMLCanvasElement,
    get fillStyle() {
      return fillStyle
    },
    set fillStyle(value: string) {
      fillStyle = value
    },
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect: (x: number, y: number, w: number, h: number) => {
      const fill = typeof fillStyle === 'string' ? fillStyle : '#000000'
      const isDark = /^#0/i.test(fill) || fill === '#000000'
      const val = isDark ? 0 : 200
      for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.floor(y + h)); row++) {
        for (let col = Math.max(0, Math.floor(x)); col < Math.min(width, Math.floor(x + w)); col++) {
          const idx = (row * width + col) * 4
          pixels[idx] = val
          pixels[idx + 1] = val
          pixels[idx + 2] = val
          pixels[idx + 3] = 255
        }
      }
    },
    clearRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    drawImage: () => {},
    getImageData: (x: number, y: number, w: number, h: number) => {
      const out = new Uint8ClampedArray(w * h * 4)
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const si = ((y + row) * width + (x + col)) * 4
          const di = (row * w + col) * 4
          out[di] = pixels[si] ?? 0
          out[di + 1] = pixels[si + 1] ?? 0
          out[di + 2] = pixels[si + 2] ?? 0
          out[di + 3] = pixels[si + 3] ?? 0
        }
      }
      return { data: out, width: w, height: h, colorSpace: 'srgb' } as ImageData
    },
  }
  return ctx as CanvasRenderingContext2D
}

export function installCanvasMock(): void {
  if (typeof HTMLCanvasElement === 'undefined') return
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (type: string) => CanvasRenderingContext2D | null
    toDataURL: () => string
  }
  proto.getContext = function (this: HTMLCanvasElement) {
    return createMockContext(this.width, this.height)
  }
  proto.toDataURL = function () {
    return 'data:image/png;base64,'
  }
}
