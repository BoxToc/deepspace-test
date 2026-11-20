import type { CollectionSchema } from 'deepspace/schema'

/**
 * Journal of committed city changes — one row per city revision.
 *
 * `uniqueOn: ['userId', 'revision']` is the compare-and-swap: inserting the
 * row for revision N claims the right to move the city from N to N+1, and
 * `next` holds the complete resulting state so any later request can finish
 * ("roll forward") a change whose city write didn't land.
 * Server-only: no client access.
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
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
