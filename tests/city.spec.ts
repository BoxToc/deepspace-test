/**
 * Phase 1 — authentication, data model, persistent player state.
 *
 * Runs against the real local worker + Durable Object (no mocks). Cities are
 * idempotent per user, so re-running reuses the same test-account city.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { APIRequestContext, Page } from '@playwright/test'

const usable = loadAllTestAccounts().length
test.skip(usable < 2, `Needs 2 usable test accounts, found ${usable}.`)

/** Same token the app's own `getAuthToken()` gets: minted from the session cookie. */
async function tokenFor(page: Page): Promise<string> {
  const res = await page.request.post('/api/auth/token', { headers: { 'Content-Type': 'application/json' } })
  expect(res.ok()).toBeTruthy()
  const { token } = (await res.json()) as { token?: string }
  expect(token).toBeTruthy()
  return token!
}

async function initCity(request: APIRequestContext, token: string, timezone = 'Europe/London') {
  const res = await request.post('/api/actions/initCity', {
    headers: { Authorization: `Bearer ${token}` },
    data: { timezone },
  })
  expect(res.status()).toBe(200)
  return (await res.json()) as {
    success: boolean
    error?: string
    data?: { created: boolean; city: { recordId: string; data: Record<string, unknown> } }
  }
}

test('initCity rejects unauthenticated callers', async ({ request }) => {
  const res = await request.post('/api/actions/initCity', { data: {} })
  expect(res.status()).toBe(401)
})

test('signed-out visitors cannot see /city', async ({ page }) => {
  await page.goto('/city')
  await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('city-page')).toHaveCount(0)
})

test('a new player gets a city that persists across reloads', async ({ users }) => {
  const [alice] = await users(1)
  await alice.page.goto('/city')

  await expect(alice.page.getByTestId('city-page')).toBeVisible({ timeout: 20_000 })
  for (const key of ['power', 'residential', 'shop', 'park']) {
    await expect(alice.page.getByTestId(`building-level-${key}`)).toHaveText(/Level [1-3]/)
  }
  const electricity = await alice.page.getByTestId('city-electricity').textContent()
  const coins = await alice.page.getByTestId('city-coins').textContent()
  expect(electricity).toMatch(/⚡/)

  await alice.page.reload()
  await expect(alice.page.getByTestId('city-page')).toBeVisible({ timeout: 20_000 })
  await expect(alice.page.getByTestId('city-electricity')).toHaveText(electricity!)
  await expect(alice.page.getByTestId('city-coins')).toHaveText(coins!)
})

test('initCity is idempotent even when called concurrently', async ({ users }) => {
  const [alice] = await users(1)
  await alice.page.goto('/home')
  const token = await tokenFor(alice.page)

  const results = await Promise.all(
    Array.from({ length: 5 }, () => initCity(alice.page.request, token)),
  )
  for (const r of results) expect(r.success, r.error).toBe(true)

  const ids = new Set(results.map((r) => r.data!.city.recordId))
  expect(ids.size).toBe(1)
  expect(results.filter((r) => r.data!.created).length).toBeLessThanOrEqual(1)
})

async function updateTimezone(request: APIRequestContext, token: string, timezone: unknown) {
  const res = await request.post('/api/actions/updateTimezone', {
    headers: { Authorization: `Bearer ${token}` },
    data: { timezone },
  })
  expect(res.status()).toBe(200)
  return (await res.json()) as { success: boolean; code?: string; error?: string }
}

test('updateTimezone rejects unauthenticated callers and invalid zones', async ({ users, request }) => {
  const anon = await request.post('/api/actions/updateTimezone', { data: { timezone: 'Asia/Tokyo' } })
  expect(anon.status()).toBe(401)

  const [, bob] = await users(2)
  await bob.page.goto('/home')
  const token = await tokenFor(bob.page)
  await initCity(bob.page.request, token)
  for (const bad of ['Mars/Olympus', '', 42, null]) {
    expect(await updateTimezone(bob.page.request, token, bad)).toMatchObject({ success: false, code: 'invalid_timezone' })
  }
})

// Re-runnable: the test account's 7-day lock persists in the local DO, so we
// assert the invariant ("at most one change wins, then everything is refused")
// rather than "the first call succeeds".
test('time zone changes: at most one per 7 days, even when concurrent', async ({ users }) => {
  const [, bob] = await users(2)
  await bob.page.goto('/home')
  const token = await tokenFor(bob.page)
  await initCity(bob.page.request, token)

  const zones = ['Asia/Tokyo', 'America/Chicago', 'Australia/Sydney', 'Africa/Nairobi']
  const results = await Promise.all(zones.map((z) => updateTimezone(bob.page.request, token, z)))
  const wins = results.filter((r) => r.success)
  expect(wins.length).toBeLessThanOrEqual(1)
  for (const r of results.filter((r) => !r.success)) {
    expect(['cooldown', 'same_timezone']).toContain(r.code)
  }

  const after = await updateTimezone(bob.page.request, token, 'Pacific/Auckland')
  expect(after).toMatchObject({ success: false, code: 'cooldown' })

  await bob.page.goto('/city')
  await expect(bob.page.getByTestId('timezone-locked')).toBeVisible({ timeout: 20_000 })
})

test('each player gets their own private city', async ({ users }) => {
  const [alice, bob] = await users(2)
  await Promise.all([alice.page.goto('/home'), bob.page.goto('/home')])
  const [ta, tb] = await Promise.all([tokenFor(alice.page), tokenFor(bob.page)])

  const [a, b] = await Promise.all([initCity(alice.page.request, ta), initCity(bob.page.request, tb)])
  expect(a.success && b.success).toBe(true)
  expect(a.data!.city.recordId).not.toBe(b.data!.city.recordId)
  expect(a.data!.city.data.userId).not.toBe(b.data!.city.data.userId)

  // The client asks for every city it can see; `read: 'own'` must return one.
  await Promise.all([alice.page.goto('/city'), bob.page.goto('/city')])
  await expect(alice.page.getByTestId('city-page')).toBeVisible({ timeout: 20_000 })
  await expect(bob.page.getByTestId('city-page')).toBeVisible({ timeout: 20_000 })
})
