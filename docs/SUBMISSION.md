# DreamGrid — DeepSpace internship submission

> **Draft.** Edit the voice and add personal context before submitting (due November 24, 2026).

**Live app:** https://dreamgrid.app.space
**Code:** this repository (`README.md` covers setup, architecture and tests)

## The idea

Most sleep apps measure you. DreamGrid *rewards* you. Your night's sleep becomes electricity for a tiny isometric town. While the battery holds, the lights stay on and the town earns coins, and you spend the coins to grow its buildings. If you skip sleep, the town goes dark.

The loop is deliberately small, so every part of it could be finished properly:

**Sleep → Energy → Powered city → Coins → Upgrades** (and a bigger Power Station turns sleep into more energy).

## What I built, phase by phase

| Phase | Delivered |
|---|---|
| 1. Foundations | DeepSpace auth, record schemas with owner-only RBAC, persistent per-player city |
| 2. Sleep | Start / Wake Up / Cancel sessions, server-timed. Energy rewards with anti-farming rules: 1-hour minimum, 10-hour cap, one reward per local day, 4-hour gap between rewards. Time-zone handling |
| 3. The town | A miniature isometric city made from Kenney CC0 sprites. Painter's-algorithm layering, day, night and out-of-power looks, scales to a 360 px phone |
| 4. Economy | Electricity consumption, passive coins (including offline time), a park income bonus, building upgrades to level 3, and a live dashboard |
| 5. Polish | An original 3-level Power Station (generator building → substation → power complex). Visible upgrade stages for every building. First-time onboarding, gameplay feedback, accessibility, mobile, landing page and docs |

## The parts I'm proudest of

### 1. Correct under concurrency, without transactions

DeepSpace server actions don't offer multi-record transactions. A naive "read the city, add coins, write it back" would let two tabs spend the same coins, or let a slow request overwrite a newer state. I built on the one atomic primitive the SDK *does* guarantee, a `uniqueOn` insert:

- **City state is append-only.** Every change inserts revision *N+1* of the full state, unique on `(userId, revision)`. The insert is the compare-and-swap, and losers re-read and retry. No row is ever overwritten.
- **Exactly-once rewards.** Three unique rows enforce exactly-once:
  - one open session per player
  - one outcome per session (Wake Up XOR Cancel)
  - one paid reward per local day
- **Crash recovery by rolling forward.** Waking up is "decide, then finish", and every finish step is idempotent. If the worker dies halfway, the next request completes the job.

The end-to-end tests cover each of these: racing Wake Up against Cancel, double-tapping Upgrade, and injecting a crash after each step of a close.

### 2. The server is the only authority

The client sends intents ("I'm going to sleep"), never numbers. Durations use server time, and offline earnings are settled once inside each city change. The browser runs the same pure rules (`src/game/`) to animate the dashboard every second, so the numbers move live without becoming trusted. Dev-only tools (a simulated clock, fault injection) sit behind two independent gates, so production can't reach them.

### 3. Original art that matches the Kenney pack

I wanted the Power Station to visibly grow across three levels, and no CC0 pack had that. So I wrote a small dev-only pipeline (three.js rendered in headless Chromium) that reproduces Kenney's projection, palette and three-tone shading. I calibrated it against a real Kenney tile to a 98.5% silhouette match, then modelled one building that grows: a red-brick generator hall, then a substation with a control wing and gantry, then a power complex with a cooling tower. The renders are byte-reproducible, and three.js never ships to players.

### 4. Explaining the rules before they bite

Anti-cheat rules are only fair if players know them. The app says *before* you start a session if it won't earn ("you woke up less than 4 hours ago…"). It shows the next upgrade and when you'll afford it, and it warns when the town is out of power. All of this guidance comes from the same config the server enforces, so the explanation and the enforcement can't drift apart.

## How DeepSpace is used

- **Auth and per-user data:** sign-in, a JWT on every server action, and `read: 'own'` record permissions keep cities and sleep history private.
- **Server actions** (`POST /api/actions/<name>`) are the only write path. Clients have no create, update or delete permissions on game data.
- **`RecordRoom` + `useQuery`:** the city page subscribes live to its latest city revision and sleep sessions. An upgrade or wake-up in one tab appears in the others.
- **Static + dynamic pages:** the landing page is prerendered static HTML with no auth fetch and no WebSocket. The game lives under the `(app)` boundary.
- **`deepspace test`** runs Playwright with multiple signed-in test accounts against a real local worker.

## Quality

- **Vitest unit tests (96)** cover the pure rules: sleep crediting, day boundaries across time zones, settlement, upgrades, scene layout and guidance.
- **Playwright end-to-end tests (49)** cover concurrency races, crash recovery, economy over simulated time, the town at every level, phone layout, onboarding and keyboard access.
- TypeScript strict, ESLint clean.

## Trade-offs and what I'd do next

- **Sleep is self-reported.** The rules cap the abuse, but they can't verify sleep. The next step would be optional wearable or Health integration as a *bonus*, never a requirement.
- **Scope.** There's one town layout with four buildings. I froze building designs to finish the loop well rather than widen it. Natural next steps:
  - more lots that unlock with the Power Station level
  - weekly streaks
  - a shared neighbourhood grid where friends' towns sit side by side (DeepSpace's real-time rooms make that a small step)
- **Balance** has been checked against the rules but not tuned by long-term play.

## Credits

Building sprites: Kenney (CC0). The Power Station art and all code are original to this project.
