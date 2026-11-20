/**
 * /city — the player's home base (sign-in required via the (protected) group).
 *
 * Phase 1: a plain readout of the persistent player state, proving the
 * auth → server action → record → live subscription loop. The isometric
 * scene replaces the building list in Phase 3.
 */

import { Button } from '@/components/ui'
import { TimezoneSetting } from '@/components/TimezoneSetting'
import { BUILDING_KEYS, BUILDINGS, BATTERY_CAPACITY } from '@/game/config'
import { useCity } from '@/hooks/useCity'
import { APP_NAME } from '@/constants'

export default function CityPage() {
  const { city, loading, error, retry } = useCity()

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-destructive" data-testid="city-error">{error}</p>
        <Button className="mt-4" onClick={() => void retry()}>Try again</Button>
      </div>
    )
  }

  if (loading || !city) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground" data-testid="city-loading">
        Building your city…
      </div>
    )
  }

  const { data } = city
  const capacity = BATTERY_CAPACITY[data.buildings.power] ?? BATTERY_CAPACITY[1]

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="city-page">
      <title>{`City · ${APP_NAME}`}</title>
      <h1 className="text-2xl font-semibold text-foreground">Your city</h1>
      <TimezoneSetting city={data} />

      <dl className="mt-8 grid grid-cols-2 gap-4">
        <Stat label="Electricity" testId="city-electricity" value={`${formatNumber(data.electricity)} / ${capacity} ⚡`} />
        <Stat label="Coins" testId="city-coins" value={`${Math.floor(data.coins)}`} />
      </dl>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-muted-foreground">Buildings</h2>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border" data-testid="city-buildings">
        {BUILDING_KEYS.map((key) => (
          <li key={key} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-foreground">{BUILDINGS[key].label}</span>
            <span className="text-muted-foreground" data-testid={`building-level-${key}`}>
              Level {data.buildings[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-foreground" data-testid={testId}>{value}</dd>
    </div>
  )
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
