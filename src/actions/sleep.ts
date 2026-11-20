/**
 * Sleep server actions: startSleep, wakeUp, cancelSleep.
 *
 * Server-authoritative: times come from `serverNow()`, rewards from the pure
 * rules in src/game/sleep.ts. The client sends no parameters (dev builds may
 * send `__devFault`, which production ignores).
 *
 * Built on two SDK-guaranteed atomic operations — a single-row insert that
 * `uniqueOn` can refuse, and a single-record update:
 *
 *   sleep_sessions   (userId, openSlot='open') → one open session per player
 *   session_closures (sessionId)               → Wake Up XOR Cancel decides
 *   energy_rewards   (userId, rewardDay)       → one paid reward per local day
 *   city_mutations   (userId, revision)        → serialized city changes
 *
 * Closing a session is DECIDE then FINISH:
 *   decide  — insert the closure row (the whole outcome, computed once).
 *   finish  — (1) claim the day's reward, (2) apply it to the city via
 *             mutateCity, (3) finalize the session row.
 * Every finish step is idempotent, so any later request — a retry, the other
 * button, or the next Start Sleep — completes a close that crashed midway
 * (roll-forward recovery). Nothing is ever rolled back.
 */

import type { ActionContext, ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { chargeBattery, evaluateWake, recordedMinutes } from '../game/sleep'
import type { EnergyRewardData, RewardStatus, SleepSessionData } from '../game/types'
import { findMutation, loadCity, mutateCity } from './city-store'
import { serverNow } from './clock'
import { devFault, type FaultPoint } from './devtools'
import { fail, ok } from './results'

type SessionRecord = { recordId: string; data: SleepSessionData }

export interface SessionClosureData extends Record<string, unknown> {
  userId: string
  sessionId: string
  kind: 'wake' | 'cancel'
  endedAt: number
  recordedMinutes: number
  creditedMinutes: number
  energyAwarded: number
  rewardDay: string
  rewardStatus: Exclude<RewardStatus, 'pending'>
}
type ClosureRecord = { recordId: string; data: SessionClosureData }

export interface CloseResult {
  sessionId: string
  session: SleepSessionData
  /** False when another request decided this session's outcome. */
  decidedHere: boolean
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Load a session and confirm it belongs to `userId` (tools bypass RBAC). */
async function loadOwnSession(tools: ActionTools, userId: string, sessionId: string): Promise<SessionRecord | null> {
  const res = await tools.get<SleepSessionData>('sleep_sessions', sessionId)
  if (!res.success || res.data.record.data.userId !== userId) return null
  return { recordId: sessionId, data: res.data.record.data }
}

async function findOpenSession(tools: ActionTools, userId: string): Promise<SessionRecord | null> {
  const res = await tools.query<SleepSessionData>('sleep_sessions', { where: { userId, openSlot: 'open' }, limit: 1 })
  const row = res.success ? res.data.records[0] : undefined
  return row ? { recordId: row.recordId, data: row.data } : null
}

async function loadClosure(tools: ActionTools, userId: string, sessionId: string): Promise<ClosureRecord | null> {
  const res = await tools.query<SessionClosureData>('session_closures', { where: { userId, sessionId }, limit: 1 })
  const row = res.success ? res.data.records[0] : undefined
  return row ? { recordId: row.recordId, data: row.data } : null
}

const injected = (point: FaultPoint) => fail('injected_fault', `Simulated failure ${point} (dev only).`)

// ── Resolve the active session (with self-repair) ─────────────────────────

type Resolved =
  | { kind: 'none' }
  | { kind: 'active'; session: SessionRecord; closure: ClosureRecord | null }
  | { kind: 'error'; error: ActionResult<never> }

/**
 * The player's one open session, if any. Repairs two crash leftovers:
 *   - the city doesn't point at an open session (Start crashed midway) → adopt it;
 *   - the city points at a session that's gone → clear the pointer.
 */
async function resolveActiveSession(tools: ActionTools, userId: string): Promise<Resolved> {
  const loaded = await loadCity(tools, userId)
  if (!loaded.success) return { kind: 'error', error: loaded as ActionResult<never> }
  if (!loaded.data) return { kind: 'error', error: fail('no_city', 'Create your city first.') }
  const pointer = loaded.data.data.activeSessionId

  let session = pointer ? await loadOwnSession(tools, userId, pointer) : null
  if (!session || session.data.status !== 'active') session = await findOpenSession(tools, userId)
  if (!session) {
    if (pointer) {
      await mutateCity(tools, userId, {
        reason: 'clear_stale_pointer',
        decide: (c) => (c.activeSessionId === pointer ? { kind: 'change', patch: { activeSessionId: '' }, result: null } : { kind: 'noop', result: null }),
      })
    }
    return { kind: 'none' }
  }

  const closure = await loadClosure(tools, userId, session.recordId)
  if (!closure && pointer !== session.recordId) {
    const id = session.recordId
    const adopted = await mutateCity(tools, userId, {
      reason: 'adopt_session',
      refId: id,
      decide: (c) =>
        c.activeSessionId === id
          ? { kind: 'noop', result: null }
          : { kind: 'change', patch: { activeSessionId: id }, result: null },
    })
    if (!adopted.success) return { kind: 'error', error: adopted as ActionResult<never> }
  }
  return { kind: 'active', session, closure }
}

// ── Start Sleep ────────────────────────────────────────────────────────────

export const startSleep: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const current = await resolveActiveSession(tools, userId)
  if (current.kind === 'error') return current.error
  if (current.kind === 'active') {
    if (!current.closure) {
      return fail('already_sleeping', 'You already have a sleep session running.', { sessionId: current.session.recordId })
    }
    // A previous Wake Up / Cancel crashed midway: finish it, then start fresh.
    const finished = await finishSession(tools, userId, current.session, current.closure, null)
    if (!finished.success) return finished
  }

  const now = await serverNow(env, tools, userId)
  const loaded = await loadCity(tools, userId)
  if (!loaded.success || !loaded.data) return loaded.success ? fail('no_city', 'Create your city first.') : loaded
  const session: SleepSessionData = {
    userId,
    status: 'active',
    startedAt: now,
    endedAt: 0,
    timezone: loaded.data.data.timezone,
    recordedMinutes: 0,
    creditedMinutes: 0,
    energyAwarded: 0,
    energyStored: 0,
    openSlot: 'open',
    rewardDay: '',
    rewardStatus: 'pending',
  }
  const created = await tools.create<SleepSessionData>('sleep_sessions', session)
  if (!created.success) {
    // Unique (userId, 'open'): a concurrent Start Sleep won.
    return fail('already_sleeping', 'You already have a sleep session running.')
  }

  const sessionId = created.data.recordId
  const linked = await mutateCity(tools, userId, {
    reason: 'start_sleep',
    refId: sessionId,
    decide: (c) =>
      c.activeSessionId && c.activeSessionId !== sessionId
        ? { kind: 'refuse', refusal: fail('already_sleeping', 'You already have a sleep session running.') }
        : { kind: 'change', patch: { activeSessionId: sessionId }, result: null },
  })
  if (!linked.success) {
    // Only undo on a clean refusal; on an unknown failure leave the open
    // session — the next request adopts it (resolveActiveSession).
    if ((linked as { code?: string }).code === 'already_sleeping') await tools.remove('sleep_sessions', sessionId)
    return linked
  }
  return ok({ sessionId, startedAt: now })
}

// ── Wake Up / Cancel Sleep ─────────────────────────────────────────────────

export const wakeUp: ActionHandler<Env> = (ctx) => closeSession('wake', ctx)

/** End the active session without any reward (e.g. tapped Start by accident). */
export const cancelSleep: ActionHandler<Env> = (ctx) => closeSession('cancel', ctx)

async function closeSession(kind: 'wake' | 'cancel', { userId, tools, env, params }: ActionContext<Env>) {
  const fault = devFault(env, params)
  const current = await resolveActiveSession(tools, userId)
  if (current.kind === 'error') return current.error
  if (current.kind === 'none') return fail('not_sleeping', 'You are not sleeping right now.')
  const { session } = current
  let closure = current.closure
  let decidedHere = false

  if (!closure) {
    // DECIDE — computed once, stored before anything else is written.
    const now = await serverNow(env, tools, userId)
    const city = await loadCity(tools, userId)
    if (!city.success || !city.data) return city.success ? fail('no_city', 'Create your city first.') : city
    const outcome =
      kind === 'wake'
        ? evaluateWake({ startedAt: session.data.startedAt, wakeAt: now, timezone: session.data.timezone, city: city.data.data })
        : {
            recordedMinutes: recordedMinutes(session.data.startedAt, now),
            creditedMinutes: 0,
            energyAwarded: 0,
            rewardDay: '',
            rewardStatus: 'cancelled' as const,
          }
    const decision: SessionClosureData = { userId, sessionId: session.recordId, kind, endedAt: now, ...outcome }
    const inserted = await tools.create<SessionClosureData>('session_closures', decision)
    if (inserted.success) {
      closure = { recordId: inserted.data.recordId, data: decision }
      decidedHere = true
    } else {
      // Unique (sessionId): Wake Up / Cancel already decided elsewhere.
      closure = await loadClosure(tools, userId, session.recordId)
      if (!closure) return inserted
    }
  }
  if (fault === 'after_closure') return injected(fault)

  const finished = await finishSession(tools, userId, session, closure, fault)
  if (!finished.success) return finished

  const result: CloseResult = { sessionId: session.recordId, session: finished.data, decidedHere }
  if (closure.data.kind !== kind) {
    const code = closure.data.kind === 'wake' ? 'already_woke' : 'already_cancelled'
    const msg = closure.data.kind === 'wake' ? 'This session already ended with Wake Up.' : 'This session was already cancelled.'
    return fail(code, msg, { ...result })
  }
  return ok(result)
}

/**
 * FINISH a decided session. Idempotent — safe to run any number of times,
 * concurrently, by any request.
 */
async function finishSession(
  tools: ActionTools,
  userId: string,
  session: SessionRecord,
  closure: ClosureRecord,
  fault: FaultPoint | null,
): Promise<ActionResult<SleepSessionData>> {
  const sessionId = session.recordId
  let c = closure.data

  // (1) Claim the day's reward. Already ours → fine. Held by another session → downgrade.
  if (c.rewardStatus === 'rewarded') {
    const claim = await tools.create<EnergyRewardData>('energy_rewards', {
      userId,
      sessionId,
      rewardDay: c.rewardDay,
      energy: c.energyAwarded,
      wakeAt: c.endedAt,
    })
    if (!claim.success) {
      const holder = await tools.query<EnergyRewardData>('energy_rewards', { where: { userId, rewardDay: c.rewardDay }, limit: 1 })
      const holderSession = holder.success ? holder.data.records[0]?.data.sessionId : undefined
      if (!holderSession) return claim
      if (holderSession !== sessionId) {
        const downgrade = { rewardStatus: 'daily_limit' as const, creditedMinutes: 0, energyAwarded: 0 }
        await tools.update('session_closures', closure.recordId, downgrade)
        c = { ...c, ...downgrade }
      }
    }
  }
  if (fault === 'after_reward') return injected(fault)

  // (2) Apply to the city exactly once: only while it still points at this session.
  const rewarded = c.rewardStatus === 'rewarded'
  const applied = await mutateCity<{ energyStored: number } | null>(tools, userId, {
    reason: 'close_session',
    refId: sessionId,
    decide: (city) => {
      if (city.activeSessionId !== sessionId) return { kind: 'noop', result: null }
      if (!rewarded) return { kind: 'change', patch: { activeSessionId: '' }, meta: { energyStored: 0 }, result: { energyStored: 0 } }
      const charge = chargeBattery(city.electricity, c.energyAwarded, city.buildings?.power ?? 1)
      return {
        kind: 'change',
        patch: { activeSessionId: '', electricity: charge.electricity, lastRewardDay: c.rewardDay, lastRewardedWakeAt: c.endedAt },
        meta: { energyStored: charge.stored },
        result: { energyStored: charge.stored },
      }
    },
  })
  if (!applied.success) return applied
  if (fault === 'after_city') return injected(fault)

  let energyStored = applied.data.result?.energyStored
  if (energyStored === undefined) {
    // An earlier request applied it; its journal entry recorded what fit.
    const prior = await findMutation(tools, userId, 'close_session', sessionId)
    energyStored = Number(prior?.meta?.energyStored ?? 0)
  }

  // (3) Finalize the session row (absolute values — repeatable).
  const patch: Partial<SleepSessionData> = {
    status: c.kind === 'wake' ? 'completed' : 'cancelled',
    endedAt: c.endedAt,
    recordedMinutes: c.recordedMinutes,
    creditedMinutes: c.creditedMinutes,
    energyAwarded: c.energyAwarded,
    energyStored,
    rewardDay: c.rewardDay,
    rewardStatus: c.rewardStatus,
    openSlot: `closed:${sessionId}`,
  }
  const saved = await tools.update<SleepSessionData>('sleep_sessions', sessionId, patch)
  if (!saved.success) return saved
  return ok({ ...session.data, ...patch })
}
