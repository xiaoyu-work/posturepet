import { describe, expect, it } from 'vitest'
import { DeviceConnectType, type DeviceStatus } from '@evenrealities/even_hub_sdk'

import { formatDeviceStatus } from './bridge'

function status(overrides: Partial<DeviceStatus>): DeviceStatus {
  return { connectType: DeviceConnectType.None, ...overrides } as DeviceStatus
}

describe('formatDeviceStatus', () => {
  it('returns placeholder when no status is available', () => {
    expect(formatDeviceStatus(null)).toMatch(/connected/i)
  })

  it('shows battery level when connected', () => {
    expect(
      formatDeviceStatus(status({ connectType: DeviceConnectType.Connected, batteryLevel: 80 })),
    ).toContain('80%')
  })

  it('shows connecting label', () => {
    expect(formatDeviceStatus(status({ connectType: DeviceConnectType.Connecting }))).toMatch(/connecting/i)
  })

  it('shows disconnected label', () => {
    expect(formatDeviceStatus(status({ connectType: DeviceConnectType.Disconnected }))).toMatch(
      /disconnected/i,
    )
  })

  it('shows failed label', () => {
    expect(formatDeviceStatus(status({ connectType: DeviceConnectType.ConnectionFailed }))).toMatch(/failed/i)
  })
})
