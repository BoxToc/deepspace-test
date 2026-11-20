import type { CollectionSchema } from 'deepspace/schema'

/**
 * How each sleep session ended — the decision record for Wake Up vs Cancel.
 *
 * `uniqueOn: ['sessionId']`: the first of Wake Up / Cancel Sleep to insert
 * this row decides the session's fate; the other is refused. So a rewarded
 * session can never later be marked cancelled (or vice versa).
 *
 * It is also the write-ahead record for finishing the session: the outcome is
 * stored here BEFORE the reward claim, city update, and session update, so a
 * request that crashes midway is completed by the next one (roll-forward).
 * `rewardStatus` may be downgraded once, from 'rewarded' to 'daily_limit',
 * if the day's reward claim turns out to be held by another session.
 */
export const sessionClosuresSchema: CollectionSchema = {
  name: 'session_closures',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'sessionId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    {
      name: 'kind',
      storage: 'text',
      interpretation: { kind: 'select', options: ['wake', 'cancel'] },
      immutable: true,
      required: true,
    },
    { name: 'endedAt', storage: 'number', interpretation: 'plain', immutable: true, required: true },
    { name: 'recordedMinutes', storage: 'number', interpretation: 'plain', immutable: true, default: 0 },
    { name: 'creditedMinutes', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'energyAwarded', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'rewardDay', storage: 'text', interpretation: 'plain', immutable: true, default: '' },
    { name: 'rewardStatus', storage: 'text', interpretation: 'plain', required: true },
  ],
  ownerField: 'userId',
  uniqueOn: ['sessionId'],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
