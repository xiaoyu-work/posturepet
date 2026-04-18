/**
 * Fan-out logger for this project.
 *
 * Writes every message to three places:
 *   1. `console.log` (browser devtools, only visible if you can open them)
 *   2. An in-memory ring buffer the preview UI can subscribe to
 *   3. Batched POSTs to the Vite dev server (`/api/log`) — that server
 *      prints each line to its terminal AND appends to `imu-logs/webview.log`
 *
 * Why all three: Even App's webview has no devtools, so `console.log` alone
 * is invisible. The UI panel works but requires scrolling. Terminal output
 * is the fastest "watch while it happens" for desktop debugging.
 */

type Listener = (lines: readonly string[]) => void

const MAX_LINES = 120
const buffer: string[] = []
const listeners = new Set<Listener>()

const POST_BATCH_MS = 400
const pending: string[] = []
let flushTimer: number | null = null

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    const batch = pending.splice(0, pending.length)
    if (batch.length === 0) return
    void fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: batch }),
      keepalive: true,
    }).catch(() => {
      /* dev-only pipe; don't crash on transport errors */
    })
  }, POST_BATCH_MS)
}

export function log(msg: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  buffer.push(line)
  while (buffer.length > MAX_LINES) buffer.shift()
  // eslint-disable-next-line no-console
  console.log(msg)
  pending.push(msg)
  scheduleFlush()
  for (const l of listeners) l(buffer)
}

export function subscribeLog(listener: Listener): () => void {
  listeners.add(listener)
  listener(buffer)
  return () => {
    listeners.delete(listener)
  }
}

export function snapshotLog(): readonly string[] {
  return buffer
}
