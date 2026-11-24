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
import { ChevronRight, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { DEV_TOOLS } from '@/hooks/useDevClock'
import { SLEEP } from '@/game/config'
import { formatDayKey, formatEnergy, formatMinutes, REWARD_LABELS, sessionDayKey } from '@/game/format'
import { sleepReadiness } from '@/game/guidance'
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
  const [message, setMessage] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null)

  const run = async (kind: Exclude<Busy, null>, action: string) => {
    setBusy(kind)
    setMessage(null)
    const res = await callAction<{ session?: SleepSessionData }>(action)
    setBusy(null)
    setConfirmCancel(false)
    if (!res.success) return setMessage({ tone: 'error', text: res.error })
    const s = res.data.session
    if (kind === 'wake' && s) setMessage({ tone: s.rewardStatus === 'rewarded' ? 'success' : 'info', text: describeOutcome(s) })
    if (kind === 'start') setMessage({ tone: 'info', text: 'Sleep started. Good night! Tap Wake Up when you get up to collect your energy.' })
    if (kind === 'cancel') setMessage({ tone: 'info', text: 'Session cancelled. No energy was claimed.' })
  }

  return (
    <section className="hud-card" data-testid="sleep-panel" data-sleeping={sleeping} aria-labelledby="sleep-title">
      <h2 id="sleep-title" className="hud-label mb-2 flex items-center gap-1.5">
        <Moon className="size-3.5" aria-hidden /> Tonight
      </h2>
      {sleeping ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="sleep-status">
            {active ? `Sleeping since ${formatStart(active.data.startedAt, now)}` : 'Sleeping…'}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground" data-testid="sleep-elapsed">
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
            <div className="mt-4 grid gap-2">
              <Button className="game-btn is-wake" disabled={busy !== null} onClick={() => void run('wake', 'wakeUp')} data-testid="sleep-wake">
                <Sun className="size-4" aria-hidden /> {busy === 'wake' ? 'Waking…' : 'Wake Up'}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmCancel(true)} data-testid="sleep-cancel">
                Cancel Session
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-testid="sleep-status">Awake</p>
          <Button className="game-btn mt-2" disabled={busy !== null} onClick={() => void run('start', 'startSleep')} data-testid="sleep-start">
            <Moon className="size-4" aria-hidden /> {busy === 'start' ? 'Starting…' : 'Start Sleep'}
          </Button>
        </>
      )}

      {/* Announced to screen readers; errors interrupt, results wait politely. */}
      <div aria-live="polite" role="status">
        {message && message.tone !== 'error' && (
          <p
            className={`mt-4 rounded-md px-3 py-2 text-sm ${message.tone === 'success' ? 'border border-amber-400/40 bg-amber-400/10 text-foreground' : 'text-foreground'}`}
            data-testid="sleep-result"
            data-tone={message.tone}
          >
            {message.text}
          </p>
        )}
      </div>
      {message?.tone === 'error' && (
        <p className="mt-4 text-sm text-destructive" role="alert" data-testid="sleep-error">
          {message.text}
        </p>
      )}

      {!sleeping && (
        <>
          <ReadinessHint city={city} now={now} />
          <p className="mt-3 text-xs text-muted-foreground" data-testid="sleep-rules">
            Tap Start Sleep at bedtime and Wake Up in the morning. Sleep of {SLEEP.minEligibleMinutes / 60} hour or more earns{' '}
            {SLEEP.energyPerCreditedHour} ⚡ per hour (up to {SLEEP.maxCreditedMinutes / 60} hours), once per day.
          </p>
        </>
      )}

      <SleepHistory sessions={sessions.filter((s) => s.data.status !== 'active')} devClockOffsetMs={devClockOffsetMs} />
    </section>
  )
}

/** Before starting: will a session started now be able to earn energy? (Display only; the server decides.) */
function ReadinessHint({ city, now }: { city: CityData; now: number }) {
  const r = sleepReadiness(city, now)
  if (r.kind === 'ready') return null
  const text =
    r.kind === 'cooldown'
      ? `You woke up less than ${SLEEP.minHoursBetweenRewards} hours ago. Sleep started before ${new Date(r.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} won't earn energy.`
      : "You've already collected today's energy. Your next reward counts when you wake up on a new day, so tonight's sleep still counts."
  return (
    <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid="sleep-readiness" data-kind={r.kind}>
      {text}
    </p>
  )
}

/** "22:40" today, otherwise "Thu, Nov 19, 22:40" (relative to server-aligned now). */
function formatStart(startedAt: number, now: number): string {
  const time = new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (new Date(startedAt).toDateString() === new Date(now).toDateString()) return time
  return `${new Date(startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

type SessionRow = { recordId: string; data: SleepSessionData }

/** The latest session stays in view; older ones fold away under "Sleep history". */
function SleepHistory({ sessions, devClockOffsetMs }: { sessions: SessionRow[]; devClockOffsetMs: number }) {
  if (sessions.length === 0) return null
  const [latest, ...older] = sessions
  return (
    <div className="mt-4 border-t border-border pt-3">
      {DEV_TOOLS && devClockOffsetMs > 0 && (
        <p className="mb-1 text-xs text-amber-400" data-testid="sleep-history-dev-note">
          Dev: dates follow the simulated test clock ({formatAhead(devClockOffsetMs)} ahead of real time).
        </p>
      )}
      <h3 className="text-xs font-medium text-muted-foreground">Last sleep</h3>
      <ul className="text-sm" data-testid="sleep-history">
        <HistoryRow row={latest} />
      </ul>
      {older.length > 0 && (
        <details className="group mt-1">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
            Sleep history ({older.length} more)
          </summary>
          <ul className="divide-y divide-border text-sm">
            {older.map((row) => (
              <HistoryRow key={row.recordId} row={row} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function HistoryRow({ row: { data: s } }: { row: SessionRow }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-1.5" data-testid="sleep-row" data-status={s.rewardStatus}>
      <span className="text-foreground" data-testid="sleep-row-day">{formatDayKey(sessionDayKey(s))}</span>
      <span className="text-xs text-muted-foreground">
        recorded {formatMinutes(s.recordedMinutes)}
        {s.rewardStatus === 'rewarded' && <> · credited {formatMinutes(s.creditedMinutes)}</>}
      </span>
      <span className={s.rewardStatus === 'rewarded' ? 'font-semibold text-amber-300' : 'text-muted-foreground'}>
        {s.rewardStatus === 'rewarded' ? `+${formatEnergy(s.energyAwarded)} ⚡` : REWARD_LABELS[s.rewardStatus]}
      </span>
    </li>
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
  const gain = `+${formatEnergy(s.energyAwarded)} ⚡ earned`
  const battery = lost > 0 ? ` (${formatEnergy(lost)} ⚡ didn't fit in your battery)` : ' and stored in your battery'
  return `${gain}${battery}. ${recorded}, credited ${formatMinutes(s.creditedMinutes)}.`
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
