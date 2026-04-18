/**
 * IMU Spike — Phase 0 of Posture Pet.
 *
 * Goals:
 *   1. Learn the physical meaning of IMU_Report_Data.x/y/z (accel? gyro? euler?).
 *   2. Learn the actual sample rate of ImuReportPace.P100..P1000.
 *   3. Learn noise floor at rest and response magnitude to head pitch.
 *
 * Usage:
 *   npm run dev  →  open /imu-debug.html in the simulator or real glasses webview.
 *   (Browser-only mode shows the UI but no data; use the simulator for real signals.)
 */

import {
  CreateStartUpPageContainer,
  ImuReportPace,
  OsEventTypeList,
  TextContainerProperty,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'

import './imu-debug.css'
import { initializeEvenBridge } from './app/bridge'

type Sample = { t: number; x: number; y: number; z: number }

const WINDOW_MS = 3_000
const MAX_SAMPLES = 3_000
const GRAVITY = 9.80665

class RingBuffer {
  private readonly data: Sample[] = []

  push(sample: Sample): void {
    this.data.push(sample)
    if (this.data.length > MAX_SAMPLES) this.data.shift()
    const cutoff = sample.t - WINDOW_MS
    while (this.data.length > 1 && this.data[0].t < cutoff) this.data.shift()
  }

  clear(): void {
    this.data.length = 0
  }

  all(): readonly Sample[] {
    return this.data
  }

  latest(): Sample | undefined {
    return this.data[this.data.length - 1]
  }

  rate(): number {
    if (this.data.length < 2) return 0
    const span = this.data[this.data.length - 1].t - this.data[0].t
    return span > 0 ? ((this.data.length - 1) * 1000) / span : 0
  }

  stats(axis: 'x' | 'y' | 'z' | 'mag'): { min: number; max: number; mean: number; std: number } {
    if (this.data.length === 0) return { min: 0, max: 0, mean: 0, std: 0 }
    let min = Infinity
    let max = -Infinity
    let sum = 0
    const values: number[] = []
    for (const s of this.data) {
      const v = axis === 'mag' ? Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) : s[axis]
      if (v < min) min = v
      if (v > max) max = v
      sum += v
      values.push(v)
    }
    const mean = sum / values.length
    let sq = 0
    for (const v of values) sq += (v - mean) ** 2
    return { min, max, mean, std: Math.sqrt(sq / values.length) }
  }
}

class ImuDebugApp {
  private readonly ring = new RingBuffer()
  private readonly log: string[] = []

  /** Samples accumulated since the last upload. Unbounded — cleared on successful POST. */
  private readonly uploadBuffer: Sample[] = []
  private sessionId = `s-${new Date().toISOString().replace(/[:.]/g, '-')}`
  private uploadTimer: number | null = null
  private uploadInFlight = false
  private totalUploaded = 0
  private uploadEnabled = false

  private bridge: EvenAppBridge | null = null
  private imuOn = false
  private pace: ImuReportPace = ImuReportPace.P100
  private unsub: (() => void) | null = null
  private wearing: boolean | undefined = undefined
  private containerReady = false

  private readonly el = {
    status: null as unknown as HTMLElement,
    wearing: null as unknown as HTMLElement,
    graph: null as unknown as HTMLCanvasElement,
    log: null as unknown as HTMLElement,
    toggle: null as unknown as HTMLButtonElement,
    clear: null as unknown as HTMLButtonElement,
    export: null as unknown as HTMLButtonElement,
    pace: null as unknown as HTMLSelectElement,
    stream: null as unknown as HTMLInputElement,
    sendNow: null as unknown as HTMLButtonElement,
    upStats: null as unknown as HTMLElement,
    lanUrl: null as unknown as HTMLElement,
    stats: {} as Record<string, HTMLElement>,
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="panel" style="background: #0e2e1a; border-color: #1f5e33">
        <h2 style="color: #4ade80">当前地址（把这个 URL 输入到 Even App 的 webview）</h2>
        <div id="lan-url" style="font-family: ui-monospace, Menlo, monospace; font-size: 20px; font-weight: 600; color: #4ade80; word-break: break-all">—</div>
        <p class="hint" style="margin: 8px 0 0">
          手机/眼镜必须和电脑在<b>同一 Wi-Fi</b>。如果这个 URL 是 <code>localhost</code> 或 <code>127.0.0.1</code>，说明你现在在电脑上预览——请在终端里看启动日志里的局域网 IP，手工改成 <code>http://&lt;电脑IP&gt;:5173/imu-debug.html</code>。
        </p>
      </div>

      <div class="row" style="justify-content: space-between">
        <h1>IMU 调试 · 姿势宠物 第 0 阶段</h1>
        <div class="row">
          <span class="status" data-state="pending" id="status">连接中…</span>
          <span class="status" id="wearing">佩戴：?</span>
        </div>
      </div>

      <div class="panel">
        <h2>控制</h2>
        <div class="row">
          <label>上报档位
            <select id="pace">
              ${Object.entries(ImuReportPace)
                .filter(([k]) => k.startsWith('P'))
                .map(([k, v]) => `<option value="${v}">${k}</option>`)
                .join('')}
            </select>
          </label>
          <button id="toggle" class="primary">开启 IMU</button>
          <button id="clear">清空缓冲</button>
          <button id="export">浏览器导出 CSV</button>
        </div>
        <div class="row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border)">
          <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer">
            <input type="checkbox" id="stream" checked />
            自动上传到电脑（推荐，眼镜里看不到下载按钮）
          </label>
          <button id="send-now">立即上传</button>
          <span class="status" id="up-stats">已上传 0 条</span>
        </div>
        <p class="hint" style="margin: 10px 0 0">
          打开"自动上传"后，样本会每 1 秒增量写到电脑的 <code>imu-logs/${'{sessionId}'}.csv</code>。
          你在眼镜里什么都不用做，做完测试流程直接把电脑上的 CSV 文件给我就行。
        </p>
      </div>

      <div class="panel">
        <h2>实时数据（最近 3 秒窗口）</h2>
        <div class="stats" id="stats-grid">
          ${this.statCell('采样率', 'rate', '—', 'Hz')}
          ${this.statCell('|v| 合向量', 'mag', '—', '', 'axis-mag')}
          ${this.statCell('X 轴', 'x', '—', '', 'axis-x')}
          ${this.statCell('Y 轴', 'y', '—', '', 'axis-y')}
          ${this.statCell('Z 轴', 'z', '—', '', 'axis-z')}
        </div>
        <p class="hint" style="margin: 8px 2px 0">
          每格显示：<b>当前值</b>，μ = 3 秒均值，σ = 标准差（噪声），Δ = 最大-最小（动态范围）。
        </p>
        <div style="margin-top: 12px">
          <canvas class="graph" id="graph" width="1040" height="360"></canvas>
          <div class="legend" style="margin-top: 6px">
            <span class="axis-x">x 轴</span>
            <span class="axis-y">y 轴</span>
            <span class="axis-z">z 轴</span>
            <span class="axis-mag">|v| 合向量</span>
          </div>
          <p class="hint" style="margin: 6px 2px 0">
            图中虚线标出 <code>±g (9.8)</code> 参考线；静止时若有任意一轴贴近 ±g，基本可确认是加速度计。
          </p>
        </div>
      </div>

      <div class="panel">
        <h2>测试步骤（戴好眼镜，按顺序做）</h2>
        <ol class="hint" style="padding-left: 20px; margin: 0 0 10px">
          <li><b>确保"自动上传"已勾选</b>，然后 <b>开启 IMU</b>。</li>
          <li>平视前方保持 <b>5 秒静止</b>。观察三轴值、|v| 和 σ（噪声）。
            <br><span style="color:#8892a2">
              👉 目的：判断数据类型。|v| ≈ 9.8 → 加速度计含重力；|v| ≈ 1 → 加速度计以 g 为单位；三轴都 ≈ 0 → 陀螺仪或已去重力。
            </span>
          </li>
          <li>缓慢低头到 <b>大约 30°</b>（看手机那种角度），保持 3 秒。
            <br><span style="color:#8892a2">👉 观察哪个轴变化最明显，记下静止态到低头态的数值差。</span>
          </li>
          <li>继续低头到 <b>大约 60°</b>（看脚尖），保持 3 秒。
            <br><span style="color:#8892a2">👉 看变化幅度是否线性翻倍，决定后续算法。</span>
          </li>
          <li><b>点头 3 次</b>（快速上下）。</li>
          <li><b>摇头 3 次</b>（左右）。</li>
          <li><b>站起来走几步</b>。</li>
          <li>切到 <b>P1000</b> 档位，静止 3 秒，对比 P100 的采样率数字。</li>
          <li>停止 IMU。日志里会显示 <code>已上传 N 条</code>，去电脑的 <code>imu-logs/</code> 找 CSV 文件。</li>
        </ol>
      </div>

      <div class="panel">
        <h2>事件日志</h2>
        <div class="log" id="log">—</div>
      </div>
    `

    this.el.status = root.querySelector('#status')!
    this.el.wearing = root.querySelector('#wearing')!
    this.el.graph = root.querySelector<HTMLCanvasElement>('#graph')!
    this.el.log = root.querySelector('#log')!
    this.el.toggle = root.querySelector<HTMLButtonElement>('#toggle')!
    this.el.clear = root.querySelector<HTMLButtonElement>('#clear')!
    this.el.export = root.querySelector<HTMLButtonElement>('#export')!
    this.el.pace = root.querySelector<HTMLSelectElement>('#pace')!
    this.el.stream = root.querySelector<HTMLInputElement>('#stream')!
    this.el.sendNow = root.querySelector<HTMLButtonElement>('#send-now')!
    this.el.upStats = root.querySelector('#up-stats')!
    this.el.lanUrl = root.querySelector('#lan-url')!
    for (const key of ['rate', 'mag', 'x', 'y', 'z']) {
      this.el.stats[key] = root.querySelector(`[data-stat="${key}"]`)!
    }

    this.el.lanUrl.textContent = window.location.origin + '/imu-debug.html'

    this.el.toggle.addEventListener('click', () => void this.toggleImu())
    this.el.clear.addEventListener('click', () => {
      this.ring.clear()
      this.append('缓冲已清空')
    })
    this.el.export.addEventListener('click', () => this.exportCsv())
    this.el.pace.addEventListener('change', () => {
      this.pace = Number(this.el.pace.value) as ImuReportPace
      this.append(`档位切换 → P${this.pace}`)
      if (this.imuOn) void this.restartImu()
    })
    this.el.stream.addEventListener('change', () => {
      this.uploadEnabled = this.el.stream.checked
      if (this.uploadEnabled) {
        this.startUploadLoop()
        this.append('自动上传：开启')
      } else {
        this.stopUploadLoop()
        this.append('自动上传：关闭')
      }
    })
    this.el.sendNow.addEventListener('click', () => void this.flushUpload('manual'))
    this.uploadEnabled = this.el.stream.checked
    if (this.uploadEnabled) this.startUploadLoop()
    this.updateUploadStats()
  }

  async start(): Promise<void> {
    this.setStatus('连接中…', 'pending')
    this.bridge = await initializeEvenBridge()
    if (!this.bridge) {
      this.setStatus('浏览器预览（无桥接）', 'browser')
      this.el.toggle.disabled = true
      this.append('未检测到桥接 — 请在模拟器或 Even App 的 webview 里打开此页面。')
      this.renderLoop()
      return
    }
    this.setStatus('桥接已连接', 'live')
    this.append('桥接已连接')

    this.bridge.onDeviceStatusChanged((status) => {
      this.wearing = status.isWearing
      this.updateWearing()
      this.append(
        `设备状态：佩戴=${String(status.isWearing)} 电量=${status.batteryLevel ?? '?'} 连接=${status.connectType}`,
      )
    })

    try {
      const info = await this.bridge.getDeviceInfo()
      if (info?.status) {
        this.wearing = info.status.isWearing
        this.updateWearing()
      }
    } catch (e) {
      this.append(`getDeviceInfo 失败：${String(e)}`)
    }

    this.renderLoop()
  }

  private async ensureContainer(): Promise<void> {
    if (this.containerReady || !this.bridge) return
    // imuControl requires createStartUpPageContainer to have been called successfully.
    // Minimal single text container fulfils that without drawing anything.
    const code = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [
          new TextContainerProperty({
            containerID: 1,
            containerName: 'imu-host',
            xPosition: 100,
            yPosition: 220,
            width: 200,
            height: 50,
            borderWidth: 0,
            borderColor: 0,
            paddingLength: 0,
            isEventCapture: 0,
            content: 'IMU',
          }),
        ],
      }),
    )
    if (code !== 0) {
      throw new Error(`createStartUpPageContainer failed: ${code}`)
    }
    this.containerReady = true
    this.append('启动容器已创建')
  }

  private async toggleImu(): Promise<void> {
    if (!this.bridge) return
    this.el.toggle.disabled = true
    try {
      if (!this.imuOn) {
        try {
          await this.ensureContainer()
        } catch (e) {
          this.append(`容器创建失败（忽略并继续尝试 IMU）：${String(e)}`)
        }
        const ok = await this.bridge.imuControl(true, this.pace)
        if (!ok) throw new Error('imuControl(true) 返回 false')
        this.unsub = this.bridge.onEvenHubEvent((e) => this.onHubEvent(e))
        this.imuOn = true
        this.el.toggle.textContent = '停止 IMU'
        this.el.toggle.classList.remove('primary')
        this.append(`imuControl(true, P${this.pace}) 成功`)
      } else {
        await this.bridge.imuControl(false, ImuReportPace.P100)
        this.unsub?.()
        this.unsub = null
        this.imuOn = false
        this.el.toggle.textContent = '开启 IMU'
        this.el.toggle.classList.add('primary')
        this.append('imuControl(false) 成功')
      }
    } catch (err) {
      this.append(`IMU 切换失败：${String(err)}`)
    } finally {
      this.el.toggle.disabled = false
    }
  }

  private async restartImu(): Promise<void> {
    if (!this.bridge || !this.imuOn) return
    try {
      await this.bridge.imuControl(false, ImuReportPace.P100)
      const ok = await this.bridge.imuControl(true, this.pace)
      this.append(`以 P${this.pace} 重启 → ${ok}`)
    } catch (err) {
      this.append(`重启失败：${String(err)}`)
    }
  }

  private onHubEvent(event: EvenHubEvent): void {
    const imu = event.sysEvent?.imuData
    if (!imu) return
    const type = event.sysEvent?.eventType
    if (type !== undefined && type !== OsEventTypeList.IMU_DATA_REPORT) return
    const sample: Sample = {
      t: performance.now(),
      x: Number(imu.x ?? 0),
      y: Number(imu.y ?? 0),
      z: Number(imu.z ?? 0),
    }
    this.ring.push(sample)
    this.uploadBuffer.push(sample)
  }

  private startUploadLoop(): void {
    if (this.uploadTimer !== null) return
    this.uploadTimer = window.setInterval(() => {
      void this.flushUpload('auto')
    }, 1000)
  }

  private stopUploadLoop(): void {
    if (this.uploadTimer !== null) {
      window.clearInterval(this.uploadTimer)
      this.uploadTimer = null
    }
  }

  private async flushUpload(reason: 'auto' | 'manual'): Promise<void> {
    if (this.uploadInFlight) return
    if (this.uploadBuffer.length === 0) {
      if (reason === 'manual') this.append('暂无样本可上传')
      return
    }
    const batch = this.uploadBuffer.splice(0, this.uploadBuffer.length)
    this.uploadInFlight = true
    try {
      const res = await fetch('/api/imu-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: this.sessionId,
          pace: this.pace,
          note: reason,
          samples: batch,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.totalUploaded += batch.length
      if (reason === 'manual') this.append(`已上传 ${batch.length} 条（累计 ${this.totalUploaded}）`)
      this.updateUploadStats()
    } catch (err) {
      // Put the batch back at the front so it retries next tick.
      this.uploadBuffer.unshift(...batch)
      this.append(`上传失败：${String(err)}（稍后重试）`)
    } finally {
      this.uploadInFlight = false
    }
  }

  private updateUploadStats(): void {
    this.el.upStats.textContent = `已上传 ${this.totalUploaded} 条 · 队列 ${this.uploadBuffer.length}`
  }

  private renderLoop(): void {
    const tick = (): void => {
      this.drawGraph()
      this.updateStats()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  private updateStats(): void {
    const set = (key: string, value: string): void => {
      const node = this.el.stats[key]
      if (node) node.textContent = value
    }
    set('rate', this.ring.rate().toFixed(1))
    const mag = this.ring.stats('mag')
    set('mag', `${mag.mean.toFixed(2)} ±${mag.std.toFixed(2)}`)
    for (const axis of ['x', 'y', 'z'] as const) {
      const s = this.ring.stats(axis)
      const last = this.ring.latest()?.[axis] ?? 0
      set(axis, `${last.toFixed(2)}  (μ ${s.mean.toFixed(2)}, σ ${s.std.toFixed(3)}, Δ ${(s.max - s.min).toFixed(2)})`)
    }
    this.updateUploadStats()
  }

  private drawGraph(): void {
    const canvas = this.el.graph
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0b0d10'
    ctx.fillRect(0, 0, cssW, cssH)

    const samples = this.ring.all()
    if (samples.length < 2) {
      ctx.fillStyle = '#555'
      ctx.font = '12px -apple-system'
      ctx.fillText('等待 IMU 数据…', 16, 24)
      return
    }

    // Auto-scale across x/y/z/|v| with a small epsilon and ±gravity padding.
    let lo = Infinity
    let hi = -Infinity
    const mags: number[] = []
    for (const s of samples) {
      const m = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
      mags.push(m)
      lo = Math.min(lo, s.x, s.y, s.z, m)
      hi = Math.max(hi, s.x, s.y, s.z, m)
    }
    if (!isFinite(lo) || !isFinite(hi) || hi - lo < 0.1) {
      lo -= 1
      hi += 1
    } else {
      const pad = (hi - lo) * 0.1
      lo -= pad
      hi += pad
    }

    const t0 = samples[0].t
    const tN = samples[samples.length - 1].t
    const span = Math.max(1, tN - t0)

    const xOf = (t: number): number => ((t - t0) / span) * cssW
    const yOf = (v: number): number => cssH - ((v - lo) / (hi - lo)) * cssH

    // Gridlines
    ctx.strokeStyle = '#1c2028'
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * cssH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(cssW, y)
      ctx.stroke()
    }

    // Zero line
    if (lo < 0 && hi > 0) {
      ctx.strokeStyle = '#333'
      ctx.beginPath()
      const y = yOf(0)
      ctx.moveTo(0, y)
      ctx.lineTo(cssW, y)
      ctx.stroke()
    }
    // Gravity reference (±9.8) — useful for spotting accelerometer
    for (const g of [GRAVITY, -GRAVITY]) {
      if (g >= lo && g <= hi) {
        ctx.strokeStyle = '#2a3140'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        const y = yOf(g)
        ctx.moveTo(0, y)
        ctx.lineTo(cssW, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#475063'
        ctx.font = '10px ui-monospace, Menlo, monospace'
        ctx.fillText(`${g > 0 ? '+' : '-'}g`, 4, y - 3)
      }
    }

    const drawSeries = (color: string, fn: (s: Sample) => number): void => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]
        const px = xOf(s.t)
        const py = yOf(fn(s))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    drawSeries('#f87171', (s) => s.x)
    drawSeries('#60a5fa', (s) => s.y)
    drawSeries('#fbbf24', (s) => s.z)
    // Magnitude series
    ctx.strokeStyle = '#c084fc'
    ctx.lineWidth = 1.2
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    for (let i = 0; i < samples.length; i++) {
      const px = xOf(samples[i].t)
      const py = yOf(mags[i])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#475063'
    ctx.font = '10px ui-monospace, Menlo, monospace'
    ctx.fillText(`hi ${hi.toFixed(2)}`, 4, 12)
    ctx.fillText(`lo ${lo.toFixed(2)}`, 4, cssH - 4)
    ctx.fillText(`共 ${samples.length} 点 / ${(span / 1000).toFixed(2)} 秒`, cssW - 170, 12)
  }

  private exportCsv(): void {
    const samples = this.ring.all()
    if (samples.length === 0) {
      this.append('暂无数据可导出')
      return
    }
    const lines = ['t_ms,x,y,z,magnitude']
    const t0 = samples[0].t
    for (const s of samples) {
      const m = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
      lines.push(`${(s.t - t0).toFixed(1)},${s.x},${s.y},${s.z},${m.toFixed(4)}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imu-p${this.pace}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    this.append(`已导出 ${samples.length} 条样本`)
  }

  private setStatus(text: string, state: 'pending' | 'live' | 'browser' | 'error'): void {
    this.el.status.textContent = text
    this.el.status.setAttribute('data-state', state)
  }

  private updateWearing(): void {
    const label =
      this.wearing === undefined ? '佩戴：?' : this.wearing ? '佩戴：是' : '佩戴：否'
    this.el.wearing.textContent = label
  }

  private statCell(title: string, key: string, initial: string, unit = '', cls = ''): string {
    const val = unit ? `${initial} ${unit}` : initial
    return `<div><div class="label">${title}</div><div class="val ${cls}" data-stat="${key}">${val}</div></div>`
  }

  private append(line: string): void {
    const ts = new Date().toLocaleTimeString()
    this.log.push(`[${ts}] ${line}`)
    if (this.log.length > 200) this.log.shift()
    this.el.log.textContent = this.log.join('\n')
    this.el.log.scrollTop = this.el.log.scrollHeight
  }
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('root not found')
const app = new ImuDebugApp()
app.mount(root)
void app.start()
