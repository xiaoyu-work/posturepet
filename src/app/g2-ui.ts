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

/**
 * G2 glasses UI = one 288×100 image container (the max width the SDK accepts
 * — see `ImageContainerProperty.width` range 20–288) plus one invisible text
 * container that captures tap input.
 *
 * We used to slice the 540-px-wide scene into three 180×100 containers to
 * widen the motion range. That tripled every frame into three independent
 * `updateImageRawData` calls, and G2's image pipeline is explicitly memory-
 * and rate-limited: SDK README states "Due to limited memory resources on
 * the glasses, avoid sending images too frequently", and the BLE transport
 * dropped the 2nd/3rd container of each frame with `sendFailed`. Collapsing
 * to a single container cuts BLE writes per frame by 3× and puts us well
 * inside the SDK's guidance.
 */

/** x,y,w,h of the image container. width maxes at 288 per SDK constraint.
 *  Centered horizontally on the 576-px G2 screen, top=94 keeps it in the same
 *  vertical band the previous multi-container layout used. */
const IMAGE_CONTAINER = {
  id: 1,
  name: 'pet-scene',
  x: 144,
  y: 94,
  width: 288,
  height: 100,
} as const

/** Hidden 1×1 text container used only for tap/gesture event capture. */
const INPUT_CONTAINER = {
  id: 2,
  name: 'pet-input',
} as const

/** Per-image retry budget — `sendFailed` is sometimes transient because BLE
 *  briefly filled up. Retries clear roughly 80 % of those in practice. */
const IMAGE_RETRY_ATTEMPTS = 3
const IMAGE_RETRY_BACKOFF_MS = [0, 250, 600]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GlassesSceneUi {
  private initPromise: Promise<void> | null = null
  private lastImageSignature = ''
  private pushQueue: Promise<void> = Promise.resolve()

  constructor(private readonly bridge: EvenAppBridge) {}

  /** Width the caller should render the scene at. Exposed so the renderer
   *  produces a canvas that matches the on-lens container exactly — scaling
   *  on the glasses side would blur the pixel-art bars. */
  get sceneWidth(): number {
    return IMAGE_CONTAINER.width
  }
  get sceneHeight(): number {
    return IMAGE_CONTAINER.height
  }

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
    const imageObject = [
      new ImageContainerProperty({
        containerID: IMAGE_CONTAINER.id,
        containerName: IMAGE_CONTAINER.name,
        xPosition: IMAGE_CONTAINER.x,
        yPosition: IMAGE_CONTAINER.y,
        width: IMAGE_CONTAINER.width,
        height: IMAGE_CONTAINER.height,
      }),
    ]

    const createResult = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 2, textObject, imageObject }),
    )

    if (createResult === StartUpPageCreateResult.success) return

    // `invalid` most commonly means a previous webview session left a startup
    // container alive — rebuild replaces it in place. SDK README §Rebuild:
    // "Use `rebuildPageContainer` to rebuild pages, even for the first page.
    //  Do not use `createStartUpPageContainer` again after the initial creation."
    if (createResult === StartUpPageCreateResult.invalid) {
      const rebuilt = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({ containerTotalNum: 2, textObject, imageObject }),
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

  async sync(imageBase64: string): Promise<void> {
    await this.initialize()

    if (!imageBase64 || imageBase64 === this.lastImageSignature) return
    this.lastImageSignature = imageBase64

    // SDK README: "Image transmission must not be sent concurrently - use a
    // queue mode, ensuring the previous image transmission returns
    // successfully before sending the next one." We chain every update
    // through a single-flight promise so a stuck send never overlaps.
    this.pushQueue = this.pushQueue.catch(() => undefined).then(() => this.pushImage(imageBase64))
    await this.pushQueue
  }

  private async pushImage(imageBase64: string): Promise<void> {
    let lastError: unknown = null
    for (let attempt = 0; attempt < IMAGE_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(IMAGE_RETRY_BACKOFF_MS[attempt] ?? 600)
      try {
        const result = await this.bridge.updateImageRawData(
          new ImageRawDataUpdate({
            containerID: IMAGE_CONTAINER.id,
            containerName: IMAGE_CONTAINER.name,
            imageData: imageBase64,
          }),
        )
        if (result === ImageRawDataUpdateResult.success) return
        lastError = new Error(`update returned ${result}`)
      } catch (err) {
        lastError = err
      }
    }
    // Reset signature so the next sync retries with a fresh frame.
    this.lastImageSignature = ''
    throw new Error(
      `Image update failed for ${IMAGE_CONTAINER.name} after ${IMAGE_RETRY_ATTEMPTS} attempts: ${String(lastError)}`,
    )
  }
}
