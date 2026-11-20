import { describe, expect, it } from 'vitest'
import type { ActionContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createInitialCity } from '../game/city'
import type { CityData } from '../game/types'
import { loadCity, mutateCity } from './city-store'
import { upgradeBuilding } from './economy'
import { createFakeTools } from './fake-tools.test-helper'

const UNIQUE = { cities: ['userId'], city_mutations: ['userId', 'revision'], dev_clocks: ['userId'] }
const PROD_ENV = { PLATFORM_WORKER: {} as Fetcher, API_WORKER: {} as Fetcher } as Env

async function cityWith(coins: number, electricity = 0) {
  const fake = createFakeTools(UNIQUE)
  // Settled "now" with no energy, so no time-based income muddies the numbers.
  await fake.tools.create('cities', { ...createInitialCity('u1', 'UTC', Date.now()), coins, electricity })
  const ctx = (params: Record<string, unknown>): ActionContext<Env> => ({ userId: 'u1', params, tools: fake.tools, env: PROD_ENV, callerJwt: 'jwt' })
  const city = async () => ((await loadCity(fake.tools, 'u1')) as { data: { data: CityData } }).data.data
  return { ...fake, ctx, city }
}

describe('upgradeBuilding', () => {
  it('upgrades, charges the cost, and bumps the level', async () => {
    const { ctx, city } = await cityWith(150)
    const res = await upgradeBuilding(ctx({ building: 'shop', fromLevel: 1 }))
    expect(res).toMatchObject({ success: true, data: { building: 'shop', level: 2, cost: 100, coins: 50 } })
    expect(await city()).toMatchObject({ coins: 50, buildings: { shop: 2, residential: 1, power: 1, park: 1 } })
  })

  it('five simultaneous clicks on the same upgrade upgrade it once', async () => {
    const { ctx, city } = await cityWith(1000)
    const results = await Promise.all(Array.from({ length: 5 }, () => upgradeBuilding(ctx({ building: 'shop', fromLevel: 1 }))))
    expect(results.filter((r) => r.success)).toHaveLength(1)
    for (const r of results.filter((r) => !r.success)) expect(r).toMatchObject({ code: 'level_changed' })
    expect(await city()).toMatchObject({ coins: 900, buildings: { shop: 2 } })
  })

  it('simultaneous upgrades of different buildings never overspend', async () => {
    const { ctx, city } = await cityWith(250) // affords two of the three
    const results = await Promise.all(
      (['shop', 'residential', 'park'] as const).map((b) => upgradeBuilding(ctx({ building: b, fromLevel: 1 }))),
    )
    expect(results.filter((r) => r.success)).toHaveLength(2)
    expect(results.filter((r) => !r.success)[0]).toMatchObject({ code: 'insufficient_coins' })
    const c = await city()
    expect(c.coins).toBe(50)
    expect(Object.values(c.buildings).filter((l) => l === 2)).toHaveLength(2)
  })

  it('refuses insufficient funds, max level, and bad input without changing anything', async () => {
    const { ctx, city, rows } = await cityWith(99)
    expect(await upgradeBuilding(ctx({ building: 'shop', fromLevel: 1 }))).toMatchObject({ code: 'insufficient_coins', details: { missing: 1 } })
    expect(await upgradeBuilding(ctx({ building: 'castle', fromLevel: 1 }))).toMatchObject({ code: 'invalid_building' })
    expect(await upgradeBuilding(ctx({ building: 'shop' }))).toMatchObject({ code: 'invalid_level' })
    expect(rows('city_mutations')).toHaveLength(0)

    // Max level
    const top = await cityWith(9999)
    await mutateCity(top.tools, 'u1', { reason: 't', decide: () => ({ kind: 'change', patch: { buildings: { power: 3, residential: 3, shop: 3, park: 3 } }, result: null }) })
    expect(await upgradeBuilding(top.ctx({ building: 'park', fromLevel: 3 }))).toMatchObject({ code: 'max_level' })
    expect((await city()).coins).toBe(99)
  })

  it('counts coins earned since the last save before checking funds', async () => {
    const { tools, ctx } = await cityWith(90, 35)
    // Pretend the last save was 1 h ago: 18.7 coins earned since then → 108.7, enough.
    await mutateCity(tools, 'u1', { reason: 't', decide: () => ({ kind: 'change', patch: { lastSettledAt: Date.now() - 3_600_000 }, result: null }) })
    const res = await upgradeBuilding(ctx({ building: 'shop', fromLevel: 1 }))
    expect(res).toMatchObject({ success: true })
    expect((res as { data: UpgradeData }).data.coins).toBeCloseTo(8.7, 1)
  })
})

type UpgradeData = { coins: number }
