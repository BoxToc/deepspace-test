/**
 * City server actions — the only code allowed to write a player's city.
 *
 * Trust model (see src/server/action-routes.ts): `userId` is the verified
 * caller from the JWT. `tools.*` runs with RBAC off, so every read and write
 * here is explicitly scoped to `userId`; nothing taken from `params` is used
 * as an identity or record id.
 */

import { isAnonymousUserId } from 'deepspace/worker'
import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import { createInitialCity, isValidTimeZone } from '../game/city'
import { checkTimezoneChange, nextTimezoneChangeAt } from '../game/time'
import type { CityData } from '../game/types'
import type { Env } from '../../worker'

export interface CityRecord {
  recordId: string
  data: CityData
}

/** The caller's city, or `null` when they don't have one yet. */
export async function loadCity(
  tools: ActionTools,
  userId: string,
): Promise<ActionResult<CityRecord | null>> {
  const res = await tools.query<CityData>('cities', { where: { userId }, limit: 1 })
  if (!res.success) return res
  const row = res.data.records[0]
  return { success: true, data: row ? { recordId: row.recordId, data: row.data } : null }
}

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
export const initCity: ActionHandler<Env> = async ({ userId, params, tools }) => {
  if (isAnonymousUserId(userId)) {
    return { success: false, error: 'Sign in to start a city.' }
  }

  const existing = await loadCity(tools, userId)
  if (!existing.success) return existing
  if (existing.data) {
    return ok({ city: existing.data, created: false, serverNow: Date.now() })
  }

  const now = Date.now()
  const data = createInitialCity(userId, params.timezone, now)
  const created = await tools.create<CityData>('cities', data)

  if (created.success) {
    return ok({ city: { recordId: created.data.recordId, data }, created: true, serverNow: now })
  }

  // Most likely lost the race to a concurrent initCity (uniqueOn refusal).
  const winner = await loadCity(tools, userId)
  if (winner.success && winner.data) {
    return ok({ city: winner.data, created: false, serverNow: Date.now() })
  }
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
 *
 * Params: `{ timezone: string }` (IANA zone).
 *
 * Concurrency: the cooldown check reads the city, then writes it — two
 * requests could both pass the check. So before writing the city we insert a
 * `timezone_changes` row keyed on the city's previous `timezoneChangedAt`;
 * the schema's uniqueOn lets only one request claim that previous state.
 */
export const updateTimezone: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const timezone = params.timezone
  if (!isValidTimeZone(timezone)) {
    return { success: false, code: 'invalid_timezone', error: 'That is not a recognised time zone.' }
  }

  const loaded = await loadCity(tools, userId)
  if (!loaded.success) return loaded
  if (!loaded.data) return { success: false, code: 'no_city', error: 'Create your city first.' }
  const { recordId, data: city } = loaded.data
  const previousChangeAt = city.timezoneChangedAt ?? 0

  const now = Date.now()
  const check = checkTimezoneChange({ ...city, timezoneChangedAt: previousChangeAt }, timezone, now)
  if (!check.ok) {
    return {
      success: false,
      code: check.code,
      error: TIMEZONE_REFUSALS[check.code],
      ...(check.nextAllowedAt ? { details: { nextAllowedAt: check.nextAllowedAt } } : {}),
    }
  }

  const claim = await tools.create('timezone_changes', {
    userId,
    fromTimezone: city.timezone,
    toTimezone: timezone,
    changedAt: now,
    previousChangeAt,
  })
  if (!claim.success) {
    // Another request claimed this change slot first.
    return { success: false, code: 'cooldown', error: TIMEZONE_REFUSALS.cooldown }
  }

  const updated = await tools.update<CityData>('cities', recordId, { timezone, timezoneChangedAt: now })
  if (!updated.success) {
    // Release the slot so the player can retry; otherwise it stays claimed forever.
    await tools.remove('timezone_changes', claim.data.recordId)
    return updated
  }

  return ok({ timezone, timezoneChangedAt: now, nextAllowedAt: nextTimezoneChangeAt(now) })
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}
