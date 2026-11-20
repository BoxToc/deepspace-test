/**
 * DEV ONLY — the player's simulated clock offset, so the UI's elapsed timer
 * matches the server's simulated time. In production builds
 * `import.meta.env.DEV` is false: this returns offset 0 and never calls the
 * server (whose dev actions refuse anyway).
 */

import { useCallback, useEffect, useState } from 'react'
import { callAction } from '@/lib/actions'

export const DEV_TOOLS = import.meta.env.DEV

export function useDevClock() {
  const [offsetMs, setOffsetMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!DEV_TOOLS) return
    void callAction<{ offsetMs: number }>('devGetClock').then((res) => {
      if (res.success) setOffsetMs(res.data.offsetMs)
    })
  }, [])

  const advance = useCallback(async (minutes: number) => {
    if (!DEV_TOOLS) return
    setError(null)
    const res = await callAction<{ offsetMs: number }>('devAdvanceClock', { minutes })
    if (res.success) setOffsetMs(res.data.offsetMs)
    else setError(res.error)
  }, [])

  return { offsetMs, advance, error }
}
