import { describe, expect, it } from 'vitest'
import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

import { getEventType, isClickEvent, isDoubleClick } from './input'

describe('input', () => {
  it('isClickEvent returns true only for CLICK_EVENT', () => {
    expect(isClickEvent(OsEventTypeList.CLICK_EVENT)).toBe(true)
    expect(isClickEvent(OsEventTypeList.DOUBLE_CLICK_EVENT)).toBe(false)
    expect(isClickEvent(undefined)).toBe(false)
  })

  it('isDoubleClick returns true only for DOUBLE_CLICK_EVENT', () => {
    expect(isDoubleClick(OsEventTypeList.DOUBLE_CLICK_EVENT)).toBe(true)
    expect(isDoubleClick(OsEventTypeList.CLICK_EVENT)).toBe(false)
    expect(isDoubleClick(undefined)).toBe(false)
  })

  it('getEventType extracts from the first populated payload', () => {
    const event = {
      textEvent: { eventType: OsEventTypeList.CLICK_EVENT },
    } as unknown as EvenHubEvent
    expect(getEventType(event)).toBe(OsEventTypeList.CLICK_EVENT)
    expect(getEventType({} as EvenHubEvent)).toBeUndefined()
  })
})
