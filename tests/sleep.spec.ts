/**
 * Phase 2 — sleep sessions and server-side energy rewards.
 *
 * Uses the dev-only simulated clock (devAdvanceClock) to fast-forward time;
 * every reward still goes through the real startSleep / wakeUp actions.
 *
 * Re-runnable: each test first cancels any open session, jumps the player's
 * clock 2 days ahead, and resets the economy to a known state (0 ⚡, so
 * nothing is consumed while time is fast-forwarded), then aligns to a known
 * LOCAL time in the city's own zone, so daily-limit and midnight cases are
 * deterministic.
 *
 * Runs as "Carol" only, serially, so no other spec touches this city.
 */
import { test, expect, findTestAccountByName } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { client, expectConsistentHistory, type Res, type Session } from './helpers/game'

test.describe.configure({ mode: 'serial' })

let hasCarol = true
try {
  findTestAccountByName('Carol')
} catch {
  hasCarol = false
}
test.skip(!hasCarol, 'Needs a test account named "Carol" (npx deepspace test accounts create --name Carol ...).')

async function carol(users: (names: string[]) => Promise<{ page: Page }[]>) {
  const [u] = await users(['Carol'])
  await u.page.goto('/home')
  return { page: u.page, api: client(u.page) }
}

test('sleep actions require sign-in', async ({ request }) => {
  for (const name of ['startSleep', 'wakeUp', 'cancelSleep', 'devAdvanceClock']) {
    expect((await request.post(`/api/actions/${name}`, { data: {} })).status(), name).toBe(401)
  }
})

test('overnight session across midnight: reward goes to the wake-up day', async ({ users }) => {
  const { api } = await carol(users)
  await api.reset()
  await api.alignTo(23)
  const before = await api.city()

  const started = await api.act('startSleep')
  expect(started.success, started.error).toBe(true)
  const again = await api.act('startSleep')
  expect(again).toMatchObject({ success: false, code: 'already_sleeping' })

  await api.advance(8 * 60 + 7) // 23:00 → 07:07 next day
  // Client-supplied values are ignored: the server computes everything.
  const woke = await api.act<{ session: Session }>('wakeUp', { energy: 9999, endedAt: 0, creditedMinutes: 600 })
  expect(woke.success, woke.error).toBe(true)
  const s = woke.data.session
  expect(s).toMatchObject({ status: 'completed', recordedMinutes: 487, creditedMinutes: 480, energyAwarded: 80, rewardStatus: 'rewarded' })

  const after = await api.city()
  expect(after.activeSessionId).toBe('')
  expect(after.lastRewardDay).toBe(s.rewardDay)
  expect(s.rewardDay).not.toBe(new Intl.DateTimeFormat('en-CA', { timeZone: after.timezone }).format(new Date(before.serverNow)))
  expect(after.electricity).toBe(Math.min(100, before.electricity + 80))
  expect(s.energyStored).toBe(after.electricity - before.electricity)
})

test('one reward per local day; recorded time kept beyond the 10 h cap', async ({ users }) => {
  const { api } = await carol(users)
  await api.reset()
  await api.alignTo(20)

  await api.act('startSleep')
  await api.advance(11 * 60) // 20:00 → 07:00, 11 h recorded
  const first = await api.act<{ session: Session }>('wakeUp')
  expect(first.data.session).toMatchObject({ recordedMinutes: 660, creditedMinutes: 600, energyAwarded: 100, rewardStatus: 'rewarded' })

  await api.advance(5 * 60) // 12:00 — past the 4 h gap, same local day
  await api.act('startSleep')
  await api.advance(2 * 60)
  const second = await api.act<{ session: Session }>('wakeUp')
  expect(second.data.session).toMatchObject({ recordedMinutes: 120, energyAwarded: 0, rewardStatus: 'daily_limit' })
})

test('4 hour gap between rewarded sessions holds across midnight', async ({ users }) => {
  const { api } = await carol(users)
  await api.reset()
  await api.alignTo(21)

  await api.act('startSleep')
  await api.advance(120) // 21:00 → 23:00
  const first = await api.act<{ session: Session }>('wakeUp')
  expect(first.data.session.rewardStatus).toBe('rewarded')

  await api.advance(120) // 01:00 next day — new local day, only 2 h later
  await api.act('startSleep')
  await api.advance(120)
  const second = await api.act<{ session: Session }>('wakeUp')
  expect(second.data.session).toMatchObject({ rewardStatus: 'cooldown', energyAwarded: 0 })
  expect(second.data.session.rewardDay).not.toBe(first.data.session.rewardDay)
})

test('short sessions earn nothing; cancel claims nothing', async ({ users }) => {
  const { api } = await carol(users)
  await api.reset()

  await api.act('startSleep')
  await api.advance(59)
  const short = await api.act<{ session: Session }>('wakeUp')
  expect(short.data.session).toMatchObject({ recordedMinutes: 59, energyAwarded: 0, rewardStatus: 'too_short' })

  const before = await api.city()
  await api.act('startSleep')
  await api.advance(8 * 60)
  const cancelled = await api.act<{ session: Session }>('cancelSleep')
  expect(cancelled.data.session).toMatchObject({ status: 'cancelled', rewardStatus: 'cancelled', energyAwarded: 0, recordedMinutes: 480 })
  expect((await api.city()).electricity).toBe(before.electricity)

  expect(await api.act('wakeUp')).toMatchObject({ success: false, code: 'not_sleeping' })
  expect(await api.act('cancelSleep')).toMatchObject({ success: false, code: 'not_sleeping' })
})

test('concurrent Start Sleep opens one session; concurrent Wake Up pays once', async ({ users }) => {
  const { api } = await carol(users)
  await api.reset()
  await api.alignTo(22)

  const starts = await Promise.all(Array.from({ length: 5 }, () => api.act('startSleep')))
  expect(starts.filter((r) => r.success)).toHaveLength(1)
  for (const r of starts.filter((r) => !r.success)) expect(r.code).toBe('already_sleeping')

  await api.advance(8 * 60)
  const before = await api.city()
  type Close = { sessionId: string; session: Session; decidedHere: boolean }
  const wakes = await Promise.all(Array.from({ length: 5 }, () => api.act<Close>('wakeUp')))
  console.log('concurrent wake outcomes:', wakes.map((r) => (r.success ? `${r.data.session.rewardStatus}${r.data.decidedHere ? '*' : ''}` : r.code)).join(', '))

  // Exactly one request decided; the others either finished the same decision or found nothing open.
  const decided = wakes.filter((r) => r.success && r.data.decidedHere)
  expect(decided).toHaveLength(1)
  const sessionId = decided[0].data.sessionId
  for (const r of wakes) {
    if (r.success) expect(r.data.sessionId).toBe(sessionId)
    else expect(r.code).toBe('not_sleeping')
  }

  const state = await api.inspect(sessionId)
  expectConsistentHistory(state)
  expect(state.revisions.filter((r) => r.reason === 'close_session').length).toBeGreaterThanOrEqual(1)
  expect(state.rewards).toHaveLength(1)
  expect(state.closures).toHaveLength(1)
  expect(state.city.activeSessionId).toBe('')
  expect(state.city.electricity).toBe(Math.min(100, before.electricity + 80))
})

test('Wake Up vs Cancel race: a rewarded session is never cancelled', async ({ users }) => {
  const { api } = await carol(users)
  type Close = { sessionId: string; session: Session; decidedHere: boolean }
  const tally: string[] = []

  for (let round = 0; round < 4; round++) {
    await api.reset() // fresh day each round so the wake is reward-eligible
    await api.act('startSleep')
    await api.advance(3 * 60)
    const before = await api.city()

    // Alternate which request is sent first so both outcomes get exercised.
    const [wake, cancel] =
      round % 2 === 0
        ? await Promise.all([api.act<Close>('wakeUp'), api.act<Close>('cancelSleep')])
        : await Promise.all([api.act<Close>('cancelSleep'), api.act<Close>('wakeUp')]).then(([c, w]) => [w, c] as const)
    const winner = wake.success ? 'wake' : 'cancel'
    tally.push(winner)
    // Exactly one side wins; the loser is told what really happened.
    expect(wake.success !== cancel.success).toBe(true)
    const loser = wake.success ? cancel : wake
    expect(loser.code).toBe(winner === 'wake' ? 'already_woke' : 'already_cancelled')

    const sessionId = (wake.success ? wake : cancel).data.sessionId
    const s = await api.inspect(sessionId)
    expectConsistentHistory(s)
    expect(s.closures).toHaveLength(1)
    expect(s.closures[0].kind).toBe(winner)
    if (winner === 'wake') {
      expect(s.session).toMatchObject({ status: 'completed', rewardStatus: 'rewarded', energyAwarded: 30 })
      expect(s.rewards).toHaveLength(1)
      expect(s.city.electricity).toBe(Math.min(100, before.electricity + 30))
    } else {
      expect(s.session).toMatchObject({ status: 'cancelled', rewardStatus: 'cancelled', energyAwarded: 0 })
      expect(s.rewards).toHaveLength(0)
      expect(s.city.electricity).toBe(before.electricity)
    }
    expect(s.session!.openSlot).toBe(`closed:${sessionId}`)
    expect(s.city.activeSessionId).toBe('')
  }
  console.log('wake vs cancel winners:', tally.join(', '))
})

// Partial server failure: the action stops after a given step, as if the
// worker crashed. The next request must finish the job exactly once.
for (const fault of ['after_closure', 'after_reward', 'after_city'] as const) {
  test(`recovers from a crash ${fault.replace('_', ' ')}: reward applied exactly once`, async ({ users }) => {
    const { api } = await carol(users)
    await api.reset()
    await api.act('startSleep')
    await api.advance(4 * 60)
    const before = await api.city()

    const crashed = await api.act('wakeUp', { __devFault: fault })
    expect(crashed).toMatchObject({ success: false, code: 'injected_fault' })

    // Retry (the player taps Wake Up again).
    const retry = await api.act<{ sessionId: string; session: Session; decidedHere: boolean }>('wakeUp')
    expect(retry.success, retry.error).toBe(true)
    expect(retry.data.decidedHere).toBe(false) // the crashed request's decision stands
    expect(retry.data.session).toMatchObject({ status: 'completed', rewardStatus: 'rewarded', energyAwarded: 40 })

    const s = await api.inspect(retry.data.sessionId)
    expect(s.rewards).toHaveLength(1)
    expect(s.closures).toHaveLength(1)
    expect(s.city.activeSessionId).toBe('')
    expect(s.city.electricity).toBe(Math.min(100, before.electricity + 40))
    expect(s.session!.energyStored).toBe(s.city.electricity - before.electricity)

    // Further calls change nothing.
    expect(await api.act('wakeUp')).toMatchObject({ success: false, code: 'not_sleeping' })
    expect((await api.inspect(retry.data.sessionId)).city.electricity).toBe(s.city.electricity)
  })
}

test('recovery also happens through Cancel or the next Start Sleep', async ({ users }) => {
  const { api } = await carol(users)

  // Wake crashed after the closure; the player then presses Cancel → the wake stands.
  await api.reset()
  await api.act('startSleep')
  await api.advance(2 * 60)
  expect(await api.act('wakeUp', { __devFault: 'after_closure' })).toMatchObject({ code: 'injected_fault' })
  const cancel = (await api.act('cancelSleep')) as Res & { details?: { sessionId: string; session: Session } }
  expect(cancel).toMatchObject({ success: false, code: 'already_woke' })
  expect(cancel.details?.session).toMatchObject({ status: 'completed', rewardStatus: 'rewarded' })
  const first = await api.inspect(cancel.details!.sessionId)
  expect(first.session).toMatchObject({ status: 'completed', rewardStatus: 'rewarded' })
  expect(first.rewards).toHaveLength(1)
  expect(first.city.activeSessionId).toBe('')

  // Wake crashed after the city update; the player starts a new session → old one is finalized first.
  await api.reset()
  const started = await api.act<{ sessionId: string }>('startSleep')
  await api.advance(2 * 60)
  expect(await api.act('wakeUp', { __devFault: 'after_city' })).toMatchObject({ code: 'injected_fault' })
  const next = await api.act<{ sessionId: string }>('startSleep')
  expect(next.success, next.error).toBe(true)
  const old = await api.inspect(started.data.sessionId)
  expect(old.session).toMatchObject({ status: 'completed', rewardStatus: 'rewarded', openSlot: `closed:${started.data.sessionId}` })
  expect(old.rewards).toHaveLength(1)
  expect(old.city.activeSessionId).toBe(next.data.sessionId)
  await api.act('cancelSleep')
})

test('UI: Start Sleep → (dev clock +8h) → Wake Up shows the reward and history', async ({ users }) => {
  const { page, api } = await carol(users)
  await api.reset({ electricity: 50 }) // powered, so the sky goes day → night → day

  await page.goto('/city')
  await expect(page.getByTestId('sleep-start')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'day')
  await page.getByTestId('sleep-start').click()
  await expect(page.getByTestId('sleep-wake')).toBeVisible()
  await expect(page.getByTestId('sleep-status')).toContainText('Sleeping since')
  // The town goes to night while you sleep.
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'night')

  await page.getByTestId('dev-advance-480').click()
  await expect(page.getByTestId('sleep-elapsed')).toHaveText(/^8h \d+m$/)

  await page.getByTestId('sleep-wake').click()
  await expect(page.getByTestId('sleep-result')).toContainText('+80 ⚡')
  await expect(page.getByTestId('sleep-start')).toBeVisible()
  await expect(page.getByTestId('sleep-row').first()).toHaveAttribute('data-status', 'rewarded')
  await expect(page.getByTestId('city-scene')).toHaveAttribute('data-sky', 'day')
})

// ── Playtest regressions ───────────────────────────────────────────────────

test('regression: sleep controls — Start only while awake; Wake Up and Cancel Session while asleep', async ({ users }) => {
  const { page, api } = await carol(users)
  await api.reset({ electricity: 50 })
  await page.goto('/city')

  // Awake: only Start Sleep.
  await expect(page.getByTestId('sleep-start')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('sleep-wake')).toHaveCount(0)
  await expect(page.getByTestId('sleep-cancel')).toHaveCount(0)

  // Asleep: clearly labelled Wake Up + Cancel Session, no Start.
  await page.getByTestId('sleep-start').click()
  await expect(page.getByTestId('sleep-wake')).toHaveText('Wake Up')
  await expect(page.getByTestId('sleep-cancel')).toHaveText('Cancel Session')
  await expect(page.getByTestId('sleep-start')).toHaveCount(0)

  // Cancel asks first; "Keep sleeping" backs out.
  await page.getByTestId('sleep-cancel').click()
  await expect(page.getByTestId('sleep-cancel-dialog')).toContainText('no energy is awarded')
  await page.getByTestId('sleep-cancel-keep').click()
  await expect(page.getByTestId('sleep-wake')).toBeVisible()

  // Confirmed cancel → awake again, saved as cancelled.
  await page.getByTestId('sleep-cancel').click()
  await page.getByTestId('sleep-cancel-confirm').click()
  await expect(page.getByTestId('sleep-result')).toHaveText('Session cancelled. No energy was claimed.')
  await expect(page.getByTestId('sleep-start')).toBeVisible()
  await expect(page.getByTestId('sleep-wake')).toHaveCount(0)
  await expect(page.getByTestId('sleep-row').first()).toHaveAttribute('data-status', 'cancelled')

  // A session started elsewhere (another tab/device) switches this page to the asleep controls.
  await api.act('startSleep')
  await expect(page.getByTestId('sleep-wake')).toBeVisible()
  await expect(page.getByTestId('sleep-start')).toHaveCount(0)
  await api.act('cancelSleep')
  await expect(page.getByTestId('sleep-start')).toBeVisible()
})

test('regression: history dates follow the (dev) simulated clock and say so', async ({ users }) => {
  const { page, api } = await carol(users)
  await api.reset()
  await api.act('startSleep')
  await api.advance(90)
  await api.act('wakeUp')
  const s = await api.inspect()
  const tz = (s.city as unknown as { timezone: string }).timezone

  await page.goto('/city')
  await expect(page.getByTestId('sleep-row').first()).toBeVisible({ timeout: 20_000 })
  // The newest row is the session just finished, dated by the simulated clock in the city's zone.
  const wakeAt = (s.city as unknown as { lastSettledAt: number }).lastSettledAt
  const expected = await page.evaluate(
    ([t, zone]) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone as string }).format(new Date(t as number)),
    [wakeAt, tz],
  )
  await expect(page.getByTestId('sleep-row-day').first()).toHaveText(expected)
  // Dev builds explain why that can be far from today.
  await expect(page.getByTestId('sleep-history-dev-note')).toContainText('simulated test clock')
  await expect(page.getByTestId('dev-clock-now')).toBeVisible()
})
