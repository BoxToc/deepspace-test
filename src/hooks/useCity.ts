/**
 * The signed-in player's city.
 *
 * Reads come from the live record subscription (`useQuery`) — the schema's
 * `read: 'own'` rule means the server only ever sends this player's row.
 * If the player has no city yet, we ask the server to create one once.
 * The client never writes the city itself.
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery } from 'deepspace'
import { callAction } from '@/lib/actions'
import type { CityData } from '@/game/types'

type InitState = 'idle' | 'creating' | 'error'

export function useCity() {
  const { records, status } = useQuery<CityData>('cities', { limit: 1 })
  const city = records[0] ?? null
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
