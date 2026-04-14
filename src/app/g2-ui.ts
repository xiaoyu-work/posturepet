import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  TextContainerProperty,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

const IMAGE_CONTAINERS = [
  { id: 1, name: 'fish-1', x: 18 },
  { id: 2, name: 'fish-2', x: 198 },
  { id: 3, name: 'fish-3', x: 378 },
] as const

const INPUT_CONTAINER = {
  id: 4,
  name: 'fish-input',
}

export class GlassesFishUi {
  private started = false
  private lastSegments = ['', '', '']
  private imageQueue: Promise<void> = Promise.resolve()

  constructor(private readonly bridge: EvenAppBridge) {}

  async initialize(): Promise<void> {
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
      throw new Error(`Failed to create startup page. Result: ${result}`)
    }
    this.started = true
  }

  async sync(segments: string[]): Promise<void> {
    if (!this.started) {
      await this.initialize()
    }

    for (let i = 0; i < segments.length; i++) {
      if (this.lastSegments[i] === segments[i]) continue
      this.lastSegments[i] = segments[i]
      const target = IMAGE_CONTAINERS[i]
      if (target) {
        await this.enqueueImageUpdate(target.id, target.name, segments[i])
      }
    }
  }

  private enqueueImageUpdate(id: number, name: string, data: string): Promise<void> {
    this.imageQueue = this.imageQueue
      .catch(() => undefined)
      .then(async () => {
        const result = await this.bridge.updateImageRawData(
          new ImageRawDataUpdate({ containerID: id, containerName: name, imageData: data }),
        )
        if (result !== ImageRawDataUpdateResult.success) {
          console.warn('Image update failed.', name, result)
        }
      })
    return this.imageQueue
  }
}
