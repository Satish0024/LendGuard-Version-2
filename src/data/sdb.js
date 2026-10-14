import { readSession, writeSession, INVESTMENT_KEY } from './participants'

// Demo default: show the opted-in variant until the participant (or the
// Prototype demo switch) saves a choice, so SDB screens are never empty.
const DEMO_DEFAULT = { enabled: true, separate: true, pending: [] }
export const SDB_EVENT = 'lg-sdb-change'

export function getSdb() {
  return readSession(INVESTMENT_KEY)?.sdb ?? DEMO_DEFAULT
}

export function setSdbDemo(enabled) {
  const inv = readSession(INVESTMENT_KEY) || {}
  writeSession(INVESTMENT_KEY, { ...inv, sdb: enabled ? DEMO_DEFAULT : { enabled: false } })
  window.dispatchEvent(new Event(SDB_EVENT))
}
