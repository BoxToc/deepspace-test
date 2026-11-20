import type { ActionResult } from 'deepspace/worker'

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

/** A refusal the UI can branch on (`code`) and show (`error`). */
export function fail<T = never>(code: string, error: string, details?: Record<string, unknown>): ActionResult<T> {
  return { success: false, code, error, ...(details ? { details } : {}) } as ActionResult<T>
}
