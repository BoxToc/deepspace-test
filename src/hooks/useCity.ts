/**
 * The signed-in player's city.
 *
 * Reads come from live record subscriptions (`useQuery`) — `read: 'own'`
 * means the server only ever sends this player's rows, and every open tab
 * updates when any tab (or the server) commits a change. City state is
 * versioned (see src/actions/city-store.ts): the base `cities` row overlaid
 * with the highest-revision `city_mutations` row, so the view only moves
 * forward.
 *
 * On mount we call `initCity` once: it creates the city if needed and returns
 * the server's clock, from which we derive `clockOffsetMs` (server time minus
 * browser time — includes the dev-only simulated clock in local dev). The
 * client never writes the city itself.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'deepspace'
import { callAction } from '@/lib/actions'
import { currentCityState } from '@/game/city'
import type { CityData, CityMutationData } from '@/game/types'

type InitState = 'idle' | 'creating' | 'error'

export function useCity() {
  const base = useQuery<CityData>('cities', { limit: 1 })
  const latest = useQuery<CityMutationData>('city_mutations', { orderBy: 'revision', orderDir: 'desc', limit: 1 })
  const baseRow = base.records[0] ?? null
  const latestNext = latest.records[0]?.data.next
  const city = useMemo(
    () => (baseRow ? { recordId: baseRow.recordId, data: currentCityState(baseRow.data, latestNext) } : null),
    [baseRow, latestNext],
  )
  const status =
    base.status === 'error' || latest.status === 'error' ? 'error' : base.status === 'ready' && latest.status === 'ready' ? 'ready' : 'loading'

  const [initState, setInitState] = useState<InitState>('idle')
  const [initError, setInitError] = useState<string | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const requested = useRef(false)

  /** Create the city if needed and sync the clock offset with the server. */
  const sync = useCallback(async () => {
    requested.current = true
    setInitState('creating')
    setInitError(null)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const sentAt = Date.now()
    const res = await callAction<{ serverNow: number }>('initCity', { timezone })
    if (res.success) {
      // Assume the server stamped its time halfway through the round trip.
      const midpoint = (sentAt + Date.now()) / 2
      setClockOffsetMs(Math.round(res.data.serverNow - midpoint))
      setInitState('idle')
    } else {
      setInitState('error')
      setInitError(res.error)
    }
  }, [])

  useEffect(() => {
    if (status === 'ready' && !requested.current) void sync()
  }, [status, sync])

  return {
    city,
    clockOffsetMs,
    /** Re-sync the server clock (e.g. after the dev clock jumps). */
    syncClock: sync,
    // After a successful create there's a brief gap before the subscription
    // delivers the row — keep showing "loading" until it arrives.
    loading: status === 'loading' || (!city && initState !== 'error'),
    error: status === 'error' ? 'Could not load your city.' : initError,
    retry: sync,
  }
}
