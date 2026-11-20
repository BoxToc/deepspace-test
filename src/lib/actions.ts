/**
 * Browser → server action calls. The JWT goes in the Authorization header;
 * the worker verifies it and derives the caller's userId from it, so the
 * client never sends its own identity.
 */

import { getAuthToken } from 'deepspace'

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export async function callAction<T>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Not signed in.' }
  try {
    const res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    if (res.status === 401) return { success: false, error: 'Your session expired. Sign in again.' }
    return (await res.json()) as ActionResponse<T>
  } catch {
    return { success: false, error: 'Could not reach the server. Check your connection.' }
  }
}
