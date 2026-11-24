/**
 * Phase 3 — the isometric town on /city. Read-only for the test account.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { USE_POWER_STATION_ART } from '../src/city/sprites'

const usable = loadAllTestAccounts().length
test.skip(usable < 1, 'Needs a usable test account.')

async function openCity(page: Page, query = '') {
  await page.goto(`/city${query}`)
  await expect(page.getByTestId('city-scene')).toBeVisible({ timeout: 20_000 })
  // Every sprite actually loaded (no broken image paths).
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>('[data-testid="city-scene"] img')].every((i) => i.complete && i.naturalWidth > 0),
      ),
    )
    .toBe(true)
}

test('the town shows all four buildings, lit to match stored energy', async ({ users }) => {
  const [alice] = await users(1)
  await openCity(alice.page)
  const page = alice.page

  const buildings = page.getByTestId('city-building')
  const kinds = await buildings.evaluateAll((els) => els.map((e) => e.getAttribute('data-building')).sort())
  expect(kinds).toEqual(['park', 'power', 'residential', 'residential', 'shop'])
  expect(await page.locator('[data-testid="city-scene"] img').count()).toBeGreaterThan(30)

  const energy = Number((await page.getByTestId('city-electricity').textContent())!.split('/')[0].trim())
  const powered = String(energy > 0)
  for (const v of await buildings.evaluateAll((els) => els.map((e) => e.getAttribute('data-powered')))) expect(v).toBe(powered)
  for (const key of ['power', 'residential', 'shop', 'park']) {
    await expect(page.getByTestId(`building-power-${key}`)).toHaveText(energy > 0 ? 'Powered' : 'No power')
  }
})

test('fits a phone screen without horizontal scrolling', async ({ users }) => {
  const [alice] = await users(1)
  await alice.page.setViewportSize({ width: 360, height: 780 })
  await openCity(alice.page)
  const { scrollW, innerW, sceneW } = await alice.page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    sceneW: document.querySelector('[data-testid="city-scene"]')!.getBoundingClientRect().width,
  }))
  expect(scrollW).toBeLessThanOrEqual(innerW)
  expect(sceneW).toBeLessThanOrEqual(innerW)
  expect(sceneW).toBeGreaterThan(300)
})

test('dev preview: an unpowered town dims every building and shows its badge', async ({ users }) => {
  const [alice] = await users(1)
  await openCity(alice.page, '?preview=unpowered&level=3')
  const page = alice.page
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'dark')
  const buildings = page.getByTestId('city-building')
  for (const v of await buildings.evaluateAll((els) => els.map((e) => e.getAttribute('data-powered')))) expect(v).toBe('false')
  await expect(page.locator('[data-testid="city-scene"] .city-badge.is-off')).toHaveCount(5)
  await expect(page.locator('[data-testid="city-scene"] .city-lamp-glow')).toHaveCount(0)
  // Level 3 preview: ground + 2 floors + roof for each Kenney stack (shop, two houses);
  // the Power Station is one rendered sprite (or a 4-layer Kenney stack as fallback).
  await expect(page.locator('[data-testid="city-scene"] .city-building img')).toHaveCount(3 * 4 + (USE_POWER_STATION_ART ? 1 : 4))
})
