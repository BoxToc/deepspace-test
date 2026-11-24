# DreamGrid — Phase 3 town screenshots

Captured from local dev at 1280 px (phone shot at 390 px). Sprites: Kenney isometric packs (CC0).

| File | What it shows |
|---|---|
| `scene-day.png` | The town at level 1 with power: lit street lamps, ⚡ over the Power Station |
| `scene-night.png` | Night sky while a sleep session is running |
| `scene-unpowered-level3.png` | Out of power (all buildings at level 3): buildings and park dimmed, "no power" badges, lamps off, overcast sky |
| `scene-level2.png` / `scene-level3.png` | Buildings grow one floor per level (sprite stacking) |
| `page-mobile.png` | The `/city` page on a 390 px phone |

The level 2/3 and unpowered shots use the dev-only `?preview=` / `?level=` switch, which only changes what is drawn (never server state) and is not present in production builds.

## Phase 4 — economy and upgrades

| File | What it shows |
|---|---|
| `phase4-dashboard.png` | Live dashboard: energy meter with hours of power left and usage, coins with hourly income, building levels with upgrade buttons and costs (Power Station and Shop at level 2) |
| `phase4-upgrade-panel.png` | Tapping a building: current vs. next-level effects, cost, Upgrade button |
| `phase4-mobile-upgrade-panel.png` | The upgrade panel on a 390 px phone |

The Phase 4 shots are from local dev, so they include the dev-only simulated-clock panel, which production builds don't have.

## Phase 5 — Power Station art and building upgrade stages

| File | What it shows |
|---|---|
| `power-station-progression.png` | The Power Station at 2×: generator building → electrical substation → power complex, between Kenney neighbours. Original art, rendered in the Kenney style by `tools/sprite-pipeline` |
| `town-power-l1.png` / `town-power-l2.png` / `town-power-l3.png` | The Power Station at levels 1, 2 and 3 in the town; everything else stays at level 1 |
| `town-power-l3-unpowered.png` | Level 3 out of power: dimmed, with "no power" badges |
| `town-power-l3-phone.png` | Level 3 at 390 px phone width |
| `town-all-l3.png` | Every building at level 3: power complex, department store, three-storey houses (Kenney upgrade stages) |

Captured from local dev. The in-town levels were set on a test account's local city. The all-level-3 and unpowered shots use the dev-only `?level=` / `?preview=` switch.

## Phase 5 — onboarding, feedback and landing page

| File | What it shows |
|---|---|
| `phase5-landing.png` / `phase5-landing-phone.png` | The static landing page: hero, the town at level 3, and "How it works" |
| `phase5-onboarding-phone.png` | First visit on a 390 px phone: the three-step how-to-play card and the out-of-power banner |
| `phase5-outage-phone.png` | After dismissing the card: the out-of-power banner above the dark town |
| `phase5-dashboard.png` | Dashboard with the next-goal line ("Next upgrade: Power Station (100) in ≈ 3h 12m") |
| `phase5-hud.png` | The game HUD (desktop): resource chips above the town, goal ribbon, "Tonight" sleep card and building tiles in a side column |
| `phase5-hud-phone.png` | The game HUD at 390 px: 2×2 resource chips, the town at full width, then the goal ribbon and the sleep card |
| `phase5-wake-reward-phone.png` | A rewarded wake-up, plus the hint explaining why a session started now wouldn't earn (4-hour gap) |

Captured from local dev with a test account (the wake-up uses the dev-only simulated clock, which is also why the sleep history shows a "Dev:" note; production doesn't have it).

## Phase 5 — town life

| File | What it shows |
|---|---|
| `phase5-town-life.webp` | About 12 s of the animated town at level 3 (desktop): citizens walking and pausing, the taxi and sedan, steam from the cooling tower, swaying trees, drifting clouds |
| `phase5-town-life.png` | A single frame of the same |
| `phase5-town-life-phone.webp` | The animated town on a 390 px phone |
| `phase5-upgrade-celebration.webp` | Upgrading the Shop to level 3, then closing the panel: the new building rises into place with sparkles and dust |
| `phase5-town-dark.png` | Out of power: grey clouds, cold vignette, dimmed buildings, citizens and cars, no steam |
| `phase5-town-night.png` | While sleeping: night sky and tint, citizens at home, lamps glowing |

Captured from local dev with a test account (levels set with the dev-only state setter; the night shot uses the dev-only `?preview=night`). The animated previews are real-time frame captures, so they are a little choppier than the app itself.
