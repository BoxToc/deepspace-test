import { describe, expect, it } from 'vitest'
import {
  batteryCapacity,
  buildingEffect,
  checkUpgrade,
  coinMultiplier,
  coinsPerHour,
  consumptionPerHour,
  hoursOfPowerLeft,
  settle,
  upgradeCost,
} from './economy'

const HOUR = 60 * 60 * 1000
const L1 = { power: 1, residential: 1, shop: 1, park: 1 }
const L3 = { power: 3, residential: 3, shop: 3, park: 3 }
const T0 = 1_800_000_000_000

describe('rates from the central config', () => {
  it('level 1 city: 3.5 ⚡/h, 18.7 coins/h, 100 ⚡ battery', () => {
    expect(consumptionPerHour(L1)).toBe(3.5) // houses 1 + shop 2 + park 0.5
    expect(coinMultiplier(L1)).toBe(1.1)
    expect(coinsPerHour(L1)).toBe(18.7) // (5 + 12) × 1.1
    expect(batteryCapacity(L1)).toBe(100)
  })

  it('level 3 city: 10.5 ⚡/h, 66.3 coins/h, 300 ⚡ battery', () => {
    expect(consumptionPerHour(L3)).toBe(10.5)
    expect(coinsPerHour(L3)).toBe(66.3) // (15 + 36) × 1.3
    expect(batteryCapacity(L3)).toBe(300)
  })

  it('the power station consumes nothing and adds no coins', () => {
    expect(consumptionPerHour({ ...L1, power: 3 })).toBe(3.5)
    expect(coinsPerHour({ ...L1, power: 3 })).toBe(18.7)
  })
})

describe('settle', () => {
  const city = { electricity: 35, coins: 10, lastSettledAt: T0, buildings: L1 }

  it('consumes energy and earns coins while powered', () => {
    const s = settle(city, T0 + 4 * HOUR)
    expect(s).toMatchObject({ electricity: 21, lastSettledAt: T0 + 4 * HOUR, poweredHours: 4, outageAt: null })
    expect(s.coins).toBeCloseTo(10 + 18.7 * 4, 6)
  })

  it('stops exactly when the battery runs out and never goes negative', () => {
    const s = settle(city, T0 + 30 * HOUR) // 35 ⚡ / 3.5 = 10 h of power
    expect(s.electricity).toBe(0)
    expect(s.poweredHours).toBe(10)
    expect(s.coins).toBeCloseTo(10 + 187, 6)
    expect(s.outageAt).toBe(T0 + 10 * HOUR)
  })

  it('earns nothing during an outage', () => {
    const s = settle({ ...city, electricity: 0 }, T0 + 50 * HOUR)
    expect(s).toMatchObject({ electricity: 0, coins: 10, poweredHours: 0 })
  })

  it('counts offline time exactly once: one long settle = many short ones', () => {
    const once = settle(city, T0 + 12 * HOUR)
    let step: typeof city = city
    for (let h = 1; h <= 12; h++) step = { ...step, ...settle(step, T0 + h * HOUR) }
    expect(step.electricity).toBeCloseTo(once.electricity, 6)
    expect(step.coins).toBeCloseTo(once.coins, 4)
  })

  it('is idempotent and never moves time backwards', () => {
    const s = settle(city, T0 + 2 * HOUR)
    const again = settle({ ...city, ...s }, T0 + 2 * HOUR)
    expect(again).toMatchObject({ electricity: s.electricity, coins: s.coins, lastSettledAt: s.lastSettledAt })
    const back = settle({ ...city, ...s }, T0 + HOUR)
    expect(back).toMatchObject({ electricity: s.electricity, coins: s.coins, lastSettledAt: s.lastSettledAt })
  })

  it('treats a missing timestamp as "start now"', () => {
    expect(settle({ ...city, lastSettledAt: 0 }, T0)).toMatchObject({ electricity: 35, coins: 10, lastSettledAt: T0 })
  })
})

describe('hoursOfPowerLeft', () => {
  it('divides stored energy by consumption', () => {
    expect(hoursOfPowerLeft({ electricity: 35, buildings: L1 })).toBe(10)
    expect(hoursOfPowerLeft({ electricity: 0, buildings: L1 })).toBe(0)
  })
})

describe('upgrades', () => {
  it('costs 100 to reach level 2 and 200 to reach level 3; none past 3', () => {
    expect(upgradeCost(1)).toBe(100)
    expect(upgradeCost(2)).toBe(200)
    expect(upgradeCost(3)).toBeNull()
  })

  it('allows an affordable upgrade from the level the player saw', () => {
    expect(checkUpgrade(L1, 100, 'shop', 1)).toEqual({ ok: true, cost: 100, toLevel: 2 })
  })

  it('refuses when short of coins, at max level, or when the level already changed', () => {
    expect(checkUpgrade(L1, 99.5, 'shop', 1)).toEqual({ ok: false, code: 'insufficient_coins', cost: 100, missing: 0.5 })
    expect(checkUpgrade(L3, 9999, 'shop', 3)).toEqual({ ok: false, code: 'max_level' })
    expect(checkUpgrade({ ...L1, shop: 2 }, 9999, 'shop', 1)).toEqual({ ok: false, code: 'level_changed' })
  })
})

describe('buildingEffect', () => {
  it('describes what each building does at a level', () => {
    expect(buildingEffect('power', 2).lines).toEqual(['Battery 200 ⚡', 'Sleep energy +20%'])
    expect(buildingEffect('residential', 2).lines).toEqual(['+10 coins/h', 'Uses 2 ⚡/h'])
    expect(buildingEffect('shop', 3).lines).toEqual(['+36 coins/h', 'Uses 6 ⚡/h'])
    expect(buildingEffect('park', 1).lines).toEqual(['+10% coins', 'Uses 0.5 ⚡/h'])
  })
})
