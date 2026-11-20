/**
 * DreamGrid economy — pure functions over (city, server time). No I/O.
 *
 * The city stores a snapshot { electricity, coins, lastSettledAt }. Between
 * snapshots, everything follows from the building levels:
 *
 *   consumption  ⚡/h   = Σ energyPerHourPerLevel × level
 *   production   coins/h = (Σ coinsPerHourPerLevel × level) × (1 + park bonus)
 *
 * The city is powered while electricity > 0. `settle(city, now)` applies the
 * elapsed time: power runs for min(elapsed, electricity / consumption) hours,
 * electricity drops by exactly that much (never below 0), and coins accrue
 * only for those powered hours. The server settles inside every city change
 * (so offline time is counted exactly once); the browser runs the same
 * function every second to animate the dashboard.
 */

import {
  BATTERY_CAPACITY,
  BUILDING_KEYS,
  BUILDINGS,
  MAX_BUILDING_LEVEL,
  POWER_STATION_SLEEP_MULTIPLIER,
  UPGRADE_COST_TO_LEVEL,
  type BuildingKey,
} from './config'
import type { BuildingLevels, CityData } from './types'

const HOUR = 60 * 60 * 1000

type Levels = BuildingLevels

/** ⚡ per hour the whole city uses while powered. */
export function consumptionPerHour(levels: Levels): number {
  return round(BUILDING_KEYS.reduce((sum, k) => sum + BUILDINGS[k].energyPerHourPerLevel * (levels[k] ?? 1), 0))
}

/** City-wide coin multiplier from the park (1.1 at park level 1). */
export function coinMultiplier(levels: Levels): number {
  return round(1 + BUILDING_KEYS.reduce((sum, k) => sum + BUILDINGS[k].coinBonusPerLevel * (levels[k] ?? 1), 0))
}

/** Coins per hour while powered. */
export function coinsPerHour(levels: Levels): number {
  const base = BUILDING_KEYS.reduce((sum, k) => sum + BUILDINGS[k].coinsPerHourPerLevel * (levels[k] ?? 1), 0)
  return round(base * coinMultiplier(levels))
}

export function batteryCapacity(levels: Levels): number {
  return BATTERY_CAPACITY[levels.power] ?? BATTERY_CAPACITY[1]
}

export type EconomyState = Pick<CityData, 'electricity' | 'coins' | 'lastSettledAt' | 'buildings'>

export interface Settlement {
  electricity: number
  coins: number
  lastSettledAt: number
  /** Hours of the elapsed span the city had power. */
  poweredHours: number
  /** Server time the battery ran out during this span, or null. */
  outageAt: number | null
}

/**
 * Apply elapsed time up to `now`. Idempotent for a given `now` (settling twice
 * to the same instant changes nothing) and never moves time backwards.
 */
export function settle(city: EconomyState, now: number): Settlement {
  const from = city.lastSettledAt || now
  const electricity = Math.max(0, city.electricity)
  const coins = city.coins
  if (now <= from) return { electricity, coins, lastSettledAt: from, poweredHours: 0, outageAt: null }

  const elapsedHours = (now - from) / HOUR
  const usage = consumptionPerHour(city.buildings)
  const hoursAvailable = usage > 0 ? electricity / usage : electricity > 0 ? Infinity : 0
  const poweredHours = Math.min(elapsedHours, hoursAvailable)
  const ranOut = hoursAvailable < elapsedHours

  return {
    electricity: ranOut ? 0 : Math.max(0, round(electricity - usage * poweredHours)),
    coins: round(coins + coinsPerHour(city.buildings) * poweredHours),
    lastSettledAt: now,
    poweredHours,
    outageAt: ranOut && electricity > 0 ? Math.round(from + hoursAvailable * HOUR) : ranOut ? from : null,
  }
}

/** Hours until the battery is empty at the current levels (Infinity if nothing consumes). */
export function hoursOfPowerLeft(city: Pick<CityData, 'electricity' | 'buildings'>): number {
  const usage = consumptionPerHour(city.buildings)
  if (city.electricity <= 0) return 0
  return usage > 0 ? city.electricity / usage : Infinity
}

// ── Upgrades ───────────────────────────────────────────────────────────────

export function upgradeCost(currentLevel: number): number | null {
  return currentLevel >= MAX_BUILDING_LEVEL ? null : (UPGRADE_COST_TO_LEVEL[currentLevel + 1] ?? null)
}

export type UpgradeCheck =
  | { ok: true; cost: number; toLevel: number }
  | { ok: false; code: 'max_level' | 'insufficient_coins' | 'level_changed'; cost?: number; missing?: number }

/**
 * Can `building` go from `fromLevel` to the next level with these coins?
 * `fromLevel` is what the player saw when they pressed Upgrade — if the
 * building already moved on (double click, second tab), refuse instead of
 * upgrading twice.
 */
export function checkUpgrade(levels: Levels, coins: number, building: BuildingKey, fromLevel: number): UpgradeCheck {
  const level = levels[building]
  if (level !== fromLevel) return { ok: false, code: 'level_changed' }
  const cost = upgradeCost(level)
  if (cost === null) return { ok: false, code: 'max_level' }
  if (coins < cost) return { ok: false, code: 'insufficient_coins', cost, missing: round(cost - coins) }
  return { ok: true, cost, toLevel: level + 1 }
}

// ── What each level does (shown in the upgrade panel) ─────────────────────

export interface BuildingEffect {
  /** Short lines, e.g. "+12 coins/h", "Uses 2 ⚡/h". */
  lines: string[]
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function buildingEffect(building: BuildingKey, level: number): BuildingEffect {
  const spec = BUILDINGS[building]
  if (building === 'power') {
    const bonus = Math.round(((POWER_STATION_SLEEP_MULTIPLIER[level] ?? 1) - 1) * 100)
    return { lines: [`Battery ${BATTERY_CAPACITY[level] ?? BATTERY_CAPACITY[1]} ⚡`, `Sleep energy +${bonus}%`] }
  }
  const lines: string[] = []
  if (spec.coinsPerHourPerLevel) lines.push(`+${fmt(spec.coinsPerHourPerLevel * level)} coins/h`)
  if (spec.coinBonusPerLevel) lines.push(`+${Math.round(spec.coinBonusPerLevel * level * 100)}% coins`)
  if (spec.energyPerHourPerLevel) lines.push(`Uses ${fmt(spec.energyPerHourPerLevel * level)} ⚡/h`)
  return { lines }
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
