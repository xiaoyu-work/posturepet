import { PET_TYPES, PET_LABELS, type PetType, type PreviewRenderModel } from './types'
import { lastNDays, loadLog, aggregateDaily, todayStat, type DailyStat } from './dashboard'
import { subscribeLog } from './logbus'

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
        <h2 class="dashboard-title">SLOUCH HISTORY</h2>
        <p class="dashboard-hero" data-hero>—</p>
        <h3 class="dashboard-subtitle">LAST 7 DAYS · slouching minutes per day</h3>
        <div class="history-chart" data-history></div>
      </section>

      <section class="debug-card">
        <h2 class="dashboard-title">LIVE DEBUG</h2>
        <div class="debug-grid">
          <div><span class="dlabel">IMU events</span><span class="dval" data-dbg-imu-count>0</span></div>
          <div><span class="dlabel">Last IMU (g)</span><span class="dval" data-dbg-imu-xyz>—</span></div>
          <div><span class="dlabel">IMU age (ms)</span><span class="dval" data-dbg-imu-age>—</span></div>
          <div><span class="dlabel">Deviation (°)</span><span class="dval" data-dbg-dev>—</span></div>
          <div><span class="dlabel">State</span><span class="dval" data-dbg-state>—</span></div>
          <div><span class="dlabel">Calibrated</span><span class="dval" data-dbg-cal>—</span></div>
          <div><span class="dlabel">Wearing</span><span class="dval" data-dbg-wearing>—</span></div>
          <div><span class="dlabel">Slouch (s)</span><span class="dval" data-dbg-slouch>0.0</span></div>
          <div><span class="dlabel">Toast</span><span class="dval" data-dbg-toast>idle</span></div>
        </div>
        <pre class="log-feed" data-dbg-log>waiting for events…</pre>
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
  const tiltEl = root.querySelector<HTMLElement>('[data-tilt]')!
  const wearingEl = root.querySelector<HTMLElement>('[data-wearing]')!
  const hero = root.querySelector<HTMLElement>('[data-hero]')!
  const history = root.querySelector<HTMLElement>('[data-history]')!
  const dbgImuCount = root.querySelector<HTMLElement>('[data-dbg-imu-count]')!
  const dbgImuXyz = root.querySelector<HTMLElement>('[data-dbg-imu-xyz]')!
  const dbgImuAge = root.querySelector<HTMLElement>('[data-dbg-imu-age]')!
  const dbgDev = root.querySelector<HTMLElement>('[data-dbg-dev]')!
  const dbgState = root.querySelector<HTMLElement>('[data-dbg-state]')!
  const dbgCal = root.querySelector<HTMLElement>('[data-dbg-cal]')!
  const dbgWearing = root.querySelector<HTMLElement>('[data-dbg-wearing]')!
  const dbgSlouch = root.querySelector<HTMLElement>('[data-dbg-slouch]')!
  const dbgToast = root.querySelector<HTMLElement>('[data-dbg-toast]')!
  const dbgLog = root.querySelector<HTMLElement>('[data-dbg-log]')!

  subscribeLog((lines) => {
    // Show newest at the bottom, last ~30 lines to keep the DOM cheap.
    const tail = lines.slice(-30)
    dbgLog.textContent = tail.join('\n')
    dbgLog.scrollTop = dbgLog.scrollHeight
  })

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
      hpReadout.textContent = `${Math.round(model.hp)} / 100`
      tiltEl.textContent = model.calibrated
        ? `tilt: ${Math.round(model.deviationDeg)}°`
        : 'tilt: calibrating'
      wearingEl.textContent = `wearing: ${model.wearing ? 'yes' : 'no'}`

      picker.querySelectorAll<HTMLButtonElement>('.pet-option').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.pet === model.petType)
      })

      const d = model.debug
      dbgImuCount.textContent = String(d.imuCount)
      dbgImuXyz.textContent = d.lastImu
        ? `${d.lastImu.x.toFixed(3)}, ${d.lastImu.y.toFixed(3)}, ${d.lastImu.z.toFixed(3)}`
        : '—'
      dbgImuAge.textContent = d.imuAgeMs === null ? '—' : Math.round(d.imuAgeMs).toString()
      dbgDev.textContent = model.calibrated ? model.deviationDeg.toFixed(1) : 'calibrating'
      dbgState.textContent = model.stateLabel
      dbgCal.textContent = model.calibrated ? 'yes' : 'no'
      dbgWearing.textContent = model.wearing ? 'yes' : 'no'
      dbgSlouch.textContent = (d.slouchMs / 1000).toFixed(1)
      dbgToast.textContent =
        d.toastStatus === 'cooldown'
          ? `cooldown ${Math.ceil(d.toastCooldownLeftMs / 1000)}s`
          : d.toastStatus
    },
    refreshDashboard() {
      const today = todayStat()
      hero.textContent = formatToday(today.slouchMinutes + today.sickMinutes, today.healthyMinutes)

      const stats = aggregateDaily(loadLog())
      const week = lastNDays(stats, 7)
      renderHistory(history, week)
    },
  }
}

function formatToday(slouchMin: number, healthyMin: number): string {
  const h = Math.floor(slouchMin / 60)
  const m = slouchMin % 60
  const slouchStr = h > 0 ? `${h}h ${m}min` : `${m}min`
  return `Today: slouched ${slouchStr} · good posture ${healthyMin}min`
}

function renderHistory(container: HTMLElement, stats: DailyStat[]): void {
  container.innerHTML = ''
  // Chart scale = worst slouch-minutes of the week, so the bars compare
  // against each other rather than a noisy total-wearing-time yardstick.
  const max = Math.max(1, ...stats.map((s) => s.slouchMinutes + s.sickMinutes))
  for (const stat of stats) {
    const bar = document.createElement('div')
    bar.className = 'history-bar'
    const slouch = stat.slouchMinutes + stat.sickMinutes
    const pct = (slouch / max) * 100
    bar.innerHTML = `
      <div class="history-stack">
        <div class="history-seg history-seg--slouch" style="height:${pct}%"></div>
      </div>
      <div class="history-day">${stat.day.slice(5)}</div>
      <div class="history-value">${slouch}</div>
    `
    bar.title = `${stat.day} · ${slouch} slouching min · ${stat.healthyMinutes} healthy min`
    container.append(bar)
  }
}
