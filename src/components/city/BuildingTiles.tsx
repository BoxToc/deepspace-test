/**
 * The "Buildings" card: one compact tile per building with a thumbnail of
 * its current look, level pips, power status and the upgrade cost. Every
 * action opens the UpgradePanel; upgrading itself happens there.
 */

import { Coins } from 'lucide-react'
import { Button } from '@/components/ui'
import { BUILDING_KEYS, BUILDINGS, MAX_BUILDING_LEVEL, type BuildingKey } from '@/game/config'
import { upgradeCost } from '@/game/economy'
import type { BuildingLevels } from '@/game/types'
import { boundsOf, placeBuilding, placeTile, type Placed } from '@/city/iso'
import { BUILDING_PLACEMENTS } from '@/city/layout'
import { ART, artForLevel, SPRITES } from '@/city/sprites'

export function BuildingTiles({
  levels,
  coins,
  power,
  selected,
  onSelect,
}: {
  levels: BuildingLevels
  coins: number
  power: Record<BuildingKey, boolean>
  selected: BuildingKey | null
  onSelect: (b: BuildingKey) => void
}) {
  return (
    <ul className="hud-tiles grid gap-2" data-testid="city-buildings">
      {BUILDING_KEYS.map((key) => {
        const level = levels[key]
        const cost = upgradeCost(level)
        const affordable = cost !== null && coins >= cost
        const label = BUILDINGS[key].label
        const on = power[key]
        return (
          <li key={key} className={`hud-tile${selected === key ? ' is-selected' : ''}`} data-testid={`building-row-${key}`}>
            <Thumb building={key} level={level} powered={on} />
            <div className="min-w-0">
              <button
                type="button"
                className="block min-h-6 max-w-full text-left text-sm font-semibold leading-tight text-foreground underline-offset-4 hover:underline"
                onClick={() => onSelect(key)}
                aria-label={`${label}: details`}
              >
                {label}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">
                  <span className="hud-pips" aria-hidden>
                    {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
                      <i key={i} className={i < level ? 'is-on' : ''} />
                    ))}
                  </span>
                  <span data-testid={`building-level-${key}`}>
                    Level {level}/{MAX_BUILDING_LEVEL}
                  </span>
                </span>
                <span className={`inline-flex items-center gap-1 whitespace-nowrap ${on ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`size-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-red-400'}`} aria-hidden />
                  <span data-testid={`building-power-${key}`}>{on ? 'Powered' : 'No power'}</span>
                </span>
              </div>
            </div>
            <div className="hud-tile__action">
              {cost === null ? (
                <span className="inline-flex h-9 items-center px-2 text-sm font-semibold text-foreground" data-testid={`building-max-${key}`}>
                  Max
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className={`hud-cost${affordable ? ' is-affordable' : ''}`}
                  onClick={() => onSelect(key)}
                  data-testid={`building-upgrade-${key}`}
                  aria-label={`Upgrade ${label} for ${cost} coins${affordable ? '' : ` (need ${Math.ceil(cost - coins)} more)`}`}
                >
                  <Coins className="size-3.5" aria-hidden /> {cost}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** The building's current look, fitted into a square. */
function Thumb({ building, level, powered }: { building: BuildingKey; level: number; powered: boolean }) {
  const placement = BUILDING_PLACEMENTS.find((p) => p.building === building)
  const layers: Placed[] = placement ? placeBuilding(artForLevel(ART[placement.art], level), 0, 0) : [placeTile('fountain', 0, 0)]
  const b = boundsOf(layers)
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY)
  const ox = b.minX - (size - (b.maxX - b.minX)) / 2
  const oy = b.minY - (size - (b.maxY - b.minY))
  const pct = (n: number) => `${(n / size) * 100}%`
  return (
    <div className="hud-thumb" style={powered ? undefined : { filter: 'grayscale(0.85) brightness(0.62)' }} aria-hidden>
      {layers.map((l, i) => (
        <img
          key={i}
          src={SPRITES[l.sprite].src}
          alt=""
          draggable={false}
          style={{ left: pct(l.left - ox), top: pct(l.top - oy), width: pct(l.w), height: pct(l.h) }}
        />
      ))}
    </div>
  )
}
