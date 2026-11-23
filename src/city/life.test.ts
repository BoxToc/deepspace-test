import { describe, expect, it } from 'vitest'
import { BUILDING_PLACEMENTS } from './layout'
import { ACTORS, CITIZENS, TRAFFIC_PERIOD, VEHICLES, citizenFrame, poseAt, restPose, timelineOf, type Pose } from './life'

const ROAD = 2
const near = (v: number) => Math.round(v)

/** Sample an actor's visible poses over two full loops. */
function visiblePoses(actor: (typeof ACTORS)[number], step = 0.05): { t: number; p: Pose }[] {
  const tl = timelineOf(actor)
  const out = []
  for (let t = 0; t < tl.period * 2; t += step) {
    const p = poseAt(tl, t + actor.offset)
    if (p.opacity > 0) out.push({ t, p })
  }
  return out
}

describe('citizens', () => {
  it('only ever walk on sidewalks: never on asphalt, grass or a building lot', () => {
    for (const a of CITIZENS) {
      for (const { p } of visiblePoses(a)) {
        const onRowRoad = near(p.r) === ROAD && Math.abs(p.r - ROAD) >= 0.28 && Math.abs(p.r - ROAD) <= 0.5
        const onColRoad = near(p.c) === ROAD && Math.abs(p.c - ROAD) >= 0.28 && Math.abs(p.c - ROAD) <= 0.5
        expect(onRowRoad || onColRoad, `${a.id} at ${p.c.toFixed(2)},${p.r.toFixed(2)}`).toBe(true)
        expect(BUILDING_PLACEMENTS.some((b) => b.c === near(p.c) && b.r === near(p.r))).toBe(false)
      }
    }
  })

  it('face the way they walk, and stand still while pausing', () => {
    for (const a of CITIZENS) {
      const tl = timelineOf(a)
      let paused = 0
      for (let t = 0; t < tl.period; t += 0.25) {
        const p = poseAt(tl, t)
        const q = poseAt(tl, t + 0.05)
        if (!p.moving) {
          paused++
          continue
        }
        if (!q.moving) continue
        const dc = q.c - p.c
        const dr = q.r - p.r
        const expected = Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 'SE' : 'NW') : dr > 0 ? 'SW' : 'NE'
        expect(p.facing, a.id).toBe(expected)
      }
      expect(paused, `${a.id} pauses`).toBeGreaterThan(0)
    }
  })

  it('use the mirrored sheet frames for ↙ and ↗', () => {
    expect(citizenFrame(1, 'SE', 0)).toEqual({ frame: 6, flip: false })
    expect(citizenFrame(1, 'SW', 2)).toEqual({ frame: 8, flip: true })
    expect(citizenFrame(1, 'NW', 1)).toEqual({ frame: 10, flip: false })
    expect(citizenFrame(1, 'NE', 0)).toEqual({ frame: 9, flip: true })
  })

  it('rest on the map when motion is reduced', () => {
    for (const a of CITIZENS) expect(restPose(a).opacity, a.id).toBe(1)
  })
})

describe('traffic', () => {
  it('drives across the town on the asphalt', () => {
    for (const a of VEHICLES) {
      const seen = visiblePoses(a)
      // Visible for most of each crossing (not hopping from edge to edge).
      expect(seen.length * 0.05, a.id).toBeGreaterThan(TRAFFIC_PERIOD)
      for (const { p } of seen) {
        const onRowRoad = near(p.r) === ROAD && Math.abs(p.r - ROAD) <= 0.22
        const onColRoad = near(p.c) === ROAD && Math.abs(p.c - ROAD) <= 0.22
        expect(onRowRoad || onColRoad, `${a.id} at ${p.c.toFixed(2)},${p.r.toFixed(2)}`).toBe(true)
      }
    }
  })

  it('shares one period, phased so the cars only ever pass in opposite lanes', () => {
    const opposite = (p: Pose, q: Pose) => ({ NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE' })[p.facing] === q.facing
    for (const a of VEHICLES) expect(timelineOf(a).period).toBe(TRAFFIC_PERIOD)
    const [a, b] = VEHICLES.map(timelineOf)
    let closest = Infinity
    let together = 0
    for (let t = 0; t < TRAFFIC_PERIOD; t += 0.02) {
      const p = poseAt(a, t + VEHICLES[0].offset)
      const q = poseAt(b, t + VEHICLES[1].offset)
      if (p.opacity > 0 && q.opacity > 0) {
        together++
        if (!opposite(p, q)) closest = Math.min(closest, Math.hypot(p.c - q.c, p.r - q.r))
      }
    }
    // Both cars are on screen for a good part of the loop…
    expect(together * 0.02).toBeGreaterThan(5)
    // …yet never close in the same lane or across the crossroads.
    expect(closest).toBeGreaterThan(1.5)
  })
})
