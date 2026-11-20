/**
 * Record shapes for DreamGrid's collections. These describe `record.data`
 * (DeepSpace wraps every row in an envelope: { recordId, createdBy, data, ... }).
 */

import type { BuildingKey } from './config'

export type BuildingLevels = Record<BuildingKey, number>

/** One per player — enforced by `uniqueOn: ['userId']` in the schema. */
export interface CityData extends Record<string, unknown> {
  userId: string
  /** IANA zone (e.g. "Europe/London") — decides which local day a reward belongs to. */
  timezone: string
  /** Server time (ms) of the last time-zone change, or 0 if never changed. */
  timezoneChangedAt: number
  electricity: number
  coins: number
  /** Server time (ms) up to which consumption/production has been applied. */
  lastSettledAt: number
  /** Id of the running sleep session, or '' when awake. */
  activeSessionId: string
  /** Local date ("YYYY-MM-DD") of the last rewarded wake-up, or ''. */
  lastRewardDay: string
  /** Server time (ms) of the last rewarded wake-up, or 0. */
  lastRewardedWakeAt: number
  buildings: BuildingLevels
}

export type SleepStatus = 'active' | 'completed' | 'cancelled'

/**
 * Why a finished session did or did not pay out. "Recorded" time is simply
 * how long the session ran; it is NOT verified sleep. Only the rules below
 * decide what is credited.
 */
export type RewardStatus =
  | 'pending' // still running
  | 'rewarded'
  | 'too_short'
  | 'daily_limit'
  | 'cooldown'
  | 'cancelled'

export interface SleepSessionData extends Record<string, unknown> {
  userId: string
  status: SleepStatus
  /** Server time (ms). */
  startedAt: number
  /** Server time (ms), 0 while active. */
  endedAt: number
  /** Zone used to compute rewardDay (copied from the city at start). */
  timezone: string
  /** endedAt − startedAt, uncapped. */
  recordedMinutes: number
  /** Minutes that counted toward energy (step-rounded and capped). */
  creditedMinutes: number
  energyAwarded: number
  /** Local date of wake-up, "YYYY-MM-DD", or '' while active / cancelled. */
  rewardDay: string
  rewardStatus: RewardStatus
}
