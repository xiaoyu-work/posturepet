import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
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

/** Visible text container used to pop a short "fix your posture" toast. Sits
 *  above the pet scene so it doesn't occlude the blinking HP/MP overlay. */
const TOAST_CONTAINER = {
  id: 3,
  name: 'pet-toast',
  x: 150,
  y: 40,
  width: 280,
  height: 40,
} as const

/** Per-image retry budget — `sendFailed` is sometimes transient because BLE
 *  briefly filled up. Per the official evenhub-templates image scaffold, a
 *  full frame takes 0.5–2 s on the wire, so retry backoff needs to be in
 *  the same order of magnitude or we retry into a still-busy pipe. */
const IMAGE_RETRY_ATTEMPTS = 3
const IMAGE_RETRY_BACKOFF_MS = [0, 800, 1500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GlassesSceneUi {
  private initPromise: Promise<void> | null = null
  private lastImageKey = ''
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
      new TextContainerProperty({
        containerID: TOAST_CONTAINER.id,
        containerName: TOAST_CONTAINER.name,
        xPosition: TOAST_CONTAINER.x,
        yPosition: TOAST_CONTAINER.y,
        width: TOAST_CONTAINER.width,
        height: TOAST_CONTAINER.height,
        borderWidth: 0,
        borderColor: 0,
        paddingLength: 0,
        isEventCapture: 0,
        // Empty at boot — we call textContainerUpgrade to pop and clear.
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

    // image (1) + hidden input-capture text (1) + visible toast text (1) = 3
    const createResult = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 3, textObject, imageObject }),
    )

    if (createResult === StartUpPageCreateResult.success) return

    // `invalid` most commonly means a previous webview session left a startup
    // container alive — rebuild replaces it in place. SDK README §Rebuild:
    // "Use `rebuildPageContainer` to rebuild pages, even for the first page.
    //  Do not use `createStartUpPageContainer` again after the initial creation."
    if (createResult === StartUpPageCreateResult.invalid) {
      const rebuilt = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({ containerTotalNum: 3, textObject, imageObject }),
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

  /** Fire-and-forget toast update. Text uses its own BLE channel
   *  (`textContainerUpgrade`) so it doesn't compete with image pushes in our
   *  single-flight image queue. `content === ''` clears the toast. */
  async setToast(content: string): Promise<void> {
    await this.initialize()
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: TOAST_CONTAINER.id,
        containerName: TOAST_CONTAINER.name,
        contentOffset: 0,
        contentLength: content.length,
        content,
      }),
    )
  }

  async sync(imageBytes: Uint8Array, signatureKey: string): Promise<void> {
    await this.initialize()

    if (!imageBytes.length || signatureKey === this.lastImageKey) return
    this.lastImageKey = signatureKey

    // SDK README: "Image transmission must not be sent concurrently - use a
    // queue mode, ensuring the previous image transmission returns
    // successfully before sending the next one." We chain every update
    // through a single-flight promise so a stuck send never overlaps.
    this.pushQueue = this.pushQueue.catch(() => undefined).then(() => this.pushImage(imageBytes))
    await this.pushQueue
  }

  private async pushImage(imageBytes: Uint8Array): Promise<void> {
    let lastError: unknown = null
    for (let attempt = 0; attempt < IMAGE_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(IMAGE_RETRY_BACKOFF_MS[attempt] ?? 1500)
      try {
        const result = await this.bridge.updateImageRawData(
          new ImageRawDataUpdate({
            containerID: IMAGE_CONTAINER.id,
            containerName: IMAGE_CONTAINER.name,
            // Match `even-realities/evenhub-templates/image` sample: pass raw
            // PNG bytes, not base64. Host serializer turns it into List<int>
            // directly (see SDK comment "`imageData`建议传 number[]（宿主
            // List<int> 最好接）") — one less decode step on device.
            imageData: imageBytes,
          }),
        )
        if (result === ImageRawDataUpdateResult.success) return
        lastError = new Error(`update returned ${result}`)
      } catch (err) {
        lastError = err
      }
    }
    // Reset signature so the next sync retries with a fresh frame.
    this.lastImageKey = ''
    throw new Error(
      `Image update failed for ${IMAGE_CONTAINER.name} after ${IMAGE_RETRY_ATTEMPTS} attempts: ${String(lastError)}`,
    )
  }
}
