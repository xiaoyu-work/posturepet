import { PET_TYPES, PET_LABELS, type PetType, type PreviewRenderModel } from './types'
import { lastNDays, loadLog, aggregateDaily, todayStat, type DailyStat } from './dashboard'
import { drawQrOnto } from './qr'

export interface PreviewController {
  render(model: PreviewRenderModel): void
  refreshDashboard(): void
}

interface PreviewHandlers {
  onToggle: () => void
  onPetSelect: (petType: PetType) => void
}

export function createPreview(root: HTMLElement, handlers: PreviewHandlers): PreviewController {
  root.innerHTML = `
    <main class="app-shell pixel">
      <header class="pixel-header">
        <h1 class="pixel-title">POSTURE PET</h1>
        <p class="pixel-subtitle">your neck decides how your pet feels</p>
      </header>

      <section class="pet-card">
        <div class="pet-status-row">
          <div class="pet-emoji" data-emoji>(o_o)</div>
          <div class="pet-status-details">
            <div class="pet-state-label" data-state-label>Calibrating</div>
            <div class="pet-meter">
              <span class="meter-name">HP</span>
              <div class="meter-track">
                <div class="meter-fill meter-fill--hp" data-hp-fill></div>
                <div class="meter-readout" data-hp-readout>100 / 100</div>
              </div>
            </div>
            <div class="pet-meter">
              <span class="meter-name">MD</span>
              <div class="meter-track">
                <div class="meter-fill meter-fill--mood" data-mood-fill></div>
                <div class="meter-readout" data-mood-readout>100 / 100</div>
              </div>
            </div>
            <div class="pet-stats">
              <span data-tilt>tilt: —</span>
              <span data-wearing>wearing: —</span>
            </div>
          </div>
        </div>

        <div class="preview-frame">
          <canvas class="scene-canvas" data-scene-canvas></canvas>
        </div>

        <div class="pet-picker" data-picker></div>

        <div class="controls">
          <p class="connection-pill" data-connection>Booting…</p>
          <button class="pixel-button" data-toggle type="button">Wake pet</button>
        </div>
      </section>

      <section class="dashboard">
        <h2 class="dashboard-title">TODAY</h2>
        <div class="dashboard-grid">
          <div class="stat-tile">
            <div class="stat-value" data-today-healthy>0</div>
            <div class="stat-label">healthy min</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value" data-today-slouch>0</div>
            <div class="stat-label">slouching min</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value" data-today-sick>0</div>
            <div class="stat-label">sick min</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value" data-today-streak>0</div>
            <div class="stat-label">longest streak</div>
          </div>
        </div>

        <h3 class="dashboard-subtitle">LAST 7 DAYS</h3>
        <div class="history-chart" data-history></div>
      </section>

      <section class="qr-card">
        <h2 class="qr-title">PAIR WITH EVEN APP</h2>
        <p class="qr-hint">
          Paste the public URL (e.g. your <code>cloudflared</code> tunnel) and scan the QR in
          Even App → Developer. <strong>localhost</strong> won't work for Even App — only
          publicly-reachable URLs.
        </p>
        <div class="qr-row">
          <input
            class="qr-input"
            data-qr-input
            type="url"
            placeholder="https://&lt;your-tunnel&gt;.trycloudflare.com"
          />
          <button class="pixel-button" data-qr-generate type="button">Generate</button>
          <button class="pixel-button" data-qr-download type="button" disabled>Download PNG</button>
        </div>
        <div class="qr-surface">
          <canvas class="qr-canvas" data-qr-canvas width="220" height="220"></canvas>
          <div class="qr-url" data-qr-url>—</div>
        </div>
      </section>

      <footer class="pixel-footer">
        <a class="debug-link" href="/imu-debug.html">IMU spike →</a>
      </footer>
    </main>
  `

  const canvas = root.querySelector<HTMLCanvasElement>('[data-scene-canvas]')!
  const picker = root.querySelector<HTMLElement>('[data-picker]')!
  const connection = root.querySelector<HTMLElement>('[data-connection]')!
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-toggle]')!
  const emoji = root.querySelector<HTMLElement>('[data-emoji]')!
  const stateLabel = root.querySelector<HTMLElement>('[data-state-label]')!
  const hpFill = root.querySelector<HTMLElement>('[data-hp-fill]')!
  const hpReadout = root.querySelector<HTMLElement>('[data-hp-readout]')!
  const moodFill = root.querySelector<HTMLElement>('[data-mood-fill]')!
  const moodReadout = root.querySelector<HTMLElement>('[data-mood-readout]')!
  const tiltEl = root.querySelector<HTMLElement>('[data-tilt]')!
  const wearingEl = root.querySelector<HTMLElement>('[data-wearing]')!
  const todayHealthy = root.querySelector<HTMLElement>('[data-today-healthy]')!
  const todaySlouch = root.querySelector<HTMLElement>('[data-today-slouch]')!
  const todaySick = root.querySelector<HTMLElement>('[data-today-sick]')!
  const todayStreak = root.querySelector<HTMLElement>('[data-today-streak]')!
  const history = root.querySelector<HTMLElement>('[data-history]')!
  const qrInput = root.querySelector<HTMLInputElement>('[data-qr-input]')!
  const qrGenerate = root.querySelector<HTMLButtonElement>('[data-qr-generate]')!
  const qrDownload = root.querySelector<HTMLButtonElement>('[data-qr-download]')!
  const qrCanvas = root.querySelector<HTMLCanvasElement>('[data-qr-canvas]')!
  const qrUrl = root.querySelector<HTMLElement>('[data-qr-url]')!

  for (const type of PET_TYPES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pet-option'
    button.dataset.pet = type
    button.textContent = PET_LABELS[type]
    button.addEventListener('click', () => handlers.onPetSelect(type))
    picker.append(button)
  }

  toggleButton.addEventListener('click', () => handlers.onToggle())

  qrInput.value = guessTunnelDefault()
  let activeQrUrl = ''

  qrGenerate.addEventListener('click', () => {
    void regenerateQr()
  })
  qrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void regenerateQr()
  })
  qrDownload.addEventListener('click', () => {
    if (!activeQrUrl) return
    const link = document.createElement('a')
    link.href = qrCanvas.toDataURL('image/png')
    link.download = safeFilename(activeQrUrl) + '.png'
    link.click()
  })

  async function regenerateQr(): Promise<void> {
    const value = qrInput.value.trim()
    if (!value) {
      qrUrl.textContent = 'enter a URL first'
      qrDownload.disabled = true
      return
    }
    try {
      await drawQrOnto(qrCanvas, value, 220)
      activeQrUrl = value
      qrUrl.textContent = value
      qrDownload.disabled = false
    } catch (err) {
      qrUrl.textContent = `QR failed: ${String(err)}`
      qrDownload.disabled = true
    }
  }

  // Auto-render a QR on boot if the URL looks usable (non-localhost).
  if (looksReachable(qrInput.value)) {
    void regenerateQr()
  } else {
    qrUrl.textContent = 'paste your tunnel URL above'
  }

  return {
    render(model) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (canvas.width !== model.sceneCanvas.width) canvas.width = model.sceneCanvas.width
      if (canvas.height !== model.sceneCanvas.height) canvas.height = model.sceneCanvas.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(model.sceneCanvas, 0, 0)

      connection.textContent = model.connectionLabel
      toggleButton.textContent = model.visible ? 'Hide pet' : 'Wake pet'

      emoji.textContent = model.moodEmoji
      stateLabel.textContent = model.stateLabel
      stateLabel.dataset.state = model.stateLabel.toLowerCase()
      hpFill.style.width = `${Math.max(0, Math.min(100, model.hp))}%`
      moodFill.style.width = `${Math.max(0, Math.min(100, model.mood))}%`
      hpReadout.textContent = `${Math.round(model.hp)} / 100`
      moodReadout.textContent = `${Math.round(model.mood)} / 100`
      tiltEl.textContent = model.calibrated
        ? `tilt: ${Math.round(model.deviationDeg)}°`
        : 'tilt: calibrating'
      wearingEl.textContent = `wearing: ${model.wearing ? 'yes' : 'no'}`

      picker.querySelectorAll<HTMLButtonElement>('.pet-option').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.pet === model.petType)
      })
    },
    refreshDashboard() {
      const today = todayStat()
      todayHealthy.textContent = String(today.healthyMinutes)
      todaySlouch.textContent = String(today.slouchMinutes)
      todaySick.textContent = String(today.sickMinutes)
      todayStreak.textContent = String(today.longestHealthyStreak)

      const stats = aggregateDaily(loadLog())
      const week = lastNDays(stats, 7)
      renderHistory(history, week)
    },
  }
}

function renderHistory(container: HTMLElement, stats: DailyStat[]): void {
  container.innerHTML = ''
  const max = Math.max(1, ...stats.map((s) => s.totalMinutes))
  for (const stat of stats) {
    const bar = document.createElement('div')
    bar.className = 'history-bar'
    const healthyPct = (stat.healthyMinutes / max) * 100
    const slouchPct = (stat.slouchMinutes / max) * 100
    const sickPct = (stat.sickMinutes / max) * 100
    bar.innerHTML = `
      <div class="history-stack">
        <div class="history-seg history-seg--sick" style="height:${sickPct}%"></div>
        <div class="history-seg history-seg--slouch" style="height:${slouchPct}%"></div>
        <div class="history-seg history-seg--healthy" style="height:${healthyPct}%"></div>
      </div>
      <div class="history-day">${stat.day.slice(5)}</div>
    `
    const total = stat.totalMinutes
    bar.title = `${stat.day} · ${total} min total · ${stat.healthyMinutes} healthy · ${stat.slouchMinutes} slouch · ${stat.sickMinutes} sick`
    container.append(bar)
  }
}

function guessTunnelDefault(): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  if (looksReachable(url.href)) {
    return `${url.origin}/`
  }
  return ''
}

function looksReachable(value: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (host === 'localhost') return false
    if (host === '127.0.0.1') return false
    if (host === '0.0.0.0') return false
    if (host.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

function safeFilename(url: string): string {
  return `evenpet-qr-${url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`
}
