/**
 * City server actions.
 *
 * Trust model (see src/server/action-routes.ts): `userId` is the verified
 * caller from the JWT. `tools.*` runs with RBAC off, so every read and write
 * here is explicitly scoped to `userId`; nothing taken from `params` is used
 * as an identity or record id. After creation, the city changes only through
 * `mutateCity` (src/actions/city-store.ts).
 */

import { isAnonymousUserId } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import { createInitialCity, isValidTimeZone } from '../game/city'
import { checkTimezoneChange, nextTimezoneChangeAt } from '../game/time'
import type { CityData } from '../game/types'
import type { Env } from '../../worker'
import { loadCity, mutateCity, type CityRecord } from './city-store'
import { serverNow } from './clock'
import { fail, ok } from './results'

export { loadCity, type CityRecord }

export interface InitCityResult {
  city: CityRecord
  created: boolean
  serverNow: number
}

/**
 * Idempotent: returns the existing city, or creates the starting city.
 *
 * Params: `{ timezone?: string }` — the browser's IANA zone, validated here
 * and stored once at creation (it decides which local day a reward lands on).
 *
 * Race safety: two tabs calling this at once can both see "no city" and both
 * create. The schema's `uniqueOn: ['userId']` makes the DO refuse the second
 * create, so we re-read and return the winner instead of making a duplicate.
 */
export const initCity: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (isAnonymousUserId(userId)) return fail('anonymous', 'Sign in to start a city.')

  const now = await serverNow(env, tools, userId)
  const existing = await loadCity(tools, userId)
  if (!existing.success) return existing
  if (existing.data) return ok<InitCityResult>({ city: existing.data, created: false, serverNow: now })

  const data = createInitialCity(userId, params.timezone, now)
  const created = await tools.create<CityData>('cities', data)
  if (created.success) {
    return ok<InitCityResult>({ city: { recordId: created.data.recordId, data }, created: true, serverNow: now })
  }

  // Most likely lost the race to a concurrent initCity (uniqueOn refusal).
  const winner = await loadCity(tools, userId)
  if (winner.success && winner.data) return ok<InitCityResult>({ city: winner.data, created: false, serverNow: now })
  return created
}

export interface UpdateTimezoneResult {
  timezone: string
  timezoneChangedAt: number
  nextAllowedAt: number
}

const TIMEZONE_REFUSALS = {
  same_timezone: 'That is already your time zone.',
  session_active: 'Finish or cancel your sleep session before changing time zone.',
  cooldown: 'You can change your time zone once every 7 days.',
} as const

/**
 * Change the saved time zone — at most once per 7 days, never mid-session.
 * Params: `{ timezone: string }` (IANA zone).
 *
 * Concurrency: the rule is evaluated inside `mutateCity` against the exact
 * revision being replaced, so of two simultaneous changes only one commits;
 * the other retries on the new revision and hits the cooldown.
 */
export const updateTimezone: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const timezone = params.timezone
  if (!isValidTimeZone(timezone)) return fail('invalid_timezone', 'That is not a recognised time zone.')

  const now = await serverNow(env, tools, userId)
  const res = await mutateCity<UpdateTimezoneResult>(tools, userId, {
    reason: 'timezone',
    decide: (city) => {
      const check = checkTimezoneChange({ ...city, timezoneChangedAt: city.timezoneChangedAt ?? 0 }, timezone, now)
      if (!check.ok) {
        const details = check.nextAllowedAt ? { nextAllowedAt: check.nextAllowedAt } : undefined
        return { kind: 'refuse', refusal: fail(check.code, TIMEZONE_REFUSALS[check.code], details) }
      }
      return {
        kind: 'change',
        patch: { timezone, timezoneChangedAt: now },
        meta: { from: city.timezone },
        result: { timezone, timezoneChangedAt: now, nextAllowedAt: nextTimezoneChangeAt(now) },
      }
    },
  })
  return res.success ? ok(res.data.result) : res
}
