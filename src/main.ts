import { OsEventTypeList, type EvenAppBridge, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

import './styles.css'
import { initializeEvenBridge, formatDeviceStatus } from './app/bridge'
import { GlassesFishUi } from './app/g2-ui'
import { isClickEvent, isDoubleClick, getEventType } from './app/input'
import { PetRenderer } from './app/pixel-cat'
import { createPreview, type PreviewController } from './app/preview'
import type { PetType } from './app/types'

const STORAGE_KEY = 'evenpet:pet-type'

function loadPetType(): PetType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fish' || saved === 'jellyfish' || saved === 'turtle' || saved === 'butterfly') {
      return saved
    }
  } catch { /* ignore */ }
  return 'fish'
}

function savePetType(petType: PetType): void {
  try { localStorage.setItem(STORAGE_KEY, petType) } catch { /* ignore */ }
}

class EvenPetApp {
  private readonly renderer = new PetRenderer(540, 100)
  private readonly preview: PreviewController

  private bridge: EvenAppBridge | null = null
  private glassesUi: GlassesFishUi | null = null
  private visible = true
  private petType: PetType = loadPetType()
  private connectionLabel = 'Browser preview only'
  private lastUiSignature = ''

  constructor(root: HTMLElement) {
    this.preview = createPreview(root, {
      onToggle: () => {
        this.visible = !this.visible
        void this.render()
      },
      onPetSelect: (type: PetType) => {
        this.petType = type
        savePetType(type)
        void this.render()
      },
    })
  }

  async start(): Promise<void> {
    this.bridge = await initializeEvenBridge()

    if (this.bridge) {
      this.glassesUi = new GlassesFishUi(this.bridge)

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
        void this.render()
      })
    }

    await this.render()
    window.setInterval(() => void this.render(), 300)
  }

  private async handleEvent(event: EvenHubEvent): Promise<void> {
    const type = getEventType(event)

    if (isDoubleClick(type) && this.bridge) {
      await this.bridge.shutDownPageContainer(1)
      return
    }

    if (isClickEvent(type)) {
      this.visible = !this.visible
      await this.render()
    }
  }

  private async render(): Promise<void> {
    const now = Date.now()
    const frame = this.renderer.render(this.petType, this.visible, now)

    const sig = `${this.petType}|${this.visible}|${frame.step}|${this.connectionLabel}`
    if (sig === this.lastUiSignature) return
    this.lastUiSignature = sig

    this.preview.render({
      visible: this.visible,
      petType: this.petType,
      sceneCanvas: frame.canvas,
      connectionLabel: this.connectionLabel,
    })

    if (this.glassesUi) {
      try {
        await this.glassesUi.sync(frame.segments)
      } catch (e) {
        console.error('G2 sync failed', e)
      }
    }
  }
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('App root not found.')
void new EvenPetApp(root).start()
