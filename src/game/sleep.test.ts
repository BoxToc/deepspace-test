import { describe, expect, it } from 'vitest'
import { chargeBattery, creditableMinutes, evaluateWake, recordedMinutes, sleepEnergy } from './sleep'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const utc = (iso: string) => Date.parse(iso)
const fresh = { lastRewardedWakeAt: 0, lastRewardDay: '', buildings: { power: 1, residential: 1, shop: 1, park: 1 } }

describe('durations', () => {
  it('records whole minutes, never negative', () => {
    expect(recordedMinutes(0, 90 * MIN + 59_000)).toBe(90)
    expect(recordedMinutes(10 * MIN, 0)).toBe(0)
  })

  it('credits whole 15-minute steps, capped at 10 h', () => {
    expect(creditableMinutes(59)).toBe(45)
    expect(creditableMinutes(74)).toBe(60)
    expect(creditableMinutes(487)).toBe(480)
    expect(creditableMinutes(900)).toBe(600) // 15 h recorded → 10 h credited
  })
})

describe('sleepEnergy', () => {
  it('pays 10⚡ per credited hour, scaled by power-station level', () => {
    expect(sleepEnergy(60, 1)).toBe(10)
    expect(sleepEnergy(75, 1)).toBe(12.5)
    expect(sleepEnergy(480, 1)).toBe(80)
    expect(sleepEnergy(600, 1)).toBe(100)
    expect(sleepEnergy(600, 2)).toBe(120)
    expect(sleepEnergy(600, 3)).toBe(140)
  })
})

describe('evaluateWake', () => {
  const tz = 'Europe/London'

  it('rewards an 8 h night and assigns it to the wake-up date (crosses midnight)', () => {
    const startedAt = utc('2026-03-02T23:00:00Z')
    const wakeAt = utc('2026-03-03T07:10:00Z')
    expect(evaluateWake({ startedAt, wakeAt, timezone: tz, city: fresh })).toEqual({
      recordedMinutes: 490,
      creditedMinutes: 480,
      energyAwarded: 80,
      rewardDay: '2026-03-03',
      rewardStatus: 'rewarded',
    })
  })

  it('keeps the full recorded duration but caps the credit', () => {
    const startedAt = utc('2026-03-02T20:00:00Z')
    const r = evaluateWake({ startedAt, wakeAt: startedAt + 14 * HOUR, timezone: tz, city: fresh })
    expect(r).toMatchObject({ recordedMinutes: 840, creditedMinutes: 600, energyAwarded: 100, rewardStatus: 'rewarded' })
  })

  it('pays nothing under 60 minutes', () => {
    const startedAt = utc('2026-03-03T13:00:00Z')
    expect(evaluateWake({ startedAt, wakeAt: startedAt + 59 * MIN, timezone: tz, city: fresh })).toMatchObject({
      recordedMinutes: 59,
      creditedMinutes: 0,
      energyAwarded: 0,
      rewardStatus: 'too_short',
    })
  })

  it('allows exactly 60 minutes', () => {
    const startedAt = utc('2026-03-03T13:00:00Z')
    expect(evaluateWake({ startedAt, wakeAt: startedAt + 60 * MIN, timezone: tz, city: fresh }).rewardStatus).toBe('rewarded')
  })

  it('refuses a second reward on the same local day', () => {
    const firstWake = utc('2026-03-03T07:00:00Z')
    const city = { ...fresh, lastRewardedWakeAt: firstWake, lastRewardDay: '2026-03-03' }
    const startedAt = firstWake + 5 * HOUR // clears the 4 h gap
    expect(evaluateWake({ startedAt, wakeAt: startedAt + 2 * HOUR, timezone: tz, city })).toMatchObject({
      rewardStatus: 'daily_limit',
      energyAwarded: 0,
    })
  })

  it('enforces the 4 h gap even across midnight', () => {
    const firstWake = utc('2026-03-03T21:00:00Z') // rewarded late on Mar 3
    const city = { ...fresh, lastRewardedWakeAt: firstWake, lastRewardDay: '2026-03-03' }
    const startedAt = firstWake + 3 * HOUR // 00:00 Mar 4 — new day, but only 3 h later
    expect(evaluateWake({ startedAt, wakeAt: startedAt + 2 * HOUR, timezone: tz, city }).rewardStatus).toBe('cooldown')
    const later = firstWake + 4 * HOUR
    expect(evaluateWake({ startedAt: later, wakeAt: later + 2 * HOUR, timezone: tz, city }).rewardStatus).toBe('rewarded')
  })

  it('reports too_short before daily_limit', () => {
    const firstWake = utc('2026-03-03T07:00:00Z')
    const city = { ...fresh, lastRewardedWakeAt: firstWake, lastRewardDay: '2026-03-03' }
    const startedAt = firstWake + 6 * HOUR
    expect(evaluateWake({ startedAt, wakeAt: startedAt + 30 * MIN, timezone: tz, city }).rewardStatus).toBe('too_short')
  })
})

describe('chargeBattery', () => {
  it('adds energy up to capacity and reports what was stored', () => {
    expect(chargeBattery(20, 80, 1)).toEqual({ electricity: 100, stored: 80 })
    expect(chargeBattery(50, 80, 1)).toEqual({ electricity: 100, stored: 50 })
    expect(chargeBattery(50, 80, 2)).toEqual({ electricity: 130, stored: 80 })
  })
})
