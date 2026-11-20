/**
 * DEV ONLY — fast-forward the simulated server clock for this player.
 * Rendered only when import.meta.env.DEV; production builds drop it, and the
 * server's dev actions refuse outside local dev/test regardless.
 */

import { Button } from '@/components/ui'
import { formatMinutes } from '@/game/format'

const STEPS = [
  { label: '+30m', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '+8h', minutes: 480 },
  { label: '+1 day', minutes: 1440 },
]

export function DevClockPanel({
  offsetMs,
  advance,
  error,
}: {
  offsetMs: number
  advance: (minutes: number) => Promise<void>
  error: string | null
}) {
  return (
    <section className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm" data-testid="dev-clock">
      <p className="font-medium text-foreground">Dev tools · simulated time</p>
      <p className="mt-1 text-muted-foreground">
        Server clock is <span data-testid="dev-clock-offset">{formatMinutes(Math.round(offsetMs / 60_000))}</span> ahead for you.
        Rewards still run through the real Start / Wake Up rules.
      </p>
      <p className="mt-1 text-muted-foreground">
        Simulated now:{' '}
        <span className="text-foreground" data-testid="dev-clock-now">
          {new Date(Date.now() + offsetMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>{' '}
        · sleep history and timers use this clock, so dates can be days or months ahead of today.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Button key={s.minutes} size="sm" variant="outline" onClick={() => void advance(s.minutes)} data-testid={`dev-advance-${s.minutes}`}>
            {s.label}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-destructive">{error}</p>}
    </section>
  )
}
