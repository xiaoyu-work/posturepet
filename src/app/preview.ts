import { PET_TYPES, PET_LABELS, type PetType, type PreviewRenderModel } from './types'

export interface PreviewController {
  render(model: PreviewRenderModel): void
}

interface PreviewHandlers {
  onToggle: () => void
  onPetSelect: (petType: PetType) => void
}

export function createPreview(root: HTMLElement, handlers: PreviewHandlers): PreviewController {
  root.innerHTML = `
    <main class="app-shell">
      <div class="preview-frame">
        <canvas class="scene-canvas" data-scene-canvas></canvas>
      </div>

      <div class="pet-picker" data-picker></div>

      <div class="controls">
        <p class="connection-pill" data-connection></p>
        <button class="toggle-button" data-toggle type="button">Toggle</button>
      </div>

      <a class="debug-link" href="/imu-debug.html">IMU spike →</a>
    </main>
  `

  const canvas = root.querySelector<HTMLCanvasElement>('[data-scene-canvas]')!
  const picker = root.querySelector<HTMLElement>('[data-picker]')!
  const connection = root.querySelector<HTMLElement>('[data-connection]')!
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-toggle]')!

  for (const type of PET_TYPES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pet-option'
    button.dataset.pet = type
    button.textContent = PET_LABELS[type]
    button.addEventListener('click', () => handlers.onPetSelect(type))
    picker.append(button)
  }

  toggleButton.addEventListener('click', () => handlers.onToggle())

  return {
    render(model) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (canvas.width !== model.sceneCanvas.width) canvas.width = model.sceneCanvas.width
      if (canvas.height !== model.sceneCanvas.height) canvas.height = model.sceneCanvas.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(model.sceneCanvas, 0, 0)

      connection.textContent = model.connectionLabel
      toggleButton.textContent = model.visible ? 'Hide pet' : 'Wake pet'

      picker.querySelectorAll<HTMLButtonElement>('.pet-option').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.pet === model.petType)
      })
    },
  }
}
