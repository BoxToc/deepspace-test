# DreamGrid — DeepSpace Internship Submission

**Live Application:** https://dreamgrid.app.space

**GitHub Repository:** https://github.com/BoxToc/deepspace-test

## 1. What I Built

DreamGrid is a sleep-powered miniature city-building game where your sleep helps keep a virtual town alive.

Instead of simply tracking how many hours someone sleeps, DreamGrid turns their recorded sleep into electricity. That electricity powers the town's buildings, which generate coins over time. Players can then spend those coins to upgrade buildings, improve electricity production, and gradually develop their city.

The main gameplay loop is:

**Sleep → Earn Electricity → Power Your City → Generate Coins → Upgrade Buildings**

I chose this concept because I wanted to combine something useful, encouraging better sleep habits, with the progression and reward systems that make games enjoyable. I was particularly interested in making an application that felt like a small game rather than a traditional productivity tracker.

The finished application includes:

- Sleep tracking with electricity rewards.
- A persistent, isometric miniature city.
- Four upgradeable building types with three levels each.
- Passive coin generation and electricity consumption, even while the application is closed.
- Animated citizens, vehicles, environmental effects, and building upgrades.
- A responsive game-style interface with onboarding and accessibility features.

## 2. How I Used DeepSpace

DreamGrid uses DeepSpace for authentication, persistent data, server-side game actions, real-time synchronization, testing, and deployment.

Each player has a private city associated with their account. DeepSpace record permissions restrict access to user-owned data, while server actions handle sleep sessions, electricity rewards, coin generation, and upgrades.

The application uses `RecordRoom` and `useQuery` to keep the interface synchronized with the latest saved state. For example, upgrading a building in one browser tab automatically updates the city in another.

DeepSpace's testing environment also allowed us to test the application with multiple accounts and simulated time, making it possible to verify sleep rewards, offline progression, and concurrent actions without waiting hours in real life.

The production application is deployed through DeepSpace at [dreamgrid.app.space](https://dreamgrid.app.space).

## 3. Engineering Challenges and Trade-offs

One of the most interesting challenges was ensuring the game's economy stayed consistent when multiple actions happened at the same time.

For example, if a player attempted to purchase upgrades in two browser tabs, the application needed to prevent both requests from spending the same coins.

We addressed this using server-authoritative calculations and a revision-based state system built around DeepSpace's unique record constraints.

Each city update claims a unique revision. If another request has already claimed that revision, the conflicting operation can read the newer state and retry. This helps prevent older requests from overwriting newer progress.

Another decision was to calculate electricity consumption and coin production from elapsed server time rather than requiring the application to remain open.

This makes offline progression possible without continuously running a separate game simulation.

I also chose to keep DreamGrid's scope manageable. Instead of building a complex city simulator, we focused on one town, four building types, and a complete gameplay loop.

For rendering, we used lightweight isometric sprites rather than a full 3D game engine. Existing Kenney assets were combined with custom-generated artwork, including a three-stage Power Station.

## 4. Development Process and AI Assistance

I developed DreamGrid between November 19 and November 24, 2026, using Claude Code as my primary coding assistant, with ChatGPT helping me brainstorm, plan features, review decisions, and work through technical questions.

Claude Code implemented most of the application code, automated tests, art-generation tooling, and initial documentation.

My role focused on defining the product, making design decisions, reviewing implementations, identifying problems, and testing the resulting application.

I helped shape the gameplay loop, building progression, economy direction, and visual presentation. As development progressed, I reviewed screenshots and prototypes, rejected designs that didn't match my vision, and requested changes.

For example, the original Power Station looked like a standalone generator. I wanted something that looked more like an actual industrial building, with meaningful visual evolution across its three levels. We iterated on that design until it matched the rest of the town.

During my own playtesting, I also noticed that the displayed timezone and coin balance were behaving incorrectly. Investigation revealed that administrator accounts could receive other players' records in their subscriptions. The application was updated to explicitly select the signed-in player's data.

I later verified the corrected behavior by testing building upgrades, sleep controls, electricity rewards, multi-tab synchronization, and persistence.

Before submission, I also tested the live production application, including its mobile-responsive preview, and confirmed that all ten items on my production verification checklist passed.

AI handled much of the implementation, but I remained involved in the product direction, iteration, review, and final acceptance of the application.

## 5. Testing and Verification

The completed project passed:

- 103 unit tests covering the game rules, sleep logic, economy, upgrades, and scene behavior.
- 51 browser/API tests covering gameplay, concurrency, recovery, responsiveness, and accessibility.
- TypeScript checks, ESLint, and production build verification.

I also manually tested the deployed application to confirm that authentication, city creation, sleep controls, building selection, resource displays, animations, and persistence worked as expected.

## 6. What I'd Improve Next

DreamGrid is currently a small single-player experience, but there are several directions I'd like to explore.

The most interesting would be expanding the town with additional buildings and neighborhoods, introducing more long-term progression, and allowing friends to visit or connect their cities.

I'd also like to explore optional integrations with health or wearable devices to reduce reliance on manually recorded sleep sessions.

My priority for this version, however, was delivering a complete application with a functional gameplay loop, persistent state, responsive visuals, and reliable backend behavior.

## Final Thoughts

DreamGrid gave me the opportunity to work through the development of a full-stack application, from the initial concept to a deployed product.

It also taught me the importance of testing AI-generated implementations rather than assuming they work correctly. Some of the most valuable improvements came from personally trying the application, identifying issues, and iterating on the results.

I'm proud that DreamGrid is not just a concept or a static prototype, but a functioning application that people can sign in to and use.
