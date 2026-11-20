/**
 * Start Sleep / Wake Up / Cancel Session, plus recent history.
 *
 * Awake  -> only "Start Sleep".
 * Asleep -> "Wake Up" (claim the reward) and "Cancel Session" (end it without
 *           a reward, after a confirmation). "Asleep" comes from the city's own
 *           activeSessionId, so the controls are right even before the session
 *           row arrives over the live subscription.
 *
 * The panel never computes rewards: it calls the server action and shows
 * the outcome. The live timer is display-only ("recorded" time, not verified
 * sleep). History is filtered to this player (the app owner is an admin and
 * could otherwise receive every player's sessions).
 */

import { useEffect, useState } from 'react'
import { useQuery } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { DEV_TOOLS } from '@/hooks/useDevClock'
import { formatDayKey, formatEnergy, formatMinutes, REWARD_LABELS, sessionDayKey } from '@/game/format'
import { selectOwnSessions } from '@/game/ownership'
import { recordedMinutes } from '@/game/sleep'
import type { CityData, SleepSessionData } from '@/game/types'

type Busy = null | 'start' | 'wake' | 'cancel'

export function SleepPanel({
  city,
  clockOffsetMs,
  devClockOffsetMs = 0,
}: {
  city: CityData
  /** Server time minus browser time (includes the dev clock in local dev). */
  clockOffsetMs: number
  /** DEV ONLY: how far the simulated clock is ahead, to explain future dates. */
  devClockOffsetMs?: number
}) {
  const query = useQuery<SleepSessionData>('sleep_sessions', {
    where: { userId: city.userId },
    orderBy: 'startedAt',
    orderDir: 'desc',
    limit: 7,
  })
  const sessions = selectOwnSessions(city.userId, query.records, 7)
  const sleeping = Boolean(city.activeSessionId)
  const active = sessions.find((s) => s.recordId === city.activeSessionId && s.data.status === 'active')
  const now = useNow(clockOffsetMs)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const run = async (kind: Exclude<Busy, null>, action: string) => {
    setBusy(kind)
    setMessage(null)
    const res = await callAction<{ session?: SleepSessionData }>(action)
    setBusy(null)
    setConfirmCancel(false)
    if (!res.success) return setMessage({ tone: 'error', text: res.error })
    const s = res.data.session
    if (kind === 'wake' && s) setMessage({ tone: 'info', text: describeOutcome(s) })
    if (kind === 'cancel') setMessage({ tone: 'info', text: 'Session cancelled. No energy was claimed.' })
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-5" data-testid="sleep-panel" data-sleeping={sleeping}>
      {sleeping ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="sleep-status">
            {active ? `Sleeping since ${formatStart(active.data.startedAt, now)}` : 'Sleeping…'}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground" data-testid="sleep-elapsed">
            {active ? formatMinutes(recordedMinutes(active.data.startedAt, now)) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Recorded time — how long this session has been running.</p>

          {confirmCancel ? (
            <div className="mt-4 rounded-md border border-border p-3" data-testid="sleep-cancel-dialog">
              <p className="text-sm text-foreground">Cancel this session? It will be saved as cancelled and no energy is awarded.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="destructive" disabled={busy !== null} onClick={() => void run('cancel', 'cancelSleep')} data-testid="sleep-cancel-confirm">
                  {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel session'}
                </Button>
                <Button variant="outline" disabled={busy !== null} onClick={() => setConfirmCancel(false)} data-testid="sleep-cancel-keep">
                  Keep sleeping
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={busy !== null} onClick={() => void run('wake', 'wakeUp')} data-testid="sleep-wake">
                {busy === 'wake' ? 'Waking…' : 'Wake Up'}
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={() => setConfirmCancel(true)} data-testid="sleep-cancel">
                Cancel Session
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-testid="sleep-status">Awake</p>
          <Button className="mt-3" disabled={busy !== null} onClick={() => void run('start', 'startSleep')} data-testid="sleep-start">
            {busy === 'start' ? 'Starting…' : 'Start Sleep'}
          </Button>
        </>
      )}

      {message && (
        <p
          className={`mt-4 text-sm ${message.tone === 'error' ? 'text-destructive' : 'text-foreground'}`}
          data-testid={message.tone === 'error' ? 'sleep-error' : 'sleep-result'}
        >
          {message.text}
        </p>
      )}

      <SleepHistory sessions={sessions.filter((s) => s.data.status !== 'active')} devClockOffsetMs={devClockOffsetMs} />
    </section>
  )
}

/** "22:40" today, otherwise "Thu, Nov 19, 22:40" (relative to server-aligned now). */
function formatStart(startedAt: number, now: number): string {
  const time = new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (new Date(startedAt).toDateString() === new Date(now).toDateString()) return time
  return `${new Date(startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

function SleepHistory({ sessions, devClockOffsetMs }: { sessions: { recordId: string; data: SleepSessionData }[]; devClockOffsetMs: number }) {
  if (sessions.length === 0) return null
  return (
    <div className="mt-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent sessions</h3>
      {DEV_TOOLS && devClockOffsetMs > 0 && (
        <p className="mt-1 text-xs text-amber-400" data-testid="sleep-history-dev-note">
          Dev: dates follow the simulated test clock ({formatAhead(devClockOffsetMs)} ahead of real time).
        </p>
      )}
      <ul className="mt-2 divide-y divide-border text-sm" data-testid="sleep-history">
        {sessions.map(({ recordId, data: s }) => (
          <li key={recordId} className="flex flex-wrap items-baseline justify-between gap-2 py-2" data-testid="sleep-row" data-status={s.rewardStatus}>
            <span className="text-foreground" data-testid="sleep-row-day">{formatDayKey(sessionDayKey(s))}</span>
            <span className="text-muted-foreground">
              recorded {formatMinutes(s.recordedMinutes)}
              {s.rewardStatus === 'rewarded' && <> · credited {formatMinutes(s.creditedMinutes)}</>}
            </span>
            <span className={s.rewardStatus === 'rewarded' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {s.rewardStatus === 'rewarded' ? `+${formatEnergy(s.energyAwarded)} ⚡` : REWARD_LABELS[s.rewardStatus]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatAhead(ms: number): string {
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return days ? `${days}d ${hours}h` : `${hours}h`
}

function describeOutcome(s: SleepSessionData): string {
  const recorded = `Recorded ${formatMinutes(s.recordedMinutes)}`
  if (s.rewardStatus !== 'rewarded') return `${recorded}. ${REWARD_LABELS[s.rewardStatus]} — no energy this time.`
  const lost = s.energyAwarded - s.energyStored
  const battery = lost > 0 ? ` (${formatEnergy(lost)} ⚡ didn't fit in your battery)` : ''
  return `${recorded}, credited ${formatMinutes(s.creditedMinutes)}: +${formatEnergy(s.energyAwarded)} ⚡${battery}.`
}

/** Re-render every 15 s with the (possibly simulated) current time. */
function useNow(offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    setNow(Date.now() + offsetMs)
    const id = setInterval(() => setNow(Date.now() + offsetMs), 15_000)
    return () => clearInterval(id)
  }, [offsetMs])
  return now
}
