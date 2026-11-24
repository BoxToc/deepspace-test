# DreamGrid — DeepSpace internship submission

> **Draft for review.** Lines marked **✏️ Confirm** need your own words or a yes/no before you submit. Delete this note and the markers when you're done. Due **November 24, 2026, 11:59 PM ET**.

**Live app:** https://dreamgrid.app.space
**Code:** https://github.com/BoxToc/deepspace-test (`README.md` covers setup, architecture and tests)

## 1. What DreamGrid is, and why I built it

Most sleep apps measure you. DreamGrid *rewards* you. Your night's sleep becomes electricity for a tiny isometric town. While the battery holds, the lights stay on and the town earns coins, and you spend the coins to grow its buildings. If you skip sleep, the town goes dark.

The loop is deliberately small, so every part of it could be finished properly:

**Sleep → Energy → Powered city → Coins → Upgrades** (and a bigger Power Station turns sleep into more energy).

> **✏️ Confirm:** why *you* chose this idea, in one or two sentences of your own. For example, a personal reason to care about sleep, or why you wanted to build a game on DeepSpace. I haven't written this part, because only you know it.

## 2. How DeepSpace is used

- **Auth and per-user data:** DeepSpace sign-in, a JWT on every server action, and `read: 'own'` record permissions keep each player's city and sleep history private.
- **Server actions** (`POST /api/actions/<name>`) are the only write path. Clients have no create, update or delete permission on game data.
- **`RecordRoom` + `useQuery`:** the city page subscribes live to the player's latest city revision and sleep sessions, so an upgrade or wake-up in one tab appears in every other tab.
- **Unique constraints as the concurrency primitive:** `uniqueOn` inserts give exactly-once guarantees without multi-record transactions (see below).
- **Static + dynamic pages:** the landing page is prerendered static HTML with no auth request and no WebSocket. The game lives under the `(app)` boundary.
- **`deepspace test`** runs Playwright against a real local worker, with several signed-in test accounts. **`deepspace deploy`** ships to `dreamgrid.app.space`, and every deploy is an immutable release that can be rolled back.

## 3. Architecture and engineering trade-offs

```
src/game/      Pure rules shared by server and browser (config, sleep, economy, time, guidance)
src/actions/   Server actions: the only way state changes
src/schemas/   Record collections and their RBAC
src/city/      The isometric scene: projection, layout, sprite stacking, town-life routes
src/components/ React UI: game HUD, scene, sleep panel, upgrade panel, onboarding
```

**Correct under concurrency, without transactions.** DeepSpace server actions don't offer multi-record transactions. A naive "read the city, add coins, write it back" would let two tabs spend the same coins, or let a slow request overwrite a newer state. Everything is built on the one atomic primitive the SDK guarantees, a `uniqueOn` insert:
- **City state is append-only.** Every change inserts revision *N+1* of the full state, unique on `(userId, revision)`. The insert is the compare-and-swap, and losers re-read and retry.
- **Exactly-once rewards.** Three unique rows enforce exactly-once:
  - one open session per player
  - one outcome per session (Wake Up XOR Cancel)
  - one paid reward per local day
- **Crash recovery by rolling forward.** Waking up is "decide, then finish", and every finish step is idempotent. If the worker dies halfway, the next request completes the job.

**The server is the only authority.** The client sends intents ("I'm going to sleep"), never numbers. Durations use server time, and offline earnings are settled once inside each city change. The browser runs the same pure rules every second to animate the HUD, so the numbers move live without being trusted.

**Dev tools that production can't reach.** A simulated clock, fault injection and a state setter make edge cases testable: day rollover, the 4-hour gap, crash recovery and a dead battery. They need both `ALLOW_DEBUG_ROUTES=true` and a worker *without* production service bindings, and their UI is tree-shaken out of production builds.

**Original art that matches the Kenney pack.** No CC0 pack had a Power Station that visibly grows, so a dev-only pipeline (three.js in headless Chromium) renders new sprites in Kenney's projection, palette and shading. It is calibrated against a real Kenney tile to a 98.5% silhouette match. The citizens come from the same pipeline. three.js never ships to players.

**A living town that stays cheap.** Citizens and cars follow fixed routes as a pure function of time, so there is no pathfinding or per-frame React rendering. One `requestAnimationFrame` loop moves them with compositor-only transforms, everything pauses off-screen, and reduced-motion users get a still town. Unit tests check that walkers stay on sidewalks, that cars stay in their lanes, and that the two cars share one loop, phased so they only ever pass each other in opposite lanes.

**Trade-offs I accepted:**
- **Self-reported sleep.** Two taps start and end a session. The anti-farming rules cap the abuse: a 1-hour minimum, a 10-hour cap, one reward per local day, a 4-hour gap between rewards, and time-zone changes at most once a week. They can't verify that you slept.
- **A full-state revision per change** instead of deltas. That means more storage, but compare-and-swap and history stay simple and auditable.
- **Plain `<img>` sprites with the painter's algorithm** instead of a canvas or game engine. The scene is accessible: every building is a real button, and it scales to a 360 px phone. The cost is limited scope, which suits a small town.
- **Scope frozen** at one layout and four buildings, so the loop could be finished, tested and polished.

## 4. Development process and AI assistance

DreamGrid was built between November 19 and November 24, 2026, in five phases, each reviewed as GitHub pull requests before merging:

| Phase | Delivered |
|---|---|
| 1. Foundations | DeepSpace auth, record schemas with owner-only RBAC, a persistent per-player city |
| 2. Sleep | Server-timed Start / Wake Up / Cancel, energy rewards with anti-farming rules, time-zone handling |
| 3. The town | An isometric city from Kenney CC0 sprites with day, night and out-of-power looks |
| 4. Economy | Electricity consumption, passive coins (including offline time), a park bonus, upgrades to level 3 |
| 5. Polish | An original 3-level Power Station, visible upgrade stages, a living town (citizens, traffic, steam, celebrations), onboarding, accessibility, a landing page, and a game-style HUD |

**AI assistance.** I built DreamGrid with **Claude Code** (Anthropic's AI coding agent) as my main implementation tool. Claude Code wrote most of the code, the automated tests, the sprite pipeline and first drafts of the documentation. It worked on branches and opened pull requests, and nothing was merged or deployed without my approval.

> **✏️ Confirm:** this is accurate as written. If you wrote or substantially rewrote any parts yourself, name them here.

## 5. What I personally directed, reviewed, tested and verified

> **✏️ Confirm:** the bullets below come from our working sessions (the instructions and approvals you gave). Check that each one is how you'd describe your role, and reword it in your own voice.

My role was product owner and reviewer:

- **Direction:** I defined the core loop (sleep → energy → city → coins → upgrades), the phase plan, and the scope freeze before the deadline.
- **Guardrails:** I set the rules the work had to follow:
  - polish phases must not change sleep rules, rewards, the economy, auth or schemas
  - player data stays private
  - development tools must never be reachable in production
  - every change goes through a branch and a pull request
  - nothing is merged or deployed without my approval
- **Design review:** for the game HUD, I asked for a review, a proposal and a visual mockup before any implementation, approved the design, and then delegated the remaining decisions.
- **Pull request review:** I reviewed the Phase 5 work as four stacked PRs and approved merging them in order.
- **Release:** I approved the final deployment.

> **✏️ Confirm each of these, and add specifics you remember:**
> - Did you playtest the app yourself, and on which devices (desktop, your phone)? What did you notice or ask to change?
> - The commit "Fix playtest issues: scope city/session reads to the signed-in player" came from a playtest. Did you find that bug yourself?
> - Which parts of the code did you read closely enough to explain in an interview? The concurrency design (section 3) is the most likely question.

**Automated verification (final release):**
- 103 Vitest unit tests: rules, time zones, settlement, upgrades, scene layout, guidance, town-life routes
- 51 Playwright browser/API tests: concurrency races, crash recovery, economy over simulated time, every town level, phone layout, onboarding, keyboard access, reduced motion
- TypeScript strict, ESLint clean, and a production build that contains no dev tools

## 6. Known limitations and what I'd do next

- **Sleep is self-reported.** The next step would be optional wearable or Health integration as a *bonus*, never a requirement.
- **One town layout** with four buildings, each topping out at level 3. Natural next steps:
  - lots that unlock with the Power Station level
  - weekly streaks
  - a shared neighbourhood where friends' towns sit side by side (DeepSpace's real-time rooms make that a small step)
- **Balance** has been checked against the rules, but not tuned through long-term play. Upgrade costs are the same for every building.
- **Single-player.** The live sync only connects one player's own tabs and devices today.

## Credits

Building and vehicle sprites: [Kenney](https://kenney.nl) (CC0). The Power Station and citizen art and all code are original to this project.
