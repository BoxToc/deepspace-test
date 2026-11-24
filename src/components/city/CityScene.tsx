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
 *   4. Every node carries its painter's-order z-index, so the moving citizens
 *      and cars of <CityLife> slot in between tiles, trees and buildings.
 *
 * Ambient effects (tree sway, steam, clouds, upgrade celebration) are CSS
 * animations in city.css, all switched off under prefers-reduced-motion.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, ZapOff } from 'lucide-react'
import { BUILDINGS, type BuildingKey } from '@/game/config'
import type { BuildingLevels } from '@/game/types'
import type { Placed } from '@/city/iso'
import { buildScene, type SceneNode } from '@/city/scene'
import { SPRITES, STEAM_VENTS } from '@/city/sprites'
import { CityLife } from './CityLife'
import '@/city/city.css'

export interface CitySceneProps {
  levels: BuildingLevels
  /** Power state per building. */
  power: Record<BuildingKey, boolean>
  /** Night sky while a sleep session runs. */
  sleeping?: boolean
  /** Called when a building is clicked / activated with the keyboard. */
  onSelect?: (building: BuildingKey) => void
  /** Play the upgrade celebration on this building (a new `id` replays it). */
  celebrate?: { building: BuildingKey; id: number }
}

type Party = { building: BuildingKey; id: number } | null

const CELEBRATION_MS = 1800

const pct = (v: number, total: number) => `${(v / total) * 100}%`

export function CityScene({ levels, power, sleeping = false, onSelect, celebrate }: CitySceneProps) {
  const scene = useMemo(() => buildScene(levels), [levels])
  const [party, setParty] = useState<Party>(null)
  // Pause every ambient animation while the town is scrolled out of view (saves battery on phones).
  const figure = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = figure.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) delete el.dataset.offscreen
      else el.dataset.offscreen = 'true'
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!celebrate) return
    setParty(celebrate)
    const done = setTimeout(() => setParty(null), CELEBRATION_MS)
    return () => clearTimeout(done)
  }, [celebrate])
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
      ref={figure}
      className="city-scene"
      data-sky={sleeping ? 'night' : anyPowered ? 'day' : 'dark'}
      data-testid="city-scene"
      data-powered={anyPowered}
    >
      <span className="city-cloud is-a" aria-hidden />
      <span className="city-cloud is-b" aria-hidden />
      {/* A labelled group, not role="img": an image role would hide the building buttons inside it from assistive tech. */}
      <div className="city-scene__stage" style={{ aspectRatio: `${W} / ${H}` }} role="group" aria-label={label}>
        {scene.nodes.map((node) => (
          <SceneItem key={node.id} node={node} box={box} power={power} onSelect={onSelect} party={party} />
        ))}
        <CityLife bounds={bounds} width={W} sleeping={sleeping} />
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
  party,
}: {
  node: SceneNode
  box: (p: Placed) => Record<string, string>
  power: Record<BuildingKey, boolean>
  onSelect?: (b: BuildingKey) => void
  party: Party
}) {
  if (node.kind === 'building')
    return (
      <BuildingView
        node={node}
        box={box}
        powered={power[node.building]}
        onSelect={onSelect}
        partyId={party?.building === node.building ? party.id : undefined}
      />
    )

  const dim = node.owner ? !power[node.owner] : false
  const lit = node.kind === 'detail' && node.light && Object.values(power).some(Boolean)
  // The park has no building stack; its fountain tile carries its badge.
  const parkTile = node.kind === 'ground' && node.owner === 'park'
  const sway = node.kind === 'detail' ? node.sway : undefined
  const parkParty = parkTile && party?.building === 'park' ? party.id : undefined
  return (
    <>
      <Sprite
        item={node.item}
        style={{
          ...box(node.item),
          zIndex: String(node.z),
          // Trees sway out of step with each other.
          ...(sway !== undefined ? { animationDelay: `${-((sway * 1.37) % 5).toFixed(2)}s` } : {}),
        }}
        className={`city-sprite${dim ? ' is-unpowered' : ''}${sway !== undefined ? ' city-tree' : ''}`}
      />
      {lit && <span className="city-lamp-glow" style={{ ...lampGlowBox(node.item, box), zIndex: String(node.z + 1) }} aria-hidden />}
      {parkTile && (
        <span
          className={`city-park${parkParty ? ' is-celebrating' : ''}`}
          style={{ ...box(node.item), zIndex: String(node.z + 2) }}
          data-celebrating={parkParty ? true : undefined}
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
          {parkParty && <Celebration key={parkParty} lotTop="34%" />}
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
  partyId,
}: {
  node: Extract<SceneNode, { kind: 'building' }>
  box: (p: Placed) => Record<string, string>
  powered: boolean
  onSelect?: (b: BuildingKey) => void
  /** Set while this building's upgrade celebration plays. */
  partyId?: number
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
  // Steam rises from vents (the Level 3 cooling tower) only while powered.
  const vents = powered
    ? node.layers.flatMap((l) => {
        const v = STEAM_VENTS[l.sprite]
        return v ? [{ left: pct(l.left - base.left + v.x, base.w), top: pct(l.top - base.top + v.y, base.h) }] : []
      })
    : []
  return (
    <div
      className={`city-building ${powered ? 'is-powered' : 'is-unpowered'}${partyId ? ' is-celebrating' : ''}`}
      style={{ ...box(base), zIndex: String(node.z) }}
      data-testid="city-building"
      data-building={node.building}
      data-powered={powered}
      data-celebrating={partyId ? true : undefined}
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
      {vents.map((v, i) => (
        <span key={i} className="city-steam" style={v} aria-hidden data-testid="city-steam">
          <i />
          <i />
          <i />
        </span>
      ))}
      {partyId && <Celebration key={partyId} lotTop={pct(base.h - 66, base.h)} />}
    </div>
  )
}

/** Sparkles bursting up from the lot and a puff of construction dust at its base. */
function Celebration({ lotTop }: { lotTop: string }) {
  return (
    <span className="city-celebration" style={{ top: lotTop }} aria-hidden data-testid="city-celebration">
      {SPARKS.map(([x, y, delay], i) => (
        <i key={i} className="city-spark" style={{ '--x': `${x}%`, '--y': `${y}%`, animationDelay: `${delay}ms` } as React.CSSProperties} />
      ))}
      <b className="city-dust is-l" />
      <b className="city-dust is-c" />
      <b className="city-dust is-r" />
    </span>
  )
}

/** Where each sparkle ends up (translate %, i.e. multiples of its own size, so the burst scales with the screen) and its delay in ms. */
const SPARKS: [number, number, number][] = [
  [-380, -900, 0],
  [-140, -1150, 80],
  [120, -1050, 40],
  [360, -880, 120],
  [-260, -620, 200],
  [240, -680, 160],
  [0, -1300, 60],
]

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
