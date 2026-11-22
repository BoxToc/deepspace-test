/**
 * DreamGrid Power Station — one facility in three upgrade stages.
 *
 *   L1  Generator building  red-brick generator hall with a slate gable roof,
 *                           roll-up door + bolt sign, louvre grilles, exhaust
 *                           stack; one transformer and a cabinet outside
 *   L2  Electrical substation  the same hall (ridge ventilator added) + a
 *                           control wing, two transformers, a line gantry
 *                           with insulators, cabinets and conduits
 *   L3  Power complex       the hall rises to two storeys with a bigger roof
 *                           and a banded stack, the wing grows a storey, a
 *                           cooling tower, transformers and cabinets
 *
 * Continuity: the hall keeps its footprint, red brick, slate gable roof,
 * street-facing roll-up door with the yellow bolt sign and its stack at every
 * level; upgrades only add to the same lot around it.
 *
 * World: one 1×1 lot. Visible faces are +z (screen-left) and +x
 * (screen-right). Tall parts sit at the back (−x, −z) or to the sides so the
 * hall's door stays visible.
 */
import * as THREE from 'three'
import { BOLT, box, cylinder, decal, gableRoof, lathe, puff, scaled, upPx } from '../kenney-style.js'

const BRICK = 'red'
const TRIM = 'concrete'

/** Canvas big enough for level 3; render.mjs trims the empty top. */
export const outputFor = () => ({ width: 132, height: 280, anchor: [66, 280 - 66], trimTop: 3 })

// ── Parts ──────────────────────────────────────────────────────────────────

/** Kenney building lot: 19 px of concrete on 14 px of dirt, plus a service pad. */
function lot(g) {
  const slab = upPx(19)
  const dirt = upPx(14)
  g.add(box('dirt', [1, dirt, 1], [0, -slab - dirt, 0]))
  g.add(box('concrete', [1, slab, 1], [0, -slab, 0]))
  g.add(box('concreteDark', [0.86, 0.012, 0.86], [0, 0, 0]))
}

/**
 * A walled block over [x0,x1]×[z0,z1], `h` tall, in `wall` colour, with a
 * Kenney plinth and cornice. Returns the top height.
 */
function block(g, wall, [x0, x1], [z0, z1], h) {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  g.add(box('concreteDark', [x1 - x0 + 0.02, 0.035, z1 - z0 + 0.02], [cx, 0.012, cz])) // plinth
  g.add(box(wall, [x1 - x0, h, z1 - z0], [cx, 0.012, cz]))
  g.add(box(TRIM, [x1 - x0 + 0.02, 0.028, z1 - z0 + 0.02], [cx, 0.012 + h - 0.028, cz])) // cornice
  return 0.012 + h
}

/** Flat Kenney roof: concrete parapet around a slightly lower deck. */
function flatRoof(g, [x0, x1], [z0, z1], y) {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  g.add(box(TRIM, [x1 - x0 + 0.02, 0.03, z1 - z0 + 0.02], [cx, y, cz]))
  g.add(box('concreteDark', [x1 - x0 - 0.06, 0.012, z1 - z0 - 0.06], [cx, y + 0.026, cz]))
}

/** Louvre grille on the +z face (u along x) or +x face (u along −z). */
function grille(g, face, at, u, y, w = 0.12, h = 0.11) {
  if (face === 'z') {
    g.add(box('dark', [w, h, 0.01], [u, y, at]))
    for (let i = 0; i < 4; i++) g.add(box('steel', [w - 0.02, 0.011, 0.016], [u, y + 0.014 + i * (h - 0.02) / 3.4, at]))
  } else {
    g.add(box('dark', [0.01, h, w], [at, y, u]))
    for (let i = 0; i < 4; i++) g.add(box('steel', [0.016, 0.011, w - 0.02], [at, y + 0.014 + i * (h - 0.02) / 3.4, u]))
  }
}

/** Window (Kenney blue glass in a concrete frame) on the +z or +x face. */
function windowAt(g, face, at, u, y, w = 0.08, h = 0.1) {
  if (face === 'z') {
    g.add(box(TRIM, [w + 0.02, h + 0.02, 0.008], [u, y - 0.01, at]))
    g.add(box('window', [w, h, 0.012], [u, y, at]))
  } else {
    g.add(box(TRIM, [0.008, h + 0.02, w + 0.02], [at, y - 0.01, u]))
    g.add(box('window', [0.012, h, w], [at, y, u]))
  }
}

/** Roll-up door with slats on the +x face, centred at z = u. */
function rollUpDoor(g, at, u, w = 0.17, h = 0.25) {
  g.add(box('dark', [0.012, h + 0.02, w + 0.03], [at, 0.012, u]))
  g.add(box('steel', [0.016, h, w], [at, 0.012, u]))
  for (let i = 1; i < 6; i++) g.add(box('dark', [0.02, 0.006, w], [at, 0.012 + (i * h) / 6, u]))
}

/** Yellow bolt on a dark plate, on the +x face. */
function boltSign(g, at, u, y, size = 0.1) {
  g.add(box('dark', [0.01, size * 1.15, size * 1.0], [at, y, u]))
  // On the +x face the decal's u axis runs along −z, so its left edge sits at z = u + w/2.
  g.add(decal('yellow', scaled(BOLT, size * 0.9), 'x', at + 0.006, [-(u + size * 0.42), y + size * 0.1]))
}

/** Pad-mounted transformer: finned steel tank, three insulators, bolt plate. */
function transformer(g, x, z, s = 1) {
  const w = 0.15 * s
  const d = 0.12 * s
  const h = 0.17 * s
  g.add(box('dark', [w + 0.03, 0.02, d + 0.03], [x, 0.012, z]))
  g.add(box('steel', [w, h, d], [x, 0.032, z]))
  // Cooling fins on both visible faces.
  for (let i = 0; i < 4; i++) {
    g.add(box('slate', [0.012, h * 0.8, 0.02], [x - w / 2 + 0.025 + i * (w - 0.05) / 3, 0.032 + h * 0.08, z + d / 2 + 0.008]))
    if (i < 3) g.add(box('slate', [0.02, h * 0.8, 0.012], [x + w / 2 + 0.008, 0.032 + h * 0.08, z - d / 2 + 0.03 + i * (d - 0.06) / 2]))
  }
  g.add(box('slate', [w + 0.012, 0.014, d + 0.012], [x, 0.032 + h, z])) // lid
  for (let i = -1; i <= 1; i++) {
    const ix = x + i * w * 0.3
    g.add(cylinder('white', 0.014 * s, 0.07 * s, [ix, 0.046 + h, z], 10))
    g.add(cylinder('dark', 0.017 * s, 0.012, [ix, 0.046 + h + 0.07 * s, z], 10))
  }
  g.add(box('yellow', [0.05 * s, 0.05 * s, 0.008], [x - w * 0.2, 0.032 + h * 0.35, z + d / 2 + 0.006]))
}

/** Steel electrical cabinet with a small bolt sign. */
function cabinet(g, x, z, h = 0.17) {
  g.add(box('steel', [0.1, h, 0.08], [x, 0.012, z]))
  g.add(box('slate', [0.115, 0.016, 0.095], [x, 0.012 + h, z]))
  g.add(box('dark', [0.004, h * 0.75, 0.002], [x, 0.03, z + 0.041])) // door seam
  g.add(decal('yellow', scaled(BOLT, 0.06), 'z', z + 0.041, [x - 0.04, 0.012 + h * 0.45], 0.006))
}

/** Ground conduit (dark) between two points, along x then z. */
function conduit(g, [xa, za], [xb, zb]) {
  if (xa !== xb) g.add(box('dark', [Math.abs(xb - xa), 0.022, 0.026], [(xa + xb) / 2, 0.012, za]))
  if (za !== zb) g.add(box('dark', [0.026, 0.022, Math.abs(zb - za)], [xb, 0.012, (za + zb) / 2]))
}

/** Line gantry: two lattice-ish posts, a crossbeam and hanging insulators (along x at z). */
function gantry(g, [xa, xb], z, h = 0.46) {
  for (const x of [xa, xb]) {
    g.add(box('steel', [0.028, h, 0.028], [x, 0.012, z]))
    g.add(box('concreteDark', [0.06, 0.03, 0.06], [x, 0.012, z]))
  }
  g.add(box('steel', [Math.abs(xb - xa) + 0.06, 0.03, 0.03], [(xa + xb) / 2, 0.012 + h, z]))
  for (let i = 0; i < 3; i++) {
    const x = xa + ((i + 0.5) * (xb - xa)) / 3
    g.add(cylinder('white', 0.012, 0.08, [x, 0.012 + h - 0.08, z], 8))
    g.add(cylinder('dark', 0.016, 0.01, [x, 0.012 + h - 0.085, z], 8))
  }
}

/** Exhaust stack; `bands` adds red/white warning bands near the top. */
function stack(g, x, z, y0, h, r = 0.045, bands = false) {
  g.add(cylinder('steel', r, h, [x, y0, z]))
  if (bands) {
    g.add(cylinder('red', r + 0.003, 0.05, [x, y0 + h - 0.16, z]))
    g.add(cylinder('white', r + 0.003, 0.05, [x, y0 + h - 0.11, z]))
    g.add(cylinder('red', r + 0.003, 0.05, [x, y0 + h - 0.06, z]))
  }
  g.add(cylinder('dark', r + 0.013, 0.03, [x, y0 + h, z]))
}

/** Hyperbolic cooling tower with a dark mouth and a little steam. */
function coolingTower(g, x, z) {
  const profile = [
    [0.17, 0],
    [0.15, 0.12],
    [0.12, 0.34],
    [0.115, 0.44],
    [0.125, 0.56],
    [0.135, 0.6],
  ]
  g.add(lathe('concrete', profile, [x, 0.012, z]))
  g.add(cylinder('dark', 0.122, 0.012, [x, 0.012 + 0.6 - 0.02, z], 28))
  g.add(cylinder('concreteDark', 0.138, 0.02, [x, 0.012 + 0.585, z], 28)) // rim
  g.add(puff('white', 0.065, [x + 0.02, 0.012 + 0.68, z - 0.03]))
  g.add(puff('white', 0.05, [x + 0.08, 0.012 + 0.74, z - 0.07]))
  g.add(puff('white', 0.04, [x + 0.02, 0.012 + 0.8, z - 0.09]))
}

// ── The facility ───────────────────────────────────────────────────────────

/** The generator hall's footprint never changes between levels. */
const HALL_X = [-0.42, 0.12]
const HALL_Z = [-0.42, 0.06]
const DOOR_Z = -0.12

export function buildPowerStation(level) {
  const g = new THREE.Group()
  lot(g)

  // Generator hall: one storey at L1–L2, two at L3.
  const hallH = level >= 3 ? 0.84 : 0.5
  const top = block(g, BRICK, HALL_X, HALL_Z, hallH)
  const rise = level >= 3 ? 0.22 : 0.17
  g.add(gableRoof('slate', TRIM, HALL_X, HALL_Z, top, rise, 'x'))

  const xFace = HALL_X[1]
  const zFace = HALL_Z[1]
  rollUpDoor(g, xFace, DOOR_Z)
  boltSign(g, xFace, DOOR_Z, 0.31)
  grille(g, 'x', xFace, -0.33, 0.2)
  grille(g, 'z', zFace, -0.3, 0.32)
  grille(g, 'z', zFace, -0.08, 0.32)
  if (level >= 3) {
    // Upper storey: windows on both faces.
    for (const u of [-0.36, -0.24, -0.12]) windowAt(g, 'x', xFace, u, 0.6)
    for (const u of [-0.32, -0.16, 0.0]) windowAt(g, 'z', zFace, u, 0.6)
  }

  // Ridge ventilator from L2 (a raised monitor at L3).
  const ridgeY = top + rise
  if (level === 2) {
    g.add(box('steel', [0.16, 0.05, 0.07], [-0.15, ridgeY - 0.02, -0.18]))
    g.add(box('slate', [0.19, 0.02, 0.1], [-0.15, ridgeY + 0.03, -0.18]))
  }
  if (level >= 3) {
    g.add(box('window', [0.32, 0.06, 0.1], [-0.15, ridgeY - 0.03, -0.18]))
    g.add(gableRoof('slate', TRIM, [-0.32, 0.02], [-0.25, -0.11], ridgeY + 0.03, 0.06, 'x', 0.015))
  }

  // Exhaust stack at the back corner, taller each level.
  const stackH = [0.3, 0.38, 0.62][level - 1]
  stack(g, -0.36, -0.36, top, stackH, level >= 3 ? 0.055 : 0.045, level >= 3)

  if (level === 1) {
    transformer(g, 0.3, -0.26)
    cabinet(g, -0.24, 0.27)
    conduit(g, [0.22, -0.26], [xFace, -0.26])
    conduit(g, [-0.24, 0.22], [-0.24, zFace])
  }

  if (level >= 2) {
    // Control wing in the left corner (one storey; two at L3), flat Kenney roof, window band.
    const WX = [-0.44, -0.06]
    const WZ = [0.1, 0.42]
    const wingTop = block(g, 'concreteDark', WX, WZ, level >= 3 ? 0.56 : 0.3)
    flatRoof(g, WX, WZ, wingTop)
    const wz = WZ[1]
    const wx = WX[1]
    for (const u of [-0.36, -0.25, -0.14]) windowAt(g, 'z', wz, u, 0.13, 0.07, 0.09)
    g.add(box('dark', [0.01, 0.2, 0.08], [wx, 0.012, 0.3])) // wing door
    windowAt(g, 'x', wx, -0.16, 0.13, 0.07, 0.09)
    if (level >= 3) {
      for (const u of [-0.36, -0.25, -0.14]) windowAt(g, 'z', wz, u, 0.38, 0.07, 0.09)
      for (const u of [-0.3, -0.16]) windowAt(g, 'x', wx, u, 0.38, 0.07, 0.09)
    }
    // Rooftop unit on the wing.
    g.add(box('steel', [0.1, 0.05, 0.08], [-0.3, wingTop + 0.03, 0.22]))
  }

  if (level === 2) {
    gantry(g, [0.18, 0.42], -0.42)
    transformer(g, 0.27, -0.29)
    transformer(g, 0.38, -0.09, 0.9)
    cabinet(g, 0.24, 0.32)
    cabinet(g, 0.37, 0.32)
    conduit(g, [0.19, -0.29], [xFace, -0.29])
    conduit(g, [0.38, -0.03], [0.38, 0.27])
    conduit(g, [0.24, 0.27], [0.24, 0.07])
  }

  if (level >= 3) {
    coolingTower(g, 0.3, -0.29)
    // Transformers stand left of the door's line of sight; cabinets below it.
    transformer(g, 0.18, 0.31)
    transformer(g, 0.33, 0.31, 0.9)
    cabinet(g, 0.42, -0.06)
    cabinet(g, 0.04, 0.36)
    conduit(g, [0.18, 0.24], [0.18, 0.07])
    conduit(g, [0.33, 0.25], [0.33, 0.07])
  }

  return g
}
