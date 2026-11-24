/**
 * Kenney building layers in contact-sheet coordinates (origin = the lot's
 * top-face centre), mirroring placeBuilding() in src/city/iso.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GROUND_TOP = -61 // 34 px tile face + 27 px ground-floor drop
const FLOOR_INSET_X = 17
const STOREY = 34
const ROOF_SEAT = 50

const sprite = (name) => `public/sprites/${name}.png`
const pngHeight = (file) => readFileSync(resolve(file)).readUInt32BE(20)

/** Ground floor + floors + roof, like the game draws a Kenney building. */
export function kenneyStack(ground, floors, roof) {
  const layers = [{ src: sprite(ground), left: -66, top: GROUND_TOP }]
  floors.forEach((f, i) => layers.push({ src: sprite(f), left: -66 + FLOOR_INSET_X, top: GROUND_TOP - STOREY * (i + 1) }))
  const roofSrc = sprite(roof)
  layers.push({ src: roofSrc, left: -66 + FLOOR_INSET_X, top: GROUND_TOP - STOREY * floors.length + ROOF_SEAT - pngHeight(roofSrc) })
  return layers
}

/** A single generated sprite whose lot centre sits `anchorY` px from its top. */
export function single(src, anchorY) {
  return [{ src, left: -66, top: -anchorY }]
}
