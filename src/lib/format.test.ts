import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatSnoozeUntil } from './format'

// formatSnoozeUntil is deliberately dependent on this device's own timezone -
// that is the whole point, showing when the reminder comes back in the
// viewer's own local time - so these tests pin the process timezone to a
// known zone rather than whatever happens to run the suite.
describe('formatSnoozeUntil', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'Asia/Jerusalem'
  })

  afterEach(() => {
    process.env.TZ = originalTz
  })

  it('shows just the time when the snooze ends later the same local day', () => {
    // 20:30 in Asia/Jerusalem (UTC+2 in January) is 18:30 UTC.
    expect(formatSnoozeUntil('2026-01-10T18:30:00.000Z', '2026-01-10', 'he')).toBe('20:30')
  })

  it('names the day when the snooze crosses local midnight into tomorrow', () => {
    // 00:30 local on the 11th is 22:30 UTC on the 10th.
    expect(formatSnoozeUntil('2026-01-10T22:30:00.000Z', '2026-01-10', 'he')).toBe('מחר 00:30')
    expect(formatSnoozeUntil('2026-01-10T22:30:00.000Z', '2026-01-10', 'en')).toBe('tomorrow 00:30')
  })

  it('names a later day when the snooze is more than a day out', () => {
    expect(formatSnoozeUntil('2026-01-12T18:30:00.000Z', '2026-01-10', 'he')).toBe('מחרתיים 20:30')
  })
})
