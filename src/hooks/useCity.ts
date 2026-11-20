/**
 * The signed-in player's city.
 *
 * Reads come from live record subscriptions (`useQuery`) — `read: 'own'`
 * means the server only ever sends this player's rows. City state is
 * versioned (see src/actions/city-store.ts): the base `cities` row overlaid
 * with the highest-revision `city_mutations` row, so the view only ever moves
 * forward. If the player has no city yet, we ask the server to create one
 * once. The client never writes the city itself.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const status = base.status === 'error' || latest.status === 'error' ? 'error' : base.status === 'ready' && latest.status === 'ready' ? 'ready' : 'loading'

  const [initState, setInitState] = useState<InitState>('idle')
  const [initError, setInitError] = useState<string | null>(null)
  const requested = useRef(false)

  const ensureCity = async () => {
    requested.current = true
    setInitState('creating')
    setInitError(null)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const res = await callAction('initCity', { timezone })
    if (res.success) {
      // The subscription delivers the record; nothing to store locally.
      setInitState('idle')
    } else {
      setInitState('error')
      setInitError(res.error)
    }
  }

  useEffect(() => {
    if (status === 'ready' && !city && !requested.current) void ensureCity()
  }, [status, city])

  return {
    city,
    // After a successful create there's a brief gap before the subscription
    // delivers the row — keep showing "loading" until it arrives.
    loading: status === 'loading' || (!city && initState !== 'error'),
    error: status === 'error' ? 'Could not load your city.' : initError,
    retry: ensureCity,
  }
}
