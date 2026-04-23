# Implementation Plan: Dream Timeline

**Branch**: `003-dream-timeline` | **Date**: 2026-04-22 | **Spec**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/spec.md)  
**Input**: Feature specification from `/specs/003-dream-timeline/spec.md`

## Summary

Add Dream Timeline to ClawFace as a second-level adjunct to Dream Inspector so users can understand the visible chronology already present in the current dream snapshot: promotion moments, replay touchpoints, diary chronology, and candidate-oriented evidence when available. Unlike the earlier follow-up draft, this slice must ship entirely from ClawFace against current gateway surfaces. That means the renderer should reuse the existing Dream Inspector snapshot and diary normalization, derive chronology locally, and stay explicit about the difference between visible evidence and a full backend dream-event journal.

## Technical Context

**Language/Version**: TypeScript (Node.js `22.22.0` tooling, React/Electron renderer stack)  
**Primary Dependencies**: React, Electron, Vite, existing Dream Inspector components/controllers, current OpenClaw gateway protocol surfaces already used by Dream Visibility  
**Storage**: Existing OpenClaw gateway payloads and ClawFace local UI state; no new ClawFace persistent store required  
**Testing**: `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop timeline flows  
**Target Platform**: Desktop app (Electron renderer, macOS-first development environment)  
**Project Type**: Desktop app with an external backend dependency treated as read-only for this repo  
**Performance Goals**: Timeline open, candidate filtering, and moment selection should feel immediate on normal desktop hardware; all chronology derivation should be local and bounded to the current snapshot; no new background polling is required  
**Constraints**: Must remain adjacent to Dream Inspector rather than becoming a new dashboard stack; must not read raw event-log files directly from ClawFace; must not require new OpenClaw methods; must not overclaim provenance where current data is incomplete; must keep `src/app.tsx` shell-only  
**Scale/Scope**: One follow-up dream feature entirely within the ClawFace repo, centered on deriving truthful visible chronology from the active workspace's current Dream Inspector data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable boundaries over gravity wells**: Pass. The plan keeps timeline derivation out of `src/app.tsx` and `src/components/ChatView.tsx` by introducing timeline-specific helpers and a controller/panel boundary on top of the existing Dream Inspector snapshot seam.
- **Validation is a merge gate**: Pass. Validation includes helper-level coverage for chronology derivation and link shaping, plus `make test-unit`, `make typecheck`, `make build`, and manual desktop flows around timeline availability, chronology, and candidate provenance.
- **UX consistency beats novelty**: Pass. The feature extends Dream Inspector as adjacent context instead of introducing a detached operations console or a graph-first surface.
- **Performance and responsiveness are product features**: Pass. The feature is derived from the existing snapshot and does not introduce a new polling loop, live stream, or redundant gateway fetch path.
- **Testable behavior over cleverness**: Pass. Timeline grouping, candidate relationship handling, and limited states are designed as pure seams with direct test coverage.
- **Current OpenClaw surface is the integration boundary**: Pass. The plan depends only on `doctor.memory.status`, `doctor.memory.dreamDiary`, and already-available optional related-context surfaces. Missing backend event-journal support is treated as a blocker for those specific claims, not as companion implementation work.

## Project Structure

### Documentation (this feature)

```text
specs/003-dream-timeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dream-timeline-gateway.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app.tsx
├── styles.css
├── components/
│   ├── dreams/
│   │   ├── DreamInspectorPane.tsx
│   │   ├── DreamTimelinePanel.tsx
│   │   ├── DreamTimelineEventGroup.tsx
│   │   ├── DreamCandidateTimeline.tsx
│   │   └── DreamTimelineEmptyState.tsx
├── hooks/
│   ├── useDreamInspectorController.ts
│   └── useDreamTimelineController.ts
└── lib/
    ├── shell-gateway-memory.ts
    ├── dream-timeline.ts
    └── dream-timeline-links.ts

tests/
├── dream-timeline.test.mjs
├── dream-timeline-links.test.mjs
└── [existing shell/media/dream visibility tests]
```

**Structure Decision**: Keep Dream Timeline inside the existing Dream Inspector architecture rather than creating a separate app-level browser stack. Reuse the current Dream Inspector snapshot and diary normalization, add timeline-specific derivation helpers and a controller, then render timeline UI as adjacent context from the current Dream Inspector pane. Avoid adding a second gateway normalization path when the existing seam already exposes the needed source data.

## Phase 0 Research

See [research.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/research.md).

## Phase 1 Design

See:
- [data-model.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/data-model.md)
- [quickstart.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/quickstart.md)
- [contracts/dream-timeline-gateway.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/contracts/dream-timeline-gateway.md)

## Implementation Approach

### 1. Keep Dream Timeline attached to Dream Inspector

Dream Timeline should not become a fourth top-level app surface. The right ClawFace fit is:

- keep Dream Inspector as the main dream entry point
- open timeline as deeper adjacent context from the Dream Inspector pane
- preserve the current chat/session shell and workstation framing
- avoid extending `activeView`

This keeps the feature aligned with the product idea that Dream Inspector answers "what matters now" and Dream Timeline answers "what visible chronology can ClawFace already explain?"

### 2. Reuse current Dream Inspector snapshot data instead of adding a new backend dependency

This slice is implementable only by staying on current surfaces. That means Dream Timeline should derive its source data from:

- the normalized `doctor.memory.status` snapshot already used by Dream Inspector
- the parsed Dream Diary document already loaded by Dream Inspector
- optional Imported Insights and Memory Palace context already used by Dream Visibility

It must not depend on:

- new OpenClaw gateway methods
- direct reads of `memory/.dreams/events.jsonl`
- companion backend work landing in a different repo

### 3. Derive visible chronology locally from current evidence

The current surfaces already expose enough information to build a truthful but limited chronology:

- `promotedAt` can support promotion moments
- `lastRecalledAt` can support replay touchpoints
- parsed diary entry dates can support diary chronology
- current lane placement can support candidate status framing

The new helper seam in `src/lib/dream-timeline.ts` should own:

- grouping candidates by shared visible timestamps
- sorting visible moments into one chronology
- deriving range and freshness metadata from those moments
- distinguishing direct evidence from inferred chronology
- keeping `loadedAtMs` as freshness metadata for the panel header only, not as chronology input

This keeps raw timestamp interpretation out of UI components and avoids duplicating dream parsing in multiple surfaces.

### 4. Treat missing exact event history as an explicit product boundary

Current gateway surfaces do **not** expose:

- exact dream-run completion history
- stable backend event ids
- a complete replay wave journal

The plan should therefore:

- show only chronology that can be supported from visible evidence
- use explicit "limited" or "not available from current data" copy when users expect fuller history
- avoid fake dream-run cards that merely guess at missing backend history

This is where the new constitution guidance materially changes the feature: missing backend support is a blocker for those specific claims, not future implementation work hidden inside the slice.

### 5. Make candidate provenance helpful but honest

Not every moment can support deterministic candidate linking. The timeline should therefore:

- treat workspace chronology as the guaranteed baseline
- treat candidate timeline tracks as an enhanced path when the selected candidate has visible timestamped evidence
- keep inferred and limited relationship states explicit
- avoid blocking the whole timeline on perfect candidate fidelity

This still adds product value on day one while staying honest about what the current data can and cannot prove.

### 6. Reuse Dream Inspector state and navigation patterns where possible

Likely integration points:

- `src/components/dreams/DreamInspectorPane.tsx`
  - add a timeline affordance from overview or candidate detail
  - keep timeline mounted as adjacent context or sub-panel rather than a separate route
- `src/hooks/useDreamInspectorController.ts`
  - remain owner of the current dream snapshot, diary, and related context loading
  - hand selected candidate and workspace context into the timeline controller seam
- `src/hooks/useDreamTimelineController.ts`
  - own selected moment, candidate filter state, and derived timeline view-model shaping
  - expose workspace-scope label and scope detail alongside timeline state so the panel stays honest about chronology scope
  - map Dream Inspector `disabled` state into an explicit Dream Timeline disabled state instead of collapsing it into generic unavailability
- `src/app.tsx`
  - stay shell-only, just like Dream Visibility
  - own pane visibility and context handoff, not timeline derivation or fetch logic

- restrict Imported Insights and Memory Palace handoffs to candidate-scoped timeline moments so grouped workspace chronology does not imply stronger linkage than the current data supports

### 7. Preserve explicit snapshot semantics

The first Dream Timeline slice should stay snapshot-based:

- derive from the current Dream Inspector snapshot
- refresh through the existing Dream Inspector refresh path
- avoid implying continuous stream semantics
- tolerate sparse or partial chronology gracefully

This is consistent with Dream Visibility and avoids inventing another network lifecycle for a feature that is fundamentally derived from the current snapshot.

### 8. Validation strategy

Implementation must validate with:

- `make test-unit`
- `make typecheck`
- `make build`

Targeted manual desktop flows must include:

- open Dream Timeline from Dream Inspector
- verify loading, empty, disabled, unavailable, limited, and partial states
- verify promotion moments and replay touchpoints render chronologically when visible
- verify diary chronology renders when diary dates are available
- verify at least one candidate-specific timeline path when timestamped evidence exists
- verify timeline-to-diary or timeline-to-related-context handoff when links are present
- verify Dream Inspector remains usable when the current snapshot cannot support a meaningful timeline

Automated coverage must include:

- visible chronology derivation
- grouping and ordering behavior
- inferred or limited provenance handling
- optional artifact-link shaping
- sparse-data and no-data handling

## Future Notes

Future enhancements beyond this slice can include:

- exact dream-run or event-journal chronology only when it becomes available on an already exposed backend surface the repo can actually ship against
- richer candidate provenance once current surfaces expose better shared identifiers
- deeper promotion explanation cards if they can be built from current data without backend assumptions
- richer diary-linked chronology if current diary parsing proves strong enough to support it
