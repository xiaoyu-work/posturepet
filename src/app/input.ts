import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

export function isClickEvent(eventType: OsEventTypeList | undefined): boolean {
  return eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined
}

export function isDoubleClick(eventType: OsEventTypeList | undefined): boolean {
  return eventType === OsEventTypeList.DOUBLE_CLICK_EVENT
}

export function getEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  if (event.textEvent) return event.textEvent.eventType
  if (event.listEvent) return event.listEvent.eventType
  if (event.sysEvent) return event.sysEvent.eventType
  return undefined
}
