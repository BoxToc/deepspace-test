import { describe, expect, it } from 'vitest'
import { createInitialCity } from '../game/city'
import type { CityData } from '../game/types'
import { loadCity, mutateCity } from './city-store'
import { createFakeTools, type FakeToolsOptions } from './fake-tools.test-helper'
import { fail } from './results'

// Same uniqueness rules as the real schemas.
const UNIQUE = { cities: ['userId'], city_mutations: ['userId', 'revision'] }

async function setup(opts: FakeToolsOptions = {}) {
  const fake = createFakeTools(UNIQUE, opts)
  await fake.tools.create('cities', createInitialCity('u1', 'UTC', 0)) // electricity 20, revision 0
  const city = async () => ((await loadCity(fake.tools, 'u1')) as { data: { data: CityData } }).data.data
  return { ...fake, city }
}

const addEnergy = (n: number) => ({
  reason: 'test_add',
  decide: (c: CityData) => ({ kind: 'change' as const, patch: { electricity: c.electricity + n }, result: null }),
})

describe('mutateCity — versioned, append-only city state', () => {
  it('commits a change as the next revision', async () => {
    const { tools, city, rows } = await setup()
    expect((await mutateCity(tools, 'u1', addEnergy(5))).success).toBe(true)
    expect(await city()).toMatchObject({ electricity: 25, revision: 1 })
    expect(rows('cities')[0]).toMatchObject({ electricity: 20, revision: 0 }) // base row never rewritten
  })

  it('never loses a concurrent update (12 parallel increments)', async () => {
    const { tools, city, rows } = await setup()
    const results = await Promise.all(Array.from({ length: 12 }, () => mutateCity(tools, 'u1', addEnergy(1))))
    const committed = results.filter((r) => r.success).length
    for (const r of results.filter((r) => !r.success)) expect(r).toMatchObject({ code: 'city_busy' })
    expect(committed).toBeGreaterThan(0)
    expect(await city()).toMatchObject({ electricity: 20 + committed, revision: committed })
    // Revisions are contiguous and unique: 1..committed.
    const revs = rows('city_mutations').map((r) => r.revision as number).sort((a, b) => a - b)
    expect(revs).toEqual(Array.from({ length: committed }, (_, i) => i + 1))
  })

  it('a slow writer that read an older revision cannot overwrite newer state', async () => {
    // Writer A reads revision 0 and is held right before committing. Writer B
    // commits revision 1 meanwhile. When A resumes, its (now stale) commit for
    // revision 1 must be refused, and A must redo its change on top of B's.
    let releaseA!: () => void
    const aHeld = new Promise<void>((r) => (releaseA = r))
    let bCommitted!: () => void
    const bDone = new Promise<void>((r) => (bCommitted = r))
    const { tools, city } = await setup({
      beforeCreate: async (collection, data) => {
        if (collection !== 'city_mutations') return
        if (data.reason === 'A' && data.revision === 1) await aHeld
      },
    })

    const a = mutateCity(tools, 'u1', {
      reason: 'A',
      decide: (c) => ({ kind: 'change', patch: { electricity: c.electricity + 5 }, result: null }),
    })
    const b = mutateCity(tools, 'u1', {
      reason: 'B',
      decide: (c) => ({ kind: 'change', patch: { coins: c.coins + 100 }, result: null }),
    }).then((r) => (bCommitted(), r))

    await bDone
    expect(await city()).toMatchObject({ electricity: 20, coins: 100, revision: 1 }) // B is visible
    releaseA()
    const [ra, rb] = await Promise.all([a, b])
    expect(ra.success && rb.success).toBe(true)
    // Both changes survive: A's stale write was refused and re-applied on top of B.
    expect(await city()).toMatchObject({ electricity: 25, coins: 100, revision: 2 })
  })

  it('reads never go backwards while writers race', async () => {
    const { tools } = await setup()
    const seen: number[] = []
    let writing = true
    const reader = (async () => {
      while (writing) {
        const r = await loadCity(tools, 'u1')
        if (r.success && r.data) seen.push(r.data.data.revision)
      }
    })()
    await Promise.all(Array.from({ length: 10 }, () => mutateCity(tools, 'u1', addEnergy(1))))
    writing = false
    await reader
    expect(seen.length).toBeGreaterThan(5)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  })

  it('refusals and no-ops commit nothing', async () => {
    const { tools, rows } = await setup()
    const refused = await mutateCity(tools, 'u1', {
      reason: 'test_refuse',
      decide: () => ({ kind: 'refuse', refusal: fail('nope', 'Refused') }),
    })
    expect(refused).toMatchObject({ success: false, code: 'nope' })
    const noop = await mutateCity(tools, 'u1', { reason: 'test_noop', decide: () => ({ kind: 'noop', result: 1 }) })
    expect(noop).toMatchObject({ success: true, data: { applied: false, result: 1 } })
    expect(rows('city_mutations')).toHaveLength(0)
  })
})
