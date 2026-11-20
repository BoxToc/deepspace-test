/**
 * In-memory stand-in for DeepSpace ActionTools, for unit tests only.
 * Enforces `uniqueOn` like the RecordRoom DO, and yields to the event loop
 * between operations so concurrent callers genuinely interleave.
 */

import type { ActionTools } from 'deepspace/worker'

type Row = { recordId: string; data: Record<string, unknown> }

export function createFakeTools(uniqueOn: Record<string, string[]>, opts: { failUpdates?: (collection: string) => boolean } = {}) {
  const tables = new Map<string, Row[]>()
  let seq = 0
  const table = (c: string) => tables.get(c) ?? (tables.set(c, []), tables.get(c)!)
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3))
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => (k === 'recordId' ? row.recordId === v : row.data[k] === v))
  const clone = <T>(v: T): T => structuredClone(v)

  const tools = {
    async create(collection: string, data: Record<string, unknown>, recordId?: string) {
      await tick()
      const keys = uniqueOn[collection]
      if (keys && table(collection).some((r) => keys.every((k) => r.data[k] === data[k]))) {
        return { success: false, error: `Duplicate in ${collection}` }
      }
      const id = recordId ?? `${collection}_${++seq}`
      table(collection).push({ recordId: id, data: clone(data) })
      return { success: true, data: { recordId: id } }
    },
    async update(collection: string, recordId: string, patch: Record<string, unknown>) {
      await tick()
      if (opts.failUpdates?.(collection)) return { success: false, error: 'injected update failure' }
      const row = table(collection).find((r) => r.recordId === recordId)
      if (!row) return { success: false, error: 'Record not found' }
      row.data = { ...row.data, ...clone(patch) }
      return { success: true, data: { recordId } }
    },
    async remove(collection: string, recordId: string) {
      await tick()
      tables.set(collection, table(collection).filter((r) => r.recordId !== recordId))
      return { success: true, data: { recordId } }
    },
    async get(collection: string, recordId: string) {
      await tick()
      const row = table(collection).find((r) => r.recordId === recordId)
      return row ? { success: true, data: { record: clone(row) } } : { success: false, error: 'Record not found' }
    },
    async query(collection: string, options: { where?: Record<string, unknown>; limit?: number } = {}) {
      await tick()
      const rows = table(collection).filter((r) => matches(r, options.where)).slice(0, options.limit ?? 100)
      return { success: true, data: { records: clone(rows), count: rows.length } }
    },
  }

  return { tools: tools as unknown as ActionTools, rows: (c: string) => table(c).map((r) => r.data) }
}
