import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

const IMAGE_CONTAINERS = [
  { id: 1, name: 'pet-1', x: 18 },
  { id: 2, name: 'pet-2', x: 198 },
  { id: 3, name: 'pet-3', x: 378 },
] as const

const INPUT_CONTAINER = {
  id: 4,
  name: 'pet-input',
} as const

/** BLE throughput ceiling: G2's raw-image transport can't absorb back-to-back
 *  writes — we need a pause between container updates, otherwise the second
 *  one returns `sendfailed`. */
const IMAGE_INTER_PUSH_DELAY_MS = 120

/** Per-image retry budget. `sendfailed` is usually transient; 2 retries with
 *  exponential-ish backoff clears most of them. */
const IMAGE_RETRY_ATTEMPTS = 3
const IMAGE_RETRY_BACKOFF_MS = [0, 200, 500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GlassesSceneUi {
  private initPromise: Promise<void> | null = null
  private readonly lastSegments: [string, string, string] = ['', '', '']
  private imageQueue: Promise<void> = Promise.resolve()
  private sinceLastPush = 0

  constructor(private readonly bridge: EvenAppBridge) {}

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize()
    }
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    const textObject = [
      new TextContainerProperty({
        containerID: INPUT_CONTAINER.id,
        containerName: INPUT_CONTAINER.name,
        xPosition: 0,
        yPosition: 0,
        width: 1,
        height: 1,
        borderWidth: 0,
        borderColor: 0,
        paddingLength: 0,
        isEventCapture: 1,
        content: '',
      }),
    ]
    const imageObject = IMAGE_CONTAINERS.map(
      (c) =>
        new ImageContainerProperty({
          containerID: c.id,
          containerName: c.name,
          xPosition: c.x,
          yPosition: 94,
          width: 180,
          height: 100,
        }),
    )

    const createResult = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 4, textObject, imageObject }),
    )

    if (createResult === StartUpPageCreateResult.success) return

    // `invalid` typically means a container from a previous webview session is
    // still live on the device — switching to `rebuildPageContainer` replaces
    // that container in place with our new layout instead of refusing.
    if (createResult === StartUpPageCreateResult.invalid) {
      const rebuilt = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({ containerTotalNum: 4, textObject, imageObject }),
      )
      if (rebuilt) return
      this.initPromise = null
      throw new Error('Failed to create startup page (invalid), and rebuild was rejected.')
    }

    this.initPromise = null
    throw new Error(
      `Failed to create startup page. Result: ${createResult} (${StartUpPageCreateResult[createResult] ?? 'unknown'})`,
    )
  }

  async sync(segments: readonly string[]): Promise<void> {
    await this.initialize()

    for (let i = 0; i < IMAGE_CONTAINERS.length; i++) {
      const next = segments[i]
      if (next === undefined || this.lastSegments[i] === next) continue
      this.lastSegments[i] = next
      const target = IMAGE_CONTAINERS[i]
      this.enqueueImageUpdate(target.id, target.name, next)
    }

    // Surface any errors that accumulated on the queue.
    await this.imageQueue
  }

  private enqueueImageUpdate(id: number, name: string, data: string): void {
    this.imageQueue = this.imageQueue
      .catch(() => undefined)
      .then(async () => {
        // Space individual container updates so BLE has time to flush the
        // previous raw-image write before we queue the next one.
        if (this.sinceLastPush > 0) await sleep(IMAGE_INTER_PUSH_DELAY_MS)

        let lastError: unknown = null
        for (let attempt = 0; attempt < IMAGE_RETRY_ATTEMPTS; attempt++) {
          if (attempt > 0) await sleep(IMAGE_RETRY_BACKOFF_MS[attempt] ?? 500)
          try {
            const result = await this.bridge.updateImageRawData(
              new ImageRawDataUpdate({ containerID: id, containerName: name, imageData: data }),
            )
            if (result === ImageRawDataUpdateResult.success) {
              this.sinceLastPush = 1
              return
            }
            lastError = new Error(`Image update for ${name} returned ${result}`)
          } catch (err) {
            lastError = err
          }
        }
        throw new Error(
          `Image update failed for ${name} after ${IMAGE_RETRY_ATTEMPTS} attempts: ${String(lastError)}`,
        )
      })
  }
}
