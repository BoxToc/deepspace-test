import type { CollectionSchema } from 'deepspace/schema'

/**
 * Sleep sessions — an append-mostly history of Start Sleep / Wake Up.
 *
 * Same trust model as `cities`: players read their own rows, only server
 * actions write. `recordedMinutes` is how long the session ran (not verified
 * sleep); `creditedMinutes` is what the reward rules accepted.
 *
 * Written by the Phase 2 sleep actions; defined now so the data model is
 * complete and migrates in one step.
 */
export const sleepSessionsSchema: CollectionSchema = {
  name: 'sleep_sessions',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['active', 'completed', 'cancelled'] },
      default: 'active',
    },
    { name: 'startedAt', storage: 'number', interpretation: 'plain', required: true },
    { name: 'endedAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'timezone', storage: 'text', interpretation: 'plain', default: 'UTC' },
    { name: 'recordedMinutes', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'creditedMinutes', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'energyAwarded', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'rewardDay', storage: 'text', interpretation: 'plain', default: '' },
    {
      name: 'rewardStatus',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['pending', 'rewarded', 'too_short', 'daily_limit', 'cooldown', 'cancelled'],
      },
      default: 'pending',
    },
  ],
  ownerField: 'userId',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
