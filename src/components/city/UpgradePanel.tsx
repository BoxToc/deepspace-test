/**
 * Building details + upgrade. The button is a convenience — the server
 * re-checks funds, level, and max level inside a concurrency-safe city change.
 */

import { useState } from 'react'
import { ArrowRight, Coins } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { BUILDINGS, MAX_BUILDING_LEVEL, type BuildingKey } from '@/game/config'
import { buildingEffect, upgradeCost } from '@/game/economy'
import { callAction } from '@/lib/actions'

export function UpgradePanel({
  building,
  level,
  coins,
  powered,
  onClose,
}: {
  building: BuildingKey | null
  level: number
  coins: number
  powered: boolean
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const close = () => {
    setMessage(null)
    onClose()
  }
  if (!building) return <Modal open={false} onClose={close}>{null}</Modal>

  const name = BUILDINGS[building].label
  const cost = upgradeCost(level)
  const atMax = cost === null
  const missing = cost === null ? 0 : Math.max(0, Math.ceil(cost - coins))

  const upgrade = async () => {
    setBusy(true)
    setMessage(null)
    const res = await callAction<{ level: number }>('upgradeBuilding', { building, fromLevel: level })
    setBusy(false)
    setMessage(res.success ? { tone: 'ok', text: `${name} upgraded to level ${res.data.level}!` } : { tone: 'error', text: res.error })
  }

  return (
    <Modal open onClose={close} size="sm" aria-label={`${name} details`} data-testid="upgrade-panel">
      <div className="space-y-4 p-1">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{name}</h2>
          <p className="text-sm text-muted-foreground">
            Level <span data-testid="upgrade-level">{level}</span> of {MAX_BUILDING_LEVEL} · {powered ? 'Powered' : 'No power'}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-sm">
          <EffectCard title="Now" lines={buildingEffect(building, level).lines} testId="upgrade-current" />
          {!atMax && <ArrowRight className="mt-6 size-4 text-muted-foreground" aria-hidden />}
          {!atMax && <EffectCard title={`Level ${level + 1}`} lines={buildingEffect(building, level + 1).lines} highlight testId="upgrade-next" />}
        </div>

        {atMax ? (
          <p className="text-sm text-muted-foreground" data-testid="upgrade-max">Fully upgraded.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm text-foreground">
              <Coins className="size-4 text-amber-400" aria-hidden />
              <span data-testid="upgrade-cost">{cost}</span> coins
              {missing > 0 && (
                <span className="text-muted-foreground" data-testid="upgrade-missing">
                  · need {missing} more
                </span>
              )}
            </p>
            <Button onClick={() => void upgrade()} disabled={busy || missing > 0} data-testid="upgrade-button">
              {busy ? 'Upgrading…' : `Upgrade to level ${level + 1}`}
            </Button>
          </div>
        )}

        <div aria-live="polite" role="status">
          {message && (
            <p
              className={`text-sm ${message.tone === 'error' ? 'text-destructive' : 'font-medium text-emerald-400'}`}
              data-testid={`upgrade-${message.tone === 'error' ? 'error' : 'result'}`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EffectCard({ title, lines, highlight, testId }: { title: string; lines: string[]; highlight?: boolean; testId: string }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-primary/60 bg-primary/5' : 'border-border'}`} data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5 text-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}
