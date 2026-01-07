Tactical Manager & Codex Office

System Overview – Updated

Status: UI-first, engine-backed, no DB, no Gemini
Scope: Tactical Manager game + Codex Office + Phase 13 Harness

1. System Architecture (Locked)
[ React UI (tactical-manager) ]
            ↓
[ codex-cloud-backend ]
            ↓
[ tactical-simulation-engine ]

Design Rules (Non-Negotiable)

❌ No database (state is in-memory / payload-driven)

❌ No Gemini / LLM dependency

❌ No backend logic changes required for UI completion

✅ UI is pure consumer of engine contracts

✅ Engine is authoritative for match + season logic

2. Tactical Manager – Purpose

Tactical Manager is a deterministic football simulation system presented through a React UI and powered by a standalone simulation engine.

It supports:

Match simulation

League table calculation

Season progression

Hierarchy + timeline visualisation

Career flow (advance / snapshot / save)

The Codex Office acts as the managerial layer, not the engine.

3. Codex Office Role

The Codex Office is not gameplay logic.

It provides:

Navigation shell

Status visibility

Event logging

Harness / diagnostics

Control surfaces (play, advance, validate)

Think:

Office = Manager
Engine = Match officials + physics
UI = Stadium screens

4. Phase 13 – Test Harness (UPDATED)
Summary of Builder Changes

The harness has been significantly upgraded and now acts as a first-class system console.

New Capabilities

Connection status pills (Engine / Match / Validation)

Info-tooled headers (ⓘ contextual help)

Structured summaries:

Engine state

Match result

Validation outcome

Raw payload toggles (inspect engine I/O)

Enhanced event log layout (readable + chronological)

Visual Intent

HUD-style diagnostic console

Clear separation of:

Inputs

Outputs

System health

Zero ambiguity about what ran and why

Screenshots not captured
(no runnable dev server in deploy artifact)

5. Tactical Simulation Engine (Authoritative)
Location
simulation-engine/

Core Responsibilities

Match simulation

Season progression

Event emission

League table calculation

Timeline generation

Key Files
File	Purpose
engine.ts	Core engine bootstrap
engineController.ts	High-level orchestration
simulateMatch.ts	Single match logic
simulateSeason.ts	Full season logic
runSeason.ts	Execution wrapper
seasonRunner.ts	Season lifecycle
eventBus.ts	Internal pub/sub
events.ts	Event contracts
matchEvents.ts	Match-specific events
transport/websocketServer.ts	Live transport
types.ts	Engine types
6. React Frontend (Current State)
App Structure
src/
 ├─ App.tsx
 ├─ AppRoutes.tsx
 ├─ main.tsx
 ├─ api/
 │   ├─ client.ts
 │   └─ endpoints.ts
 ├─ config/
 │   ├─ env.ts
 │   ├─ auth.ts
 │   └─ harness.ts
 ├─ components/
 │   ├─ AppShell.tsx
 │   ├─ GlobalNav.tsx
 │   ├─ GlobalErrorBanner.tsx
 │   ├─ GlobalLoadingOverlay.tsx
 │   └─ Icons.tsx
 ├─ harness/
 │   ├─ HarnessScreen.tsx
 │   ├─ HarnessRoute.tsx
 │   └─ Harness.stories.tsx
 ├─ hooks/
 │   └─ useHarnessWebSocket.ts
 ├─ routes/
 │   ├─ CareerHubRoute.tsx
 │   ├─ FixturesResultsRoute.tsx
 │   ├─ LeagueHierarchyRoute.tsx
 │   ├─ LeagueTableRoute.tsx
 │   ├─ SeasonSummaryRoute.tsx
 │   └─ SeasonTimelineRoute.tsx
 ├─ screens/
 │   ├─ CareerHub/
 │   ├─ FixturesResults/
 │   ├─ LeagueHierarchy/
 │   ├─ LeagueTable/
 │   ├─ SeasonSummary/
 │   └─ SeasonTimeline/
 ├─ mocks/
 ├─ styles/
 │   └─ app.css
 └─ types/
     └─ contracts.ts

7. UI Screens – Status
Screen	Status
Career Hub	UI complete
Fixtures & Results	UI complete
League Table	UI complete (engine wiring pending earlier, now supported)
League Hierarchy	UI complete
Season Summary	UI complete
Season Timeline	UI complete
Harness Screen	Enhanced + authoritative

Mocks exist for all major data contracts.

8. Data Contracts (Locked)

Located in:

src/types/contracts.ts


Mocks in:

src/mocks/data/


Includes:

LeagueTable.json

SeasonSnapshot.json

SeasonSave.json

SeasonTimeline.json

LeagueHierarchyGraph.json

These define the exact shape the UI expects.

9. What Is NOT Happening (Important)

❌ No database writes

❌ No persistence beyond engine runtime (unless explicitly saved)

❌ No UI-side computation of standings

❌ No hidden state

Everything is:

Engine → Payload → UI

10. Current Focus (Agreed Direction)

While future DB-backed leagues are being built:

UI work continues without waiting

Harness is the truth source

React wiring finishes:

League table refresh

Match → league update loop

Status + feedback clarity

11. Mental Model (For Future Builders)

The game is not a CRUD app

It is a simulation pipeline

UI is a visualisation + control surface

Harness is the black box recorder

Engine is law

12. Status

✅ Architecture stable
✅ Engine implemented
✅ UI screens present
✅ Harness upgraded
🔄 Final UI ↔ engine wiring (league refresh loop)