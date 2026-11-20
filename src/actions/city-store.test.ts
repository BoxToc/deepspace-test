import { describe, expect, it } from 'vitest'
import { createInitialCity } from '../game/city'
import type { CityData } from '../game/types'
import { loadCity, mutateCity } from './city-store'
import { createFakeTools } from './fake-tools.test-helper'
import { fail } from './results'

const UNIQUE = { cities: ['userId'], city_mutations: ['userId', 'revision'] }

async function setup(failUpdates?: (c: string) => boolean) {
  const fake = createFakeTools(UNIQUE, { failUpdates })
  await fake.tools.create('cities', createInitialCity('u1', 'UTC', 0))
  const city = async () => ((await loadCity(fake.tools, 'u1')) as { data: { data: CityData } }).data.data
  return { ...fake, city }
}

const addEnergy = (n: number) => ({
  reason: 'test_add',
  decide: (c: CityData) => ({ kind: 'change' as const, patch: { electricity: c.electricity + n }, result: null }),
})

describe('mutateCity (optimistic concurrency via uniqueOn)', () => {
  it('applies one change and bumps the revision', async () => {
    const { tools, city } = await setup()
    const res = await mutateCity(tools, 'u1', addEnergy(5))
    expect(res.success).toBe(true)
    expect(await city()).toMatchObject({ electricity: 25, revision: 1 })
  })

  it('never loses a concurrent update (12 parallel increments)', async () => {
    const { tools, city, rows } = await setup()
    const results = await Promise.all(Array.from({ length: 12 }, () => mutateCity(tools, 'u1', addEnergy(1))))
    const committed = results.filter((r) => r.success).length
    // Each request either commits exactly once or reports "busy" — never a silent overwrite.
    for (const r of results.filter((r) => !r.success)) expect(r).toMatchObject({ code: 'city_busy' })
    const c = await city()
    expect(c.electricity).toBe(20 + committed)
    expect(c.revision).toBe(committed)
    expect(rows('city_mutations')).toHaveLength(committed)
    expect(committed).toBeGreaterThan(0)
  })

  it('rolls a committed-but-unwritten change forward on the next mutation', async () => {
    const { tools, city } = await setup()
    await mutateCity(tools, 'u1', { ...addEnergy(30), skipMaterialize: true }) // journal only
    expect((await city()).electricity).toBe(20) // city row not written yet

    await mutateCity(tools, 'u1', addEnergy(1))
    expect(await city()).toMatchObject({ electricity: 51, revision: 2 }) // 20 + 30 (rolled forward) + 1
  })

  it('treats a failed city write as committed (journal is the source of truth)', async () => {
    let failing = true
    const { tools, city } = await setup((c) => failing && c === 'cities')
    const res = await mutateCity(tools, 'u1', addEnergy(10))
    expect(res.success).toBe(true)
    failing = false
    await mutateCity(tools, 'u1', addEnergy(0))
    expect((await city()).electricity).toBe(30)
  })

  it('decides against the exact revision it replaces (refusals and no-ops write nothing)', async () => {
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
