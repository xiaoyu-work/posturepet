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
import { log } from './app/logbus'

// Matches the single-image container width/height advertised by GlassesSceneUi
// — keep these in sync so the renderer produces pixels 1:1 to on-lens pixels
// (SDK won't scale; mismatched sizes = blurry pixel-art bars).
const SCENE_WIDTH = 288
const SCENE_HEIGHT = 100

/** `shutDownPageContainer` exit modes are documented by the SDK as numeric codes.
 *  1 = show the standard "exit app" dialog on the glasses. */
const SHUTDOWN_EXIT_MODE_CONFIRM = 1

/** Minimum interval between G2 image pushes (ms). Lower = smoother pet
 *  animation but harder on BLE. Now that the image container is a single
 *  288×100 cell (vs original 3 cells) and IMU is P100, 600 ms gives the
 *  fish ~3 tail-flap frames per second and still leaves BLE recoverable
 *  between writes. Raise back toward 1000+ if sendFailed recurs. */
const G2_PUSH_INTERVAL_MS = 600

/** If a sync fails entirely (past the per-image retry budget), let BLE cool
 *  down this long before the next attempt. */
const G2_RETRY_BACKOFF_MS = 2000

/** IMU pace on the glasses. Number = ms between reports. Each report is a
 *  BLE write, so there's a tradeoff with image-push airtime — but since the
 *  pet is now static (we only push when HP/MP/state change), the BLE link
 *  is mostly idle. P200 = 5 Hz gives 5× snappier posture response than the
 *  previous P1000 while still being well under the rate that previously
 *  triggered `sendFailed` on image pushes. */
const IMU_PACE = ImuReportPace.P100

/** Pop the "sit up" toast on the lens after this much continuous slouching. */
const TOAST_SLOUCH_TRIGGER_MS = 5_000

/** Keep the toast on screen for this long before auto-clearing, even if the
 *  user keeps slouching. A sticky toast becomes visual noise fast. */
const TOAST_DISPLAY_MS = 3_000

/** After a toast clears, don't re-pop until either the user straightens up
 *  or this much time passes — otherwise one stubborn slouch spawns the toast
 *  on every single tick. */
const TOAST_COOLDOWN_MS = 15_000

const TOAST_MESSAGE = 'SIT UP!'

/** Max samples retained in the xyz chart ring. Sized for a ~15 s window at
 *  the fastest IMU pace we realistically use (P100 = 10 Hz). */
const IMU_RING_SIZE = 150

/** How often to refresh the browser-side dashboard (ms). A full aggregation is
 *  cheap — this just limits how often we touch the DOM chart. */
const DASHBOARD_REFRESH_MS = 5_000

class EvenPetApp {
  private readonly renderer = new PetRenderer(SCENE_WIDTH, SCENE_HEIGHT)
  private readonly preview: PreviewController
  // calibrationMs defaults to 10 000 in the estimator; at P1000 (1 Hz) that
  // forces the user to sit still for ten seconds before the very first
  // reading is meaningful. 3 s (≈ 3 samples) is plenty — noisy neutral still
  // gives a consistent *relative* deviation, which is what the state
  // thresholds actually care about.
  private readonly estimator = new PostureEstimator({ calibrationMs: 3_000 })
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
  private slouchStartedAt: number | null = null
  private toastShownAt: number | null = null
  private toastCooldownUntil = 0
  private toastUpdating = false
  private imuCount = 0
  private lastImu: { t: number; x: number; y: number; z: number } | null = null
  private lastStateLogged: PostureSnapshot['state'] = 'calibrating'
  /** Rolling IMU window feeding the xyz chart in the browser preview. At
   *  P100 (10 Hz) 150 samples ≈ 15 s of history — long enough to spot a
   *  trend, short enough that the chart redraw stays cheap. */
  private readonly imuRing: { t: number; x: number; y: number; z: number }[] = []
  private posture: PostureSnapshot = {
    t: 0,
    deviationDeg: 0,
    calibrated: false,
    state: 'calibrating',
    slouchMs: 0,
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
    log('[BOOT] app start')
    this.bridge = await initializeEvenBridge()
    log(`[BOOT] bridge=${this.bridge ? 'ready' : 'browser-only'}`)

    if (this.bridge) {
      this.glassesUi = new GlassesSceneUi(this.bridge)

      try {
        const info = await this.bridge.getDeviceInfo()
        this.connectionLabel = formatDeviceStatus(info?.status ?? null)
        log(`[BOOT] getDeviceInfo.isWearing=${info?.status?.isWearing}`)
      } catch {
        this.connectionLabel = 'Bridge ready'
      }

      // On this user's G2 the SDK reports `isWearing: false` even while the
      // user clearly has the glasses on (IMU stream is live and gravity is
      // obviously aligned with a head tilt). Trusting `isWearing` leaves the
      // state machine stuck in `asleep` forever. So we ignore it and infer
      // "wearing" from IMU activity instead — first sample flips us awake.
      this.bridge.onEvenHubEvent((event: EvenHubEvent) => {
        this.handleImuEvent(event)
        void this.handleInputEvent(event)
      })

      this.bridge.onDeviceStatusChanged((status) => {
        this.connectionLabel = formatDeviceStatus(status)
        log(`[DEVICE] status change: isWearing=${status.isWearing} connectType=${status.connectType}`)
      })

      // Defer IMU bootstrap until we've proved the image pipeline is healthy
      // — starting an IMU stream right as the first image push fires seems to
      // race on the device and was eating the pet frame.
    } else {
      // Browser-only preview: skip the full posture pipeline and show the pet
      // as if the user were in a neutral pose. Real G2 data drives the actual
      // HP/mood; this is just so the UI is demoable without glasses.
      this.wearing = true
      this.posture = {
        t: 0,
        deviationDeg: 0,
        calibrated: true,
        state: 'healthy',
        slouchMs: 0,
      }
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
      const ok = await this.bridge.imuControl(true, IMU_PACE)
      log(`[IMU-CTL] imuControl(true, ${IMU_PACE}) -> ${ok}`)
      if (!ok) {
        log('[IMU-CTL] ⚠ imuControl returned false — posture will stay uncalibrated')
      }
    } catch (err) {
      log(`[IMU-CTL] ⚠ imuControl threw: ${String(err)}`)
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
    const sample = {
      t: now,
      x: Number(imu.x ?? 0),
      y: Number(imu.y ?? 0),
      z: Number(imu.z ?? 0),
    }
    // First IMU sample = we're receiving data = user is wearing the glasses.
    // Flip `wearing` to true here instead of waiting on `isWearing`, which
    // this user's G2 never reports true.
    if (!this.wearing) {
      this.wearing = true
      this.estimator.onWearOn(now)
      log('[WEAR] inferred wearing=true from first IMU sample (isWearing ignored)')
    }
    this.imuCount += 1
    this.lastImu = sample
    this.imuRing.push(sample)
    if (this.imuRing.length > IMU_RING_SIZE) this.imuRing.shift()
    const wasCalibrated = this.estimator.isCalibrated()
    const deviation = this.estimator.push(sample)
    if (!wasCalibrated && this.estimator.isCalibrated()) {
      log('[CALIBRATE] ✓ baseline captured — pose deviations now measurable')
    }
    this.posture = this.stateMachine.step({
      t: now,
      deviationDeg: deviation,
      wearing: this.wearing,
    })
    // Cheap every-sample log. At P1000 this is 1/sec. x/y/z printed in g.
    log(
      `[IMU #${this.imuCount}] x=${sample.x.toFixed(3)} y=${sample.y.toFixed(3)} z=${sample.z.toFixed(3)} | dev=${deviation === null ? 'null' : deviation.toFixed(1) + '°'} | state=${this.posture.state} | wearing=${this.wearing}`,
    )
    if (this.posture.state !== this.lastStateLogged) {
      log(`[STATE] ${this.lastStateLogged} -> ${this.posture.state}`)
      this.lastStateLogged = this.posture.state
    }
  }

  private evaluateToast(now: number): void {
    if (!this.glassesUi) return

    const slouching =
      this.posture.state === 'alert' ||
      this.posture.state === 'unwell' ||
      this.posture.state === 'sick'

    // Straightened up — reset counters, hide a lingering toast immediately.
    if (!slouching) {
      if (this.slouchStartedAt !== null) {
        log('[TOAST] straightened — reset slouch timer')
      }
      this.slouchStartedAt = null
      if (this.toastShownAt !== null) {
        this.hideToast('state-left-slouch')
      }
      return
    }

    if (this.slouchStartedAt === null) {
      this.slouchStartedAt = now
      log(`[TOAST] slouch started (state=${this.posture.state})`)
    }

    // Auto-hide after TOAST_DISPLAY_MS so a sustained slouch doesn't leave
    // the text lingering on the lens.
    if (this.toastShownAt !== null && now - this.toastShownAt >= TOAST_DISPLAY_MS) {
      this.hideToast('display-timeout')
      return
    }

    // Already showing, or cooling down from a recent pop.
    if (this.toastShownAt !== null) return
    if (now < this.toastCooldownUntil) return

    const slouchDuration = now - this.slouchStartedAt
    if (slouchDuration >= TOAST_SLOUCH_TRIGGER_MS) {
      this.showToast(now, slouchDuration)
    }
  }

  private showToast(now: number, slouchDuration: number): void {
    if (this.toastUpdating || !this.glassesUi) return
    this.toastUpdating = true
    this.toastShownAt = now
    log(`[TOAST] show after ${(slouchDuration / 1000).toFixed(1)}s slouch`)
    const ui = this.glassesUi
    ui.setToast(TOAST_MESSAGE)
      .then((ok) => {
        log(`[TOAST] setToast('${TOAST_MESSAGE}') -> ${ok}`)
        if (!ok) this.toastShownAt = null
      })
      .catch((err) => {
        log(`[TOAST] ⚠ show failed: ${String(err)}`)
        this.toastShownAt = null
      })
      .finally(() => {
        this.toastUpdating = false
      })
  }

  private hideToast(reason: string): void {
    if (this.toastUpdating || !this.glassesUi) return
    this.toastUpdating = true
    this.toastShownAt = null
    this.toastCooldownUntil = performance.now() + TOAST_COOLDOWN_MS
    log(`[TOAST] hide (${reason}); cooldown ${TOAST_COOLDOWN_MS / 1000}s`)
    const ui = this.glassesUi
    ui.setToast('')
      .then((ok) => {
        log(`[TOAST] clear -> ${ok}`)
      })
      .catch((err) => {
        log(`[TOAST] ⚠ clear failed: ${String(err)}`)
      })
      .finally(() => {
        this.toastUpdating = false
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

    this.evaluateToast(now)

    const frame = this.renderer.render({
      petType: this.petType,
      visible: this.visible,
      posture: this.posture,
      now,
    })

    const vitals = frame.vitals
    const toastStatus: 'showing' | 'cooldown' | 'idle' =
      this.toastShownAt !== null
        ? 'showing'
        : performance.now() < this.toastCooldownUntil
          ? 'cooldown'
          : 'idle'
    const toastCooldownLeftMs = Math.max(0, this.toastCooldownUntil - performance.now())
    const slouchMs = this.slouchStartedAt === null ? 0 : performance.now() - this.slouchStartedAt
    const imuAgeMs = this.lastImu === null ? null : performance.now() - this.lastImu.t

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
      // `toastShownAt !== null` is our single source of truth for "is the
      // glasses toast container currently non-empty" — mirror the same text
      // in the browser preview so the dev can see what the lens sees.
      toastContent: this.toastShownAt === null ? null : TOAST_MESSAGE,
      debug: {
        imuCount: this.imuCount,
        lastImu: this.lastImu,
        imuAgeMs,
        slouchMs,
        toastStatus,
        toastCooldownLeftMs,
        imuRing: this.imuRing,
      },
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
      .sync(frame.imageBytes(), frame.signature)
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
