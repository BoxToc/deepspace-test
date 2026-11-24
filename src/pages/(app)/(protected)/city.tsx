/**
 * /city — the player's town (sign-in required via the (protected) group).
 *
 * Everything shown is the LIVE city: the stored snapshot settled to the
 * server-aligned current time every second (useLiveCity), so energy drains,
 * coins tick up, and buildings dim the moment the battery empties. All
 * changes go through server actions; this page never writes the city.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BatteryCharging, Coins, Moon, ZapOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { TimezoneSetting } from '@/components/TimezoneSetting'
import { SleepPanel } from '@/components/SleepPanel'
import { HowToPlayButton, HowToPlayCard, useHowToPlay } from '@/components/HowToPlay'
import { DevClockPanel } from '@/components/DevClockPanel'
import { CityScene } from '@/components/city/CityScene'
import { UpgradePanel } from '@/components/city/UpgradePanel'
import { DEV_TOOLS, useDevClock } from '@/hooks/useDevClock'
import { useLiveCity, type LiveCity } from '@/hooks/useLiveCity'
import { BUILDING_KEYS, BUILDINGS, MAX_BUILDING_LEVEL, type BuildingKey } from '@/game/config'
import { upgradeCost } from '@/game/economy'
import { goalProgress, nextUpgradeGoal } from '@/game/guidance'
import type { BuildingLevels, CityData } from '@/game/types'
import { useCity } from '@/hooks/useCity'
import { APP_NAME } from '@/constants'

export default function CityPage() {
  const { city, loading, error, retry, clockOffsetMs, syncClock } = useCity()

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

  return <CityDashboard stored={city.data} clockOffsetMs={clockOffsetMs} syncClock={syncClock} />
}

function CityDashboard({ stored, clockOffsetMs, syncClock }: { stored: CityData; clockOffsetMs: number; syncClock: () => Promise<void> }) {
  const live = useLiveCity(stored, clockOffsetMs)
  const devClock = useDevClock()
  const preview = useDevPreview()
  const view = preview(live, stored)
  const [selected, setSelected] = useState<BuildingKey | null>(null)
  const howTo = useHowToPlay()
  const { city } = live
  const sleeping = Boolean(stored.activeSessionId)

  const advanceDevClock = async (minutes: number) => {
    await devClock.advance(minutes)
    await syncClock()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10" data-testid="city-page">
      <title>{`City · ${APP_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Your city</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {!howTo.open && <HowToPlayButton onClick={howTo.show} />}
          <TimezoneSetting city={stored} now={live.now} />
        </div>
      </div>

      {howTo.open && <HowToPlayCard onDismiss={howTo.dismiss} />}

      {!live.powered && !sleeping && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
          role="status"
          data-testid="city-outage"
        >
          <ZapOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            Your town is out of power, so buildings are dark and earn nothing. Start a sleep session below tonight to recharge
            the battery.
          </span>
        </p>
      )}

      <div className="mt-4">
        <CityScene levels={view.levels} power={view.power} sleeping={view.sleeping} onSelect={setSelected} />
        <p className="mt-2 text-center text-xs text-muted-foreground">Tap a building to see what it does and upgrade it.</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <Stat
          icon={<Zap className="size-4 text-amber-400" aria-hidden />}
          label="Electricity"
          testId="city-electricity"
          value={`${formatAmount(city.electricity)} / ${live.capacity} ⚡`}
          sub={
            live.powered ? (
              <span data-testid="city-power-hours">≈ {formatHours(live.hoursLeft)} of power · uses {formatAmount(live.usagePerHour)} ⚡/h</span>
            ) : (
              <span className="text-destructive" data-testid="city-power-hours">
                Out of power — sleep to recharge
              </span>
            )
          }
          meter={Math.min(1, city.electricity / live.capacity)}
        />
        <Stat
          icon={<Coins className="size-4 text-amber-400" aria-hidden />}
          label="Coins"
          testId="city-coins"
          value={`${Math.floor(city.coins)}`}
          sub={
            <>
              <span data-testid="city-coin-rate">
                {live.powered ? `+${formatAmount(live.coinsPerHour)} / hour` : 'Paused while the power is out'}
              </span>
              <NextGoal levels={stored.buildings} coins={city.coins} coinsPerHour={live.powered ? live.coinsPerHour : 0} hoursLeft={live.hoursLeft} />
            </>
          }
        />
      </dl>

      <SleepPanel city={stored} clockOffsetMs={clockOffsetMs} devClockOffsetMs={DEV_TOOLS ? devClock.offsetMs : 0} />

      <h2 className="mt-10 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <BatteryCharging className="size-4" aria-hidden /> Buildings
      </h2>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border" data-testid="city-buildings">
        {BUILDING_KEYS.map((key) => {
          const level = stored.buildings[key]
          const cost = upgradeCost(level)
          const affordable = cost !== null && city.coins >= cost
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 text-sm" data-testid={`building-row-${key}`}>
              <button
                type="button"
                className="min-h-9 text-left text-foreground underline-offset-4 hover:underline"
                onClick={() => setSelected(key)}
                aria-label={`${BUILDINGS[key].label}: details`}
              >
                {BUILDINGS[key].label}
              </button>
              <span className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span data-testid={`building-power-${key}`}>{view.power[key] ? 'Powered' : 'No power'}</span>
                <span data-testid={`building-level-${key}`}>
                  Level {level}/{MAX_BUILDING_LEVEL}
                </span>
                {cost === null ? (
                  <span className="text-foreground" data-testid={`building-max-${key}`}>Max</span>
                ) : (
                  <Button
                    size="sm"
                    variant={affordable ? 'default' : 'outline'}
                    onClick={() => setSelected(key)}
                    data-testid={`building-upgrade-${key}`}
                    aria-label={`Upgrade ${BUILDINGS[key].label} for ${cost} coins${affordable ? '' : ` (need ${Math.ceil(cost - city.coins)} more)`}`}
                  >
                    <Coins className="size-3.5" aria-hidden /> {cost}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {sleeping && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Moon className="size-3.5" aria-hidden /> Your town keeps running on stored power while you sleep.
        </p>
      )}

      <UpgradePanel
        building={selected}
        level={selected ? stored.buildings[selected] : 1}
        coins={city.coins}
        powered={live.powered}
        onClose={() => setSelected(null)}
      />

      {DEV_TOOLS && <DevClockPanel offsetMs={devClock.offsetMs} advance={advanceDevClock} error={devClock.error} />}
    </div>
  )
}

interface SceneView {
  levels: BuildingLevels
  power: Record<BuildingKey, boolean>
  sleeping: boolean
}

/**
 * DEV ONLY: `?preview=unpowered|night&level=1..3` overrides what the scene
 * DRAWS (never server state). In production builds DEV_TOOLS is false and
 * the URL is ignored.
 */
function useDevPreview() {
  const [params] = useSearchParams()
  return (live: LiveCity, stored: CityData): SceneView => {
    const view: SceneView = { levels: stored.buildings, power: live.power, sleeping: Boolean(stored.activeSessionId) }
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

function Stat({
  icon,
  label,
  value,
  sub,
  testId,
  meter,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: React.ReactNode
  testId: string
  meter?: number
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground" data-testid={testId}>{value}</dd>
      {meter !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-amber-400 transition-[width] duration-700" style={{ width: `${meter * 100}%` }} />
        </div>
      )}
      <dd className="mt-1.5 text-xs text-muted-foreground">{sub}</dd>
    </div>
  )
}

/** "Next upgrade: Shop (100) in ≈ 2h 10m" — display-only guidance from the live economy. */
function NextGoal({ levels, coins, coinsPerHour, hoursLeft }: { levels: BuildingLevels; coins: number; coinsPerHour: number; hoursLeft: number }) {
  const goal = nextUpgradeGoal(levels, coins)
  if (!goal) return <span className="mt-0.5 block" data-testid="city-next-goal">Every building is fully upgraded!</span>
  const name = BUILDINGS[goal.building].label
  const p = goalProgress(goal, coinsPerHour, hoursLeft)
  const text =
    p.kind === 'affordable'
      ? `You can afford an upgrade: ${name} (${goal.cost})`
      : p.kind === 'eta'
        ? `Next upgrade: ${name} (${goal.cost}) in ≈ ${formatHours(p.hours)}`
        : `Next upgrade: ${name} (${goal.cost}), sleep to keep earning`
  return (
    <span className={`mt-0.5 block ${p.kind === 'affordable' ? 'font-medium text-amber-400' : ''}`} data-testid="city-next-goal" data-kind={p.kind}>
      {text}
    </span>
  )
}

function formatAmount(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function formatHours(h: number): string {
  if (!Number.isFinite(h)) return '∞'
  const total = Math.floor(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? `${hh}h ${mm}m` : `${mm}m`
}
