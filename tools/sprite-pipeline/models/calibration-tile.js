/**
 * Calibration: Kenney's plain pavement tile (cityTiles_072, 132×99) rebuilt
 * from boxes. If the camera, scale and tones are right, this render matches
 * the original almost pixel for pixel — `render.mjs --check` diffs them.
 *
 * Measured from the PNG: a 1×1 concrete block, 32 px thick (Kenney draws it 131 px wide inside a 132 px image).
 */
import { box, upPx } from '../kenney-style.js'

export const output = { width: 132, height: 99, anchor: [66, 34] }

export default function build() {
  const h = upPx(32)
  return box('concrete', [1, h, 1], [0, -h, 0])
}
