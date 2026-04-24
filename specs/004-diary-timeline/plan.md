# Implementation Plan: Dream Diary Timeline

**Branch**: `004-diary-timeline` | **Date**: 2026-04-24 | **Spec**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/spec.md)  
**Input**: Feature specification from `/specs/004-diary-timeline/spec.md`

## Summary

Refactor ClawFace's dream integration into a lean Dream Diary Timeline: an interactive list of diary entries plus a focused reader. The current signal overview, memory lanes, candidate detail, candidate timeline, and related-context panels should be removed from the primary dream flow rather than preserved behind compatibility toggles. The implementation should reuse current gateway surfaces, especially `doctor.memory.dreamDiary`, with `doctor.memory.status` used only for availability or disabled-state context.

Because this project is still greenfield, the plan intentionally optimizes for a clean user-facing implementation over backward compatibility with the previous Dream Inspector shape. Future Imported Insights and Memory Palace support should be planned as diary-entry attachments, not as candidate-first panels.

## Technical Context

**Language/Version**: TypeScript with Node.js `22.22.0`, React, Vite, and Electron renderer code  
**Primary Dependencies**: Existing ClawFace gateway client, existing browser-shell empty-state patterns, current Dream Diary normalization helpers, React component stack  
**Storage**: Current OpenClaw gateway responses and local renderer selection state; no new persistent ClawFace storage  
**Testing**: `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop diary flows  
**Target Platform**: Desktop app, macOS-first development environment with cross-platform Electron packaging preserved  
**Project Type**: Electron desktop frontend for OpenClaw  
**Performance Goals**: Opening Dreams, selecting entries, returning to latest entry, and refreshing the snapshot should feel immediate for normal diary documents; parsing should happen once per loaded diary snapshot  
**Constraints**: Must use only current OpenClaw gateway surfaces; must not require companion OpenClaw changes; must not read backend files directly; must avoid adding more logic to `src/app.tsx` and `src/components/ChatView.tsx`; must remove dashboard-first dream UI from the primary flow  
**Scale/Scope**: One focused dream refactor centered on diary parsing, timeline selection, focused reading, and honest availability states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable boundaries over gravity wells**: Pass. The plan keeps fetching and diary view-model ownership in a dedicated hook and pure helper, while `src/app.tsx` and `ChatView.tsx` continue only to open or close the Dreams pane.
- **Validation is a merge gate**: Pass. The implementation must run `make test-unit`, `make typecheck`, and `make build`, with helper tests for diary parsing, ordering, limited fallback, and state derivation.
- **UX consistency beats novelty**: Pass. The new surface remains inside the ClawFace workstation shell and uses existing pane and empty-state patterns, but simplifies the dream content to a readable journal.
- **Performance and responsiveness are product features**: Pass. Diary parsing is snapshot-local, no live stream or polling loop is added, and selection/navigation is local UI state.
- **Testable behavior over cleverness**: Pass. Entry parsing, grouping, availability mapping, and selection defaults are pure or hook-owned behavior with direct tests.
- **Current OpenClaw surface is the integration boundary**: Pass. The plan depends on `doctor.memory.dreamDiary` and optionally `doctor.memory.status`; future Imported Insights and Memory Palace support is shaped around existing wiki surfaces only when a diary-specific need is planned.

## Project Structure

### Documentation (this feature)

```text
specs/004-diary-timeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── diary-timeline-boundaries.md
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── app.tsx
├── styles.css
├── components/
│   ├── ChatView.tsx
│   ├── SessionSidebar.tsx
│   └── dreams/
│       ├── DreamDiaryTimelinePane.tsx
│       ├── DreamDiaryTimelineList.tsx
│       ├── DreamDiaryReader.tsx
│       └── DreamDiaryTimelineEmptyState.tsx
├── hooks/
│   └── useDreamDiaryTimelineController.ts
└── lib/
    ├── shell-gateway-memory.ts
    ├── dream-diary.ts
    └── dream-diary-timeline.ts

tests/
├── dream-diary.test.mjs
├── dream-diary-timeline.test.mjs
└── shell-gateway-memory.test.mjs
```

**Structure Decision**: Replace the active dream UI with a smaller diary-focused component set. Keep the Dreams entry point in the shell/sidebar/chat affordances, but swap the pane/controller behind it. Reuse `dream-diary.ts` where useful and add `dream-diary-timeline.ts` only for diary-focused grouping, availability, and selection view models. Remove the previous signal/candidate/timeline panels from the rendered dream flow instead of keeping hidden compatibility routes.

## Phase 0 Research

See [research.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/research.md).

## Phase 1 Design

See:

- [data-model.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/data-model.md)
- [quickstart.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/quickstart.md)
- [contracts/diary-timeline-boundaries.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/004-diary-timeline/contracts/diary-timeline-boundaries.md)

## Implementation Approach

### 1. Replace the current dream composition

The active dream pane should become `DreamDiaryTimelinePane` or an equivalent single-purpose surface. It should render:

- pane header with workspace label, refresh, and close
- left or top timeline list of entries
- focused reader for the selected entry
- lightweight freshness and availability state

It should no longer render the previous dashboard-style sequence of:

- signal overview cards
- waiting, grounded, and promoted lanes
- candidate detail
- candidate timeline
- related context panel

Since the app is greenfield, implementation should remove dead dream UI from the primary flow cleanly. If old helpers become unused, prefer deleting them in this slice or immediately after the component replacement rather than preserving a large dormant dashboard stack.

### 2. Narrow controller ownership to diary reading

Introduce `useDreamDiaryTimelineController.ts` to own:

- initial load when Dreams opens
- manual refresh
- diary request through `doctor.memory.dreamDiary`
- optional status request through `doctor.memory.status` only for disabled or availability messaging
- selected entry id
- latest-entry selection
- loading, empty, disabled, unavailable, ready, and limited-parse states

The controller should return a compact view model shaped for the pane. It should not expose candidate lanes, candidate maps, overview metrics, related catalog loading, or timeline provenance structures.

`src/app.tsx` remains responsible only for Dreams pane visibility and passing gateway/session context. `ChatView.tsx` and `SessionSidebar.tsx` keep their Dreams entry affordances but should not own diary loading or parsing.

### 3. Keep diary parsing pure and testable

Use existing `parseDreamDiarySnapshot` behavior where it already fits, but make the diary timeline rules explicit in `dream-diary-timeline.ts`:

- build snapshot-local entry ids
- identify dated versus undated entries
- group entries by display date when available
- sort dated entries clearly, with stable ordering for same-date entries
- produce a limited fallback group when only document-level content is available
- keep `updatedAtMs` as freshness metadata, not as an invented entry date

If the existing parser cannot distinguish parsed dated entries from document-level fallback clearly enough, extend the diary model with a minimal `parseStatus` or `entryKind` field rather than inferring from display strings in components.

### 4. Design the UI as a reader, not a dashboard

The refactored surface should look and behave like a compact journal:

- strong selected-entry state
- comfortable readable line length
- clear date or limited-parse label
- quick "Latest" affordance
- refresh affordance with snapshot freshness
- no metric cards unless needed for availability copy

This is still an operational desktop surface, not a marketing page. It should be restrained, dense enough for repeated use, and consistent with ClawFace panes and shell controls.

### 5. Treat disabled and stale diary content carefully

The controller should distinguish:

- `loading`: initial fetch in progress
- `ready`: diary entries are readable
- `empty`: diary method succeeds but no content exists
- `disabled`: status says dreaming is off
- `unavailable`: gateway/method/fetch failure prevents loading
- `limited`: content exists but cannot be confidently split into dated entries

If dreaming is disabled but old diary content exists, reading should still work with a visible disabled note. The user asked for reading diary entries; the disabled state should not hide already-readable content.

### 6. Future Imported Insights and Memory Palace shape

Do not implement Imported Insights or Memory Palace in MVP. Preserve a clean future shape by:

- keeping diary entries as the stable unit future links would attach to
- avoiding candidate-first assumptions in the new data model
- allowing optional future `DiaryEntryAttachment` records keyed to a diary entry id
- keeping related-memory UI out of the main reader until there is a diary-specific reason to show it

When future support is added, related artifacts should appear as small entry-level references or a secondary reader-side panel, not as the old candidate/related-context dashboard.

## Validation Strategy

Automated validation:

- `make test-unit`
- `make typecheck`
- `make build`

Focused helper tests:

- diary content splits into multiple dated entries
- undated content falls back to limited readable content
- same-date entries keep stable ordering
- selected entry defaults to latest readable entry
- latest-entry action returns to latest after browsing
- empty, disabled, unavailable, ready, and limited states are derived distinctly
- `updatedAtMs` appears only as freshness metadata, not as a fabricated entry date

Manual desktop flows:

- open Dreams from sidebar and chat toolbar and confirm the first meaningful view is the diary timeline
- read a populated diary entry without passing through signal/candidate UI
- move between older and newer entries and confirm selection remains legible
- use Latest after selecting an older entry
- refresh the diary and confirm freshness state is understandable
- verify empty, disabled, unavailable, and limited-parse states
- verify previous signal cards, candidate lanes, candidate timelines, and related-context panels are gone from the main flow

## Complexity Tracking

No constitution violations are expected. The plan intentionally reduces complexity by replacing the broader dream dashboard stack with a single diary-focused controller, helper, and pane.
