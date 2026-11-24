/**
 * The game HUD above the town: energy, coins, power left and status chips,
 * plus the next-goal ribbon. Display only — every number comes from the
 * live, settled city (useLiveCity); nothing here changes game state.
 *
 * Values that JUMP (a wake-up reward, an upgrade spend, a power-station
 * upgrade) get a small floating delta and a chip glow. The every-second
 * drain/earn ticks are far below the thresholds, so they never pop.
 */

import { useEffect, useRef, useState } from 'react'
import { BatteryCharging, Coins, Hourglass, Moon, Star, Sun, ZapOff } from 'lucide-react'
import type { LiveCity } from '@/hooks/useLiveCity'
import { BUILDINGS } from '@/game/config'
import { goalProgress, nextUpgradeGoal } from '@/game/guidance'
import type { BuildingLevels } from '@/game/types'
import './hud.css'

interface Jump {
  delta: number
  id: number
}

/** A change of at least `min` between renders (a discrete event, not a tick). */
function useJump(value: number, min: number): Jump | null {
  const [prev, setPrev] = useState(value)
  const [jump, setJump] = useState<Jump | null>(null)
  if (value !== prev) {
    setPrev(value)
    const delta = value - prev
    if (Math.abs(delta) >= min) setJump({ delta, id: (jump?.id ?? 0) + 1 })
  }
  // The timer lives in a ref: each new jump restarts it, and it is only
  // cleared on unmount, so a jump always fades out.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!jump) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setJump(null), 1600)
  }, [jump])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return jump
}

function Delta({ jump, unit = '' }: { jump: Jump | null; unit?: string }) {
  if (!jump) return null
  const up = jump.delta > 0
  const n = Math.round(Math.abs(jump.delta))
  return (
    <span key={jump.id} className={`hud-delta${up ? '' : ' is-down'}`} aria-hidden>
      {up ? '+' : '−'}
      {n}
      {unit}
    </span>
  )
}

export function ResourceHud({ live, sleeping }: { live: LiveCity; sleeping: boolean }) {
  const { city, capacity, powered } = live
  const energyJump = useJump(city.electricity, 1)
  const capJump = useJump(capacity, 1)
  const coinJump = useJump(city.coins, 2)
  const fill = Math.min(1, city.electricity / capacity)
  const energyBump = energyJump ?? capJump

  return (
    <dl className="hud-grid" aria-label="Town resources">
      <div className="hud-chip" style={{ '--tone': 'var(--energy)' } as React.CSSProperties} data-bump={bump(energyBump)}>
        <span className="hud-chip__icon" aria-hidden>
          <BatteryCharging />
        </span>
        <div className="hud-chip__body">
          <dt className="sr-only">Electricity</dt>
          <dd className={`hud-value${energyJump ? ' is-bumped' : ''}`} key={energyJump?.id} data-testid="city-electricity">
            {formatAmount(city.electricity)}
            <small> / {capacity} ⚡</small>
          </dd>
          <div className={`hud-meter${fill < 0.2 ? ' is-low' : ''}`} aria-hidden>
            <i style={{ width: `${fill * 100}%` }} />
          </div>
        </div>
        <Delta jump={energyJump} unit=" ⚡" />
      </div>

      <div className="hud-chip" style={{ '--tone': 'var(--coin)' } as React.CSSProperties} data-bump={bump(coinJump)}>
        <span className="hud-chip__icon" aria-hidden>
          <Coins />
        </span>
        <div className="hud-chip__body">
          <dt className="sr-only">Coins</dt>
          <dd className={`hud-value${coinJump ? ' is-bumped' : ''}`} key={coinJump?.id} data-testid="city-coins">
            {Math.floor(city.coins)}
          </dd>
          <dd className={`hud-sub ${powered ? 'hud-gain' : 'is-wrap'}`} data-testid="city-coin-rate">
            {powered ? `+${formatAmount(live.coinsPerHour)} / hour` : 'Paused while the power is out'}
          </dd>
        </div>
        <Delta jump={coinJump} />
      </div>

      <div className={`hud-chip${powered ? '' : ' is-off'}`} style={{ '--tone': powered ? 'var(--time)' : 'var(--off)' } as React.CSSProperties}>
        <span className="hud-chip__icon" aria-hidden>
          {powered ? <Hourglass /> : <ZapOff />}
        </span>
        <div className="hud-chip__body">
          <dt className="sr-only">Power left</dt>
          <dd data-testid="city-power-hours">
            {powered ? (
              <>
                <span className="hud-value">≈ {formatHours(live.hoursLeft)}</span>{' '}
                <span className="hud-sub is-wrap">
                  of power · <span className="whitespace-nowrap">uses {formatAmount(live.usagePerHour)} ⚡/h</span>
                </span>
              </>
            ) : (
              <>
                <span className="hud-value">Out of power</span>
                <span className="hud-sub"> — sleep to recharge</span>
              </>
            )}
          </dd>
        </div>
      </div>

      <div className="hud-chip" style={{ '--tone': 'var(--sleep)' } as React.CSSProperties}>
        <span className="hud-chip__icon" aria-hidden>
          {sleeping ? <Moon /> : <Sun />}
        </span>
        <div className="hud-chip__body">
          <dt className="sr-only">Status</dt>
          <dd className="hud-value">
            <span className={`hud-light${sleeping ? ' is-sleep' : powered ? '' : ' is-off'}`} aria-hidden />
            {sleeping ? 'Sleeping' : 'Awake'}
          </dd>
          <dd className="hud-sub">{!powered ? 'Town is dark' : sleeping ? 'Town on stored power' : 'Town powered'}</dd>
        </div>
      </div>
    </dl>
  )
}

function bump(jump: Jump | null): 'up' | 'down' | undefined {
  if (!jump) return undefined
  return jump.delta > 0 ? 'up' : 'down'
}

/** "Next upgrade: Shop (100) in ≈ 2h 10m", with progress toward its cost. Display-only guidance. */
export function GoalRibbon({ levels, coins, coinsPerHour, hoursLeft }: { levels: BuildingLevels; coins: number; coinsPerHour: number; hoursLeft: number }) {
  const goal = nextUpgradeGoal(levels, coins)
  if (!goal) {
    return (
      <div className="hud-ribbon is-ready">
        <Star className="size-4 shrink-0 text-amber-300" aria-hidden />
        <span className="text-foreground" data-testid="city-next-goal">
          Every building is fully upgraded!
        </span>
      </div>
    )
  }
  const name = BUILDINGS[goal.building].label
  const p = goalProgress(goal, coinsPerHour, hoursLeft)
  const text =
    p.kind === 'affordable'
      ? `You can afford an upgrade: ${name} (${goal.cost})`
      : p.kind === 'eta'
        ? `Next upgrade: ${name} (${goal.cost}) in ≈ ${formatHours(p.hours)}`
        : `Next upgrade: ${name} (${goal.cost}), sleep to keep earning`
  const ready = p.kind === 'affordable'
  return (
    <div className={`hud-ribbon${ready ? ' is-ready' : ''}`}>
      <Star className={`size-4 shrink-0 ${ready ? 'fill-amber-300 text-amber-300' : 'text-amber-300/80'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <span className={`block ${ready ? 'font-medium text-amber-300' : 'text-foreground'}`} data-testid="city-next-goal" data-kind={p.kind}>
          {text}
        </span>
        <div className="hud-ribbon__bar" aria-hidden>
          <i style={{ width: `${Math.min(1, coins / goal.cost) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

export function formatAmount(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function formatHours(h: number): string {
  if (!Number.isFinite(h)) return '∞'
  const total = Math.floor(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? `${hh}h ${mm}m` : `${mm}m`
}
