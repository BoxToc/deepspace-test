/**
 * Regression: the app owner (an admin) receives EVERY player's rows. The city
 * page used to show an arbitrary player's city (wrong time zone, wrong coins)
 * and other players' sleep sessions (dates months ahead from their dev
 * clocks). These selectors must always pick the signed-in player's data.
 */
import { describe, expect, it } from 'vitest'
import { createInitialCity } from './city'
import { selectOwnCity, selectOwnSessions } from './ownership'
import type { CityMutationData, SleepSessionData } from './types'

const base = (userId: string, timezone: string) => ({ recordId: `c-${userId}`, data: createInitialCity(userId, timezone, 0) })
const rev = (userId: string, revision: number, next: Record<string, unknown>) => ({
  recordId: `m-${userId}-${revision}`,
  data: { userId, revision, reason: 't', refId: '', meta: {}, next: { revision, ...next } } as CityMutationData,
})

// What an admin's subscription can deliver: three players, any order.
const cities = [base('carol', 'Europe/London'), base('owner', 'America/Chicago'), base('dave', 'Europe/London')]
const mutations = [
  rev('carol', 619, { coins: 149, timezone: 'Europe/London' }),
  rev('owner', 3, { coins: 50 }),
  rev('owner', 5, { coins: 12, timezone: 'America/Chicago' }),
  rev('dave', 92, { coins: 450 }),
  rev('owner', 4, { coins: 99 }),
]

describe('selectOwnCity', () => {
  it("picks the signed-in player's city and their newest revision, ignoring other players", () => {
    const own = selectOwnCity('owner', cities, mutations)
    expect(own?.recordId).toBe('c-owner')
    expect(own?.data).toMatchObject({ userId: 'owner', timezone: 'America/Chicago', coins: 12, revision: 5 })
  })

  it('falls back to the base row when the player has no revisions yet', () => {
    const own = selectOwnCity('owner', cities, mutations.filter((m) => m.data.userId !== 'owner'))
    expect(own?.data).toMatchObject({ userId: 'owner', timezone: 'America/Chicago', coins: 0, revision: 0 })
  })

  it('returns nothing when signed out or when the player has no city', () => {
    expect(selectOwnCity(null, cities, mutations)).toBeNull()
    expect(selectOwnCity('stranger', cities, mutations)).toBeNull()
  })
})

describe('selectOwnSessions', () => {
  const s = (userId: string, startedAt: number) => ({ recordId: `${userId}-${startedAt}`, data: { userId, startedAt } as SleepSessionData })
  it("returns only the player's sessions, newest first", () => {
    const rows = [s('carol', 900), s('owner', 100), s('carol', 950), s('owner', 300), s('owner', 200)]
    expect(selectOwnSessions('owner', rows).map((r) => r.data.startedAt)).toEqual([300, 200, 100])
    expect(selectOwnSessions('owner', rows, 2)).toHaveLength(2)
    expect(selectOwnSessions(undefined, rows)).toEqual([])
  })
})
