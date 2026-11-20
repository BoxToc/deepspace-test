/**
 * Server time for game rules — and the dev-only simulated clock.
 *
 * Every action takes "now" from `serverNow()`. In production that is simply
 * Date.now(): the client never supplies a time, and the dev offset is never
 * even read. In local dev/test (see devToolsEnabled), a per-player offset
 * from `dev_clocks` is added so tests can fast-forward hours or days and then
 * run the REAL startSleep / wakeUp code. No dev path grants energy directly.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { devToolsEnabled } from './devtools'
import { fail, ok } from './results'

export { devToolsEnabled }

/** Largest single jump the dev clock accepts (prevents typos like 1e9). */
const MAX_ADVANCE_MINUTES = 60 * 24 * 30

async function loadDevClock(tools: ActionTools, userId: string) {
  const res = await tools.query<{ offsetMs: number }>('dev_clocks', { where: { userId }, limit: 1 })
  if (!res.success) return null
  const row = res.data.records[0]
  return row ? { recordId: row.recordId, offsetMs: Number(row.data.offsetMs) || 0 } : null
}

type ClockEnv = Parameters<typeof devToolsEnabled>[0]

/** Authoritative "now" for a caller. */
export async function serverNow(env: ClockEnv, tools: ActionTools, userId: string): Promise<number> {
  if (!devToolsEnabled(env)) return Date.now()
  const clock = await loadDevClock(tools, userId)
  return Date.now() + (clock?.offsetMs ?? 0)
}

const disabled = () => fail('dev_tools_disabled', 'Developer tools are disabled on this deployment.')

/** DEV ONLY. Params: `{ minutes: number }` (1 … 43 200). Moves this player's clock forward. */
export const devAdvanceClock: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (!devToolsEnabled(env)) return disabled()
  const minutes = Number(params.minutes)
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_ADVANCE_MINUTES) {
    return fail('invalid_minutes', `minutes must be between 1 and ${MAX_ADVANCE_MINUTES}.`)
  }
  const clock = await loadDevClock(tools, userId)
  const offsetMs = (clock?.offsetMs ?? 0) + Math.round(minutes) * 60_000
  const res = clock
    ? await tools.update('dev_clocks', clock.recordId, { offsetMs })
    : await tools.create('dev_clocks', { userId, offsetMs })
  if (!res.success) return res
  return ok({ offsetMs, now: Date.now() + offsetMs })
}

/** DEV ONLY. Current simulated offset for this player. */
export const devGetClock: ActionHandler<Env> = async ({ userId, tools, env }) => {
  if (!devToolsEnabled(env)) return disabled()
  const clock = await loadDevClock(tools, userId)
  const offsetMs = clock?.offsetMs ?? 0
  return ok({ offsetMs, now: Date.now() + offsetMs })
}

/**
 * DEV ONLY. The caller's own server-side state, for tests that need to see
 * records the client can't read (closures, reward claims, journal).
 * Params: `{ sessionId?: string }`.
 */
export const devInspect: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (!devToolsEnabled(env)) return disabled()
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
  const [city, rewards, closures, session] = await Promise.all([
    tools.query('cities', { where: { userId }, limit: 1 }),
    tools.query('energy_rewards', { where: sessionId ? { userId, sessionId } : { userId }, limit: 50 }),
    tools.query('session_closures', { where: sessionId ? { userId, sessionId } : { userId }, limit: 50 }),
    sessionId ? tools.get('sleep_sessions', sessionId) : Promise.resolve(null),
  ])
  const rows = <T,>(r: { success: boolean; data?: { records: { data: T }[] } }) =>
    r.success && r.data ? r.data.records.map((x) => x.data) : []
  return ok({
    city: rows(city)[0] ?? null,
    rewards: rows(rewards),
    closures: rows(closures),
    session:
      session && session.success && (session.data.record.data as { userId?: string }).userId === userId
        ? session.data.record.data
        : null,
  })
}
