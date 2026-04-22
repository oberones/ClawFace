# Tasks: Dream Timeline

**Input**: Design documents from `/specs/003-dream-timeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include focused helper-level tests for the new timeline gateway seam, timeline normalization/grouping, candidate provenance, and artifact-link shaping. Manual desktop validation is also required because this feature extends the renderer shell and depends on an out-of-repo OpenClaw backend seam.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Dream Timeline scaffolding in ClawFace and reserve the OpenClaw gateway touch points without introducing a detached dashboard stack.

- [ ] T001 Create Dream Timeline scaffolding in `src/components/dreams/`, `src/hooks/`, `src/lib/`, and `tests/`, plus reserve the new seam touch points in `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts` and related gateway registration files from `/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/plan.md`
- [ ] T002 [P] Add the Dream Timeline task/design artifact references to support files only as needed, keeping `.github/copilot-instructions.md`, `.specify/feature.json`, and the feature docs aligned with the active plan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the new OpenClaw timeline seam and the renderer-side timeline domain seams before any user story UI work begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T003 Create the new grouped dream timeline gateway seam in `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts`, registering it in `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods-list.ts` and `/Users/oberon/Projects/coding/other/openclaw/src/gateway/method-scopes.ts` so ClawFace can request a normalized chronology method such as `doctor.memory.timeline`
- [ ] T004 [P] Add focused backend seam coverage for the new timeline method in `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.test.ts`, including stable event-group ids, timestamps, range and truncation metadata, grouped chronology, and unavailable states rather than raw event-row passthrough
- [ ] T005 Create `src/lib/shell-gateway-memory-timeline.ts` to normalize the new timeline payload, capability availability, truncation metadata, and explicit loading/empty/unavailable/partial states into shell-facing Dream Timeline state
- [ ] T006 [P] Add focused normalization and capability-gating coverage for `src/lib/shell-gateway-memory-timeline.ts` in `tests/shell-gateway-memory-timeline.test.mjs`, including stable ids, timestamps, and range metadata required by the renderer
- [ ] T007 Create `src/lib/dream-timeline.ts` to derive grouped chronology, event ordering, event-group selection, and candidate-track summaries from normalized timeline payloads
- [ ] T008 [P] Add focused grouped chronology and candidate-track coverage for `src/lib/dream-timeline.ts` in `tests/dream-timeline.test.mjs`
- [ ] T009 Create `src/lib/dream-timeline-links.ts` to shape diary, promoted-memory, and candidate artifact links plus explicit limited-relationship states without reconstructing raw event-log semantics in UI components
- [ ] T010 [P] Add focused artifact-link and limitation handling coverage for `src/lib/dream-timeline-links.ts` in `tests/dream-timeline-links.test.mjs`

**Checkpoint**: The backend timeline seam, renderer normalization, grouped chronology derivation, and artifact-link helpers are ready. User story UI work can now proceed without duplicating gateway parsing in app surfaces.

---

## Phase 3: User Story 1 - Read Dream Chronology From Dream Inspector (Priority: P1) 🎯 MVP

**Goal**: Deliver an adjacent Dream Timeline panel from Dream Inspector that makes recent dream runs, replay/recall waves, and promotion moments legible in chronological order.

**Independent Test**: Open Dream Timeline from Dream Inspector in a workspace where the timeline seam is available and confirm the user can identify recent dream runs, promotion moments, and replay-related chronology without leaving the chat shell or reading raw event logs.

### Tests for User Story 1

- [ ] T011 [P] [US1] Extend `tests/shell-gateway-memory-timeline.test.mjs` to cover loading/empty/unavailable/partial/truncated timeline states, grouped event chronology metadata, and explicit workspace-scope labeling used by the Dream Timeline panel
- [ ] T012 [P] [US1] Extend `tests/dream-timeline.test.mjs` to cover recent dream run ordering, replay or recall wave grouping, promotion batch grouping, and snapshot-based refresh semantics

### Implementation for User Story 1

- [ ] T013 [US1] Create `src/hooks/useDreamTimelineController.ts` to own timeline snapshot loading, manual refresh, selected event-group state, and workspace context handoff on top of the normalized timeline seams
- [ ] T014 [P] [US1] Implement `src/components/dreams/DreamTimelineEventGroup.tsx` for grouped chronology cards with event kind, time, phase, summary, and event-group expansion language
- [ ] T015 [P] [US1] Implement `src/components/dreams/DreamTimelineEmptyState.tsx` for loading, empty, unavailable, partial, truncated, and limited timeline states using existing shell/browser empty-state patterns where appropriate
- [ ] T016 [US1] Implement `src/components/dreams/DreamTimelinePanel.tsx` to compose grouped chronology, manual refresh, workspace-scope labeling, and event-group detail as Dream Inspector-adjacent context rather than as a detached dashboard
- [ ] T017 [US1] Update `src/components/dreams/DreamInspectorPane.tsx` and `src/hooks/useDreamInspectorController.ts` to add a Dream Timeline affordance and hand off workspace context without moving timeline fetch/normalization logic into `src/app.tsx`
- [ ] T018 [US1] Add Dream Timeline panel styling in `src/styles.css` so chronology reads like ClawFace workstation history rather than a backend log viewer

**Checkpoint**: User Story 1 should now provide a usable Dream Timeline that opens from Dream Inspector and explains recent chronology at the workspace level.

---

## Phase 4: User Story 2 - Follow Candidate Provenance Over Time (Priority: P2)

**Goal**: Add candidate-oriented timeline inspection so users can follow how a selected memory heated up, grounded, or promoted over multiple dream events.

**Independent Test**: Open a candidate with timeline-linked events and confirm the user can follow its visible chronology, including limited-relationship handling when provenance is incomplete.

### Tests for User Story 2

- [ ] T019 [P] [US2] Extend `tests/dream-timeline.test.mjs` to cover candidate-track filtering, promotion provenance, and explicit limited candidate relationships when not every event can be mapped precisely
- [ ] T020 [P] [US2] Extend `tests/dream-timeline-links.test.mjs` to cover candidate-linked artifact handoff metadata and limited provenance copy for candidate detail flows

### Implementation for User Story 2

- [ ] T021 [P] [US2] Implement `src/components/dreams/DreamCandidateTimeline.tsx` for selected candidate chronology, current visible status, and limited-relationship messaging
- [ ] T022 [US2] Update `src/hooks/useDreamTimelineController.ts` to support candidate-track selection, candidate-filtered chronology, and fallback behavior when stable candidate references are incomplete
- [ ] T023 [US2] Update `src/lib/dream-timeline.ts` and `src/lib/dream-timeline-links.ts` to preserve candidate provenance, promotion batch membership, and explicit limited mapping without inventing deterministic history
- [ ] T024 [US2] Update `src/components/dreams/DreamTimelinePanel.tsx` and `src/components/dreams/DreamInspectorPane.tsx` to compose candidate timeline detail into the adjacent Dream Inspector flow

**Checkpoint**: User Story 2 should now let users trace a candidate over time and understand limited versus direct provenance safely.

---

## Phase 5: User Story 3 - Cross-Reference Timeline Events With Nearby Artifacts (Priority: P3)

**Goal**: Add optional diary/promoted-memory/artifact links from timeline events and keep the chronology flow understandable when those links are unavailable or partial.

**Independent Test**: Open timeline entries with artifact links and confirm the user can follow those links into nearby dream context; repeat with missing links and confirm graceful fallback.

### Tests for User Story 3

- [ ] T025 [P] [US3] Extend `tests/shell-gateway-memory-timeline.test.mjs` to cover artifact-link availability, partial-data handling, and timeline seam unsupported states when Dream Inspector still works
- [ ] T026 [P] [US3] Extend `tests/dream-timeline-links.test.mjs` to cover diary-link, promoted-memory-link, nearby candidate handoff shaping, and limited relationship states

### Implementation for User Story 3

- [ ] T027 [US3] Update `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts` and `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.test.ts` so the new timeline seam emits normalized diary/promoted-memory references and explicit limitation metadata where available
- [ ] T028 [US3] Update `src/hooks/useDreamTimelineController.ts` and `src/lib/dream-timeline-links.ts` to shape adjacent artifact handoffs and preserve timeline usability when links are absent
- [ ] T029 [P] [US3] Update `src/components/dreams/DreamTimelineEventGroup.tsx` and `src/components/dreams/DreamTimelinePanel.tsx` to render artifact links, limited relationship copy, and non-admin adjacent-context handoff affordances
- [ ] T030 [US3] Apply lightweight polish in `src/styles.css` and touched dream timeline components so artifact-linked chronology feels integrated with Dream Inspector rather than like a filesystem or event-log browser

**Checkpoint**: All three user stories should now work independently, with MVP value in US1 and richer candidate/artifact context in US2 and US3.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, regression protection, and documentation follow-through that affect multiple stories.

- [ ] T031 [P] Update relevant product or architecture notes in `docs/ARCHITECTURE.md` or `docs/PRODUCT-BRIEF.md` only if Dream Timeline implementation materially changes inspector/navigation guidance or the expected backend seam boundary
- [ ] T032 Run the automated validation set: `make test-unit`, `make typecheck`, `make build` in `/Users/oberon/.openclaw/workspace/ClawFace`, plus the targeted OpenClaw timeline seam tests in `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.test.ts`
- [ ] T033 Run the targeted manual validation from `specs/003-dream-timeline/quickstart.md`, including chronology rendering, candidate provenance, artifact handoffs, and unavailable-state handling
- [ ] T034 Verify existing Dream Inspector, chat shell, Files, Media, and tool activity flows still behave normally after timeline integration in `src/components/dreams/DreamInspectorPane.tsx`, `src/hooks/useDreamInspectorController.ts`, `src/app.tsx`, and `src/styles.css`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependency on other stories
- **User Story 2 (P2)**: Starts after Foundational, but practically depends on the US1 timeline shell existing
- **User Story 3 (P3)**: Starts after Foundational and is easiest once US2 candidate detail flow exists

### Within Each User Story

- Backend seam and renderer normalization before controller behavior
- Controller behavior before shell/component composition
- Event-group chronology before candidate/artifact detail composition
- Shell/component composition before final manual validation

### Parallel Opportunities

- `T004`, `T006`, `T008`, and `T010` can run in parallel once scaffolding exists
- `T014` and `T015` can run in parallel after the controller contract is settled
- `T019` and `T020` can run in parallel during the candidate provenance pass
- `T025` and `T026` can run in parallel during the artifact-link pass
- `T031` can run in parallel with final validation if documentation changes are required

---

## Parallel Example: User Story 1

```bash
# After the timeline seam and normalization helpers are in place, these can proceed together:
Task: "Implement src/components/dreams/DreamTimelineEventGroup.tsx"
Task: "Implement src/components/dreams/DreamTimelineEmptyState.tsx"
Task: "Add focused grouped chronology and timeline-state tests in tests/shell-gateway-memory-timeline.test.mjs and tests/dream-timeline.test.mjs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the timeline chronology slice independently

### Incremental Delivery

1. Deliver grouped workspace chronology first
2. Add candidate provenance second
3. Add optional diary/durable-memory artifact links third
4. Finish with validation and regression follow-through

### Practical Guidance

- Do not read `memory/.dreams/events.jsonl` directly from ClawFace
- Do not make Dream Timeline a detached dashboard or graph-first surface
- Prefer grouped chronology and explicit limitation states over raw event-row rendering
- Keep `src/app.tsx` shell-only and keep timeline fetch/normalization logic in dedicated backend/helper/controller seams
