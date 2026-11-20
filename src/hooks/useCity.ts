/**
 * The signed-in player's city.
 *
 * Reads come from live record subscriptions (`useQuery`) filtered to the
 * signed-in player's `userId` (and re-checked by selectOwnCity), so every
 * open tab updates when any tab (or the server) commits a change — and an
 * admin (the app owner) sees their own city, not an arbitrary player's. City state is
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
import { useAuthStatus, useQuery } from 'deepspace'
import { callAction } from '@/lib/actions'
import { selectOwnCity } from '@/game/ownership'
import type { CityData, CityMutationData } from '@/game/types'

type InitState = 'idle' | 'creating' | 'error'

export function useCity() {
  // Always scope to the signed-in player. `read: 'own'` only limits MEMBERS;
  // the app owner is an admin and would otherwise receive every player's rows.
  const { userId } = useAuthStatus()
  const mine = { userId: userId ?? '__signed_out__' }
  const base = useQuery<CityData>('cities', { where: mine, limit: 1 })
  const latest = useQuery<CityMutationData>('city_mutations', { where: mine, orderBy: 'revision', orderDir: 'desc', limit: 1 })
  const city = useMemo(() => selectOwnCity(userId, base.records, latest.records), [userId, base.records, latest.records])
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
