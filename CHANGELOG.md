# Changelog

All notable changes to this project should be documented in this file.

This project is currently in an early repositioning and architectural-reset phase, so the changelog starts by declaring the planning baseline and then tracking incremental pre-release implementation work.

The format is loosely based on Keep a Changelog.

---

## v0.8.0 (2026-04-13)

### Feat

- improve subagent slash command suggestions
- surface background sessions in the chat shell
- surface background work in status and slash commands

### Fix

- share slash command suggestion metadata
- stabilize background session notice copy

## v0.7.0 (2026-04-13)

### Feat

- surface background session approvals
- add in-app approval request handling
- add the first approval-needed shell surface

### Fix

- tighten approval action defaults and copy
- handle clipboard copy failures in chat view

### Perf

- streamline sidebar approval counts

## v0.6.0 (2026-04-12)

### Feat

- clarify interrupted runs after reconnect
- add reconnect recovery notices

### Fix

- preserve history run ids for reconnect recovery
- avoid recovery notices on intentional reconnects
- address PR feedback
- address PR feedback

### Refactor

- improve active session recovery state
- centralize connection recovery feedback and add composer notice

## v0.5.2 (2026-04-12)

### Fix

- address PR feedback
- address PR feedback

### Refactor

- extra header runtime cluster to separate component
- extract session model and thinking controls
- centralize session runtime patching I centralized session runtime patching in src/app.tsx (line 7681), and that shared seam is now reused by direct model/thinking changes plus model-shortcut application in src/app.tsx (line 5213). I also pulled the thinking vocabulary into src/lib/runtime-controls.ts (line 1), so the chat UI in src/components/ChatView.tsx (line 24) and slash-command help in src/lib/slash-commands.ts (line 1) now stay aligned.

## v0.5.1 (2026-04-12)

### Fix

- address PR feedback

### Refactor

- decompose settings modal and add focused 4.3 coverage

## v0.5.0 (2026-04-11)

### Feat

- add new remote media resolver
- add custom logo for ClawFace

### Fix

- address PR feedback

## v0.4.2 (2026-04-11)

### Fix

- update npm packages to latest

## v0.4.1 (2026-04-11)

### Fix

- update npm packages to latest
- address PR feedback
- address PR feedback
- tool-result messages now run media extraction

### Refactor

- finish image rendering cleanup and regression coverage
- images not showing up in chat

## v0.4.0 (2026-04-09)

### Feat

- multi tool panels derive group level summary
- improve tool activity and output

### Fix

- address PR feedback
- address PR feedback

## v0.3.0 (2026-04-09)

### Feat

- make sidebar session activity more explicit

### Fix

- address PR feedback

## v0.2.9 (2026-04-09)

### Fix

- address PR feedback
- resolve gateway connection bug

## v0.2.8 (2026-04-09)

### Feat

- add new ToolActivityPanel
- follow up on ticket 2.3
- make attachment preview/rendering a first-class concern
- tighten attachment interface
- make attachment ingestion a dedicated hook
- harden reconnect success path
- tighten explicit thread-state model further
- cleanup fallback/relaod side of the streaming path
- extract core auto scroll state machine out of ChatView
- extract composer and slashcommand components - ticket 1.3.3
- update slash parsing behavior - ticket 1.3.2
- dedicated composer component
- extract message rendering model
- extract ChatThread from ChatView
- give ChatView explicit shell-level session-switch signals
- make session ownership more explicit
- complete Phase 1 connection-state shell tickets
- first concrete implementation work

### Fix

- gateway websocket connection issues
- address PR feedback
- address PR feedback
- address PR feedback
- update mixed clipboard behavior
- enforce keys at MessageAttachmentList boundary, remove redundant keys from callbacks
- address PR feedback
- address PR feedback
- address PR feedback
- address PR feedback
- addres PR feedback
- address PR feedback
- address PR feedback
- address PR feedback
- prevent isCurrentSessionLoading from sticking on fast session switch
- address PR feedback

### Refactor

- move Compose away from a flat prop bag into grouped subdomains

## v0.0.1 (2026-04-07)

### Feat

- add file manager, UI polish, and improved error handling
- improve session sidebar search, activity state, and session model defaults

## [0.0.1-PRE.3] - 2026-04-07

### Summary
This release records the next Phase 1 shell-stabilization increment after the initial connection-state boundary work.

It captures:
- completion of Ticket `1.1.3`
- richer user-facing connection lifecycle UX
- improved signaling for reconnecting, pairing-required, error, and disconnected states

### Added
- `docs/PHASE-1-TICKETS.md` implementation notes for Ticket `1.1.3` — reconnect and disconnected-state UX stabilization

### Changed
- Updated `src/components/ChatView.tsx` so the chat shell can render a richer connection lifecycle via `connectionStatus`
- Improved topbar connection messaging to distinguish:
  - connected
  - connecting
  - pairing-required
  - connection error
  - disconnected
- Improved composer warning messaging so non-happy-path connection states are more legible and less generic
- Updated `src/app.tsx` so reconnect-oriented close cases can surface an explicit `connecting` state instead of collapsing immediately into a generic disconnected state
- Continued the Phase 1 move away from a binary connection UX toward a lifecycle-aware shell state

### Notes
- This is still a pre-release modernization phase, not a product milestone release
- Reconnect state is still inferred at the app/UI boundary and not yet modeled in a dedicated store module
- `connected` is still passed alongside `connectionStatus` during the transition to richer shell state handling

---

## [0.0.1-PRE.2] - 2026-04-07

### Summary
This release records the first concrete implementation work after the planning baseline.

It captures:
- documentation/layout cleanup around the new `docs/` structure
- repo bootstrap guidance for future agents
- the first completed Phase 1 architecture ticket work around connection-state ownership

### Added
- `docs/PHASE-1-TICKETS.md` implementation findings for:
  - Ticket `1.1.1` — connection-state ownership audit
  - Ticket `1.1.2` — first explicit connection-state boundary

### Changed
- Updated `README.md` to point to `AGENTS.md`
- Updated `README.md` to better reflect the current project framing and doc layout
- Established a first explicit connection-state model in the renderer via:
  - `GatewayConfig`
  - `ConnectionStatus`
  - `ConnectionState`
- Replaced the previous top-level loose connection model built around:
  - `connected`
  - `connectionNote`
  - `pairingRequired`
  with a cleaner first-pass boundary using:
  - `gatewayConfig`
  - `connectionState`
- Updated `src/app.tsx` so successful hello, pairing-required close, disconnect, and several note/error flows now resolve through the new connection-state boundary

### Notes
- This is still a pre-release modernization phase, not a product milestone release
- The connection-state work is intentionally a first pass and does not yet extract a dedicated external store module
- Follow-up work should build on this with reconnect/disconnected-state UX improvements and further state-boundary cleanup

---

## [0.0.1-PRE.1] - 2026-04-07

### Declared baseline
This release marks the current **pre-write / pre-major-refactor baseline** of ClawFace.

It represents the point at which the project has been:
- renamed/reframed around the ClawFace identity
- repositioned as a desktop-native OpenClaw frontend
- documented well enough to begin structured modernization work

This version should be treated as the explicit starting point before deeper implementation work and architectural refactors begin.

### Added
- `docs/ARCHITECTURE.md` — architecture inventory and refactor guidance
- `docs/PRODUCT-BRIEF.md` — product vision, direction, non-goals, and differentiators
- `docs/MILESTONE-1.md` — first serious milestone definition
- `docs/IMPLEMENTATION-ROADMAP.md` — phased roadmap with vertical slices
- `docs/PHASE-1-TICKETS.md` — Phase 1 implementation ticket breakdown
- `AGENTS.md` — repo bootstrap guide for future agents

### Changed
- Reframed the project around the **ClawFace** identity and direction
- Updated `README.md` to reflect the new product thesis and planning structure
- Established the current strategy as **salvage, refactor, then expand**, rather than rewrite-from-scratch or uncontrolled feature accretion
- Moved planning and architecture documentation into the `docs/` folder

### Notes
- This release does **not** represent a polished product milestone
- This release is primarily a **project-baseline declaration** and planning checkpoint
- Future releases should track actual implementation progress against Milestone 1 and later roadmap phases