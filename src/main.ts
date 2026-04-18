import {
  ImuReportPace,
  OsEventTypeList,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'

import './styles.css'
import { initializeEvenBridge, formatDeviceStatus } from './app/bridge'
import { GlassesSceneUi } from './app/g2-ui'
import { isClickEvent, isDoubleClick, getEventType } from './app/input'
import { loadPetType, savePetType } from './app/petStorage'
import { PetRenderer } from './app/renderer'
import { createPreview, type PreviewController } from './app/preview'
import type { PetType } from './app/types'
import { PostureEstimator } from './posture/estimator'
import { PostureStateMachine } from './posture/state'
import type { PostureSnapshot } from './posture/types'
import { MinuteSampler } from './app/dashboard'

// Matches the single-image container width/height advertised by GlassesSceneUi
// — keep these in sync so the renderer produces pixels 1:1 to on-lens pixels
// (SDK won't scale; mismatched sizes = blurry pixel-art bars).
const SCENE_WIDTH = 288
const SCENE_HEIGHT = 100

/** `shutDownPageContainer` exit modes are documented by the SDK as numeric codes.
 *  1 = show the standard "exit app" dialog on the glasses. */
const SHUTDOWN_EXIT_MODE_CONFIRM = 1

/** Minimum interval between G2 image pushes (ms). BLE to G2 + overlay PNG
 *  together cap reliable throughput at roughly 2 full-scene pushes per second.
 *  Below ~500 ms we reliably trigger `sendfailed` on one of the three images. */
const G2_PUSH_INTERVAL_MS = 500

/** If a sync fails entirely (past the per-image retry budget), hold off the
 *  next push by at least this long so BLE can recover. */
const G2_RETRY_BACKOFF_MS = 1200

/** How often to refresh the browser-side dashboard (ms). A full aggregation is
 *  cheap — this just limits how often we touch the DOM chart. */
const DASHBOARD_REFRESH_MS = 5_000

class EvenPetApp {
  private readonly renderer = new PetRenderer(SCENE_WIDTH, SCENE_HEIGHT)
  private readonly preview: PreviewController
  private readonly estimator = new PostureEstimator()
  private readonly stateMachine = new PostureStateMachine()
  private readonly sampler = new MinuteSampler()

  private bridge: EvenAppBridge | null = null
  private glassesUi: GlassesSceneUi | null = null
  private visible = true
  private petType: PetType = loadPetType()
  private connectionLabel = 'Browser preview only'
  private lastPushedSignature = ''
  private lastG2PushAt = 0
  private lastDashboardAt = 0
  private pendingPush: Promise<void> | null = null
  private rafId = 0
  private wearing = false
  private firstPushOk = false
  private syncFailures = 0
  private posture: PostureSnapshot = {
    t: 0,
    deviationDeg: 0,
    calibrated: false,
    state: 'calibrating',
  }

  constructor(root: HTMLElement) {
    this.preview = createPreview(root, {
      onToggle: () => {
        this.visible = !this.visible
      },
      onPetSelect: (type: PetType) => {
        this.petType = type
        savePetType(type)
      },
    })
  }

  async start(): Promise<void> {
    this.bridge = await initializeEvenBridge()

    if (this.bridge) {
      this.glassesUi = new GlassesSceneUi(this.bridge)

      try {
        const info = await this.bridge.getDeviceInfo()
        this.connectionLabel = formatDeviceStatus(info?.status ?? null)
        if (info?.status?.isWearing) {
          this.wearing = true
          this.estimator.onWearOn(performance.now())
        }
      } catch {
        this.connectionLabel = 'Bridge ready'
      }

      this.bridge.onEvenHubEvent((event: EvenHubEvent) => {
        this.handleImuEvent(event)
        void this.handleInputEvent(event)
      })

      this.bridge.onDeviceStatusChanged((status) => {
        this.connectionLabel = formatDeviceStatus(status)
        const nowWearing = Boolean(status.isWearing)
        if (nowWearing !== this.wearing) {
          this.wearing = nowWearing
          if (nowWearing) this.estimator.onWearOn(performance.now())
          else this.estimator.onWearOff()
        }
      })

      // Defer IMU bootstrap until we've proved the image pipeline is healthy
      // — starting an IMU stream right as the first image push fires seems to
      // race on the device and was eating the pet frame.
    } else {
      // Browser-only preview: skip the full posture pipeline and show the pet
      // as if the user were in a neutral pose. Real G2 data drives the actual
      // HP/mood; this is just so the UI is demoable without glasses.
      this.wearing = true
      this.posture = { t: 0, deviationDeg: 0, calibrated: true, state: 'healthy' }
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.startLoop()
    this.preview.refreshDashboard()
  }

  private imuBootstrapStarted = false

  private async bootstrapImu(): Promise<void> {
    if (this.imuBootstrapStarted || !this.bridge || !this.glassesUi) return
    this.imuBootstrapStarted = true
    try {
      const ok = await this.bridge.imuControl(true, ImuReportPace.P100)
      if (!ok) console.warn('imuControl(true) returned false; posture will stay uncalibrated')
    } catch (err) {
      console.warn('imuControl failed; posture will stay uncalibrated', err)
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopLoop()
    } else if (!this.rafId) {
      this.startLoop()
    }
  }

  private startLoop(): void {
    const tick = (): void => {
      this.rafId = requestAnimationFrame(tick)
      this.renderTick()
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  private handleImuEvent(event: EvenHubEvent): void {
    const imu = event.sysEvent?.imuData
    if (!imu) return
    const type = event.sysEvent?.eventType
    if (type !== undefined && type !== OsEventTypeList.IMU_DATA_REPORT) return
    const now = performance.now()
    const deviation = this.estimator.push({
      t: now,
      x: Number(imu.x ?? 0),
      y: Number(imu.y ?? 0),
      z: Number(imu.z ?? 0),
    })
    this.posture = this.stateMachine.step({
      t: now,
      deviationDeg: deviation,
      wearing: this.wearing,
    })
  }

  private async handleInputEvent(event: EvenHubEvent): Promise<void> {
    const type = getEventType(event)

    if (isDoubleClick(type) && this.bridge) {
      await this.bridge.shutDownPageContainer(SHUTDOWN_EXIT_MODE_CONFIRM)
      return
    }

    if (isClickEvent(type)) {
      this.visible = !this.visible
    }
  }

  private renderTick(): void {
    const now = performance.now()

    // Even without an IMU event this tick, advance the state machine so the
    // "sick" timer ticks and "asleep" flips on wear-off.
    if (this.bridge) {
      this.posture = this.stateMachine.step({
        t: now,
        deviationDeg: this.estimator.isCalibrated() ? this.posture.deviationDeg : null,
        wearing: this.wearing,
      })
    }

    this.sampler.tick({
      ts: Date.now(),
      pitch: this.posture.deviationDeg,
      state: this.posture.state,
      wearing: this.wearing,
    })

    const frame = this.renderer.render({
      petType: this.petType,
      visible: this.visible,
      posture: this.posture,
      now,
    })

    const vitals = frame.vitals
    this.preview.render({
      visible: this.visible,
      petType: this.petType,
      sceneCanvas: frame.canvas,
      connectionLabel: this.connectionLabel,
      hp: vitals.hp,
      mood: vitals.mood,
      moodLabel: vitals.label,
      moodEmoji: vitals.emoji,
      stateLabel: this.posture.state,
      deviationDeg: this.posture.deviationDeg,
      calibrated: this.posture.calibrated,
      wearing: this.wearing,
    })

    if (now - this.lastDashboardAt > DASHBOARD_REFRESH_MS) {
      this.lastDashboardAt = now
      this.preview.refreshDashboard()
    }

    if (!this.glassesUi) return
    if (frame.signature === this.lastPushedSignature) return
    if (now - this.lastG2PushAt < G2_PUSH_INTERVAL_MS) return
    if (this.pendingPush) return

    this.lastPushedSignature = frame.signature
    this.lastG2PushAt = now

    const ui = this.glassesUi
    this.pendingPush = ui
      .sync(frame.imageBase64())
      .then(() => {
        this.syncFailures = 0
        if (!this.firstPushOk) {
          this.firstPushOk = true
          // IMU stream is started only after the pet is actually on the lens,
          // so its startup doesn't race with the first image push.
          void this.bootstrapImu()
        }
      })
      .catch((err) => {
        this.syncFailures += 1
        const msg = err instanceof Error ? err.message : String(err)
        console.error('G2 sync failed', err)
        this.connectionLabel = `G2 sync error [${this.syncFailures}]: ${msg.slice(0, 90)}`
        // Force retry on next tick, but back off to let BLE recover.
        this.lastPushedSignature = ''
        this.lastG2PushAt = performance.now() + G2_RETRY_BACKOFF_MS - G2_PUSH_INTERVAL_MS
      })
      .finally(() => {
        this.pendingPush = null
      })
  }
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('App root not found.')
void new EvenPetApp(root).start()
