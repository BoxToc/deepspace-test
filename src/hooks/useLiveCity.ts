/**
 * The city "as of right now", for display.
 *
 * The stored city is a snapshot taken at `lastSettledAt`. Every second we run
 * the same pure `settle()` the server uses, with server-aligned time, so
 * energy drains, coins tick up, and buildings dim the moment the battery
 * empties — without any writes. The server re-settles authoritatively inside
 * every action, so this projection can never grant anything.
 */

import { useEffect, useMemo, useState } from 'react'
import { BUILDING_KEYS, type BuildingKey } from '@/game/config'
import { batteryCapacity, coinsPerHour, consumptionPerHour, hoursOfPowerLeft, settle } from '@/game/economy'
import { isCityPowered } from '@/game/power'
import type { CityData } from '@/game/types'

/** Server-aligned "now", re-rendering every `intervalMs`. */
export function useServerNow(clockOffsetMs: number, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  useEffect(() => {
    setNow(Date.now() + clockOffsetMs)
    const id = setInterval(() => setNow(Date.now() + clockOffsetMs), intervalMs)
    return () => clearInterval(id)
  }, [clockOffsetMs, intervalMs])
  return now
}

export interface LiveCity {
  city: CityData
  powered: boolean
  power: Record<BuildingKey, boolean>
  capacity: number
  usagePerHour: number
  coinsPerHour: number
  hoursLeft: number
  now: number
}

export function useLiveCity(stored: CityData, clockOffsetMs: number): LiveCity {
  const now = useServerNow(clockOffsetMs)
  return useMemo(() => {
    const s = settle(stored, now)
    const city: CityData = { ...stored, electricity: s.electricity, coins: s.coins }
    const powered = isCityPowered(city)
    return {
      city,
      powered,
      power: Object.fromEntries(BUILDING_KEYS.map((k) => [k, powered])) as Record<BuildingKey, boolean>,
      capacity: batteryCapacity(stored.buildings),
      usagePerHour: consumptionPerHour(stored.buildings),
      coinsPerHour: coinsPerHour(stored.buildings),
      hoursLeft: hoursOfPowerLeft(city),
      now,
    }
  }, [stored, now])
}
