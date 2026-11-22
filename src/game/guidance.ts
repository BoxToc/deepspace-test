/**
 * Player guidance: what to do next and why. Pure and DISPLAY-ONLY.
 *
 * These read the same rules the server enforces (src/game/config.ts, time.ts)
 * to explain them up front — e.g. "this session won't earn energy because…".
 * They never decide rewards: the server re-checks everything on Wake Up.
 */

import { BUILDING_KEYS, SLEEP, type BuildingKey } from './config'
import { upgradeCost } from './economy'
import { alreadyRewardedOnLocalDay } from './time'
import type { BuildingLevels, CityData } from './types'

const HOUR = 3_600_000

export type SleepReadiness =
  /** A session started now can earn energy (if it lasts long enough). */
  | { kind: 'ready' }
  /** Too soon after the last rewarded wake-up: sessions started before `until` earn nothing. */
  | { kind: 'cooldown'; until: number }
  /** Today's reward is claimed; a session counts again when you wake up on a new local day. */
  | { kind: 'rewarded_today' }

export function sleepReadiness(
  city: Pick<CityData, 'lastRewardedWakeAt' | 'lastRewardDay' | 'timezone'>,
  now: number,
): SleepReadiness {
  if (city.lastRewardedWakeAt) {
    const until = city.lastRewardedWakeAt + SLEEP.minHoursBetweenRewards * HOUR
    if (now < until) return { kind: 'cooldown', until }
  }
  if (alreadyRewardedOnLocalDay(city, now, city.timezone)) return { kind: 'rewarded_today' }
  return { kind: 'ready' }
}

export interface UpgradeGoal {
  building: BuildingKey
  cost: number
  /** Coins still needed (0 = affordable now). */
  missing: number
}

/** The cheapest available upgrade (ties: config order), or null when everything is maxed. */
export function nextUpgradeGoal(levels: BuildingLevels, coins: number): UpgradeGoal | null {
  let best: UpgradeGoal | null = null
  for (const building of BUILDING_KEYS) {
    const cost = upgradeCost(levels[building])
    if (cost === null) continue
    if (!best || cost < best.cost) best = { building, cost, missing: Math.max(0, Math.ceil(cost - coins)) }
  }
  return best
}

export type GoalProgress =
  | { kind: 'affordable' }
  /** Reachable on stored power in `hours`. */
  | { kind: 'eta'; hours: number }
  /** The battery runs out first — more sleep needed. */
  | { kind: 'needs_power' }

/** How the player gets to `goal` from here, given income and hours of power left. */
export function goalProgress(goal: UpgradeGoal, coinsPerHour: number, hoursOfPower: number): GoalProgress {
  if (goal.missing <= 0) return { kind: 'affordable' }
  if (coinsPerHour <= 0 || hoursOfPower <= 0) return { kind: 'needs_power' }
  const hours = goal.missing / coinsPerHour
  return hours <= hoursOfPower ? { kind: 'eta', hours } : { kind: 'needs_power' }
}
