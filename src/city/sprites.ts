/**
 * Kenney isometric sprites used by the city (CC0 — see public/sprites/LICENSE-kenney.txt).
 * Sizes are the PNGs' intrinsic pixel sizes; the scene positions everything
 * in these "art pixels" and scales the whole scene with CSS.
 */

export interface Sprite {
  src: string
  w: number
  h: number
}

const s = (name: string, w: number, h: number): Sprite => ({ src: `/sprites/${name}.png`, w, h })

export const SPRITES = {
  // Ground tiles (132 wide, 132×66 top diamond, top-aligned)
  grass: s('ground-grass', 132, 99),
  pavement: s('ground-pavement', 132, 99),
  roadCol: s('road-col', 132, 101), // runs along the column axis (screen ↘)
  roadRow: s('road-row', 132, 101), // runs along the row axis (screen ↙)
  roadCross: s('road-cross', 132, 101),
  fountain: s('park-fountain', 132, 101),

  // Details
  tree: s('tree', 32, 45),
  lamp: s('lamp-a', 22, 46),

  // Buildings: a ground floor (replaces a tile), stackable floors, a roof
  houseAGround: s('house-a-ground', 132, 127),
  houseAFloor: s('house-a-floor', 99, 85),
  houseARoof: s('house-a-roof', 99, 60),
  houseBGround: s('house-b-ground', 132, 127),
  houseBFloor: s('house-b-floor', 100, 85),
  houseBRoof: s('house-b-roof', 99, 61),
  shopGround: s('shop-ground', 132, 127),
  shopFloor: s('shop-floor', 99, 85),
  shopRoof: s('shop-roof', 99, 54),
  powerGround: s('power-ground', 133, 127),
  powerFloor: s('power-floor', 100, 85),
  powerRoof: s('power-roof', 99, 61),
} satisfies Record<string, Sprite>

export type SpriteKey = keyof typeof SPRITES

/** A building's look: one ground floor, a floor repeated per extra level, a roof. */
export interface BuildingArt {
  ground: SpriteKey
  floor: SpriteKey
  roof: SpriteKey
}

export const ART = {
  power: { ground: 'powerGround', floor: 'powerFloor', roof: 'powerRoof' },
  houseA: { ground: 'houseAGround', floor: 'houseAFloor', roof: 'houseARoof' },
  houseB: { ground: 'houseBGround', floor: 'houseBFloor', roof: 'houseBRoof' },
  shop: { ground: 'shopGround', floor: 'shopFloor', roof: 'shopRoof' },
} satisfies Record<string, BuildingArt>

export type ArtKey = keyof typeof ART
