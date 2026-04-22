# Implementation Plan: Dream Visibility

**Branch**: `002-dream-visibility` | **Date**: 2026-04-22 | **Spec**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/spec.md)  
**Input**: Feature specification from `/specs/002-dream-visibility/spec.md`

## Summary

Add Dream Visibility to ClawFace as a session-adjacent Dream Inspector pane, not a detached dashboard. The MVP should reuse the current chat/session shell, existing browser-shell primitives, and the renderer’s established gateway normalization pattern to turn `doctor.memory.status`, `doctor.memory.dreamDiary`, `wiki.importInsights`, and `wiki.palace` into a signal-first workstation surface: overview, waiting/grounded/promoted lanes, candidate-first detail, diary reading, and optional related-memory links. The implementation should avoid a new backend dependency for MVP and reserve dream event journal or run timeline work for a future gateway seam built on OpenClaw’s memory host event log.

## Technical Context

**Language/Version**: TypeScript (Node.js `22.22.0` for development tooling, React/Electron renderer stack)  
**Primary Dependencies**: React, Electron, Vite, existing ClawFace shell controllers/components, existing shell gateway normalization seams  
**Storage**: Existing OpenClaw gateway payloads and ClawFace local UI state only; no new persistent store required for MVP  
**Testing**: `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop dream-visibility flows  
**Target Platform**: Desktop app (macOS-first development target; Electron renderer + main process)  
**Project Type**: Desktop app  
**Performance Goals**: Inspector open, lane switching, and candidate detail transitions should feel immediate on normal desktop hardware; no repeated brute-force gateway calls while the pane is open; optional wiki context should load on demand instead of blocking the first render  
**Constraints**: Must stay session-adjacent rather than introducing another top-level dashboard view; must not require a new backend method for MVP; must not parse raw gateway payloads inline in `app.tsx` or giant UI components; must not overclaim hidden scoring internals or deterministic cross-artifact relationships that current APIs do not expose  
**Scale/Scope**: One workstation-oriented visibility feature in the current chat shell, scoped to the active default-agent workspace and built around existing OpenClaw dreaming and memory-wiki surfaces

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable boundaries over gravity wells**: Pass. The plan keeps Dream Visibility out of `src/components/ChatView.tsx` and `src/app.tsx` business logic by introducing a dedicated dream controller plus a shell-facing memory normalization seam instead of adding another inline payload/parser cluster.
- **Validation is a merge gate**: Pass. Implementation validation is `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop flows for overview state, lane meaning, diary reading, grounded replay distinction, and optional cross-link navigation.
- **UX consistency beats novelty**: Pass. The feature is scoped as a session-adjacent inspector that reuses current shell/header/sidebar language and selective browser-shell primitives rather than adding a detached dashboard or backend-style admin page.
- **Performance and responsiveness are product features**: Pass. MVP uses snapshot-on-open plus explicit manual refresh, on-demand optional wiki loading, and pure helper normalization instead of a live polling dashboard or global dreaming crawl.
- **Testable behavior over cleverness**: Pass. Lane derivation, diary parsing, related-context matching, and gateway payload shaping live behind focused helpers/controllers with direct regression coverage.

## Project Structure

### Documentation (this feature)

```text
specs/002-dream-visibility/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dream-visibility-boundaries.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app.tsx
├── styles.css
├── components/
│   ├── ChatView.tsx
│   ├── SessionSidebar.tsx
│   ├── ToolActivityPanel.tsx
│   ├── browser-shell/
│   │   ├── BrowserEmptyState.tsx
│   │   └── BrowserRootTabs.tsx
│   └── dreams/
│       ├── DreamInspectorPane.tsx
│       ├── DreamSignalOverview.tsx
│       ├── DreamLaneList.tsx
│       ├── DreamCandidateDetail.tsx
│       ├── DreamDiaryPanel.tsx
│       └── DreamRelatedContextPanel.tsx
├── hooks/
│   └── useDreamInspectorController.ts
└── lib/
    ├── shell-gateway-memory.ts
    ├── dream-candidates.ts
    ├── dream-diary.ts
    ├── dream-related-context.ts
    ├── shell-gateway-state.ts
    ├── shell-gateway-config.ts
    └── media-browser-sources.ts

tests/
├── shell-gateway-memory.test.mjs
├── dream-candidates.test.mjs
├── dream-diary.test.mjs
├── dream-related-context.test.mjs
└── [existing shell/media regression tests]
```

**Structure Decision**: Keep Dream Visibility inside the existing chat/session shell instead of creating another top-level `activeView`. Add a dedicated inspector controller and shell-facing memory normalization helpers, then render a session-adjacent pane composed of focused dream components. Reuse browser-shell primitives where they fit small in-pane navigation and empty states, but do not clone the FileManager/MediaBrowser stack because the feature is detail-inspection-first rather than browse-surface-first.

## Phase 0 Research

See [research.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/research.md).

## Phase 1 Design

See:
- [data-model.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/data-model.md)
- [quickstart.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/quickstart.md)
- [contracts/dream-visibility-boundaries.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/contracts/dream-visibility-boundaries.md)

## Implementation Approach

### 1. Keep Dream Visibility in the chat shell, not in `activeView`

The clarified UX is a session-adjacent inspector pane opened from the current session context. The safest ClawFace fit is:

- keep `activeView` limited to `chat | files | media`
- add a narrow chat-shell UI state for the auxiliary inspector pane, such as `activeInspector: "dreams" | null`
- surface entry points in places that already own session/workstation context:
  - `ChatView` header actions for the active session
  - `SessionSidebar` header actions as a shell-level shortcut

This preserves the product’s workstation feel and avoids inventing a second dashboard-routing model for one feature.

### 2. Reuse the shell gateway normalization pattern with a new memory seam

ClawFace already has a stable pattern for shell-facing gateway parsing:

- `src/lib/shell-gateway-state.ts`
- `src/lib/shell-gateway-responses.ts`
- `src/lib/shell-gateway-history.ts`
- `src/lib/shell-gateway-config.ts`

Dream Visibility should follow that pattern by adding a dedicated `src/lib/shell-gateway-memory.ts` seam that owns:

- normalizing `doctor.memory.status` into a renderable dream snapshot
- normalizing `doctor.memory.dreamDiary` into diary document state
- normalizing optional `wiki.importInsights` and `wiki.palace` payloads
- mapping capability availability from the current hello/config snapshot into explicit supported/disabled/unavailable states
- mapping independently failing diary or companion-context loads into an explicit partial-data state that preserves the main dream snapshot

This avoids a regression where `app.tsx` or a dream component starts parsing raw gateway payloads inline.

### 3. Build MVP lanes from existing OpenClaw payloads, not from a new API

OpenClaw already exposes enough for a useful MVP:

- `doctor.memory.status` includes counts plus `shortTermEntries`, `signalEntries`, `promotedEntries`, and phase metadata
- `doctor.memory.dreamDiary` returns the dream diary file content when present
- `wiki.importInsights` and `wiki.palace` return optional memory-wiki summaries when that plugin layer is enabled

MVP derivation rules should stay explicit and honest:

- **Signal-first overview**: derive top “heating up” items from normalized signal-aware entries using `totalSignalCount`, `phaseHitCount`, `lightHits`, `remHits`, and recency fields where available
- **Waiting lane**: short-term entries with `groundedCount === 0`
- **Grounded lane**: short-term entries with `groundedCount > 0`
- **Promoted lane**: promoted entries returned directly by status
- **Why this is sticking**: only use visible counts, grounded replay presence, and phase hits; never imply access to hidden score components

This gives the user the lanes they asked for without depending on a new backend summary seam.

### 4. Parse the diary locally and treat it as narrative context, not authoritative evidence mapping

`doctor.memory.dreamDiary` is a diary file read, not a structured candidate map. For MVP:

- create a focused `src/lib/dream-diary.ts` helper that parses the diary into navigable entries or day chunks
- present diary content as a human-readable narrative layer
- attach diary content to the candidate-first detail view as narrative context
- treat diary-to-candidate linkage as direct only when visible snapshot text and diary text clearly overlap
- explicitly show “relationship detail is limited” when no reliable candidate-to-diary mapping can be derived

ClawFace should borrow the useful diary-reading concepts from OpenClaw’s dreaming UI, but not copy the full backend Dreams tab or its maintenance actions.

### 5. Reuse browser-shell primitives selectively, not the whole browser stack

This feature is not a sibling of FileManager/MediaBrowser in navigation terms, but some small shell pieces already fit:

- `BrowserRootTabs` for waiting / grounded / promoted lane switching
- `BrowserEmptyState` for loading, empty, disabled, unavailable, and limited-data states
- existing chat-header and tool-visibility visual language for summary chips and candidate cards

What should not be reused wholesale:

- `BrowserShellLayout` as a separate full-screen view container
- `FileManagerProvider`
- `useMediaBrowserController`

Dream Visibility is a chat-adjacent inspector, not a browse-first surface with its own app-level route.

### 6. Keep optional memory-wiki linkage on demand and best-effort

The spec clarification says optional related context should load when the user inspects a specific dream item. The MVP plan should therefore:

- keep imported insights and memory palace fetching out of the initial inspector-open critical path
- request those summaries on first candidate detail expansion when the methods are available
- normalize them once and reuse them during the pane session
- derive candidate-to-related-context matches through a small pure helper such as `src/lib/dream-related-context.ts`
- route imported-insight and memory-palace handoffs through an existing ClawFace adjacent-context navigation pattern instead of a dream-specific browser stack

Current APIs do not provide deterministic relationship ids between dream candidates and wiki artifacts, so MVP matching should remain best-effort and clearly bounded. Suitable signals include:

- path overlap
- title/snippet token overlap
- shared topic or claim wording when obvious

If no strong relation is found, the detail view should show that related context is unavailable or limited rather than inventing a precise link.

### 7. Future timeline and event-journal work should wait for a gateway seam

OpenClaw already has a memory host event log at `memory/.dreams/events.jsonl`, with event helpers in `src/memory-host-sdk/events.ts`, but that log is not currently exposed as a frontend-ready gateway surface for ClawFace.

Future work can build a stronger Dream Timeline or Dream Journal feature around a new seam such as:

- `doctor.memory.timeline`
- `doctor.memory.events`
- or another normalized journal method that reads and shapes the memory host event log

That future seam would enable:

- chronological dream run timelines
- promotion events with candidate provenance
- replay/run journals
- richer promotion explanation cards

This is intentionally out of MVP. The current plan should mention the opportunity but must not block v1 on it.

### 8. App-shell integration points

Likely integration points in ClawFace:

- `src/app.tsx`
  - own only Dream Inspector visibility, current workspace/session context handoff, and pane placement in the chat shell
  - pass the current workspace/session context into the Dream Inspector controller entry seam
  - avoid owning gateway fetch logic, capability parsing, snapshot derivation, or refresh state directly
- `src/hooks/useDreamInspectorController.ts`
  - own dream snapshot loading, capability checks, manual refresh state, diary loading, and optional related-context loading
  - expose a shell-friendly view model so `src/app.tsx` and dream components stay render-focused
- `src/components/ChatView.tsx`
  - add a Dreams action in the existing header controls
  - optionally accept a rendered adjunct inspector pane slot or a minimal toggle callback
- `src/components/SessionSidebar.tsx`
  - add a top-level Dreams shortcut alongside Files and Media
  - do not put per-session dream badges on individual rows because current data is workspace-scoped
- `src/styles.css`
  - add pane layout and Dream Inspector styling while preserving the current chat-shell visual language

### 9. Validation strategy

Implementation must validate with:

- `make test-unit`
- `make typecheck`
- `make build`

Targeted manual desktop flows must include:

- open Dream Inspector from an active chat session
- verify signal-first overview, loading, empty, disabled, unavailable, and partial-data states
- distinguish waiting versus grounded versus promoted lanes
- inspect a candidate-first detail view and read associated diary context
- confirm grounded replay is legible as different from still-waiting candidates
- trigger manual refresh and verify snapshot semantics stay clear
- inspect optional imported insight and memory palace links when supported
- confirm graceful degradation when `memory-wiki` is unavailable
- confirm the feature remains session-adjacent and does not become a detached dashboard view

Automated coverage must include focused helper tests for:

- dream status normalization from `doctor.memory.status`
- waiting/grounded/promoted lane derivation and overview ranking
- dream diary parsing and empty/missing handling
- related-context matching and optional-method degradation

## Complexity Tracking

No constitution violations are required by this plan at this stage.
