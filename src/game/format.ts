import { localDayKey } from './time'
import type { RewardStatus, SleepSessionData } from './types'

/** "2026-11-19" → "Thu, Nov 19" (the key is a calendar date, so format it in UTC to avoid shifting). */
export function formatDayKey(dayKey: string, locale?: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

/** The local day a session belongs to: its reward day, or (cancelled/ongoing) the day it ended or started, in its own zone. */
export function sessionDayKey(s: Pick<SleepSessionData, 'rewardDay' | 'endedAt' | 'startedAt' | 'timezone'>): string {
  return s.rewardDay || localDayKey(s.endedAt || s.startedAt, s.timezone || 'UTC')
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export function formatEnergy(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Player-facing explanation of a session's outcome. */
export const REWARD_LABELS: Record<RewardStatus, string> = {
  pending: 'In progress',
  rewarded: 'Rewarded',
  too_short: 'Too short (under 1 hour)',
  daily_limit: 'Already rewarded today',
  cooldown: 'Too soon after your last reward (4 h gap)',
  cancelled: 'Cancelled',
}
