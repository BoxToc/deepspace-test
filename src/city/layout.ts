/**
 * DreamGrid's fixed town: a 5×5 block around a crossroads.
 *
 *           c0      c1      c2      c3      c4
 *   r0    grass   grass   road    pave    grass
 *   r1    grass   POWER   road    SHOP    pave
 *   r2    road    road    cross   road    road
 *   r3    grass   HOUSE   road    PARK*   grass
 *   r4    grass   HOUSE   road    grass   grass      (*fountain; park trees around it)
 *
 * Only the two faces toward +c / +r are visible in this projection, so every
 * building sits behind a road on one of those sides; houses are mirrored so
 * their doors face the street.
 */

import type { BuildingKey } from '@/game/config'
import type { Point } from './iso'
import type { ArtKey, SpriteKey } from './sprites'

export const GRID = { cols: 5, rows: 5 }

const ROAD_C = 2
const ROAD_R = 2

/** Ground for every cell (building cells get their own base instead). */
export function groundAt(c: number, r: number): SpriteKey {
  if (c === ROAD_C && r === ROAD_R) return 'roadCross'
  if (r === ROAD_R) return 'roadCol'
  if (c === ROAD_C) return 'roadRow'
  if ((c === 3 && r === 0) || (c === 4 && r === 1)) return 'pavement'
  if (c === 3 && r === 3) return 'fountain'
  return 'grass'
}

export interface BuildingPlacement {
  building: BuildingKey
  art: ArtKey
  c: number
  r: number
  flip?: boolean
}

export const BUILDING_PLACEMENTS: BuildingPlacement[] = [
  { building: 'power', art: 'power', c: 1, r: 1 },
  { building: 'shop', art: 'shop', c: 3, r: 1 },
  { building: 'residential', art: 'houseA', c: 1, r: 3, flip: true },
  { building: 'residential', art: 'houseB', c: 1, r: 4, flip: true },
]

export interface DetailPlacement {
  sprite: SpriteKey
  c: number
  r: number
  offset?: Point
  flip?: boolean
  /** Dims with this building when it has no power. */
  owner?: BuildingKey
  /** Lamps light up when the city is powered. */
  light?: boolean
}

const PARK_TREES: [number, number, Point][] = [
  [4, 3, { x: -14, y: -6 }],
  [4, 3, { x: 22, y: 8 }],
  [3, 4, { x: -18, y: 4 }],
  [3, 4, { x: 16, y: -8 }],
  [4, 4, { x: 0, y: -4 }],
]

export const DETAILS: DetailPlacement[] = [
  // Park greenery (dims with the park)
  ...PARK_TREES.map(([c, r, offset]) => ({ sprite: 'tree' as const, c, r, offset, owner: 'park' as const })),
  // Scenery
  { sprite: 'tree', c: 0, r: 0, offset: { x: 6, y: -2 } },
  { sprite: 'tree', c: 1, r: 0, offset: { x: -10, y: 4 } },
  { sprite: 'tree', c: 0, r: 1, offset: { x: -4, y: 6 } },
  { sprite: 'tree', c: 4, r: 0, offset: { x: 4, y: 0 } },
  { sprite: 'tree', c: 0, r: 3, offset: { x: 2, y: -2 } },
  { sprite: 'tree', c: 0, r: 4, offset: { x: -6, y: 2 } },
  // Street lamps on the sidewalks
  { sprite: 'lamp', c: 0, r: 2, offset: { x: 26, y: -13 }, light: true },
  { sprite: 'lamp', c: 4, r: 2, offset: { x: 26, y: -13 }, light: true },
  { sprite: 'lamp', c: 2, r: 0, offset: { x: -26, y: -13 }, light: true, flip: true },
  { sprite: 'lamp', c: 2, r: 4, offset: { x: -26, y: -13 }, light: true, flip: true },
]

/** The park's own "building" footprint is the fountain cell. */
export const PARK_CELL = { c: 3, r: 3 }
