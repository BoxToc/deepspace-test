/**
 * Economy server actions: building upgrades (+ a dev-only state setter).
 *
 * Every change runs inside `mutateCity`, which:
 *   1. reads the current revision,
 *   2. SETTLES elapsed time with server time (consumption + coins, once),
 *   3. validates against the settled numbers,
 *   4. commits the next revision — or retries if another change won.
 * So two simultaneous upgrades can never spend the same coins, and offline
 * earnings are counted exactly once no matter how many requests race.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { BUILDING_KEYS, BUILDINGS, MAX_BUILDING_LEVEL, type BuildingKey } from '../game/config'
import { checkUpgrade, settle } from '../game/economy'
import type { BuildingLevels } from '../game/types'
import { mutateCity } from './city-store'
import { serverNow } from './clock'
import { devToolsEnabled } from './devtools'
import { fail, ok } from './results'

const isBuilding = (v: unknown): v is BuildingKey => typeof v === 'string' && (BUILDING_KEYS as readonly string[]).includes(v)

export interface UpgradeResult {
  building: BuildingKey
  level: number
  cost: number
  coins: number
}

/**
 * Params: `{ building: 'power' | 'residential' | 'shop' | 'park', fromLevel: number }`.
 * `fromLevel` is the level the player saw; if the building is no longer at
 * that level (double click, another tab) the request is refused, not repeated.
 */
export const upgradeBuilding: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const building = params.building
  const fromLevel = Number(params.fromLevel)
  if (!isBuilding(building)) return fail('invalid_building', 'Unknown building.')
  if (!Number.isInteger(fromLevel) || fromLevel < 1 || fromLevel > MAX_BUILDING_LEVEL) {
    return fail('invalid_level', 'Missing or invalid current level.')
  }

  const now = await serverNow(env, tools, userId)
  const res = await mutateCity<UpgradeResult>(tools, userId, {
    reason: 'upgrade',
    refId: building,
    decide: (city) => {
      const s = settle(city, now)
      const check = checkUpgrade(city.buildings, s.coins, building, fromLevel)
      if (!check.ok) {
        const name = BUILDINGS[building].label
        const message = {
          max_level: `${name} is already at the highest level.`,
          insufficient_coins: `You need ${Math.ceil(check.missing ?? 0)} more coins.`,
          level_changed: `${name} was already upgraded.`,
        }[check.code]
        return { kind: 'refuse', refusal: fail(check.code, message, check.cost ? { cost: check.cost, missing: check.missing } : undefined) }
      }
      const coins = Math.round((s.coins - check.cost) * 10_000) / 10_000
      return {
        kind: 'change',
        patch: {
          electricity: s.electricity,
          coins,
          lastSettledAt: s.lastSettledAt,
          buildings: { ...city.buildings, [building]: check.toLevel },
        },
        meta: { from: fromLevel, to: check.toLevel, cost: check.cost },
        result: { building, level: check.toLevel, cost: check.cost, coins },
      }
    },
  })
  return res.success ? ok(res.data.result) : res
}

/**
 * DEV ONLY — put the caller's city into a known state for tests and
 * playtesting. Params (all optional): `{ electricity, coins, levels }`.
 * Refused outside local dev/test, like every dev tool.
 */
export const devSetCity: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (!devToolsEnabled(env)) return fail('dev_tools_disabled', 'Developer tools are disabled on this deployment.')
  const now = await serverNow(env, tools, userId)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  const levelsIn = (params.levels ?? {}) as Partial<Record<string, unknown>>
  const res = await mutateCity(tools, userId, {
    reason: 'dev_set',
    decide: (city) => {
      const buildings = { ...city.buildings } as BuildingLevels
      for (const k of BUILDING_KEYS) {
        const l = Number(levelsIn[k])
        if (Number.isInteger(l) && l >= 1 && l <= MAX_BUILDING_LEVEL) buildings[k] = l
      }
      return {
        kind: 'change',
        patch: {
          electricity: num(params.electricity) ?? city.electricity,
          coins: num(params.coins) ?? city.coins,
          buildings,
          lastSettledAt: now,
        },
        result: null,
      }
    },
  })
  return res.success ? ok({ city: res.data.city }) : res
}
