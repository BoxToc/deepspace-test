/**
 * Concurrency-safe access to the player's city.
 *
 * DeepSpace server actions have no multi-record transactions or conditional
 * updates; the atomic primitive the SDK guarantees is `uniqueOn` (the DO
 * refuses a duplicate insert on every write path). We build optimistic
 * concurrency control from it:
 *
 *   1. Read the city at revision N and compute its complete next state.
 *   2. CLAIM revision N by inserting a `city_mutations` row keyed
 *      (userId, revision=N) that stores that next state (a journal entry).
 *      Only one writer can claim N; a loser re-reads and retries.
 *   3. Materialize: write the next state to the city with revision N+1.
 *
 * If step 3 fails (or the worker dies), the change is still committed in the
 * journal. The next mutation finds revision N already claimed and "rolls
 * forward" by writing the journaled state — so the city converges and no
 * change is lost or applied twice. Every journaled state is absolute (no
 * increments), which makes roll-forward safe to repeat.
 *
 * Phase 4 (coin production, upgrades) must change the city ONLY through
 * `mutateCity` so concurrent requests can't overwrite each other.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { CityData } from '../game/types'
import { fail, ok } from './results'

export interface CityRecord {
  recordId: string
  data: CityData
}

/** The caller's city, or `null` when they don't have one yet. */
export async function loadCity(tools: ActionTools, userId: string): Promise<ActionResult<CityRecord | null>> {
  const res = await tools.query<CityData>('cities', { where: { userId }, limit: 1 })
  if (!res.success) return res
  const row = res.data.records[0]
  return { success: true, data: row ? { recordId: row.recordId, data: row.data } : null }
}

export interface CityMutationData extends Record<string, unknown> {
  userId: string
  revision: number
  reason: string
  /** Related record (e.g. the sleep session) — lets replays find this entry. */
  refId: string
  /** Complete next state of the city's mutable fields (revision = N+1). */
  next: Partial<CityData>
  /** Extra facts decided at claim time (e.g. energyStored). */
  meta: Record<string, unknown>
}

/** What a mutation decides after seeing the current city. */
export type CityDecision<R> =
  | { kind: 'change'; patch: Partial<CityData>; result: R; meta?: Record<string, unknown> }
  | { kind: 'noop'; result: R }
  | { kind: 'refuse'; refusal: ActionResult<never> }

export interface MutateOptions<R> {
  reason: string
  refId?: string
  decide: (city: CityData) => CityDecision<R>
  /** DEV fault injection: claim the journal entry, then skip materializing. */
  skipMaterialize?: boolean
}

const MAX_ATTEMPTS = 6
const IMMUTABLE_FIELDS = new Set(['userId'])

export async function mutateCity<R>(
  tools: ActionTools,
  userId: string,
  opts: MutateOptions<R>,
): Promise<ActionResult<{ city: CityData; result: R; applied: boolean }>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const loaded = await loadCity(tools, userId)
    if (!loaded.success) return loaded
    if (!loaded.data) return fail('no_city', 'Create your city first.')
    const { recordId, data: city } = loaded.data
    const revision = city.revision ?? 0

    const decision = opts.decide(city)
    if (decision.kind === 'refuse') return decision.refusal
    if (decision.kind === 'noop') return ok({ city, result: decision.result, applied: false })

    const next = nextState(city, decision.patch, revision + 1)
    const claim = await tools.create<CityMutationData>('city_mutations', {
      userId,
      revision,
      reason: opts.reason,
      refId: opts.refId ?? '',
      next,
      meta: decision.meta ?? {},
    })
    if (!claim.success) {
      // Revision N is taken: someone else changed the city (maybe without
      // finishing). Bring the city up to date, then decide again.
      await rollForward(tools, userId, recordId, revision)
      continue
    }

    if (!opts.skipMaterialize) await tools.update<CityData>('cities', recordId, next)
    // Committed either way: if that write failed, the next mutation rolls it forward.
    return ok({ city: { ...city, ...next }, result: decision.result, applied: true })
  }
  return fail('city_busy', 'Your city is busy. Please try again.')
}

/** Write the journaled state for `revision` if the city hasn't moved past it. */
export async function rollForward(tools: ActionTools, userId: string, cityRecordId: string, revision: number) {
  const entry = await tools.query<CityMutationData>('city_mutations', { where: { userId, revision }, limit: 1 })
  const next = entry.success ? entry.data.records[0]?.data.next : undefined
  if (!next) return
  const current = await tools.get<CityData>('cities', cityRecordId)
  if (current.success && (current.data.record.data.revision ?? 0) > revision) return
  await tools.update<CityData>('cities', cityRecordId, next)
}

/** Find the journal entry a previous request wrote for `refId` + `reason`. */
export async function findMutation(tools: ActionTools, userId: string, reason: string, refId: string) {
  const res = await tools.query<CityMutationData>('city_mutations', { where: { userId, reason, refId }, limit: 1 })
  return res.success ? (res.data.records[0]?.data ?? null) : null
}

function nextState(city: CityData, patch: Partial<CityData>, revision: number): Partial<CityData> {
  const merged: Record<string, unknown> = { ...city, ...patch, revision }
  for (const f of IMMUTABLE_FIELDS) delete merged[f]
  return merged as Partial<CityData>
}
