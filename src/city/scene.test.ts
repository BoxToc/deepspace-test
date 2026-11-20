import { describe, expect, it } from 'vitest'
import { BUILDING_KEYS } from '@/game/config'
import { isCityPowered } from '@/game/power'
import { cellCenter, placeBuilding, placeTile } from './iso'
import { BUILDING_PLACEMENTS, DETAILS, GRID, groundAt } from './layout'
import { buildingsInScene, buildScene } from './scene'
import { ART } from './sprites'

const level1 = { power: 1, residential: 1, shop: 1, park: 1 }
describe('isometric geometry', () => {
  it('maps cells to a 2:1 diamond grid', () => {
    expect(cellCenter(0, 0)).toEqual({ x: 0, y: 0 })
    expect(cellCenter(1, 0)).toEqual({ x: 66, y: 33 })
    expect(cellCenter(0, 1)).toEqual({ x: -66, y: 33 })
    expect(cellCenter(2, 2)).toEqual({ x: 0, y: 132 })
  })

  it('aligns a tile so its top-face centre sits on the cell centre', () => {
    expect(placeTile('grass', 1, 0)).toMatchObject({ left: 0, top: -1, w: 132, h: 99 })
  })

  it('stacks one floor per level above the ground floor, roof on top', () => {
    for (const level of [1, 2, 3]) {
      const layers = placeBuilding(ART.shop, 0, 0, level)
      expect(layers).toHaveLength(level + 1)
      expect(layers[0].sprite).toBe('shopGround')
      expect(layers.at(-1)!.sprite).toBe('shopRoof')
      const floors = layers.slice(1, -1)
      floors.forEach((f, i) => expect(layers[0].top - f.top).toBe(34 * (i + 1)))
      // Roof sits higher as the building grows.
      if (level > 1) expect(layers.at(-1)!.top).toBeLessThan(placeBuilding(ART.shop, 0, 0, level - 1).at(-1)!.top)
    }
  })
})

describe('town layout', () => {
  const scene = buildScene(level1)

  it('contains all four MVP buildings', () => {
    expect([...buildingsInScene(scene)].sort()).toEqual([...BUILDING_KEYS].sort())
  })

  it('keeps every placement inside the grid, one building per cell, never on a road', () => {
    const cells = new Set<string>()
    for (const b of BUILDING_PLACEMENTS) {
      expect(b.c).toBeGreaterThanOrEqual(0)
      expect(b.c).toBeLessThan(GRID.cols)
      expect(b.r).toBeGreaterThanOrEqual(0)
      expect(b.r).toBeLessThan(GRID.rows)
      expect(cells.has(`${b.c},${b.r}`)).toBe(false)
      cells.add(`${b.c},${b.r}`)
      expect(groundAt(b.c, b.r)).not.toMatch(/^road/)
    }
    for (const d of DETAILS) expect(cells.has(`${d.c},${d.r}`)).toBe(false)
  })

  it('faces every building onto a road on a visible (+c or +r) side', () => {
    for (const b of BUILDING_PLACEMENTS) {
      const front = [groundAt(b.c + 1, b.r), groundAt(b.c, b.r + 1)]
      expect(front.some((g) => g.startsWith('road')), `${b.art}`).toBe(true)
    }
  })

  it('draws back-to-front (painter’s algorithm)', () => {
    const depthOf = (n: (typeof scene.nodes)[number]) => {
      const item = n.kind === 'building' ? n.layers[0] : n.item
      return item.top + item.h // lower on screen = nearer
    }
    const tiles = scene.nodes.filter((n) => n.kind !== 'detail')
    for (let i = 1; i < tiles.length; i++) {
      expect(depthOf(tiles[i]) + 30).toBeGreaterThanOrEqual(depthOf(tiles[i - 1]))
    }
  })

  it('grows taller with levels without changing the footprint', () => {
    const tall = buildScene({ power: 3, residential: 3, shop: 3, park: 3 })
    expect(tall.height).toBeGreaterThan(scene.height)
    expect(tall.width).toBe(scene.width)
  })
})

describe('power state', () => {
  it('is powered while any energy is stored', () => {
    expect(isCityPowered({ electricity: 20 })).toBe(true)
    expect(isCityPowered({ electricity: 0.01 })).toBe(true)
    expect(isCityPowered({ electricity: 0 })).toBe(false)
  })
})
