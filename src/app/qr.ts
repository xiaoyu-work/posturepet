import QRCode from 'qrcode'

/**
 * Render a QR code into the given <canvas> element.
 *
 * The preview UI uses this to generate an Even-App scannable QR for whatever
 * URL the user drops into the input — typically a `cloudflared` tunnel that
 * proxies `localhost:5173` to a publicly-reachable hostname. We render into a
 * canvas rather than an <img> so the output is zero-network (no data-URL
 * round trip) and scales crisply on devicePixelRatio > 1 displays.
 */
export async function drawQrOnto(
  canvas: HTMLCanvasElement,
  text: string,
  size = 220,
): Promise<void> {
  canvas.width = size
  canvas.height = size
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 1,
    color: { dark: '#0a0e18', light: '#f5f7ff' },
    errorCorrectionLevel: 'M',
  })
}
