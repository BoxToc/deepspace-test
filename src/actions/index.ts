import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { initCity, updateTimezone } from './city'

/**
 * Every server action, exposed at POST /api/actions/<name>.
 * The route (src/server/action-routes.ts) verifies the caller's JWT first.
 */
export const actions: Record<string, ActionHandler<Env>> = {
  initCity,
  updateTimezone,
}
