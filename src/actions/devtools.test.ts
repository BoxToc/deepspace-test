/**
 * Production must never reach the simulated clock, fault injection, or the
 * inspector — even when the endpoints are called directly. These tests run
 * the real handlers with production-shaped env objects.
 */
import { describe, expect, it } from 'vitest'
import type { ActionContext, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { devAdvanceClock, devGetClock, devInspect, serverNow } from './clock'
import { devFault, devToolsEnabled } from './devtools'

const fetcher = {} as Fetcher
const LOCAL = { ALLOW_DEBUG_ROUTES: 'true' } as Env
const PROD = { PLATFORM_WORKER: fetcher, API_WORKER: fetcher } as Env
/** Production where someone also set ALLOW_DEBUG_ROUTES as a secret. */
const PROD_WITH_DEBUG_FLAG = { ...PROD, ALLOW_DEBUG_ROUTES: 'true' } as Env

/** Tools that fail the test if touched — proves prod never reads dev state. */
const untouchable = new Proxy({} as ActionTools, {
  get: (_t, prop) => () => {
    throw new Error(`tools.${String(prop)} must not be called in production`)
  },
})

const ctx = (env: Env, params: Record<string, unknown> = {}): ActionContext<Env> => ({
  userId: 'u1',
  params,
  tools: untouchable,
  env,
  callerJwt: 'jwt',
})

describe('dev tools gate', () => {
  it('is on only in local dev', () => {
    expect(devToolsEnabled(LOCAL)).toBe(true)
    expect(devToolsEnabled(PROD)).toBe(false)
    expect(devToolsEnabled(PROD_WITH_DEBUG_FLAG)).toBe(false)
    expect(devToolsEnabled({ ALLOW_DEBUG_ROUTES: 'false' } as Env)).toBe(false)
    expect(devToolsEnabled({ ALLOW_DEBUG_ROUTES: 'TRUE' } as Env)).toBe(false)
    expect(devToolsEnabled({ ALLOW_DEBUG_ROUTES: 'true', PLATFORM_WORKER: fetcher } as Env)).toBe(false)
    expect(devToolsEnabled({ ALLOW_DEBUG_ROUTES: 'true', API_WORKER: fetcher } as Env)).toBe(false)
  })

  for (const [name, env] of [['production', PROD], ['production + debug flag', PROD_WITH_DEBUG_FLAG]] as const) {
    it(`${name}: dev actions refuse without touching any data`, async () => {
      for (const handler of [devAdvanceClock, devGetClock, devInspect]) {
        expect(await handler(ctx(env, { minutes: 600, sessionId: 'x' }))).toMatchObject({
          success: false,
          code: 'dev_tools_disabled',
        })
      }
    })

    it(`${name}: serverNow is the real clock and never reads dev offsets`, async () => {
      const before = Date.now()
      const now = await serverNow(env, untouchable, 'u1')
      expect(now).toBeGreaterThanOrEqual(before)
      expect(now).toBeLessThanOrEqual(Date.now())
    })

    it(`${name}: fault injection params are ignored`, () => {
      expect(devFault(env, { __devFault: 'after_closure' })).toBeNull()
    })
  }

  it('local dev: accepts known fault points only', () => {
    expect(devFault(LOCAL, { __devFault: 'after_city' })).toBe('after_city')
    expect(devFault(LOCAL, { __devFault: 'drop_tables' })).toBeNull()
  })
})
