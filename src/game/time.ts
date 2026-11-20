/**
 * Time-zone and local-day rules. Pure functions — callers pass server time.
 */

import { TIMEZONE } from './config'
import type { CityData } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Local calendar date "YYYY-MM-DD" of instant `ms` in zone `tz`. */
export function localDayKey(ms: number, tz: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

export type TimezoneChangeCheck =
  | { ok: true }
  | { ok: false; code: 'same_timezone' | 'session_active' | 'cooldown'; nextAllowedAt?: number }

/** Can this city switch to `nextTz` at server time `now`? (`nextTz` must already be valid.) */
export function checkTimezoneChange(
  city: Pick<CityData, 'timezone' | 'timezoneChangedAt' | 'activeSessionId'>,
  nextTz: string,
  now: number,
): TimezoneChangeCheck {
  if (city.timezone === nextTz) return { ok: false, code: 'same_timezone' }
  // A running session keeps the zone it started with; no mid-session switches.
  if (city.activeSessionId) return { ok: false, code: 'session_active' }
  const nextAllowedAt = nextTimezoneChangeAt(city.timezoneChangedAt)
  if (now < nextAllowedAt) return { ok: false, code: 'cooldown', nextAllowedAt }
  return { ok: true }
}

/** First server time a change is allowed (0 = any time). */
export function nextTimezoneChangeAt(timezoneChangedAt: number): number {
  if (!timezoneChangedAt) return 0
  return timezoneChangedAt + TIMEZONE.minDaysBetweenChanges * DAY_MS
}

/**
 * Has the player already been rewarded on the local day of `wakeAt`?
 *
 * Both instants are converted with the SAME (current) zone, so a time-zone
 * change can't make an already-rewarded day look like a new one. The stored
 * `lastRewardDay` (computed in the zone used at the time) is checked too, so
 * a reward blocks its day under either zone.
 */
export function alreadyRewardedOnLocalDay(
  city: Pick<CityData, 'lastRewardedWakeAt' | 'lastRewardDay'>,
  wakeAt: number,
  tz: string,
): boolean {
  if (!city.lastRewardedWakeAt) return false
  const wakeDay = localDayKey(wakeAt, tz)
  return wakeDay === localDayKey(city.lastRewardedWakeAt, tz) || wakeDay === city.lastRewardDay
}
