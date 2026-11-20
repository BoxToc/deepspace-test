import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { initCity, updateTimezone } from './city'
import { devAdvanceClock, devGetClock, devInspect } from './clock'
import { devSetCity, upgradeBuilding } from './economy'
import { cancelSleep, startSleep, wakeUp } from './sleep'

/**
 * Every server action, exposed at POST /api/actions/<name>.
 * The route (src/server/action-routes.ts) verifies the caller's JWT first.
 * `dev*` actions refuse outside local dev/test — see src/actions/devtools.ts.
 */
export const actions: Record<string, ActionHandler<Env>> = {
  initCity,
  updateTimezone,
  startSleep,
  wakeUp,
  cancelSleep,
  upgradeBuilding,
  devAdvanceClock,
  devGetClock,
  devInspect,
  devSetCity,
}
