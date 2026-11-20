/**
 * Shows the saved time zone and offers to switch to this device's zone.
 * The server decides whether the change is allowed (7-day rule, no change
 * mid-session); this component only reflects that.
 */

import { useState } from 'react'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { nextTimezoneChangeAt } from '@/game/time'
import type { CityData } from '@/game/types'

export function TimezoneSetting({ city }: { city: CityData }) {
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const nextAllowedAt = nextTimezoneChangeAt(city.timezoneChangedAt ?? 0)
  const locked = nextAllowedAt > Date.now()
  const differs = deviceTz && deviceTz !== city.timezone

  const switchZone = async () => {
    setBusy(true)
    setMessage(null)
    const res = await callAction('updateTimezone', { timezone: deviceTz })
    setBusy(false)
    if (!res.success) setMessage(res.error)
  }

  return (
    <div className="mt-1 text-sm text-muted-foreground">
      Time zone: <span data-testid="city-timezone">{city.timezone}</span>
      {differs && !locked && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-2"
          disabled={busy}
          onClick={() => void switchZone()}
          data-testid="timezone-switch"
        >
          Use {deviceTz}
        </Button>
      )}
      {locked && (
        <span className="ml-2" data-testid="timezone-locked">
          (next change {new Date(nextAllowedAt).toLocaleDateString()})
        </span>
      )}
      {message && <p className="mt-1 text-destructive" data-testid="timezone-error">{message}</p>}
    </div>
  )
}
