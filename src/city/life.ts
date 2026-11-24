/**
 * Town life — decorative citizens and traffic. Pure and deterministic:
 * every actor's pose is a function of time, so there is no state to store,
 * nothing to sync, and the whole timeline is unit-tested.
 *
 * Coordinates are fractional grid cells (c, r); a cell's centre is at its
 * integer (c, r) and it spans ±0.5. Measured from the Kenney road tiles:
 *
 *   asphalt     ±0.22 either side of a road's centre line, ~4 px below the kerb
 *   lanes       ±0.11 (traffic keeps right)
 *   sidewalks   0.28–0.5 from the centre line; walkers use ±0.38
 *
 * Routes are fixed polylines with pauses. Off-map end points (±0.5 beyond
 * the edge) let actors fade in and out as if arriving from the next street.
 */

import { HALF_H, HALF_W } from './iso'
import { GRID } from './layout'

export type Facing = 'NE' | 'SE' | 'SW' | 'NW'

export interface Waypoint {
  c: number
  r: number
  /** Seconds to wait on arriving here. */
  pause?: number
}

export interface ActorDef {
  id: string
  kind: 'citizen' | 'vehicle'
  /** Row in the citizen / vehicle sprite sheet. */
  variant: number
  /** Cells per second. */
  speed: number
  /** Closed loop: the last point connects back to the first. Off-map hops are instant. */
  path: Waypoint[]
  /** Pad the loop to exactly this many seconds (vehicles share one period so their phasing holds). */
  period?: number
  /** Seconds into the loop at t = 0. */
  offset: number
}

const ROAD = 2
const LANE = 0.11
const WALK = 0.38
const EDGE_LO = -0.5
const EDGE_HI = GRID.cols - 0.5 // 4.5 (the grid is square)

const N = ROAD - WALK // 1.62 — north / west sidewalks
const S = ROAD + WALK // 2.38 — south / east sidewalks

/** Out and back along the same sidewalk: [a, …, z] → a…z then z…a, keeping pauses both ways. */
function outAndBack(points: Waypoint[], endPause = 3): Waypoint[] {
  const there = points.map((p, i) => (i === points.length - 1 ? { ...p, pause: endPause } : p))
  const back = points
    .slice(1, -1)
    .reverse()
    .map((p) => ({ ...p }))
  return [{ ...there[0], pause: endPause }, ...there.slice(1), ...back]
}

/** One citizen per quadrant, each on an L of sidewalk round the crossroads. */
export const CITIZENS: ActorDef[] = [
  {
    // North-west: past the Power Station.
    id: 'citizen-0',
    kind: 'citizen',
    variant: 0,
    speed: 0.22,
    offset: 2,
    path: outAndBack([
      { c: EDGE_LO, r: N },
      { c: 1.0, r: N, pause: 2.5 },
      { c: N, r: N },
      { c: N, r: EDGE_LO },
    ]),
  },
  {
    // North-east: window-shopping at the Shop.
    id: 'citizen-1',
    kind: 'citizen',
    variant: 1,
    speed: 0.2,
    offset: 9,
    path: outAndBack([
      { c: S, r: EDGE_LO },
      { c: S, r: N },
      { c: 3.2, r: N, pause: 3 },
      { c: EDGE_HI, r: N },
    ]),
  },
  {
    // South-east: a stop by the park.
    id: 'citizen-2',
    kind: 'citizen',
    variant: 2,
    speed: 0.21,
    offset: 5,
    path: outAndBack([
      { c: EDGE_HI, r: S },
      { c: S, r: S },
      { c: S, r: 3.15, pause: 2.5 },
      { c: S, r: EDGE_HI },
    ]),
  },
  {
    // South-west: leaving home.
    id: 'citizen-3',
    kind: 'citizen',
    variant: 3,
    speed: 0.2,
    offset: 14,
    path: outAndBack([
      { c: N, r: EDGE_HI },
      { c: N, r: 3.95, pause: 3 },
      { c: N, r: S },
      { c: EDGE_LO, r: S },
    ]),
  },
]

/** Both cars loop in the same period, phased so they never share a lane or the crossroads at once. */
export const TRAFFIC_PERIOD = 26

export const VEHICLES: ActorDef[] = [
  {
    // Taxi: along the column road, right turn at the crossroads, back the other way.
    id: 'taxi',
    kind: 'vehicle',
    variant: 0,
    speed: 0.55,
    period: TRAFFIC_PERIOD,
    offset: 0,
    path: [
      { c: EDGE_LO, r: ROAD + LANE },
      { c: ROAD - LANE, r: ROAD + LANE },
      { c: ROAD - LANE, r: EDGE_HI, pause: 3 },
      { c: ROAD + LANE, r: EDGE_HI },
      { c: ROAD + LANE, r: ROAD - LANE },
      { c: EDGE_LO, r: ROAD - LANE, pause: 3 },
    ],
  },
  {
    // Sedan: straight down the row road and back up.
    id: 'sedan',
    kind: 'vehicle',
    variant: 1,
    speed: 0.5,
    period: TRAFFIC_PERIOD,
    // Phased (see life.test.ts) so the cars only ever pass in opposite lanes.
    offset: 20,
    path: [
      { c: ROAD - LANE, r: EDGE_LO },
      { c: ROAD - LANE, r: EDGE_HI, pause: 2.5 },
      { c: ROAD + LANE, r: EDGE_HI },
      { c: ROAD + LANE, r: EDGE_LO, pause: 2.5 },
    ],
  },
]

export const ACTORS: ActorDef[] = [...CITIZENS, ...VEHICLES]

// ── Timeline ───────────────────────────────────────────────────────────────

const offMap = (p: Waypoint) => p.c <= EDGE_LO || p.c >= EDGE_HI || p.r <= EDGE_LO || p.r >= EDGE_HI

type Step =
  | { kind: 'move'; from: Waypoint; to: Waypoint; start: number; duration: number; facing: Facing }
  | { kind: 'wait'; at: Waypoint; start: number; duration: number; facing: Facing }

export interface Timeline {
  steps: Step[]
  period: number
}

export function facingOf(dc: number, dr: number): Facing {
  if (Math.abs(dc) >= Math.abs(dr)) return dc >= 0 ? 'SE' : 'NW'
  return dr >= 0 ? 'SW' : 'NE'
}

export function timelineOf(actor: ActorDef): Timeline {
  const steps: Step[] = []
  let t = 0
  const pts = actor.path
  let facing: Facing = facingOf(pts[1].c - pts[0].c, pts[1].r - pts[0].r)
  for (let i = 0; i < pts.length; i++) {
    const from = pts[i]
    const to = pts[(i + 1) % pts.length]
    if (from.pause) {
      steps.push({ kind: 'wait', at: from, start: t, duration: from.pause, facing })
      t += from.pause
    }
    const dist = Math.hypot(to.c - from.c, to.r - from.r)
    // A segment that stays off the map (e.g. along the edge between two lanes) is invisible: hop instantly.
    const mid = { c: (from.c + to.c) / 2, r: (from.r + to.r) / 2 }
    const duration = offMap(from) && offMap(to) && offMap(mid) ? 0 : dist / actor.speed
    if (duration > 0) facing = facingOf(to.c - from.c, to.r - from.r)
    steps.push({ kind: 'move', from, to, start: t, duration, facing })
    t += duration
  }
  if (actor.period !== undefined) {
    if (actor.period < t) throw new Error(`${actor.id}: route takes ${t.toFixed(1)} s, longer than its ${actor.period} s period`)
    const last = pts[0]
    steps.push({ kind: 'wait', at: last, start: t, duration: actor.period - t, facing })
    t = actor.period
  }
  return { steps, period: t }
}

export interface Pose {
  c: number
  r: number
  facing: Facing
  moving: boolean
  /** 0 off-map … 1 fully inside the town. */
  opacity: number
}

/** Fade over the half cell beyond each edge. */
export function edgeOpacity(c: number, r: number): number {
  const inside = Math.min(c - EDGE_LO, EDGE_HI - c, r - EDGE_LO, EDGE_HI - r)
  return Math.max(0, Math.min(1, inside / 0.5))
}

export function poseAt(timeline: Timeline, seconds: number): Pose {
  const t = ((seconds % timeline.period) + timeline.period) % timeline.period
  let step = timeline.steps[timeline.steps.length - 1]
  for (const s of timeline.steps) {
    if (t < s.start + s.duration) {
      step = s
      break
    }
  }
  if (step.kind === 'wait' || step.duration === 0) {
    const at = step.kind === 'wait' ? step.at : step.to
    return { c: at.c, r: at.r, facing: step.facing, moving: false, opacity: edgeOpacity(at.c, at.r) }
  }
  const k = Math.min(1, Math.max(0, (t - step.start) / step.duration))
  const c = step.from.c + (step.to.c - step.from.c) * k
  const r = step.from.r + (step.to.r - step.from.r) * k
  return { c, r, facing: step.facing, moving: true, opacity: edgeOpacity(c, r) }
}

/** Where a citizen stands when motion is reduced: their first pause on the map. */
export function restPose(actor: ActorDef): Pose {
  const spot = actor.path.find((p) => p.pause && !offMap(p)) ?? actor.path[1]
  const i = actor.path.indexOf(spot)
  const prev = actor.path[Math.max(0, i - 1)]
  return { c: spot.c, r: spot.r, facing: facingOf(spot.c - prev.c, spot.r - prev.r), moving: false, opacity: 1 }
}

// ── Screen placement ───────────────────────────────────────────────────────

/** Art-px position of a point on the town's surface (kerb level). */
export function screenOf(c: number, r: number): { x: number; y: number } {
  return { x: (c - r) * HALF_W, y: (c + r) * HALF_H }
}

/** Painter's order to match the static scene (see buildScene): the cell the actor stands in, above its ground and details. */
export function actorZ(c: number, r: number, kind: ActorDef['kind']): number {
  return (Math.round(c) + Math.round(r)) * 100 + (kind === 'vehicle' ? 30 : 35)
}

/** Sprite-sheet geometry (see public/sprites/citizens.png and vehicles.png). */
export const CITIZEN_SHEET = { frameW: 20, frameH: 26, anchorX: 10, anchorY: 23, framesPerCitizen: 6 }
export const VEHICLE_SHEET = { frameW: 36, frameH: 30, anchorX: 18, anchorY: 22, order: ['NE', 'SE', 'SW', 'NW'] as Facing[] }
/** Asphalt sits below the kerb. */
export const ASPHALT_DROP = 4

/** Citizen frame: the sheet has ↘ (front) and ↖ (back) views; ↙ and ↗ are their mirror images. */
export function citizenFrame(variant: number, facing: Facing, stepIndex: number): { frame: number; flip: boolean } {
  const back = facing === 'NW' || facing === 'NE'
  const flip = facing === 'SW' || facing === 'NE'
  return { frame: variant * CITIZEN_SHEET.framesPerCitizen + (back ? 3 : 0) + stepIndex, flip }
}

/** Walk cycle: stand, left, stand, right — 6 steps a second while moving. */
export function walkStep(seconds: number, moving: boolean): number {
  if (!moving) return 0
  return [0, 1, 0, 2][Math.floor(seconds * 6) % 4]
}
