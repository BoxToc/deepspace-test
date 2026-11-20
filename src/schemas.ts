/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { citiesSchema } from './schemas/cities-schema'
import { cityMutationsSchema } from './schemas/city-mutations-schema'
import { sleepSessionsSchema } from './schemas/sleep-sessions-schema'
import { sessionClosuresSchema } from './schemas/session-closures-schema'
import { energyRewardsSchema } from './schemas/energy-rewards-schema'
import { devClocksSchema } from './schemas/dev-clocks-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  citiesSchema,
  cityMutationsSchema,
  sleepSessionsSchema,
  sessionClosuresSchema,
  energyRewardsSchema,
  devClocksSchema,
]
