#!/usr/bin/env node
/**
 * Render a model from tools/sprite-pipeline/models/ to a transparent
 * Kenney-style isometric PNG.
 *
 *   node tools/sprite-pipeline/render.mjs <model> [--out file.png] [--check reference.png]
 *
 * --check diffs the render against a reference PNG of the same size
 * (silhouette overlap and mean colour error) — used to calibrate the camera
 * against a real Kenney tile.
 *
 * Development-time only: bundles the model with esbuild and renders it in
 * headless Chromium (Playwright) with three.js. Nothing here ships with the app.
 */
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const model = args.find((a) => !a.startsWith('--'))
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
if (!model) {
  console.error('usage: render.mjs <model> [--out file.png] [--check reference.png]')
  process.exit(1)
}
const out = resolve(opt('out') ?? `art-source/renders/${model}.png`)
const check = opt('check')

const posix = (p) => p.replaceAll('\\', '/')
const entry = `
  import build, { output } from ${JSON.stringify(posix(resolve(here, 'models', `${model}.js`)))}
  import { renderToDataURL } from ${JSON.stringify(posix(resolve(here, 'kenney-style.js')))}
  window.__render = () => renderToDataURL(build(), output)
`
const bundle = await build({
  stdin: { contents: entry, resolveDir: here, loader: 'js' },
  bundle: true,
  format: 'iife',
  write: false,
  logLevel: 'error',
})

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  await page.setContent('<!doctype html><body></body>')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(() => window.__render())
  const dataUrl = result.url
  const png = Buffer.from(dataUrl.split(',')[1], 'base64')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, png)
  console.log(`${model}: ${result.width}×${result.height}px, anchorY ${result.anchor[1]}, ${png.length} bytes → ${out}`)

  if (check) {
    const ref = 'data:image/png;base64,' + readFileSync(resolve(check)).toString('base64')
    const stats = await page.evaluate(
      async ([a, b]) => {
        const load = (src) =>
          new Promise((ok, fail) => {
            const img = new Image()
            img.onload = () => ok(img)
            img.onerror = fail
            img.src = src
          })
        const [ia, ib] = await Promise.all([load(a), load(b)])
        const px = (img) => {
          const c = document.createElement('canvas')
          c.width = img.width
          c.height = img.height
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0)
          return ctx.getImageData(0, 0, img.width, img.height).data
        }
        if (ia.width !== ib.width || ia.height !== ib.height) return { error: `size ${ia.width}×${ia.height} vs ${ib.width}×${ib.height}` }
        const da = px(ia)
        const db = px(ib)
        let both = 0
        let either = 0
        let err = 0
        for (let i = 0; i < da.length; i += 4) {
          const sa = da[i + 3] > 127
          const sb = db[i + 3] > 127
          if (sa || sb) either++
          if (sa && sb) {
            both++
            err += (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3
          }
        }
        return { silhouetteOverlap: +(both / either).toFixed(4), meanColourError: +(err / both).toFixed(2) }
      },
      [dataUrl, ref],
    )
    console.log('check vs', check, stats)
  }
} finally {
  await browser.close()
}
