import type { CollectionSchema } from 'deepspace/schema'

/**
 * One city per player — the persistent game state.
 *
 * Server-authoritative: no role may create/update/delete from the client.
 * Every write goes through a server action (src/actions/), which runs the
 * economy rules with server time. Players can read only their own city.
 * After creation, every change goes through `mutateCity` (revision-claimed).
 */
export const citiesSchema: CollectionSchema = {
  name: 'cities',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'timezone', storage: 'text', interpretation: 'plain', default: 'UTC' },
    { name: 'timezoneChangedAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'electricity', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'coins', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'lastSettledAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'activeSessionId', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'lastRewardDay', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'lastRewardedWakeAt', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'buildings', storage: 'text', interpretation: { kind: 'json' } },
    /** Optimistic-concurrency counter — see src/actions/city-store.ts. */
    { name: 'revision', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId'],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
