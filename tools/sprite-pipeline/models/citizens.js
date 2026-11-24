/**
 * Decorative townspeople — one sprite sheet, rendered in the Kenney style.
 *
 * Kenney's isometric packs have no people, so these are original. Each
 * citizen is a few flat-shaded boxes (legs, torso, arms, head, hair) about
 * 15 px tall: one storey (34 px) is ~3 m, so ~11 px per metre.
 *
 * Sheet layout: one row, FRAME_W px per frame. For each citizen, six frames:
 *   0–2  facing +x (screen ↘, "front"): stand, step A, step B
 *   3–5  facing −x (screen ↖, "back"):  stand, step A, step B
 * The game mirrors these for ↙ and ↗. Frames are placed side by side by
 * shifting each figure along (+x, −z), which moves it straight right on screen.
 */
import * as THREE from 'three'
import { box } from '../kenney-style.js'

export const FRAME_W = 20
export const FRAME_H = 26

/** Shirt, trousers, hair, skin. */
export const CITIZENS = [
  { shirt: '#c45b5b', pants: '#4f5966', hair: '#6b4a2f', skin: '#e8b98f' },
  { shirt: '#5b8ec4', pants: '#3d4a5c', hair: '#2f2f2f', skin: '#c58c5c' },
  { shirt: '#7da23f', pants: '#b9a37a', hair: '#d9b25a', skin: '#f1c7a1' },
  { shirt: '#f0c34a', pants: '#5a5a5a', hair: '#4a3426', skin: '#8d5a3b' },
]

const FRAMES = 6
export const output = { width: FRAME_W * FRAMES * CITIZENS.length, height: FRAME_H, anchor: [FRAME_W / 2, FRAME_H - 3] }

/** One figure facing +x. step: 0 stand, 1 left leg forward, 2 right leg forward. */
function figure({ shirt, pants, hair, skin }, step) {
  const g = new THREE.Group()
  const swing = step === 0 ? 0 : step === 1 ? 0.016 : -0.016
  const legW = 0.02
  const legH = 0.07
  // Legs (lateral axis is z).
  g.add(box(pants, [legW, legH, 0.019], [swing, 0, -0.012]))
  g.add(box(pants, [legW, legH, 0.019], [-swing, 0, 0.012]))
  // Torso and arms (arms swing against the legs).
  const torsoY = legH
  g.add(box(shirt, [0.034, 0.064, 0.05], [0, torsoY, 0]))
  g.add(box(shirt, [0.018, 0.056, 0.013], [-swing * 0.8, torsoY + 0.006, -0.032]))
  g.add(box(shirt, [0.018, 0.056, 0.013], [swing * 0.8, torsoY + 0.006, 0.032]))
  g.add(box(skin, [0.017, 0.012, 0.012], [-swing * 0.8, torsoY - 0.004, -0.032])) // hands
  g.add(box(skin, [0.017, 0.012, 0.012], [swing * 0.8, torsoY - 0.004, 0.032]))
  // Head with hair on top and at the back (−x), so front and back views differ.
  const headY = torsoY + 0.064
  g.add(box(skin, [0.036, 0.038, 0.036], [0.002, headY, 0]))
  g.add(box(hair, [0.04, 0.012, 0.04], [-0.001, headY + 0.034, 0]))
  g.add(box(hair, [0.014, 0.03, 0.04], [-0.016, headY + 0.012, 0]))
  return g
}

export default function build() {
  const all = new THREE.Group()
  let k = 0
  for (const c of CITIZENS) {
    for (const facing of [0, Math.PI]) {
      for (const step of [0, 1, 2]) {
        const f = figure(c, step)
        f.rotation.y = facing
        const a = (FRAME_W * k) / 132
        f.position.set(a, 0, -a)
        all.add(f)
        k++
      }
    }
  }
  return all
}
