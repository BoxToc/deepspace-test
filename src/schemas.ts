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
import { sleepSessionsSchema } from './schemas/sleep-sessions-schema'
import { timezoneChangesSchema } from './schemas/timezone-changes-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  citiesSchema,
  sleepSessionsSchema,
  timezoneChangesSchema,
]
