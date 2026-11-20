import type { RewardStatus } from './types'

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export function formatEnergy(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Player-facing explanation of a session's outcome. */
export const REWARD_LABELS: Record<RewardStatus, string> = {
  pending: 'In progress',
  rewarded: 'Rewarded',
  too_short: 'Too short (under 1 hour)',
  daily_limit: 'Already rewarded today',
  cooldown: 'Too soon after your last reward (4 h gap)',
  cancelled: 'Cancelled',
}
