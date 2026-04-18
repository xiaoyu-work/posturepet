#!/usr/bin/env node
/**
 * Generate a QR PNG for a given dev-server URL.
 *
 * Usage:
 *   node scripts/gen-qr.mjs <url> <output.png>
 *
 * Example:
 *   node scripts/gen-qr.mjs http://100.71.2.93:5173 qr-tailscale.png
 */

import QRCode from 'qrcode'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [, , url, outArg = 'qr.png'] = process.argv

if (!url) {
  console.error('usage: node scripts/gen-qr.mjs <url> [output.png]')
  process.exit(1)
}

const out = resolve(process.cwd(), outArg)
const buffer = await QRCode.toBuffer(url, {
  type: 'png',
  width: 512,
  margin: 2,
  color: { dark: '#0a0e18', light: '#f5f7ff' },
  errorCorrectionLevel: 'M',
})
await writeFile(out, buffer)
console.log(`wrote ${out}`)
