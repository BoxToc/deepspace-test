/**
 * Pick the signed-in player's own rows out of a subscription.
 *
 * Why this exists: collection read rules give members only their own rows
 * (`read: 'own'`), but the app OWNER is an admin, and admins may read every
 * player's rows. A query like `useQuery('cities', { limit: 1 })` therefore
 * returned an arbitrary player's city for the owner. Client queries now
 * filter by `userId`, and these selectors enforce it again on whatever
 * arrives, in whatever order.
 */

import { currentCityState } from './city'
import type { CityData, CityMutationData, SleepSessionData } from './types'

interface Row<T> {
  recordId: string
  data: T
}

/** The player's base city row overlaid with THEIR highest revision. */
export function selectOwnCity(
  userId: string | null | undefined,
  baseRows: Row<CityData>[],
  mutationRows: Row<CityMutationData>[],
): { recordId: string; data: CityData } | null {
  if (!userId) return null
  const base = baseRows.find((r) => r.data.userId === userId)
  if (!base) return null
  let latest: CityMutationData | undefined
  for (const r of mutationRows) {
    if (r.data.userId !== userId) continue
    if (!latest || r.data.revision > latest.revision) latest = r.data
  }
  return { recordId: base.recordId, data: currentCityState(base.data, latest?.next) }
}

/** The player's own sessions, newest first. */
export function selectOwnSessions(
  userId: string | null | undefined,
  rows: Row<SleepSessionData>[],
  limit = Infinity,
): Row<SleepSessionData>[] {
  if (!userId) return []
  return rows
    .filter((r) => r.data.userId === userId)
    .sort((a, b) => b.data.startedAt - a.data.startedAt)
    .slice(0, limit)
}
