/**
 * DreamGrid economy configuration — the ONLY place balance numbers live.
 *
 * Shared by the worker (server actions are the authority) and the browser
 * (display / previews only). Change a number here, redeploy, done.
 *
 * Units:
 *   ⚡ energy  — stored in the city's battery, spent by buildings over time
 *   coins     — produced by powered buildings, spent on upgrades
 *   time      — milliseconds on the wire, minutes/hours in these constants
 */

export const BUILDING_KEYS = ['power', 'residential', 'shop', 'park'] as const
export type BuildingKey = (typeof BUILDING_KEYS)[number]

export const MAX_BUILDING_LEVEL = 3

// ── Sleep → energy (generation) ────────────────────────────────────────────

export const SLEEP = {
  /** Sessions shorter than this earn nothing (still recorded). */
  minEligibleMinutes: 60,
  /** Credit is counted in whole steps of this size (rounded down). */
  creditStepMinutes: 15,
  /** Energy is calculated on at most this many minutes. The recorded
   *  duration is kept as-is; only the credited duration is capped. */
  maxCreditedMinutes: 600,
  /** Base energy per credited hour, before the power-station bonus. */
  energyPerCreditedHour: 10,
  /** At most this many rewarded sessions per local calendar day. A session
   *  belongs to the local day on which the player woke up. */
  rewardsPerLocalDay: 1,
  /** Minimum gap between the previous rewarded wake-up and the start of the
   *  next rewarded session. */
  minHoursBetweenRewards: 4,
} as const

/** Power-station level → multiplier on sleep energy. */
export const POWER_STATION_SLEEP_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.4,
}

/** Power-station level → battery capacity (⚡). Energy above the cap is lost. */
export const BATTERY_CAPACITY: Record<number, number> = {
  1: 100,
  2: 200,
  3: 300,
}

// ── Buildings: consumption and production (per hour, per level) ───────────

export interface BuildingSpec {
  label: string
  /** ⚡ consumed per hour per level while the city has power. */
  energyPerHourPerLevel: number
  /** Coins produced per hour per level while the city has power. */
  coinsPerHourPerLevel: number
  /** Added to the city-wide coin multiplier per level (park only). */
  coinBonusPerLevel: number
}

export const BUILDINGS: Record<BuildingKey, BuildingSpec> = {
  power: { label: 'Power Station', energyPerHourPerLevel: 0, coinsPerHourPerLevel: 0, coinBonusPerLevel: 0 },
  residential: { label: 'Houses', energyPerHourPerLevel: 1, coinsPerHourPerLevel: 5, coinBonusPerLevel: 0 },
  shop: { label: 'Shop', energyPerHourPerLevel: 2, coinsPerHourPerLevel: 12, coinBonusPerLevel: 0 },
  park: { label: 'Park', energyPerHourPerLevel: 0.5, coinsPerHourPerLevel: 0, coinBonusPerLevel: 0.1 },
}

// ── Upgrades ───────────────────────────────────────────────────────────────

/** Coins needed to reach a level (same for every building in the MVP). */
export const UPGRADE_COST_TO_LEVEL: Record<number, number> = {
  2: 100,
  3: 200,
}

// ── Time zone ──────────────────────────────────────────────────────────────

export const TIMEZONE = {
  /** A player may change their saved time zone at most once per this many
   *  days (the zone set when the city is created doesn't count as a change). */
  minDaysBetweenChanges: 7,
} as const

// ── New player ─────────────────────────────────────────────────────────────

export const STARTING_CITY = {
  /** A little starter charge so the city is lit on the first visit. */
  electricity: 20,
  coins: 0,
  buildingLevel: 1,
} as const
