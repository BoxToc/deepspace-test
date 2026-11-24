/**
 * /city — the player's town (sign-in required via the (protected) group).
 *
 * Everything shown is the LIVE city: the stored snapshot settled to the
 * server-aligned current time every second (useLiveCity), so energy drains,
 * coins tick up, and buildings dim the moment the battery empties. All
 * changes go through server actions; this page never writes the city.
 *
 * Layout: the town sits in a game frame with the resource HUD on top and
 * the next goal below; tonight's sleep, the buildings and settings sit in a
 * side column (stacked under the town on phones).
 */

import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Moon, ZapOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { TimezoneSetting } from '@/components/TimezoneSetting'
import { SleepPanel } from '@/components/SleepPanel'
import { HowToPlayButton, HowToPlayCard, useHowToPlay } from '@/components/HowToPlay'
import { DevClockPanel } from '@/components/DevClockPanel'
import { CityScene } from '@/components/city/CityScene'
import { UpgradePanel } from '@/components/city/UpgradePanel'
import { GoalRibbon, ResourceHud } from '@/components/city/ResourceHud'
import { BuildingTiles } from '@/components/city/BuildingTiles'
import { DEV_TOOLS, useDevClock } from '@/hooks/useDevClock'
import { useLiveCity, type LiveCity } from '@/hooks/useLiveCity'
import { BUILDING_KEYS, MAX_BUILDING_LEVEL, type BuildingKey } from '@/game/config'
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
  // A successful upgrade is celebrated in the town once its panel closes (the panel covers the scene).
  const upgradedInPanel = useRef<BuildingKey | null>(null)
  const [celebrate, setCelebrate] = useState<{ building: BuildingKey; id: number } | undefined>()
  const closePanel = () => {
    if (upgradedInPanel.current) setCelebrate({ building: upgradedInPanel.current, id: Date.now() })
    upgradedInPanel.current = null
    setSelected(null)
  }
  const howTo = useHowToPlay()
  const { city } = live
  const sleeping = Boolean(stored.activeSessionId)

  const advanceDevClock = async (minutes: number) => {
    await devClock.advance(minutes)
    await syncClock()
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8" data-testid="city-page">
      <title>{`City · ${APP_NAME}`}</title>
      <h1 className="sr-only">Your city</h1>

      {howTo.open && <HowToPlayCard onDismiss={howTo.dismiss} />}

      <div className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 ${howTo.open ? 'mt-4' : ''}`}>
        <section className="hud-frame min-w-0" aria-label="Your town">
          <ResourceHud live={live} sleeping={sleeping} />

          {!live.powered && !sleeping && (
            <p
              className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground sm:text-sm"
              role="status"
              data-testid="city-outage"
            >
              <ZapOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>Your town is out of power, so buildings are dark and earn nothing. Start a sleep session tonight to recharge the battery.</span>
            </p>
          )}

          <div className="mt-2">
            <CityScene levels={view.levels} power={view.power} sleeping={view.sleeping} onSelect={setSelected} celebrate={celebrate} />
          </div>

          <GoalRibbon levels={stored.buildings} coins={city.coins} coinsPerHour={live.powered ? live.coinsPerHour : 0} hoursLeft={live.hoursLeft} />
          <p className="mt-1.5 text-center text-xs text-muted-foreground">Tap a building to see what it does and upgrade it.</p>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <SleepPanel city={stored} clockOffsetMs={clockOffsetMs} devClockOffsetMs={DEV_TOOLS ? devClock.offsetMs : 0} />

          <section className="hud-card" aria-labelledby="buildings-title">
            <h2 id="buildings-title" className="hud-label mb-2.5 flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden /> Buildings
            </h2>
            <BuildingTiles levels={stored.buildings} coins={city.coins} power={view.power} selected={selected} onSelect={setSelected} />
            {sleeping && (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Moon className="size-3.5" aria-hidden /> Your town keeps running on stored power while you sleep.
              </p>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
            <TimezoneSetting city={stored} now={live.now} />
            {!howTo.open && <HowToPlayButton onClick={howTo.show} />}
          </div>
        </aside>
      </div>

      <UpgradePanel
        building={selected}
        level={selected ? stored.buildings[selected] : 1}
        coins={city.coins}
        powered={live.powered}
        onClose={closePanel}
        onUpgraded={(b) => (upgradedInPanel.current = b)}
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
