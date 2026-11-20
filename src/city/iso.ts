/**
 * Isometric geometry for Kenney's 132-px tiles — pure functions, measured from
 * the PNGs (see the Phase 3 notes in the PR):
 *
 *   ground tile  132 wide, top diamond 132×66, top-face centre at (66, 34)
 *   ground floor 132×127, sits 27 px lower than a ground tile (own base + dirt)
 *   upper floor  99×85, inset 17 px, each storey 34 px above the last
 *   roof         bottom-anchored 50 px below the top block's top edge
 *
 * Grid: column c grows toward screen bottom-right, row r toward bottom-left.
 */

import { SPRITES, type BuildingArt, type SpriteKey } from './sprites'

export const HALF_W = 66
export const HALF_H = 33
const TILE_FACE_Y = 34 // top-face centre, from the tile image's top edge
const GROUND_FLOOR_DROP = 27 // building base vs ground tile
const FLOOR_INSET_X = 17
const STOREY = 34
const ROOF_SEAT = 50

export interface Point {
  x: number
  y: number
}

/** Screen position (art px) of the centre of a cell's top face. */
export function cellCenter(c: number, r: number): Point {
  return { x: (c - r) * HALF_W, y: (c + r) * HALF_H }
}

/** One positioned image, in art px. */
export interface Placed {
  sprite: SpriteKey
  left: number
  top: number
  w: number
  h: number
  flip?: boolean
}

export function placeTile(sprite: SpriteKey, c: number, r: number): Placed {
  const { x, y } = cellCenter(c, r)
  const { w, h } = SPRITES[sprite]
  return { sprite, left: x - HALF_W, top: y - TILE_FACE_Y, w, h }
}

/** A small detail (tree, lamp) standing at `offset` from the cell centre, bottom-anchored. */
export function placeDetail(sprite: SpriteKey, c: number, r: number, offset: Point = { x: 0, y: 0 }, flip = false): Placed {
  const { x, y } = cellCenter(c, r)
  const { w, h } = SPRITES[sprite]
  return { sprite, left: x + offset.x - w / 2, top: y + offset.y - h + 4, w, h, flip }
}

/**
 * The layers of a building at `level` (1 = ground floor + roof; each extra
 * level adds one floor), bottom to top. `flip` mirrors it so its front faces
 * swap — still a valid isometric view.
 */
export function placeBuilding(art: BuildingArt, c: number, r: number, level: number, flip = false): Placed[] {
  const { x, y } = cellCenter(c, r)
  const ground = SPRITES[art.ground]
  const groundTop = y - TILE_FACE_Y - GROUND_FLOOR_DROP
  const layers: Placed[] = [{ sprite: art.ground, left: x - HALF_W, top: groundTop, w: ground.w, h: ground.h, flip }]

  const floors = Math.max(0, Math.floor(level) - 1)
  const floor = SPRITES[art.floor]
  for (let k = 1; k <= floors; k++) {
    layers.push({ sprite: art.floor, left: x - HALF_W + FLOOR_INSET_X, top: groundTop - STOREY * k, w: floor.w, h: floor.h, flip })
  }
  const roof = SPRITES[art.roof]
  const topBlockTop = groundTop - STOREY * floors
  layers.push({ sprite: art.roof, left: x - HALF_W + FLOOR_INSET_X, top: topBlockTop + ROOF_SEAT - roof.h, w: roof.w, h: roof.h, flip })
  return layers
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(items: Placed[], pad = 0): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const p of items) {
    b.minX = Math.min(b.minX, p.left)
    b.minY = Math.min(b.minY, p.top)
    b.maxX = Math.max(b.maxX, p.left + p.w)
    b.maxY = Math.max(b.maxY, p.top + p.h)
  }
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }
}
