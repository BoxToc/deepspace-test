/**
 * Phase 4 — electricity consumption, passive coins, upgrades.
 *
 * Each test puts Dave's city into an exact state with the dev-only
 * devSetCity, fast-forwards with the dev-only simulated clock, and then
 * checks what the SERVER commits (via a real action + devInspect) and what
 * the dashboard shows. Runs serially as "Dave" only.
 *
 * Level-1 rates (src/game/config.ts): 3.5 ⚡/h consumed, 18.7 coins/h earned.
 */
import { test, expect, findTestAccountByName } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { client } from './helpers/game'

test.describe.configure({ mode: 'serial' })

let hasDave = true
try {
  findTestAccountByName('Dave')
} catch {
  hasDave = false
}
test.skip(!hasDave, 'Needs a test account named "Dave" (npx deepspace test accounts create --name Dave ...).')

type UsersFixture = (names: string[]) => Promise<{ page: Page; context: import('@playwright/test').BrowserContext }[]>

async function dave(users: UsersFixture) {
  const [u] = await users(['Dave'])
  await u.page.goto('/home')
  return { page: u.page, context: u.context, api: client(u.page) }
}

async function openCity(page: Page) {
  await page.goto('/city')
  await expect(page.getByTestId('city-page')).toBeVisible({ timeout: 20_000 })
}

const powerFlags = (page: Page) =>
  page.getByTestId('city-building').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-powered')))])

test('economy actions require sign-in', async ({ request }) => {
  for (const name of ['upgradeBuilding', 'devSetCity']) {
    expect((await request.post(`/api/actions/${name}`, { data: { building: 'shop', fromLevel: 1, coins: 1e9 } })).status()).toBe(401)
  }
})

test('offline time: energy is consumed and coins earned exactly once, on the server', async ({ users }) => {
  const { page, api } = await dave(users)
  await api.reset({ electricity: 35, coins: 30 })
  await api.advance(4 * 60) // 4 h "offline": −14 ⚡, +74.8 coins → 21 ⚡, 104.8 coins

  // Dashboard projects the same numbers before anything is saved.
  await openCity(page)
  await expect(page.getByTestId('city-electricity')).toHaveText(/^21(\.0)? \/ 100 ⚡$/)
  await expect(page.getByTestId('city-coins')).toHaveText('104')
  await expect(page.getByTestId('city-power-hours')).toContainText(/≈ (5h 59m|6h 0m) of power/)
  await expect(page.getByTestId('city-coin-rate')).toHaveText('+18.7 / hour')

  // A real action settles server-side: the upgrade is affordable only thanks to offline earnings.
  const up = await api.act<{ coins: number; level: number }>('upgradeBuilding', { building: 'shop', fromLevel: 1 })
  expect(up.success, up.error).toBe(true)
  expect(up.data.coins).toBeCloseTo(4.8, 1)
  const s = (await api.inspect()).city as unknown as { electricity: number; coins: number }
  // ±0.05 ⚡ allows ~50 s of real drain (3.5 ⚡/h) between the reset and this read on a loaded
  // machine; settling the 4 offline hours twice would be off by 14 ⚡.
  expect(s.electricity).toBeCloseTo(21, 1)
  expect(s.coins).toBeCloseTo(4.8, 1)

  // Settling again at the same moment changes nothing (no double counting).
  const again = await api.act('upgradeBuilding', { building: 'shop', fromLevel: 2 })
  expect(again).toMatchObject({ success: false, code: 'insufficient_coins' })
  expect(((await api.inspect()).city as unknown as { coins: number }).coins).toBeCloseTo(4.8, 1)
})

test('power outage dims the town and pauses income; sleep restores it', async ({ users }) => {
  const { page, api } = await dave(users)
  await api.reset({ electricity: 7, coins: 0 }) // 2 h of power at 3.5 ⚡/h
  await api.advance(10 * 60)

  await openCity(page)
  await expect(page.getByTestId('city-electricity')).toHaveText(/^0 \/ 100 ⚡$/)
  await expect(page.getByTestId('city-coins')).toHaveText('37') // 2 h × 18.7, then nothing
  await expect(page.getByTestId('city-power-hours')).toHaveText('Out of power — sleep to recharge')
  await expect(page.getByTestId('city-coin-rate')).toHaveText('Paused while the power is out')
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'dark')
  expect(await powerFlags(page)).toEqual(['false'])

  // Sleep 8 h → +80 ⚡ → lights back on. Income during the outage stays 0.
  await api.act('startSleep')
  await api.advance(8 * 60)
  const woke = await api.act<{ session: { energyAwarded: number } }>('wakeUp')
  expect(woke.data.session.energyAwarded).toBe(80)
  const s = (await api.inspect()).city as unknown as { electricity: number; coins: number }
  expect(s.electricity).toBe(80)
  expect(s.coins).toBeCloseTo(37.4, 1)

  await openCity(page)
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'day')
  expect(await powerFlags(page)).toEqual(['true'])
  await expect(page.getByTestId('city-electricity')).toHaveText(/^80(\.0)? \/ 100 ⚡$|^79\.9 \/ 100 ⚡$/)
})

test('insufficient coins: refused by the server, button disabled in the UI', async ({ users }) => {
  const { page, api } = await dave(users)
  await api.reset({ coins: 99 })
  expect(await api.act('upgradeBuilding', { building: 'shop', fromLevel: 1 })).toMatchObject({
    success: false,
    code: 'insufficient_coins',
    details: { cost: 100, missing: 1 },
  })

  await openCity(page)
  await page.getByTestId('building-upgrade-shop').click()
  await expect(page.getByTestId('upgrade-panel')).toBeVisible()
  await expect(page.getByTestId('upgrade-cost')).toHaveText('100')
  await expect(page.getByTestId('upgrade-missing')).toHaveText('· need 1 more')
  await expect(page.getByTestId('upgrade-button')).toBeDisabled()
})

test('maximum level: no further upgrades', async ({ users }) => {
  const { page, api } = await dave(users)
  await api.reset({ coins: 1000, levels: { park: 3 } })
  expect(await api.act('upgradeBuilding', { building: 'park', fromLevel: 3 })).toMatchObject({ success: false, code: 'max_level' })

  await openCity(page)
  await expect(page.getByTestId('building-max-park')).toHaveText('Max')
  await expect(page.getByTestId('building-upgrade-park')).toHaveCount(0)
  await page.getByTestId('building-row-park').getByRole('button', { name: 'Park' }).click()
  await expect(page.getByTestId('upgrade-max')).toBeVisible()
  await expect(page.getByTestId('upgrade-button')).toHaveCount(0)
})

test('simultaneous upgrade requests never double-upgrade or overspend', async ({ users }) => {
  const { api } = await dave(users)
  await api.reset({ coins: 250 }) // 0 ⚡ → no income while this runs

  const reqs = [
    ...Array.from({ length: 3 }, () => ({ building: 'shop', fromLevel: 1 })), // triple-click
    { building: 'residential', fromLevel: 1 },
    { building: 'park', fromLevel: 1 },
  ]
  const results = await Promise.all(reqs.map((r) => api.act('upgradeBuilding', r)))
  const ok = results.filter((r) => r.success).length
  console.log('simultaneous upgrades:', results.map((r) => (r.success ? 'ok' : r.code)).join(', '))
  expect(ok).toBe(2) // 250 coins buys exactly two 100-coin upgrades
  for (const r of results.filter((r) => !r.success)) expect(['level_changed', 'insufficient_coins']).toContain(r.code)

  const c = (await api.inspect()).city as unknown as { coins: number; buildings: Record<string, number> }
  expect(c.coins).toBe(50)
  expect(Object.values(c.buildings).reduce((a, b) => a + b, 0)).toBe(4 + 2)
  expect(c.buildings.shop).toBeLessThanOrEqual(2)
})

test('upgrade from the scene: building grows, progress survives refresh, other tabs update live', async ({ users }) => {
  const { page, context, api } = await dave(users)
  await api.reset({ coins: 150, electricity: 50 })
  await openCity(page)
  const other = await context.newPage()
  await openCity(other)
  await expect(other.getByTestId('building-level-power')).toHaveText('Level 1/3')

  const stack = page.locator('[data-testid="city-building"][data-building="power"] img')
  const look = () => stack.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src.split('/').pop()))
  // Each level has its own art (rendered sprite, or the Kenney stack fallback).
  await expect(stack.first()).toBeVisible()
  const level1Look = await look()

  // Click the Power Station in the town itself.
  await page.locator('[data-testid="city-building"][data-building="power"]').click()
  await expect(page.getByTestId('upgrade-panel')).toBeVisible()
  await expect(page.getByTestId('upgrade-current')).toContainText('Battery 100 ⚡')
  await expect(page.getByTestId('upgrade-next')).toContainText('Battery 200 ⚡')
  await expect(page.getByTestId('upgrade-next')).toContainText('Sleep energy +20%')
  await page.getByTestId('upgrade-button').click()
  await expect(page.getByTestId('upgrade-result')).toHaveText('Power Station upgraded to level 2!')
  await expect(page.getByTestId('upgrade-level')).toHaveText('2')

  // Level 2 has its own look.
  await expect.poll(look).not.toEqual(level1Look)
  const level2Look = await look()
  await expect(page.getByTestId('city-electricity')).toContainText('/ 200 ⚡')
  await expect(page.getByTestId('city-coins')).toHaveText('50')

  // The other tab updates without a reload.
  await expect(other.getByTestId('building-level-power')).toHaveText('Level 2/3')
  await expect(other.getByTestId('city-electricity')).toContainText('/ 200 ⚡')

  // And everything is still there after a refresh.
  await page.reload()
  await expect(page.getByTestId('building-level-power')).toHaveText('Level 2/3', { timeout: 20_000 })
  await expect(page.getByTestId('city-coins')).toHaveText('50')
  await expect.poll(look).toEqual(level2Look)
})

// ── Playtest regressions ───────────────────────────────────────────────────

test('regression: switching time zone in the UI updates the display (no "already your time zone")', async ({ users }) => {
  const { page, api } = await dave(users)
  await openCity(page)
  const deviceTz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const other = deviceTz === 'Europe/London' ? 'Asia/Tokyo' : 'Europe/London'

  // Start from a zone different from this browser's, past any 7-day lock.
  await api.advance(8 * 24 * 60)
  if ((await api.city()).timezone !== other) {
    expect((await api.act('updateTimezone', { timezone: other })).success).toBe(true)
    await api.advance(8 * 24 * 60)
  }

  await openCity(page)
  await expect(page.getByTestId('city-timezone')).toHaveText(other)
  await page.getByTestId('timezone-switch').click()
  await expect(page.getByTestId('city-timezone')).toHaveText(deviceTz)
  await expect(page.getByTestId('timezone-error')).toHaveCount(0)
  await expect(page.getByTestId('timezone-locked')).toBeVisible()
  expect((await api.city()).timezone).toBe(deviceTz) // server agrees with the display
})

test('regression: coin balance after upgrades matches the server in every open tab', async ({ users }) => {
  const { page, context, api } = await dave(users)
  await api.reset({ coins: 450 }) // 0 ⚡ → coins don't change on their own
  await openCity(page)
  const tabB = await context.newPage()
  await openCity(tabB)
  for (const tab of [page, tabB]) await expect(tab.getByTestId('city-coins')).toHaveText('450')

  const buy = async (tab: Page, building: string, expectCoins: string) => {
    await tab.getByTestId(`building-upgrade-${building}`).click()
    await tab.getByTestId('upgrade-button').click()
    await expect(tab.getByTestId('upgrade-result')).toBeVisible()
    await tab.keyboard.press('Escape')
    const server = ((await api.inspect()).city as unknown as { coins: number }).coins
    expect(String(server)).toBe(expectCoins)
    for (const t of [page, tabB]) await expect(t.getByTestId('city-coins')).toHaveText(expectCoins)
  }
  await buy(page, 'shop', '350') // tab A
  await buy(tabB, 'residential', '250') // tab B
  await buy(page, 'park', '150') // tab A again
  // Tab B sees the Shop at level 2 (bought in tab A); level 3 costs 200 → unaffordable with 150.
  await tabB.getByTestId('building-upgrade-shop').click()
  await expect(tabB.getByTestId('upgrade-level')).toHaveText('2')
  await expect(tabB.getByTestId('upgrade-missing')).toHaveText('· need 50 more')
  await expect(tabB.getByTestId('upgrade-button')).toBeDisabled()
  await tabB.keyboard.press('Escape')
  await expect(tabB.getByTestId('city-coins')).toHaveText('150')
  await expect(page.getByTestId('building-level-shop')).toHaveText('Level 2/3')

  // Persisted: a fresh load shows the same balance.
  await page.reload()
  await expect(page.getByTestId('city-coins')).toHaveText('150', { timeout: 20_000 })
})
