import type { CollectionSchema } from 'deepspace/schema'

/**
 * Ledger of paid sleep rewards — one row per rewarded session.
 *
 * `uniqueOn: ['userId', 'rewardDay']` is the database-level guarantee of
 * "one primary energy reward per local calendar day": inserting this row is
 * the claim, and the DO refuses a second claim for the same day — so two
 * simultaneous Wake Up requests can never both pay out.
 */
export const energyRewardsSchema: CollectionSchema = {
  name: 'energy_rewards',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'sessionId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'rewardDay', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'energy', storage: 'number', interpretation: 'plain', required: true },
    { name: 'wakeAt', storage: 'number', interpretation: 'plain', required: true },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'rewardDay'],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
