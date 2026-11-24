/** Power Station progression (L1 → L3) between the Kenney buildings it stands with. */
import { readFileSync } from 'node:fs'
import { kenneyStack, single } from './kenney.js'

export const title = 'Power Station: generator building → substation → power complex (2×), with Kenney neighbours'

const render = (n) => `art-source/renders/power-l${n}.png`
/** Lot centre row = sprite height − 66 (Kenney lot convention). */
const anchor = (file) => readFileSync(file).readUInt32BE(20) - 66

export const items = [
  { label: 'Kenney house A\n(level 1)', layers: kenneyStack('house-a-ground', [], 'house-a-roof') },
  { label: 'Level 1\nGenerator building', layers: single(render(1), anchor(render(1))) },
  { label: 'Level 2\nElectrical substation', layers: single(render(2), anchor(render(2))) },
  { label: 'Level 3\nPower complex', layers: single(render(3), anchor(render(3))) },
  { label: 'Kenney shop\n(level 2)', layers: kenneyStack('shop-ground', ['shop-floor'], 'shop-roof') },
]
