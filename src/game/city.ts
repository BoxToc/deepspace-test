/**
 * Pure helpers for the player's city record. No I/O — the server action
 * decides when to call these and persists the result.
 */

import { BUILDING_KEYS, STARTING_CITY } from './config'
import type { BuildingLevels, CityData } from './types'

export const DEFAULT_TIMEZONE = 'UTC'

/** True when `tz` is an IANA zone this runtime understands. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function startingBuildings(): BuildingLevels {
  return Object.fromEntries(
    BUILDING_KEYS.map((key) => [key, STARTING_CITY.buildingLevel]),
  ) as BuildingLevels
}

/** The state of a brand-new city. `now` is server time. */
export function createInitialCity(userId: string, timezone: unknown, now: number): CityData {
  return {
    userId,
    timezone: isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE,
    timezoneChangedAt: 0,
    electricity: STARTING_CITY.electricity,
    coins: STARTING_CITY.coins,
    lastSettledAt: now,
    activeSessionId: '',
    lastRewardDay: '',
    lastRewardedWakeAt: 0,
    buildings: startingBuildings(),
  }
}
