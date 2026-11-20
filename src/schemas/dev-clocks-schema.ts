import type { CollectionSchema } from 'deepspace/schema'

/**
 * DEVELOPMENT ONLY — per-player simulated clock offset.
 *
 * Read and written only by the dev actions in src/actions/clock.ts, which
 * refuse unless ALLOW_DEBUG_ROUTES === 'true' (local dev/test). In production
 * the offset is never read, so rows here can't change any reward. No role has
 * any client access.
 */
export const devClocksSchema: CollectionSchema = {
  name: 'dev_clocks',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'offsetMs', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId'],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
