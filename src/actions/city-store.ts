/**
 * Concurrency-safe city state.
 *
 * DeepSpace server actions have no multi-record transactions or conditional
 * updates; the atomic primitive the SDK guarantees is `uniqueOn` (the DO
 * refuses a duplicate insert on every write path). City state is therefore
 * versioned, append-only:
 *
 *   cities          — the base row written once at creation (revision 0).
 *   city_mutations  — one immutable row per later revision, holding the
 *                     COMPLETE city state at that revision, unique on
 *                     (userId, revision).
 *
 * Current city = base row overlaid with the highest-revision mutation row.
 *
 * To change the city: read revision N, compute the next state, and insert the
 * row for revision N+1. Inserting it IS the commit (compare-and-swap): if
 * another request already committed N+1, the DO refuses ours and we re-read
 * and retry. No row is ever overwritten, so an older state can never replace
 * a newer one — not even briefly — and a crash can't leave a committed change
 * half-applied.
 *
 * Phase 4 (coin production, upgrades) must change the city ONLY through
 * `mutateCity`.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import { currentCityState } from '../game/city'
import type { CityData, CityMutationData } from '../game/types'
import { fail, ok } from './results'

export { currentCityState, type CityMutationData }

export interface CityRecord {
  /** Id of the base `cities` row (stable for the city's lifetime). */
  recordId: string
  data: CityData
}

/** The caller's current city, or `null` when they don't have one yet. */
export async function loadCity(tools: ActionTools, userId: string): Promise<ActionResult<CityRecord | null>> {
  const [base, latest] = await Promise.all([
    tools.query<CityData>('cities', { where: { userId }, limit: 1 }),
    tools.query<CityMutationData>('city_mutations', { where: { userId }, orderBy: 'revision', orderDir: 'desc', limit: 1 }),
  ])
  if (!base.success) return base
  if (!latest.success) return latest
  const row = base.data.records[0]
  if (!row) return ok(null)
  return ok({ recordId: row.recordId, data: currentCityState(row.data, latest.data.records[0]?.data.next) })
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
}

const MAX_ATTEMPTS = 8

export async function mutateCity<R>(
  tools: ActionTools,
  userId: string,
  opts: MutateOptions<R>,
): Promise<ActionResult<{ city: CityData; result: R; applied: boolean }>> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const loaded = await loadCity(tools, userId)
    if (!loaded.success) return loaded
    if (!loaded.data) return fail('no_city', 'Create your city first.')
    const city = loaded.data.data

    const decision = opts.decide(city)
    if (decision.kind === 'refuse') return decision.refusal
    if (decision.kind === 'noop') return ok({ city, result: decision.result, applied: false })

    const revision = city.revision + 1
    const { userId: _immutable, ...rest } = { ...city, ...decision.patch, revision }
    void _immutable
    const commit = await tools.create<CityMutationData>('city_mutations', {
      userId,
      revision,
      reason: opts.reason,
      refId: opts.refId ?? '',
      next: rest,
      meta: decision.meta ?? {},
    })
    if (commit.success) return ok({ city: { ...city, ...rest }, result: decision.result, applied: true })
    // Revision taken by a concurrent change (uniqueOn refusal): re-read and decide again.
  }
  return fail('city_busy', 'Your city is busy. Please try again.')
}

/** Find the committed change a previous request made for `refId` + `reason`. */
export async function findMutation(tools: ActionTools, userId: string, reason: string, refId: string) {
  const res = await tools.query<CityMutationData>('city_mutations', { where: { userId, reason, refId }, limit: 1 })
  return res.success ? (res.data.records[0]?.data ?? null) : null
}
