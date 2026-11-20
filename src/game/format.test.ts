import { describe, expect, it } from 'vitest'
import { formatDayKey, formatMinutes, sessionDayKey } from './format'

describe('formatDayKey', () => {
  it('formats a calendar date without shifting it by time zone', () => {
    expect(formatDayKey('2026-11-19', 'en-US')).toBe('Thu, Nov 19')
    expect(formatDayKey('2026-01-01', 'en-US')).toBe('Thu, Jan 1')
  })
})

describe('sessionDayKey', () => {
  const base = { timezone: 'America/Chicago', startedAt: Date.parse('2026-11-19T20:00:00Z'), endedAt: 0, rewardDay: '' }
  it('uses the reward day when there is one', () => {
    expect(sessionDayKey({ ...base, rewardDay: '2026-11-20' })).toBe('2026-11-20')
  })
  it('falls back to the local end (or start) date in the session zone — same format either way', () => {
    // 03:00 UTC on Nov 20 is still Nov 19 in Chicago.
    expect(sessionDayKey({ ...base, endedAt: Date.parse('2026-11-20T03:00:00Z') })).toBe('2026-11-19')
    expect(sessionDayKey(base)).toBe('2026-11-19')
  })
})

describe('formatMinutes', () => {
  it('shows hours and minutes', () => {
    expect(formatMinutes(487)).toBe('8h 7m')
    expect(formatMinutes(45)).toBe('45m')
  })
})
