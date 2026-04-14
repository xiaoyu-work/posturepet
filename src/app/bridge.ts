import {
  DeviceConnectType,
  type DeviceStatus,
  type EvenAppBridge,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'

declare global {
  interface Window {
    EvenAppBridge?: EvenAppBridge
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

export async function initializeEvenBridge(timeoutMs = 6_000): Promise<EvenAppBridge | null> {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return await withTimeout(waitForEvenAppBridge(), timeoutMs)
  } catch (error) {
    console.warn('Even bridge unavailable, staying in browser preview mode.', error)
    return null
  }
}

export function formatDeviceStatus(status: DeviceStatus | null): string {
  if (!status) {
    return 'Glasses bridge connected'
  }

  switch (status.connectType) {
    case DeviceConnectType.Connected:
      return `G2 connected • ${status.batteryLevel ?? '?'}% battery`
    case DeviceConnectType.Connecting:
      return 'Connecting to G2…'
    case DeviceConnectType.Disconnected:
      return 'Bridge ready • glasses disconnected'
    case DeviceConnectType.ConnectionFailed:
      return 'Bridge ready • connection failed'
    case DeviceConnectType.None:
    default:
      return 'Bridge ready'
  }
}
