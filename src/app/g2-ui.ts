import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
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

export class GlassesSceneUi {
  private initPromise: Promise<void> | null = null
  private readonly lastSegments: [string, string, string] = ['', '', '']
  private imageQueue: Promise<void> = Promise.resolve()

  constructor(private readonly bridge: EvenAppBridge) {}

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize()
    }
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 4,
        textObject: [
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
        ],
        imageObject: IMAGE_CONTAINERS.map(
          (c) =>
            new ImageContainerProperty({
              containerID: c.id,
              containerName: c.name,
              xPosition: c.x,
              yPosition: 94,
              width: 180,
              height: 100,
            }),
        ),
      }),
    )

    if (result !== 0) {
      // Reset so a later sync can retry initialization.
      this.initPromise = null
      throw new Error(`Failed to create startup page. Result: ${result}`)
    }
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
        const result = await this.bridge.updateImageRawData(
          new ImageRawDataUpdate({ containerID: id, containerName: name, imageData: data }),
        )
        if (result !== ImageRawDataUpdateResult.success) {
          throw new Error(`Image update failed for ${name}: ${result}`)
        }
      })
  }
}
