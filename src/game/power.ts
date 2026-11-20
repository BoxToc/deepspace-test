import type { CityData } from './types'

/**
 * Is the city powered right now? Phase 3: any stored energy lights the town.
 * (Phase 4 adds consumption over time; this stays the single source of truth
 * the scene reads.)
 */
export function isCityPowered(city: Pick<CityData, 'electricity'>): boolean {
  return city.electricity > 0
}
