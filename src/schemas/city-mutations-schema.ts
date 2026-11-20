import type { CollectionSchema } from 'deepspace/schema'

/**
 * Versioned city state — one immutable row per committed city revision.
 *
 * `next` is the COMPLETE city state at `revision`; the current city is the
 * base `cities` row overlaid with the highest-revision row here (see
 * src/actions/city-store.ts). `uniqueOn: ['userId', 'revision']` is the
 * compare-and-swap: only one change can create revision N+1. Rows are never
 * updated, so an older state can never replace a newer one.
 *
 * Players read their own rows (the city page subscribes to the latest);
 * only server actions write.
 */
export const cityMutationsSchema: CollectionSchema = {
  name: 'city_mutations',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'revision', storage: 'number', interpretation: 'plain', immutable: true, required: true },
    { name: 'reason', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'refId', storage: 'text', interpretation: 'plain', immutable: true, default: '' },
    { name: 'next', storage: 'text', interpretation: { kind: 'json' }, immutable: true, required: true },
    { name: 'meta', storage: 'text', interpretation: { kind: 'json' }, immutable: true },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'revision'],
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
