/**
 * Sleep reward rules — pure. Given server times and the city's history,
 * decide what a finished session earns. No I/O; the wakeUp action persists it.
 *
 * Vocabulary (shown to players too):
 *   recorded  — how long the session ran (Start → Wake Up). NOT verified sleep.
 *   credited  — the part the rules accept: whole 15-min steps, capped at 10 h.
 *   energy    — credited hours × rate × power-station multiplier.
 */

import { BATTERY_CAPACITY, POWER_STATION_SLEEP_MULTIPLIER, SLEEP } from './config'
import { alreadyRewardedOnLocalDay, localDayKey } from './time'
import type { CityData, RewardStatus } from './types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export function recordedMinutes(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / MINUTE))
}

/** Whole credit steps, capped. Independent of eligibility. */
export function creditableMinutes(recorded: number): number {
  const steps = Math.floor(recorded / SLEEP.creditStepMinutes)
  return Math.min(steps * SLEEP.creditStepMinutes, SLEEP.maxCreditedMinutes)
}

export function sleepEnergy(credited: number, powerLevel: number): number {
  const multiplier = POWER_STATION_SLEEP_MULTIPLIER[powerLevel] ?? POWER_STATION_SLEEP_MULTIPLIER[1]
  return round2((credited / 60) * SLEEP.energyPerCreditedHour * multiplier)
}

export interface WakeEvaluation {
  recordedMinutes: number
  creditedMinutes: number
  energyAwarded: number
  rewardDay: string
  rewardStatus: Exclude<RewardStatus, 'pending' | 'cancelled'>
}

/**
 * Decide the outcome of waking up at `wakeAt`. Check order (first failure wins):
 *   1. too_short   — recorded < 60 min
 *   2. daily_limit — already rewarded on this local day (zone-change safe)
 *   3. cooldown    — started < 4 h after the previous rewarded wake-up
 *   4. rewarded
 * The session belongs to the local day of `wakeAt` in `timezone`, so a
 * 23:00 → 07:00 session counts for the morning's date.
 */
export function evaluateWake(input: {
  startedAt: number
  wakeAt: number
  timezone: string
  city: Pick<CityData, 'lastRewardedWakeAt' | 'lastRewardDay' | 'buildings'>
}): WakeEvaluation {
  const { startedAt, wakeAt, timezone, city } = input
  const recorded = recordedMinutes(startedAt, wakeAt)
  const rewardDay = localDayKey(wakeAt, timezone)
  const base = { recordedMinutes: recorded, rewardDay }
  const none = { ...base, creditedMinutes: 0, energyAwarded: 0 }

  if (recorded < SLEEP.minEligibleMinutes) return { ...none, rewardStatus: 'too_short' }
  if (alreadyRewardedOnLocalDay(city, wakeAt, timezone)) return { ...none, rewardStatus: 'daily_limit' }
  if (city.lastRewardedWakeAt && startedAt - city.lastRewardedWakeAt < SLEEP.minHoursBetweenRewards * HOUR) {
    return { ...none, rewardStatus: 'cooldown' }
  }

  const credited = creditableMinutes(recorded)
  return {
    ...base,
    creditedMinutes: credited,
    energyAwarded: sleepEnergy(credited, city.buildings?.power ?? 1),
    rewardStatus: 'rewarded',
  }
}

/** Add energy to the battery; anything above capacity is lost. */
export function chargeBattery(current: number, add: number, powerLevel: number) {
  const capacity = BATTERY_CAPACITY[powerLevel] ?? BATTERY_CAPACITY[1]
  const next = round2(Math.min(capacity, current + add))
  return { electricity: next, stored: round2(Math.max(0, next - current)) }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
