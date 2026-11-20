/**
 * /city — the player's town (sign-in required via the (protected) group).
 *
 * The isometric scene shows the live city record: building levels, power
 * state (lights on / dimmed), and a night sky while a sleep session runs.
 * Below it: energy and coins, the sleep panel, and a building list with the
 * same state in text form.
 */

import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui'
import { TimezoneSetting } from '@/components/TimezoneSetting'
import { SleepPanel } from '@/components/SleepPanel'
import { DevClockPanel } from '@/components/DevClockPanel'
import { CityScene } from '@/components/city/CityScene'
import { DEV_TOOLS, useDevClock } from '@/hooks/useDevClock'
import { BUILDING_KEYS, BUILDINGS, BATTERY_CAPACITY, MAX_BUILDING_LEVEL, type BuildingKey } from '@/game/config'
import { isCityPowered } from '@/game/power'
import type { BuildingLevels, CityData } from '@/game/types'
import { useCity } from '@/hooks/useCity'
import { APP_NAME } from '@/constants'

export default function CityPage() {
  const { city, loading, error, retry } = useCity()
  const devClock = useDevClock()
  const preview = useDevPreview()

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
  const view = preview(data)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10" data-testid="city-page">
      <title>{`City · ${APP_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Your city</h1>
        <TimezoneSetting city={data} />
      </div>

      <div className="mt-4">
        <CityScene levels={view.levels} power={view.power} sleeping={view.sleeping} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <Stat label="Electricity" testId="city-electricity" value={`${formatNumber(data.electricity)} / ${capacity} ⚡`} />
        <Stat label="Coins" testId="city-coins" value={`${Math.floor(data.coins)}`} />
      </dl>

      <SleepPanel city={data} clockOffsetMs={devClock.offsetMs} />

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-muted-foreground">Buildings</h2>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border" data-testid="city-buildings">
        {BUILDING_KEYS.map((key) => (
          <li key={key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-foreground">{BUILDINGS[key].label}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              <span data-testid={`building-power-${key}`}>{view.power[key] ? 'Powered' : 'No power'}</span>
              <span data-testid={`building-level-${key}`}>Level {data.buildings[key]}</span>
            </span>
          </li>
        ))}
      </ul>

      {DEV_TOOLS && <DevClockPanel {...devClock} />}
    </div>
  )
}

interface SceneView {
  levels: BuildingLevels
  power: Record<BuildingKey, boolean>
  sleeping: boolean
}

function liveView(city: CityData): SceneView {
  const powered = isCityPowered(city)
  return {
    levels: city.buildings,
    power: Object.fromEntries(BUILDING_KEYS.map((k) => [k, powered])) as Record<BuildingKey, boolean>,
    sleeping: Boolean(city.activeSessionId),
  }
}

/**
 * DEV ONLY: `?preview=unpowered|night&level=1..3` overrides what the scene
 * DRAWS (never server state) so every look can be checked without editing a
 * city. In production builds DEV_TOOLS is false and the URL is ignored.
 */
function useDevPreview() {
  const [params] = useSearchParams()
  return (city: CityData): SceneView => {
    const view = liveView(city)
    if (!DEV_TOOLS) return view
    const mode = params.get('preview')
    const level = Number(params.get('level'))
    if (level >= 1 && level <= MAX_BUILDING_LEVEL) {
      view.levels = Object.fromEntries(BUILDING_KEYS.map((k) => [k, level])) as BuildingLevels
    }
    if (mode === 'unpowered') view.power = Object.fromEntries(BUILDING_KEYS.map((k) => [k, false])) as SceneView['power']
    if (mode === 'night') view.sleeping = true
    return view
  }
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
