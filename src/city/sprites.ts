/**
 * Kenney isometric sprites used by the city (CC0 — see public/sprites/LICENSE-kenney.txt),
 * plus original sprites rendered in the same style by tools/sprite-pipeline.
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
  houseAGround2: s('house-a-ground-2', 132, 127),
  houseAFloor2: s('house-a-floor-2', 100, 85),
  houseARoof2: s('house-a-roof-2', 99, 60),
  houseARoof3: s('house-a-roof-3', 99, 60),
  houseBGround: s('house-b-ground', 132, 127),
  houseBFloor: s('house-b-floor', 100, 85),
  houseBRoof: s('house-b-roof', 99, 61),
  houseBGround2: s('house-b-ground-2', 133, 127),
  houseBFloor2: s('house-b-floor-2', 100, 85),
  houseBRoof2: s('house-b-roof-2', 99, 61),
  houseBRoof3: s('house-b-roof-3', 99, 61),
  shopGround1: s('shop-ground-1', 132, 127),
  shopGround: s('shop-ground', 132, 127),
  shopFloor: s('shop-floor', 99, 85),
  shopGround3: s('shop-ground-3', 132, 127),
  shopFloor3: s('shop-floor-3', 99, 85),
  shopRoof: s('shop-roof', 99, 54),
  powerGround: s('power-ground', 133, 127),
  powerFloor: s('power-floor', 100, 85),
  powerRoof: s('power-roof', 99, 61),

  // Original art rendered by tools/sprite-pipeline (geometric models, Kenney style).
  // Whole buildings on their lots; see POWER_STATION_ANCHOR for each lot centre.
  powerStation1: s('power-station-1', 132, 164),
  powerStation2: s('power-station-2', 132, 170),
  powerStation3: s('power-station-3', 132, 218),

  // Town life (decorative; positioned by src/city/life.ts, not the static scene).
  // Citizens are original pipeline art (Kenney's packs have no people);
  // vehicles are Kenney's Isometric Vehicles taxi and red sedan, 4 headings each.
  citizens: s('citizens', 480, 26),
  vehicles: s('vehicles', 144, 60),
} satisfies Record<string, Sprite>

export type SpriteKey = keyof typeof SPRITES

/** A Kenney building at one level: a ground floor, upper floors (bottom to top), a roof. */
export interface StackArt {
  ground: SpriteKey
  floors: SpriteKey[]
  roof: SpriteKey
}

/** A single pre-composed sprite whose lot top-face centre is `anchorY` px from its top. */
export interface SingleArt {
  sprite: SpriteKey
  anchorY: number
}

export type LevelArt = StackArt | SingleArt

/** A building's look at levels 1, 2 and 3. */
export type BuildingArt = readonly [LevelArt, LevelArt, LevelArt]

/**
 * Use the Power Station art rendered by tools/sprite-pipeline (generator
 * building → substation → power complex). Set to false to fall back to the
 * original Kenney stack.
 */
export const USE_POWER_STATION_ART = true

/** Row of each Power Station sprite's lot top-face centre (sprite height − 66). */
const POWER_STATION_ANCHOR = [98, 104, 152] as const

const stack = (ground: SpriteKey, floors: SpriteKey[], roof: SpriteKey): StackArt => ({ ground, floors, roof })

const KENNEY_POWER: BuildingArt = [
  stack('powerGround', [], 'powerRoof'),
  stack('powerGround', ['powerFloor'], 'powerRoof'),
  stack('powerGround', ['powerFloor', 'powerFloor'], 'powerRoof'),
]

/**
 * Upgrade stages. Every level changes the facade, roof or both — not just the
 * height — while each house keeps its wall colour so it stays recognisable:
 *
 *   houses  cottage (orange roof) → townhouse, arched windows (red roof)
 *           → three storeys (slate roof)
 *   shop    market stall → shop with awning → glass department store
 *   power   generator building → electrical substation → power complex
 */
export const ART = {
  power: USE_POWER_STATION_ART
    ? [
        { sprite: 'powerStation1', anchorY: POWER_STATION_ANCHOR[0] },
        { sprite: 'powerStation2', anchorY: POWER_STATION_ANCHOR[1] },
        { sprite: 'powerStation3', anchorY: POWER_STATION_ANCHOR[2] },
      ]
    : KENNEY_POWER,
  houseA: [
    stack('houseAGround', [], 'houseARoof'),
    stack('houseAGround2', ['houseAFloor2'], 'houseARoof2'),
    stack('houseAGround2', ['houseAFloor2', 'houseAFloor'], 'houseARoof3'),
  ],
  houseB: [
    stack('houseBGround', [], 'houseBRoof'),
    stack('houseBGround2', ['houseBFloor2'], 'houseBRoof2'),
    stack('houseBGround2', ['houseBFloor2', 'houseBFloor'], 'houseBRoof3'),
  ],
  shop: [
    stack('shopGround1', [], 'shopRoof'),
    stack('shopGround', ['shopFloor'], 'shopRoof'),
    stack('shopGround3', ['shopFloor3', 'shopFloor'], 'shopRoof'),
  ],
} satisfies Record<string, BuildingArt>

export type ArtKey = keyof typeof ART

/** The look for `level` (clamped to the levels that have art). */
export function artForLevel(art: BuildingArt, level: number): LevelArt {
  const i = Math.min(art.length, Math.max(1, Math.floor(level))) - 1
  return art[i]
}

export function isSingleArt(art: LevelArt): art is SingleArt {
  return 'sprite' in art
}

/**
 * Where steam rises from a sprite (sprite px): the Level 3 cooling tower's
 * mouth. Animated in the scene only while the town has power.
 */
export const STEAM_VENTS: Partial<Record<SpriteKey, { x: number; y: number }>> = {
  powerStation3: { x: 106, y: 98 },
}
