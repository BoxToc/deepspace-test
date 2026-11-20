/**
 * Node-only check (kept at the root, like prerender.test.ts, because the src/
 * TypeScript project has no Node types): every sprite the city references
 * exists in public/ with exactly the size the geometry assumes.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPRITES } from './src/city/sprites'

/** Width/height from a PNG's IHDR chunk. */
function pngSize(path: string) {
  const buf = readFileSync(path)
  expect(buf.subarray(1, 4).toString()).toBe('PNG')
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('city sprites', () => {
  it('exist with the declared sizes', () => {
    for (const [key, s] of Object.entries(SPRITES)) {
      expect(pngSize(`public${s.src}`), key).toEqual({ w: s.w, h: s.h })
    }
  })
})
