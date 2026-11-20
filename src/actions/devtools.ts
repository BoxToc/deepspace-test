/**
 * Gate for every development-only capability (simulated clock, fault
 * injection, state inspection). Two independent conditions must BOTH hold:
 *
 *   1. ALLOW_DEBUG_ROUTES === 'true' — set by `deepspace dev` / `test run`
 *      only; not in wrangler.toml, not in the production secret store.
 *   2. No production service bindings — deployed workers get PLATFORM_WORKER
 *      and API_WORKER bindings; local dev only has the *_URL fallbacks. So
 *      even if someone set ALLOW_DEBUG_ROUTES in production (it's settable,
 *      for the SDK's owner-only debug API), players still can't time-travel.
 */

import type { Env } from '../../worker'

type GateEnv = Pick<Env, 'ALLOW_DEBUG_ROUTES' | 'PLATFORM_WORKER' | 'API_WORKER'>

export function devToolsEnabled(env: GateEnv): boolean {
  return env.ALLOW_DEBUG_ROUTES === 'true' && !env.PLATFORM_WORKER && !env.API_WORKER
}

/** Where a dev request asks the action to stop, simulating a crash. */
export type FaultPoint = 'after_closure' | 'after_reward' | 'after_city'

const FAULT_POINTS: readonly FaultPoint[] = ['after_closure', 'after_reward', 'after_city']

/** DEV ONLY: the fault point requested via `params.__devFault`, else null. Always null in production. */
export function devFault(env: GateEnv, params: Record<string, unknown>): FaultPoint | null {
  if (!devToolsEnabled(env)) return null
  const p = params.__devFault
  return typeof p === 'string' && (FAULT_POINTS as readonly string[]).includes(p) ? (p as FaultPoint) : null
}
