/**
 * Phase 5 — usability, accessibility and feedback on /city.
 * Uses Bob, whose city no other spec touches (collab.spec only uses Bob for
 * scaffold pages), so it can run alongside the sleep (Carol) and economy (Dave) specs.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { client } from './helpers/game'

test.skip(loadAllTestAccounts().length < 1, 'Needs a usable test account.')
test.describe.configure({ mode: 'serial' })

async function bob(users: (names: string[]) => Promise<{ page: Page }[]>) {
  const [u] = await users(['Bob'])
  return { page: u.page, api: client(u.page) }
}

async function openCity(page: Page, query = '') {
  await page.goto(`/city${query}`)
  await expect(page.getByTestId('city-scene')).toBeVisible({ timeout: 20_000 })
}

test('the park badge is fully visible when the town has no power (regression)', async ({ users }) => {
  const { page } = await bob(users)
  await openCity(page, '?preview=unpowered')
  const park = page.locator('[data-testid="city-building"][data-building="park"]')
  const badge = park.locator('.city-badge.is-off')
  await expect(badge).toBeVisible()
  // The click diamond is clipped on a child, never on the element holding the badge.
  expect(await park.evaluate((el) => getComputedStyle(el).clipPath)).toBe('none')
  expect(await park.locator('.city-park__hit').evaluate((el) => getComputedStyle(el).clipPath)).toContain('polygon')
  // The badge is actually painted: the topmost element at its centre is the badge (or its icon).
  await badge.scrollIntoViewIfNeeded()
  const onTop = await badge.evaluate((el) => {
    const r = el.getBoundingClientRect()
    el.style.pointerEvents = 'auto'
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    el.style.pointerEvents = ''
    return top && (top === el || el.contains(top)) ? 'badge' : `${top?.tagName}.${top?.className}`
  })
  expect(onTop).toBe('badge')
})

test('town buildings are reachable as buttons by assistive tech and the keyboard', async ({ users }) => {
  const { page } = await bob(users)
  await openCity(page)
  await expect(page.getByTestId('city-scene').locator('.city-scene__stage')).toHaveAttribute('role', 'group')
  for (const name of ['Power Station', 'Houses', 'Shop', 'Park']) {
    await expect(page.getByRole('button', { name: `${name}: view and upgrade` }).first()).toBeVisible()
  }
  // Keyboard: focus the Power Station and open it with Enter.
  await page.getByRole('button', { name: 'Power Station: view and upgrade' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('upgrade-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  // Row buttons say what they do, not just a number.
  await expect(page.getByRole('button', { name: /^Upgrade Power Station for \d+ coins/ })).toBeVisible()
})

test('first-time onboarding shows once, can be dismissed, and comes back on request', async ({ users }) => {
  const { page } = await bob(users)
  await page.goto('/city')
  await page.evaluate(() => localStorage.removeItem('dreamgrid.howToPlay.dismissed'))
  await openCity(page)
  const card = page.getByTestId('how-to-play')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Sleep')
  await expect(card).toContainText('Power your town')
  await expect(card).toContainText('Earn and upgrade')
  await page.getByTestId('how-to-play-done').click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('city-scene')).toBeVisible({ timeout: 20_000 })
  await expect(card).toHaveCount(0)
  await page.getByTestId('how-to-play-open').click()
  await expect(card).toBeVisible()
  await page.getByTestId('how-to-play-close').click()
  await expect(card).toHaveCount(0)
})

test('feedback: outage banner, next upgrade goal, sleep rules', async ({ users }) => {
  const { page, api } = await bob(users)
  await api.reset({ electricity: 0, coins: 40 })
  await openCity(page)
  await expect(page.getByTestId('city-outage')).toBeVisible()
  await expect(page.getByTestId('city-next-goal')).toHaveAttribute('data-kind', 'needs_power')
  await expect(page.getByTestId('sleep-rules')).toContainText('once per day')

  await api.reset({ electricity: 100, coins: 40 })
  await expect(page.getByTestId('city-outage')).toHaveCount(0)
  // 60 coins short at the level-1 rate: an ETA within the stored power.
  await expect(page.getByTestId('city-next-goal')).toHaveAttribute('data-kind', 'eta')
  await expect(page.getByTestId('city-next-goal')).toContainText('Next upgrade:')

  await api.reset({ electricity: 100, coins: 150 })
  await expect(page.getByTestId('city-next-goal')).toHaveAttribute('data-kind', 'affordable')
})

test('feedback: a rewarded wake-up is celebrated, then the panel explains the next reward', async ({ users }) => {
  const { page, api } = await bob(users)
  await api.reset({ electricity: 0 })
  // Move the dev clock well past any earlier reward so this session can earn.
  await api.advance(2 * 24 * 60)
  await openCity(page)
  await page.getByTestId('sleep-start').click()
  await expect(page.getByTestId('sleep-result')).toContainText('Good night')
  await api.advance(2 * 60)
  await page.getByTestId('sleep-wake').click()
  const result = page.getByTestId('sleep-result')
  await expect(result).toHaveAttribute('data-tone', 'success')
  await expect(result).toContainText('⚡')
  // Within 4 hours of that wake-up, starting again would not earn: say so before they try.
  await expect(page.getByTestId('sleep-readiness')).toHaveAttribute('data-kind', 'cooldown')
})
