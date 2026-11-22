#!/usr/bin/env node
/**
 * Side-by-side contact sheet: Kenney buildings next to generated sprites,
 * at the same scale, on the same ground line.
 *
 *   node tools/sprite-pipeline/compare.mjs <sheet> [--out file.png] [--scale 2]
 *
 * <sheet> is a module in tools/sprite-pipeline/sheets/ exporting `items`:
 *   [{ label, layers: [{ src, left, top }] }]
 * where each building's lot top-face centre is the origin (0, 0) — the same
 * convention as src/city/iso.ts. `kenneyStack()` builds those layers for a
 * Kenney ground floor + floors + roof exactly like placeBuilding() does.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const sheet = args.find((a) => !a.startsWith('--'))
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : d
}
if (!sheet) {
  console.error('usage: compare.mjs <sheet> [--out file.png] [--scale 2]')
  process.exit(1)
}
const scale = Number(opt('scale', 2))
const out = resolve(opt('out', `art-source/compare/${sheet}.png`))
const { items, title = sheet } = await import(pathToFileURL(resolve(here, 'sheets', `${sheet}.js`)).href)

// Inline every image as a data URL so the page needs no file access.
const cache = new Map()
const dataUrl = (src) => {
  if (!cache.has(src)) cache.set(src, 'data:image/png;base64,' + readFileSync(resolve(src)).toString('base64'))
  return cache.get(src)
}
const payload = items.map((it) => ({ label: it.label, layers: it.layers.map((l) => ({ ...l, src: dataUrl(l.src) })) }))

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><body></body>')
  const png = await page.evaluate(
    async ({ payload, scale, title }) => {
      const load = (src) =>
        new Promise((ok, fail) => {
          const img = new Image()
          img.onload = () => ok(img)
          img.onerror = fail
          img.src = src
        })
      for (const it of payload) for (const l of it.layers) l.img = await load(l.src)
      // Shared ground line: every building's origin on the same baseline.
      let up = 0
      let down = 0
      const widths = payload.map((it) => {
        let minX = Infinity
        let maxX = -Infinity
        for (const l of it.layers) {
          minX = Math.min(minX, l.left)
          maxX = Math.max(maxX, l.left + l.img.width)
          up = Math.max(up, -l.top)
          down = Math.max(down, l.top + l.img.height)
        }
        it.minX = minX
        return maxX - minX
      })
      const gap = 24
      const pad = 16
      const labelH = 34
      const W = (widths.reduce((a, b) => a + b, 0) + gap * (payload.length - 1)) * scale + pad * 2
      const H = (up + down) * scale + pad * 2 + labelH + 24
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#cfe3ef'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#23303a'
      ctx.font = '600 15px system-ui, sans-serif'
      ctx.fillText(title, pad, pad + 12)
      ctx.imageSmoothingEnabled = false
      let x = pad
      const baseY = pad + 24 + up * scale
      payload.forEach((it, i) => {
        for (const l of it.layers) {
          ctx.drawImage(l.img, x + (l.left - it.minX) * scale, baseY + l.top * scale, l.img.width * scale, l.img.height * scale)
        }
        ctx.fillStyle = '#23303a'
        ctx.font = '12px system-ui, sans-serif'
        const lines = it.label.split('\n')
        lines.forEach((t, k) => ctx.fillText(t, x, baseY + down * scale + 16 + k * 14))
        x += (widths[i] + gap) * scale
      })
      return c.toDataURL('image/png')
    },
    { payload, scale, title },
  )
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'))
  console.log(`${sheet}: ${items.length} items → ${out}`)
} finally {
  await browser.close()
}
