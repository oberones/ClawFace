# Implementation Plan: Dream Timeline

**Branch**: `003-dream-timeline` | **Date**: 2026-04-22 | **Spec**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/spec.md)  
**Input**: Feature specification from `/specs/003-dream-timeline/spec.md`

## Summary

Add Dream Timeline to ClawFace as a second-level adjunct to Dream Inspector so users can understand dream chronology, replay grounding, and promotion moments over time. Unlike Dream Visibility v1, this slice intentionally depends on a new OpenClaw gateway seam shaped from the memory host event log. The frontend should keep the existing chat/session shell, existing Dream Inspector entry points, and the established renderer normalization pattern, while the backend seam should turn raw `memory/.dreams/events.jsonl` rows into grouped, user-safe timeline history rather than exposing raw filesystem detail.

## Technical Context

**Language/Version**: TypeScript (Node.js `22.22.0` tooling, React/Electron renderer stack)  
**Primary Dependencies**: React, Electron, Vite, existing Dream Inspector components/controllers, OpenClaw gateway protocol, future OpenClaw timeline seam  
**Storage**: Existing OpenClaw gateway payloads and ClawFace local UI state; no new ClawFace persistent store required  
**Testing**: `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop timeline flows  
**Target Platform**: Desktop app (Electron renderer, macOS-first development environment)  
**Project Type**: Desktop app with out-of-repo backend dependency  
**Performance Goals**: Timeline open and event-group navigation should feel immediate on normal desktop hardware; timeline data should load as a bounded snapshot rather than a long-running stream; candidate filtering and event-group expansion should be local and fast after initial load  
**Constraints**: Must remain adjacent to Dream Inspector rather than becoming a new dashboard stack; must not read raw event-log files directly from ClawFace; must not overclaim provenance where the seam cannot supply it; must keep `src/app.tsx` shell-only; must tolerate the seam being absent on older gateways  
**Scale/Scope**: One follow-up dream feature spanning a new OpenClaw gateway seam plus ClawFace renderer integration, centered on the active workspace's dream chronology

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable boundaries over gravity wells**: Pass. The plan keeps new timeline parsing out of `src/app.tsx` and `src/components/ChatView.tsx` by introducing a timeline-specific normalization seam and controller/panel boundary.
- **Validation is a merge gate**: Pass. Validation includes helper-level coverage for timeline normalization and chronology shaping, plus `make test-unit`, `make typecheck`, `make build`, and manual desktop flows around timeline availability, chronology, and candidate provenance.
- **UX consistency beats novelty**: Pass. The feature extends Dream Inspector as adjacent context instead of introducing a detached operations console or a graph-first surface.
- **Performance and responsiveness are product features**: Pass. The feature is planned as a bounded snapshot/history surface with explicit refresh, not as a continuous event-stream dashboard.
- **Testable behavior over cleverness**: Pass. Timeline grouping, candidate relationship handling, and unavailable/limited states are designed as pure seams with direct test coverage.

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
    ├── shell-gateway-memory-timeline.ts
    ├── dream-timeline.ts
    └── dream-timeline-links.ts

tests/
├── shell-gateway-memory-timeline.test.mjs
├── dream-timeline.test.mjs
├── dream-timeline-links.test.mjs
└── [existing shell/media/dream visibility tests]
```

**Structure Decision**: Keep Dream Timeline inside the existing Dream Inspector architecture rather than creating a separate app-level browser stack. Add a dedicated timeline normalization seam and timeline-specific controller, then render timeline UI as adjacent context from the current Dream Inspector pane. Reuse existing browser-shell primitives where helpful for tabs/empty states, but do not create a separate route or management surface.

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
- open timeline as a deeper adjacent context from the Dream Inspector pane
- preserve the current chat/session shell and workstation framing
- avoid extending `activeView`

This keeps the feature aligned with the product idea that Dream Inspector answers "what matters now" and Dream Timeline answers "how it got here."

### 2. Require a backend seam and shape it for frontend use

This slice is not implementable on current public dream gateway surfaces alone. The raw OpenClaw event log exists, but ClawFace should not consume it directly. The plan therefore requires a new OpenClaw seam such as:

- `doctor.memory.timeline`
- `doctor.memory.events`
- or another equivalent normalized journal method

That seam should:

- read and shape the memory host event log inside OpenClaw
- group events into user-facing chronology instead of passing raw rows through
- preserve stable event ids and timestamps
- expose candidate, diary, and promoted-memory references when available
- include user-safe summaries and limitation markers so the renderer does not have to reverse-engineer chronology from backend internals

### 3. Add a renderer-side timeline normalization seam parallel to Dream Visibility

ClawFace already has a pattern for shell-facing gateway normalization:

- `shell-gateway-state.ts`
- `shell-gateway-config.ts`
- `shell-gateway-memory.ts`

Dream Timeline should follow that by adding `src/lib/shell-gateway-memory-timeline.ts` to own:

- capability and method-availability checks for the timeline seam
- normalization of grouped timeline payloads
- mapping unavailable, limited, partial, and truncated states
- conversion of seam payloads into shell-friendly event groups and candidate references

This keeps raw gateway shape drift out of UI components and preserves the thin-shell architecture we already enforced for Dream Inspector.

### 4. Treat grouped chronology as the MVP, not raw event rows

The raw event log currently records:

- `memory.recall.recorded`
- `memory.dream.completed`
- `memory.promotion.applied`

That is useful backend evidence, but not the right user-facing surface. The MVP chronology model should favor grouped units such as:

- dream run
- recall or replay wave
- promotion batch
- diary-linked moment

The backend seam should either pre-group these events or provide enough normalized structure that the renderer can group them predictably without becoming a log parser.

### 5. Make candidate provenance optional but first-class when available

Not every event can support deterministic candidate linking. The plan should therefore:

- treat workspace chronology as the guaranteed baseline
- treat candidate timeline tracks as an enhanced path when stable candidate references are present
- keep limited-relationship states explicit when links are incomplete
- avoid blocking the whole timeline on perfect candidate fidelity

This makes the feature useful on day one while still encouraging the backend contract to evolve toward shared identifiers with Dream Inspector status surfaces.

### 6. Reuse Dream Inspector state and navigation patterns where possible

Likely integration points:

- `src/components/dreams/DreamInspectorPane.tsx`
  - add a timeline affordance from overview or candidate detail
  - keep timeline mounted as adjacent context or sub-panel rather than a separate route
- `src/hooks/useDreamInspectorController.ts`
  - remain owner of current dream snapshot
  - hand selected candidate/workspace context into the timeline controller seam
- `src/hooks/useDreamTimelineController.ts`
  - own timeline loading, refresh, selected event group, candidate filtering, and limited-state handling
  - expose workspace-scope label and scope detail alongside timeline state so the panel can stay honest about chronology scope
- `src/app.tsx`
  - stay shell-only, just like Dream Visibility
  - own pane visibility and context handoff, not timeline parsing or fetch logic

### 7. Preserve explicit snapshot semantics

The first Dream Timeline slice should stay snapshot-based:

- load on open
- allow explicit refresh
- avoid implying continuous stream semantics
- tolerate missing or older gateway support gracefully

This is consistent with Dream Visibility and avoids coupling the feature to live telemetry before the product actually needs it.

### 8. Validation strategy

Implementation must validate with:

- `make test-unit`
- `make typecheck`
- `make build`

Targeted manual desktop flows must include:

- open Dream Timeline from Dream Inspector
- verify loading, empty, unavailable, limited, and truncated states
- verify recent dream runs and promotion batches render chronologically
- verify at least one candidate-specific timeline path when candidate references exist
- verify timeline-to-diary or timeline-to-memory handoff when links are present
- verify Dream Inspector remains usable when the timeline seam is unavailable

Automated coverage must include:

- timeline seam normalization
- grouped chronology derivation
- candidate-link limitation handling
- optional artifact-link shaping
- unavailable/truncated-state handling

## Future Notes

Future enhancements beyond this slice can include:

- live update or heartbeat refresh only if a real user need emerges
- richer candidate provenance once shared ids are broader across OpenClaw dream surfaces
- deeper promotion explanation cards if the backend can expose them safely
- richer diary-linked chronology views once the seam can attach diary entry references consistently
