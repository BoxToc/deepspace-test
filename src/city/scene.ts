/**
 * Builds the city as a flat, depth-sorted list of things to draw — pure, so
 * it is unit-tested without a browser. Painter's algorithm: cells are drawn
 * back-to-front by (c + r), and within a cell ground → details → building.
 */

import { BUILDING_KEYS, type BuildingKey } from '@/game/config'
import type { BuildingLevels } from '@/game/types'
import { boundsOf, placeBuilding, placeDetail, placeTile, type Bounds, type Placed } from './iso'
import { BUILDING_PLACEMENTS, DETAILS, GRID, PARK_CELL, groundAt } from './layout'
import { ART, artForLevel } from './sprites'

/**
 * `z` is the node's painter's-order stacking index: (c + r) × 100, then ground
 * < details < building within a cell. Static nodes are already in DOM order;
 * the explicit z lets moving actors (src/city/life.ts) slot in between.
 */
export type SceneNode = { z: number } & (
  | { kind: 'ground'; id: string; item: Placed; owner?: BuildingKey }
  | { kind: 'detail'; id: string; item: Placed; owner?: BuildingKey; light?: boolean; sway?: number }
  | { kind: 'building'; id: string; building: BuildingKey; layers: Placed[] }
)

type Unranked = SceneNode extends infer N ? (N extends SceneNode ? Omit<N, 'z'> : never) : never

export interface Scene {
  nodes: SceneNode[]
  bounds: Bounds
  width: number
  height: number
}

const BUILDING_CELLS = new Set(BUILDING_PLACEMENTS.map((b) => `${b.c},${b.r}`))

export function buildScene(levels: BuildingLevels): Scene {
  const ranked: { depth: number; order: number; node: SceneNode }[] = []
  const add = (c: number, r: number, order: number, node: Unranked) =>
    ranked.push({ depth: c + r, order: order + c / 100, node: { ...node, z: (c + r) * 100 + order * 10 + c } as SceneNode })

  for (let c = 0; c < GRID.cols; c++) {
    for (let r = 0; r < GRID.rows; r++) {
      if (BUILDING_CELLS.has(`${c},${r}`)) continue
      const isPark = c === PARK_CELL.c && r === PARK_CELL.r
      add(c, r, 0, { kind: 'ground', id: `g-${c}-${r}`, item: placeTile(groundAt(c, r), c, r), owner: isPark ? 'park' : undefined })
    }
  }
  DETAILS.forEach((d, i) =>
    add(d.c, d.r, 1, {
      kind: 'detail',
      id: `d-${i}`,
      item: placeDetail(d.sprite, d.c, d.r, d.offset, d.flip),
      owner: d.owner,
      light: d.light,
      // Trees sway, each a little out of step with its neighbours.
      sway: d.sprite === 'tree' ? i : undefined,
    }),
  )
  BUILDING_PLACEMENTS.forEach((b) =>
    add(b.c, b.r, 2, {
      kind: 'building',
      id: `b-${b.art}`,
      building: b.building,
      layers: placeBuilding(artForLevel(ART[b.art], levels[b.building] ?? 1), b.c, b.r, b.flip),
    }),
  )

  ranked.sort((a, b) => a.depth - b.depth || a.order - b.order)
  const nodes = ranked.map((x) => x.node)
  const all = nodes.flatMap((n) => (n.kind === 'building' ? n.layers : [n.item]))
  const bounds = boundsOf(all, 12)
  return { nodes, bounds, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY }
}

/** Every MVP building appears in the scene (the park via its fountain + trees). */
export function buildingsInScene(scene: Scene): Set<BuildingKey> {
  const found = new Set<BuildingKey>()
  for (const n of scene.nodes) {
    if (n.kind === 'building') found.add(n.building)
    else if (n.owner) found.add(n.owner)
  }
  return found
}

export { BUILDING_KEYS }
