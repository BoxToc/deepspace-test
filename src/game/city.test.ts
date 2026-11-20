import { describe, expect, it } from 'vitest'
import { createInitialCity, isValidTimeZone, DEFAULT_TIMEZONE } from './city'
import {
  BATTERY_CAPACITY,
  BUILDING_KEYS,
  MAX_BUILDING_LEVEL,
  POWER_STATION_SLEEP_MULTIPLIER,
  STARTING_CITY,
  UPGRADE_COST_TO_LEVEL,
} from './config'

describe('isValidTimeZone', () => {
  it('accepts IANA zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
  })

  it('rejects junk', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
    expect(isValidTimeZone('x'.repeat(65))).toBe(false)
  })
})

describe('createInitialCity', () => {
  const now = 1_700_000_000_000

  it('starts every building at level 1 with starter resources', () => {
    const city = createInitialCity('user_1', 'Europe/London', now)
    expect(city).toEqual({
      userId: 'user_1',
      timezone: 'Europe/London',
      timezoneChangedAt: 0,
      electricity: STARTING_CITY.electricity,
      coins: STARTING_CITY.coins,
      lastSettledAt: now,
      activeSessionId: '',
      lastRewardDay: '',
      lastRewardedWakeAt: 0,
      buildings: { power: 1, residential: 1, shop: 1, park: 1 },
    })
  })

  it('falls back to UTC for an invalid zone', () => {
    expect(createInitialCity('u', 'Not/AZone', now).timezone).toBe(DEFAULT_TIMEZONE)
    expect(createInitialCity('u', undefined, now).timezone).toBe(DEFAULT_TIMEZONE)
  })

  it('starting charge fits in the level-1 battery', () => {
    expect(STARTING_CITY.electricity).toBeLessThanOrEqual(BATTERY_CAPACITY[1])
  })
})

describe('economy config is complete', () => {
  const levels = Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => i + 1)

  it('defines battery capacity and sleep multiplier for every power level', () => {
    for (const level of levels) {
      expect(BATTERY_CAPACITY[level]).toBeGreaterThan(0)
      expect(POWER_STATION_SLEEP_MULTIPLIER[level]).toBeGreaterThan(0)
    }
  })

  it('prices every upgrade, increasing with level', () => {
    let previous = 0
    for (const level of levels.slice(1)) {
      expect(UPGRADE_COST_TO_LEVEL[level]).toBeGreaterThan(previous)
      previous = UPGRADE_COST_TO_LEVEL[level]
    }
  })

  it('has exactly the four MVP buildings', () => {
    expect([...BUILDING_KEYS].sort()).toEqual(['park', 'power', 'residential', 'shop'])
  })
})
