/**
 * The miniature isometric town — plain React + <img>, no canvas or engine.
 *
 * How it renders:
 *   1. buildScene() (src/city/scene.ts) lays out every tile, detail and
 *      building layer in "art pixels" and sorts them back-to-front.
 *   2. Each image is absolutely positioned in PERCENT of a stage whose
 *      aspect-ratio matches the scene, so the town scales to any width with
 *      no JS measuring (desktop and mobile alike).
 *   3. A building's layers share one wrapper, so a single CSS filter dims the
 *      whole building when it has no power; lamps glow only when powered.
 */

import { useMemo } from 'react'
import { Zap, ZapOff } from 'lucide-react'
import { BUILDINGS, type BuildingKey } from '@/game/config'
import type { BuildingLevels } from '@/game/types'
import type { Placed } from '@/city/iso'
import { buildScene, type SceneNode } from '@/city/scene'
import { SPRITES } from '@/city/sprites'
import '@/city/city.css'

export interface CitySceneProps {
  levels: BuildingLevels
  /** Power state per building. */
  power: Record<BuildingKey, boolean>
  /** Night sky while a sleep session runs. */
  sleeping?: boolean
  /** Called when a building is clicked / activated with the keyboard. */
  onSelect?: (building: BuildingKey) => void
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`

export function CityScene({ levels, power, sleeping = false, onSelect }: CitySceneProps) {
  const scene = useMemo(() => buildScene(levels), [levels])
  const { bounds, width: W, height: H } = scene
  const anyPowered = Object.values(power).some(Boolean)
  const box = (p: Placed) => ({
    left: pct(p.left - bounds.minX, W),
    top: pct(p.top - bounds.minY, H),
    width: pct(p.w, W),
    height: pct(p.h, H),
  })

  const label = `Your town: ${(Object.keys(BUILDINGS) as BuildingKey[])
    .map((k) => `${BUILDINGS[k].label} ${power[k] ? 'powered' : 'without power'}`)
    .join(', ')}.`

  return (
    <figure
      className="city-scene"
      data-sky={sleeping ? 'night' : anyPowered ? 'day' : 'dark'}
      data-testid="city-scene"
      data-powered={anyPowered}
    >
      {/* A labelled group, not role="img": an image role would hide the building buttons inside it from assistive tech. */}
      <div className="city-scene__stage" style={{ aspectRatio: `${W} / ${H}` }} role="group" aria-label={label}>
        {scene.nodes.map((node) => (
          <SceneItem key={node.id} node={node} box={box} power={power} onSelect={onSelect} />
        ))}
      </div>
    </figure>
  )
}

/** Click + Enter/Space activation for a building, when selectable. */
function selectable(building: BuildingKey, onSelect?: (b: BuildingKey) => void) {
  if (!onSelect) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    'data-selectable': true,
    onClick: () => onSelect(building),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(building)
      }
    },
  }
}

function SceneItem({
  node,
  box,
  power,
  onSelect,
}: {
  node: SceneNode
  box: (p: Placed) => Record<string, string>
  power: Record<BuildingKey, boolean>
  onSelect?: (b: BuildingKey) => void
}) {
  if (node.kind === 'building') return <BuildingView node={node} box={box} powered={power[node.building]} onSelect={onSelect} />

  const dim = node.owner ? !power[node.owner] : false
  const lit = node.kind === 'detail' && node.light && Object.values(power).some(Boolean)
  // The park has no building stack; its fountain tile carries its badge.
  const parkTile = node.kind === 'ground' && node.owner === 'park'
  return (
    <>
      <Sprite item={node.item} style={box(node.item)} className={dim ? 'city-sprite is-unpowered' : 'city-sprite'} />
      {lit && <span className="city-lamp-glow" style={lampGlowBox(node.item, box)} aria-hidden />}
      {parkTile && (
        <span
          className="city-park"
          style={box(node.item)}
          data-testid="city-building"
          data-building="park"
          data-powered={!dim}
          title={`${BUILDINGS.park.label} — ${dim ? 'no power' : 'powered'}`}
          aria-label={onSelect ? `${BUILDINGS.park.label}: view and upgrade` : undefined}
          {...selectable('park', onSelect)}
        >
          {/* The click target is only the fountain's top face; the badge and focus ring stay unclipped. */}
          <span className="city-park__hit" aria-hidden />
          {dim && (
            <span className="city-badge is-off" style={{ left: '50%', top: '4%' }} aria-hidden>
              <ZapOff />
            </span>
          )}
        </span>
      )}
    </>
  )
}

function BuildingView({
  node,
  box,
  powered,
  onSelect,
}: {
  node: Extract<SceneNode, { kind: 'building' }>
  box: (p: Placed) => Record<string, string>
  powered: boolean
  onSelect?: (b: BuildingKey) => void
}) {
  const base = node.layers[0]
  const top = node.layers[node.layers.length - 1]
  // Children are positioned in percent of the ground-floor box.
  const rel = (p: Placed) => ({
    left: pct(p.left - base.left, base.w),
    top: pct(p.top - base.top, base.h),
    width: pct(p.w, base.w),
    height: pct(p.h, base.h),
  })
  const name = BUILDINGS[node.building].label
  return (
    <div
      className={`city-building ${powered ? 'is-powered' : 'is-unpowered'}`}
      style={box(base)}
      data-testid="city-building"
      data-building={node.building}
      data-powered={powered}
      title={`${name} — ${powered ? 'powered' : 'no power'}`}
      aria-label={onSelect ? `${name}: view and upgrade` : undefined}
      {...selectable(node.building, onSelect)}
    >
      {node.layers.map((layer, i) => (
        <Sprite key={i} item={layer} style={rel(layer)} className="city-sprite" />
      ))}
      <span
        className={`city-badge ${powered ? 'is-on' : 'is-off'}`}
        style={{ left: '50%', top: pct(top.top - base.top - 6, base.h) }}
        aria-hidden
      >
        {powered ? node.building === 'power' ? <Zap /> : null : <ZapOff />}
      </span>
    </div>
  )
}

function Sprite({ item, style, className }: { item: Placed; style: Record<string, string>; className: string }) {
  return (
    <img
      src={SPRITES[item.sprite].src}
      alt=""
      draggable={false}
      decoding="async"
      className={className}
      style={{ ...style, transform: item.flip ? 'scaleX(-1)' : undefined }}
    />
  )
}

/** The lamp head sits at the top of the post's arm (mirrored lamps: other side). */
function lampGlowBox(item: Placed, box: (p: Placed) => Record<string, string>) {
  const size = 18
  const headX = item.flip ? item.left + item.w - 4 : item.left + 4
  return box({ sprite: item.sprite, left: headX - size / 2, top: item.top + 4 - size / 2, w: size, h: size })
}
