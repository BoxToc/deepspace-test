/**
 * First-time onboarding: the core loop in three steps.
 *
 * Shown until the player dismisses it; the "How to play" button brings it
 * back. Dismissal is a per-browser convenience in localStorage — if storage
 * is unavailable the card simply shows again, which is harmless.
 */

import { useState } from 'react'
import { Coins, HelpCircle, Moon, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { SLEEP, UPGRADE_COST_TO_LEVEL } from '@/game/config'

const KEY = 'dreamgrid.howToPlay.dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: nothing to remember */
  }
}

export function useHowToPlay() {
  const [open, setOpen] = useState(() => !readDismissed())
  return {
    open,
    show: () => {
      writeDismissed(false)
      setOpen(true)
    },
    dismiss: () => {
      writeDismissed(true)
      setOpen(false)
    },
  }
}

const STEPS = [
  {
    icon: Moon,
    title: 'Sleep',
    text: `Tap Start Sleep at bedtime and Wake Up in the morning. ${SLEEP.minEligibleMinutes / 60}+ hours earns ${SLEEP.energyPerCreditedHour} ⚡ per hour, once a day.`,
  },
  {
    icon: Zap,
    title: 'Power your town',
    text: 'Energy charges your battery. While it has power, your buildings light up and run, even while you are away.',
  },
  {
    icon: Coins,
    title: 'Earn and upgrade',
    text: `Powered buildings earn coins. Tap a building to upgrade it (from ${UPGRADE_COST_TO_LEVEL[2]} coins) and watch it grow.`,
  },
]

export function HowToPlayCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      className="relative mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:p-5"
      aria-labelledby="how-to-play-title"
      data-testid="how-to-play"
    >
      <h2 id="how-to-play-title" className="pr-8 text-base font-semibold text-foreground">
        Welcome to your sleep-powered city
      </h2>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="Close how to play"
        data-testid="how-to-play-close"
      >
        <X className="size-4" aria-hidden />
      </button>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400" aria-hidden>
              <Icon className="size-4" />
            </span>
            <span className="text-sm">
              <span className="font-medium text-foreground">
                {i + 1}. {title}
              </span>
              <span className="mt-0.5 block text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button className="mt-4" size="sm" onClick={onDismiss} data-testid="how-to-play-done">
        Got it
      </Button>
    </section>
  )
}

export function HowToPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} data-testid="how-to-play-open">
      <HelpCircle className="size-4" aria-hidden /> How to play
    </Button>
  )
}
