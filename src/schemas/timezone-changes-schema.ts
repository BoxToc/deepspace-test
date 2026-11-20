import type { CollectionSchema } from 'deepspace/schema'

/**
 * Audit log of time-zone changes — and the lock that makes the 7-day rule
 * hold under concurrency.
 *
 * Each change "claims" the previous change's timestamp (`previousChangeAt`).
 * `uniqueOn: ['userId', 'previousChangeAt']` lets only ONE change claim a
 * given previous state, so two simultaneous requests that both passed the
 * cooldown check can't both succeed: the DO refuses the second insert.
 */
export const timezoneChangesSchema: CollectionSchema = {
  name: 'timezone_changes',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'fromTimezone', storage: 'text', interpretation: 'plain', required: true },
    { name: 'toTimezone', storage: 'text', interpretation: 'plain', required: true },
    { name: 'changedAt', storage: 'number', interpretation: 'plain', required: true },
    { name: 'previousChangeAt', storage: 'number', interpretation: 'plain', required: true },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'previousChangeAt'],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
