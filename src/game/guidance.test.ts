import { describe, expect, it } from 'vitest'
import { goalProgress, nextUpgradeGoal, sleepReadiness } from './guidance'

const H = 3_600_000
const tz = 'Europe/London'
// 2026-11-20 08:00 London (UTC+0 in November).
const morning = Date.UTC(2026, 10, 20, 8, 0)

describe('sleepReadiness', () => {
  it('is ready for a brand-new player', () => {
    expect(sleepReadiness({ lastRewardedWakeAt: 0, lastRewardDay: '', timezone: tz }, morning)).toEqual({ kind: 'ready' })
  })

  it('reports the 4-hour gap after a rewarded wake-up first', () => {
    const city = { lastRewardedWakeAt: morning, lastRewardDay: '2026-11-20', timezone: tz }
    expect(sleepReadiness(city, morning + 1 * H)).toEqual({ kind: 'cooldown', until: morning + 4 * H })
  })

  it('then says today is claimed, until the local day changes', () => {
    const city = { lastRewardedWakeAt: morning, lastRewardDay: '2026-11-20', timezone: tz }
    expect(sleepReadiness(city, morning + 5 * H)).toEqual({ kind: 'rewarded_today' })
    // 23:30 the same evening: still today.
    expect(sleepReadiness(city, morning + 15.5 * H)).toEqual({ kind: 'rewarded_today' })
    // 00:30 the next day: a new reward day.
    expect(sleepReadiness(city, morning + 16.5 * H)).toEqual({ kind: 'ready' })
  })

  it('uses the city time zone for "today"', () => {
    // Rewarded at 08:00 London = 17:00 Tokyo. At 01:00 London (10:00 Tokyo next day) a Tokyo city is on a new day.
    const city = { lastRewardedWakeAt: morning, lastRewardDay: '2026-11-20', timezone: 'Asia/Tokyo' }
    expect(sleepReadiness(city, morning + 17 * H)).toEqual({ kind: 'ready' })
  })
})

describe('nextUpgradeGoal', () => {
  const lv1 = { power: 1, residential: 1, shop: 1, park: 1 }

  it('picks the cheapest upgrade and what is missing', () => {
    expect(nextUpgradeGoal(lv1, 40)).toEqual({ building: 'power', cost: 100, missing: 60 })
    expect(nextUpgradeGoal({ ...lv1, power: 2 }, 150)).toEqual({ building: 'residential', cost: 100, missing: 0 })
  })

  it('returns null when every building is maxed', () => {
    expect(nextUpgradeGoal({ power: 3, residential: 3, shop: 3, park: 3 }, 0)).toBeNull()
  })
})

describe('goalProgress', () => {
  const goal = { building: 'shop' as const, cost: 100, missing: 50 }

  it('is affordable when nothing is missing', () => {
    expect(goalProgress({ ...goal, missing: 0 }, 0, 0)).toEqual({ kind: 'affordable' })
  })

  it('gives an ETA when stored power lasts long enough', () => {
    expect(goalProgress(goal, 25, 5)).toEqual({ kind: 'eta', hours: 2 })
  })

  it('asks for more sleep when the battery runs out first or is empty', () => {
    expect(goalProgress(goal, 25, 1)).toEqual({ kind: 'needs_power' })
    expect(goalProgress(goal, 0, 0)).toEqual({ kind: 'needs_power' })
  })
})
