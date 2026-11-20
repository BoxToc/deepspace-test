import { describe, expect, it } from 'vitest'
import { alreadyRewardedOnLocalDay, checkTimezoneChange, localDayKey, nextTimezoneChangeAt } from './time'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const utc = (iso: string) => Date.parse(iso)

describe('localDayKey', () => {
  it('uses the local calendar date, not UTC', () => {
    const t = utc('2026-03-02T03:00:00Z') // 22:00 on Mar 1 in New York
    expect(localDayKey(t, 'UTC')).toBe('2026-03-02')
    expect(localDayKey(t, 'America/New_York')).toBe('2026-03-01')
    expect(localDayKey(t, 'Asia/Tokyo')).toBe('2026-03-02')
  })

  it('assigns a session that crosses midnight to the wake-up day', () => {
    const wake = utc('2026-03-03T07:00:00Z') // slept 23:00 Mar 2 → woke 07:00 Mar 3 (London, GMT)
    expect(localDayKey(wake, 'Europe/London')).toBe('2026-03-03')
  })
})

describe('checkTimezoneChange', () => {
  const now = utc('2026-06-10T12:00:00Z')
  const base = { timezone: 'Europe/London', timezoneChangedAt: 0, activeSessionId: '' }

  it('allows the first change at any time', () => {
    expect(checkTimezoneChange(base, 'Asia/Tokyo', now)).toEqual({ ok: true })
  })

  it('refuses a no-op change', () => {
    expect(checkTimezoneChange(base, 'Europe/London', now)).toMatchObject({ ok: false, code: 'same_timezone' })
  })

  it('refuses while a sleep session is running', () => {
    expect(checkTimezoneChange({ ...base, activeSessionId: 's1' }, 'Asia/Tokyo', now)).toMatchObject({
      ok: false,
      code: 'session_active',
    })
  })

  it('enforces 7 days between changes', () => {
    const changedAt = now - 6 * DAY
    expect(checkTimezoneChange({ ...base, timezoneChangedAt: changedAt }, 'Asia/Tokyo', now)).toEqual({
      ok: false,
      code: 'cooldown',
      nextAllowedAt: changedAt + 7 * DAY,
    })
    expect(checkTimezoneChange({ ...base, timezoneChangedAt: now - 7 * DAY }, 'Asia/Tokyo', now)).toEqual({ ok: true })
  })

  it('reports when the next change opens', () => {
    expect(nextTimezoneChangeAt(0)).toBe(0)
    expect(nextTimezoneChangeAt(1000)).toBe(1000 + 7 * DAY)
  })
})

describe('alreadyRewardedOnLocalDay', () => {
  it('is false before any reward', () => {
    expect(alreadyRewardedOnLocalDay({ lastRewardedWakeAt: 0, lastRewardDay: '' }, Date.now(), 'UTC')).toBe(false)
  })

  it('blocks a second reward on the same local day', () => {
    const first = utc('2026-03-03T07:00:00Z')
    const city = { lastRewardedWakeAt: first, lastRewardDay: '2026-03-03' }
    expect(alreadyRewardedOnLocalDay(city, first + 10 * HOUR, 'UTC')).toBe(true)
    expect(alreadyRewardedOnLocalDay(city, first + DAY, 'UTC')).toBe(false)
  })

  it('cannot be dodged by moving east across the date line', () => {
    // Rewarded 07:00 Mar 3 in Honolulu (17:00 UTC). Player switches to Kiritimati (UTC+14),
    // where that same instant was already Mar 4 07:00. A wake at 20:00 Mar 4 there is
    // still the same local day as the last reward when both are read in the new zone.
    const first = utc('2026-03-03T17:00:00Z')
    const city = { lastRewardedWakeAt: first, lastRewardDay: localDayKey(first, 'Pacific/Honolulu') }
    const wake = utc('2026-03-04T06:00:00Z') // 20:00 Mar 4 in Kiritimati
    expect(localDayKey(wake, 'Pacific/Kiritimati')).toBe('2026-03-04')
    expect(alreadyRewardedOnLocalDay(city, wake, 'Pacific/Kiritimati')).toBe(true)
  })

  it('cannot be dodged by moving west', () => {
    // Rewarded 07:00 Mar 3 in Tokyo (22:00 Mar 2 UTC). Player switches to Honolulu, where
    // that instant reads as Mar 2 — so only the stored lastRewardDay ("2026-03-03") catches
    // a wake later on Mar 3 Honolulu time. This is why both checks exist.
    const first = utc('2026-03-02T22:00:00Z')
    const city = { lastRewardedWakeAt: first, lastRewardDay: '2026-03-03' }
    const wake = utc('2026-03-03T19:00:00Z') // 09:00 Mar 3 in Honolulu
    expect(alreadyRewardedOnLocalDay(city, wake, 'Pacific/Honolulu')).toBe(true)
  })
})
