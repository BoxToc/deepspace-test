/**
 * Shared test client for DreamGrid's server actions (tests only).
 * Uses the real auth token of a signed-in Playwright page; dev-only actions
 * (devAdvanceClock, devSetCity, devInspect) work only against local dev.
 */
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export type Res<T = Record<string, unknown>> = { success: boolean; code?: string; error?: string; data: T }
export type Session = {
  status: string
  recordedMinutes: number
  creditedMinutes: number
  energyAwarded: number
  energyStored: number
  rewardDay: string
  rewardStatus: string
}
export type City = {
  electricity: number
  coins: number
  timezone: string
  activeSessionId: string
  lastRewardDay: string
  lastSettledAt: number
  buildings: Record<'power' | 'residential' | 'shop' | 'park', number>
}

/**
 * Revisions (newest first) must be strictly decreasing — no duplicates — and
 * the city must be AT the newest one, i.e. no older state is showing.
 * (Gaps are harmless; local dev data from before this scheme has one.)
 */
export function expectConsistentHistory(s: Inspection) {
  const revs = s.revisions.map((r) => r.revision)
  for (let i = 1; i < revs.length; i++) expect(revs[i - 1]).toBeGreaterThan(revs[i])
  expect(s.city.revision).toBe(revs[0] ?? 0)
}

export function client(page: Page) {
  let token: string | null = null
  async function call<T = Record<string, unknown>>(name: string, params: Record<string, unknown> = {}, auth = true) {
    if (auth && !token) {
      const r = await page.request.post('/api/auth/token', { headers: { 'Content-Type': 'application/json' } })
      token = ((await r.json()) as { token: string }).token
    }
    const res = await page.request.post(`/api/actions/${name}`, {
      headers: auth ? { Authorization: `Bearer ${token}` } : {},
      data: params,
    })
    return { status: res.status(), body: (res.status() === 200 ? await res.json() : null) as Res<T> }
  }
  const act = async <T = Record<string, unknown>>(name: string, params: Record<string, unknown> = {}) =>
    (await call<T>(name, params)).body
  const city = async () => {
    const r = await act<{ city: { data: City }; serverNow: number }>('initCity', { timezone: 'Europe/London' })
    expect(r.success, r.error).toBe(true)
    return { ...r.data.city.data, serverNow: r.data.serverNow }
  }
  const advance = async (minutes: number) => {
    const r = await act('devAdvanceClock', { minutes })
    expect(r.success, r.error).toBe(true)
  }
  /** Put the city into an exact state (dev only). Settled "now", so time-based changes start from here. */
  const setCity = async (state: { electricity?: number; coins?: number; levels?: Partial<City['buildings']> }) => {
    const r = await act('devSetCity', state)
    expect(r.success, r.error).toBe(true)
  }
  /**
   * Fresh state: no open session, last reward ≥ 2 days ago, and a known
   * economy (0 ⚡ so nothing is consumed while time is fast-forwarded,
   * 0 coins, every building at level 1) unless overridden.
   */
  const reset = async (state: Parameters<typeof setCity>[0] = {}) => {
    await city()
    await act('cancelSleep')
    await advance(2 * 24 * 60)
    await setCity({ electricity: 0, coins: 0, levels: { power: 1, residential: 1, shop: 1, park: 1 }, ...state })
  }
  /** Move the clock forward to the next HH:00 local time in the city's zone. */
  const alignTo = async (hour: number) => {
    const c = await city()
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: c.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(c.serverNow))
    const h = Number(parts.find((p) => p.type === 'hour')!.value)
    const m = Number(parts.find((p) => p.type === 'minute')!.value)
    let diff = (hour * 60 - (h * 60 + m) + 1440) % 1440
    if (diff === 0) diff = 1440
    await advance(diff)
  }
  /** Server-side state the client can't read (dev-only inspector). */
  const inspect = async (sessionId?: string) => {
    const r = await act<Inspection>('devInspect', sessionId ? { sessionId } : {})
    expect(r.success, r.error).toBe(true)
    return r.data
  }
  return { call, act, city, advance, setCity, reset, alignTo, inspect }
}

export type Inspection = {
  city: City & { revision: number; lastRewardedWakeAt: number }
  rewards: { sessionId: string; rewardDay: string; energy: number }[]
  closures: { sessionId: string; kind: string; rewardStatus: string }[]
  revisions: { revision: number; reason: string }[]
  session: (Session & { openSlot: string }) | null
}

