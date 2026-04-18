import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'

import './styles.css'
import { initializeEvenBridge, formatDeviceStatus } from './app/bridge'
import { GlassesSceneUi } from './app/g2-ui'
import { isClickEvent, isDoubleClick, getEventType } from './app/input'
import { loadPetType, savePetType } from './app/petStorage'
import { PetRenderer } from './app/renderer'
import { createPreview, type PreviewController } from './app/preview'
import type { PetType } from './app/types'

const SCENE_WIDTH = 540
const SCENE_HEIGHT = 100

/** `shutDownPageContainer` exit modes are documented by the SDK as numeric codes.
 *  1 = show the standard "exit app" dialog on the glasses. */
const SHUTDOWN_EXIT_MODE_CONFIRM = 1

/** Minimum interval between G2 image pushes (ms). The G2 bridge cannot usefully
 *  consume frames faster than this and PNG encoding is expensive. */
const G2_PUSH_INTERVAL_MS = 100

class EvenPetApp {
  private readonly renderer = new PetRenderer(SCENE_WIDTH, SCENE_HEIGHT)
  private readonly preview: PreviewController

  private bridge: EvenAppBridge | null = null
  private glassesUi: GlassesSceneUi | null = null
  private visible = true
  private petType: PetType = loadPetType()
  private connectionLabel = 'Browser preview only'
  private lastPushedSignature = ''
  private lastG2PushAt = 0
  private pendingPush: Promise<void> | null = null
  private rafId = 0

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
      } catch {
        this.connectionLabel = 'Bridge ready'
      }

      this.bridge.onEvenHubEvent((event: EvenHubEvent) => {
        void this.handleEvent(event)
      })

      this.bridge.onDeviceStatusChanged((status) => {
        this.connectionLabel = formatDeviceStatus(status)
      })
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.startLoop()
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

  private async handleEvent(event: EvenHubEvent): Promise<void> {
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
    const frame = this.renderer.render(this.petType, this.visible, now)

    this.preview.render({
      visible: this.visible,
      petType: this.petType,
      sceneCanvas: frame.canvas,
      connectionLabel: this.connectionLabel,
    })

    if (!this.glassesUi) return
    if (frame.signature === this.lastPushedSignature) return
    if (now - this.lastG2PushAt < G2_PUSH_INTERVAL_MS) return
    if (this.pendingPush) return

    this.lastPushedSignature = frame.signature
    this.lastG2PushAt = now

    const ui = this.glassesUi
    this.pendingPush = ui
      .sync(frame.segments())
      .catch((err) => {
        console.error('G2 sync failed', err)
        this.connectionLabel = 'G2 sync error'
        // Force retry on next tick.
        this.lastPushedSignature = ''
      })
      .finally(() => {
        this.pendingPush = null
      })
  }
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('App root not found.')
void new EvenPetApp(root).start()
