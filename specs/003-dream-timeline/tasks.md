# Tasks: Dream Timeline

**Input**: Design documents from `/specs/003-dream-timeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include focused helper-level tests for visible chronology derivation, candidate provenance, and artifact-link shaping. Manual desktop validation is also required because this feature extends the renderer shell and changes Dream Inspector behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Dream Timeline scaffolding in ClawFace without introducing a detached dashboard stack or any backend dependency.

- [x] T001 Create Dream Timeline scaffolding in `src/components/dreams/`, `src/hooks/`, `src/lib/`, and `tests/`, keeping the feature attached to the existing Dream Inspector shell from `/Users/oberon/.openclaw/workspace/ClawFace/specs/003-dream-timeline/plan.md`
- [x] T002 [P] Update support files only as needed so `.github/copilot-instructions.md`, `.specify/feature.json`, and the feature docs stay aligned with the current-surface-only Dream Timeline plan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the renderer-side timeline derivation seams on top of the existing Dream Inspector snapshot before any user story UI work begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T003 Create `src/lib/dream-timeline.ts` to derive grouped chronology, chronology range metadata, event ordering, and candidate-track summaries from `DreamInspectorSnapshot`, parsed diary data, and current workspace scope, keeping `loadedAtMs` as freshness metadata rather than as a timeline moment source
- [x] T004 [P] Add focused grouped chronology coverage for `src/lib/dream-timeline.ts` in `tests/dream-timeline.test.mjs`, including promotion grouping from `promotedAt`, replay touchpoint grouping from `lastRecalledAt`, diary-entry chronology, limited `diary-update` fallback from `updatedAtMs`, explicit sparse-data handling, and true `empty` behavior when only snapshot freshness exists
- [x] T005 Create `src/lib/dream-timeline-links.ts` to shape diary, candidate, Imported Insights, and Memory Palace timeline links plus explicit inferred or limited-relationship states without adding a second raw gateway parsing path, restricting related-memory links to candidate-safe moments
- [x] T006 [P] Add focused artifact-link and limitation handling coverage for `src/lib/dream-timeline-links.ts` in `tests/dream-timeline-links.test.mjs`
- [x] T007 Create `src/hooks/useDreamTimelineController.ts` to own selected moment state, candidate filtering, workspace-scope labeling, and shell-facing Dream Timeline view-model shaping on top of the existing Dream Inspector controller output
- [x] T008 [P] Extend `tests/dream-timeline.test.mjs` to cover workspace-scope labeling, availability states, explicit Dream Timeline `disabled` mapping, and explicit "not available from current data" behavior when exact dream-run history cannot be derived

**Checkpoint**: Visible chronology derivation, link shaping, and controller boundaries are ready. User story UI work can now proceed without duplicating Dream Inspector parsing in app surfaces.

---

## Phase 3: User Story 1 - Read Visible Dream Chronology From Dream Inspector (Priority: P1) 🎯 MVP

**Goal**: Deliver an adjacent Dream Timeline panel from Dream Inspector that makes visible promotion moments, replay touchpoints, and diary chronology legible in chronological order.

**Independent Test**: Open Dream Timeline from Dream Inspector in a workspace with timestamped dream evidence and confirm the user can identify visible promotion, replay, and diary chronology without leaving the chat shell or reading backend files.

### Tests for User Story 1

- [x] T009 [P] [US1] Extend `tests/dream-timeline.test.mjs` to cover loading, empty, disabled, unavailable, and partial timeline states plus grouped chronology ordering used by the Dream Timeline panel, including the rule that snapshot freshness alone does not create timeline moments
- [x] T010 [P] [US1] Extend `tests/dream-timeline-links.test.mjs` to cover diary-date parsing fallback, grouped timestamp labels, limited `diary-update` copy, and timeline moments that intentionally omit unsupported chronology claims

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement `src/components/dreams/DreamTimelineEmptyState.tsx` for loading, empty, disabled, unavailable, partial, and limited timeline states using existing shell or browser empty-state patterns where appropriate
- [x] T012 [P] [US1] Implement `src/components/dreams/DreamTimelineEventGroup.tsx` for grouped chronology cards with visible source labels, timestamps, summaries, limitation notes, event-group expansion language, and distinct rendering for `diary-entry` versus limited `diary-update` moments
- [x] T013 [US1] Implement `src/components/dreams/DreamTimelinePanel.tsx` to compose grouped chronology, workspace-scope labeling, and moment detail as Dream Inspector-adjacent context rather than as a detached dashboard
- [x] T014 [US1] Update `src/components/dreams/DreamInspectorPane.tsx` and `src/hooks/useDreamInspectorController.ts` to add a Dream Timeline affordance and hand off current snapshot, diary, related context, and workspace scope without moving timeline derivation logic into `src/app.tsx`
- [x] T015 [US1] Add Dream Timeline panel styling in `src/styles.css` so chronology reads like ClawFace workstation history rather than a backend log viewer

**Checkpoint**: User Story 1 should now provide a usable Dream Timeline that opens from Dream Inspector and explains visible chronology at the workspace level.

---

## Phase 4: User Story 2 - Follow Candidate Evidence Over Time (Priority: P2)

**Goal**: Add candidate-oriented timeline inspection so users can follow how a selected memory visibly heated up, got replay touchpoints, or promoted from the evidence currently available to ClawFace.

**Independent Test**: Open a candidate with visible timestamps and confirm the user can follow its chronology, including inferred or limited handling when provenance is incomplete.

### Tests for User Story 2

- [x] T016 [P] [US2] Extend `tests/dream-timeline.test.mjs` to cover candidate-track filtering, current-status framing, and explicit inferred candidate relationships when chronology is derived rather than direct
- [x] T017 [P] [US2] Extend `tests/dream-timeline-links.test.mjs` to cover candidate-linked diary and related-context handoff metadata plus limited provenance copy for candidate detail flows

### Implementation for User Story 2

- [x] T018 [P] [US2] Implement `src/components/dreams/DreamCandidateTimeline.tsx` for selected candidate chronology, visible status, and inferred or limited-relationship messaging
- [x] T019 [US2] Update `src/hooks/useDreamTimelineController.ts` to support candidate-track selection, candidate-filtered chronology, and fallback behavior when a candidate lacks enough visible timestamped evidence
- [x] T020 [US2] Update `src/lib/dream-timeline.ts` and `src/lib/dream-timeline-links.ts` to preserve candidate provenance, grouped timestamp moments, and explicit inferred mapping without inventing deterministic history
- [x] T021 [US2] Update `src/components/dreams/DreamTimelinePanel.tsx` and `src/components/dreams/DreamInspectorPane.tsx` to compose candidate timeline detail into the adjacent Dream Inspector flow

**Checkpoint**: User Story 2 should now let users trace a candidate over visible chronology and understand direct versus inferred evidence safely.

---

## Phase 5: User Story 3 - Cross-Reference Chronology With Diary And Nearby Context (Priority: P3)

**Goal**: Add optional diary and nearby related-context links from timeline moments and keep the chronology flow understandable when those links are unavailable or partial.

**Independent Test**: Open timeline moments with diary or related-context links and confirm the user can follow those links into nearby dream context; repeat with missing links and confirm graceful fallback.

### Tests for User Story 3

- [x] T022 [P] [US3] Extend `tests/dream-timeline-links.test.mjs` to cover diary-entry links, selected-candidate handoff, Imported Insights and Memory Palace link shaping for candidate-safe moments only, and explicit limited relationship states
- [x] T023 [P] [US3] Extend `tests/dream-timeline.test.mjs` to cover partial-data handling when chronology exists but diary or nearby related-context links are unavailable

### Implementation for User Story 3

- [x] T024 [US3] Update `src/hooks/useDreamTimelineController.ts` and `src/lib/dream-timeline-links.ts` to shape adjacent artifact handoffs and preserve timeline usability when links are absent, grouped, or not safe enough for direct related-context linkage
- [x] T025 [P] [US3] Update `src/components/dreams/DreamTimelineEventGroup.tsx` and `src/components/dreams/DreamTimelinePanel.tsx` to render diary and nearby related-context handoffs, limiting Imported Insights and Memory Palace links to candidate-scoped timeline views
- [x] T026 [US3] Apply lightweight polish in `src/styles.css` and touched Dream Timeline components so artifact-linked chronology feels integrated with Dream Inspector rather than like a filesystem or event-log browser

**Checkpoint**: All three user stories should now work independently, with MVP value in US1 and richer candidate or artifact context in US2 and US3.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, regression protection, and documentation follow-through that affect multiple stories.

- [x] T027 [P] Update relevant architecture or product notes in `docs/ARCHITECTURE.md` or `docs/PRODUCT-BRIEF.md` only if Dream Timeline implementation materially changes inspector or integration-boundary guidance
- [x] T028 Run the automated validation set: `make test-unit`, `make typecheck`, `make build` in `/Users/oberon/.openclaw/workspace/ClawFace`
- [x] T029 Run the targeted manual validation from `specs/003-dream-timeline/quickstart.md`, including chronology rendering, candidate provenance, diary or nearby-context handoffs, and sparse-data handling
- [x] T030 Verify existing Dream Inspector, chat shell, Files, Media, and tool activity flows still behave normally after timeline integration in `src/components/dreams/DreamInspectorPane.tsx`, `src/hooks/useDreamInspectorController.ts`, `src/app.tsx`, and `src/styles.css`

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

- visible chronology derivation before controller behavior
- controller behavior before shell or component composition
- moment-group chronology before candidate or artifact detail composition
- shell or component composition before final manual validation

### Parallel Opportunities

- `T004`, `T006`, and `T008` can run in parallel once scaffolding exists
- `T011` and `T012` can run in parallel after the controller contract is settled
- `T016` and `T017` can run in parallel during the candidate provenance pass
- `T022` and `T023` can run in parallel during the artifact-link pass
- `T027` can run in parallel with final validation if documentation changes are required

---

## Parallel Example: User Story 1

```bash
# After the timeline derivation helpers and controller are in place, these can proceed together:
Task: "Implement src/components/dreams/DreamTimelineEventGroup.tsx"
Task: "Implement src/components/dreams/DreamTimelineEmptyState.tsx"
Task: "Add focused chronology and timeline-state tests in tests/dream-timeline.test.mjs and tests/dream-timeline-links.test.mjs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the visible chronology slice independently

### Incremental Delivery

1. Deliver grouped workspace chronology first
2. Add candidate evidence tracks second
3. Add optional diary and nearby related-context links third
4. Finish with validation and regression follow-through

### Practical Guidance

- Do not read `memory/.dreams/events.jsonl` directly from ClawFace
- Do not make Dream Timeline a detached dashboard or graph-first surface
- Prefer grouped visible chronology and explicit limitation states over raw timestamp rendering
- Keep `src/app.tsx` shell-only and keep timeline derivation logic in dedicated helper and controller seams
- Treat unsupported chronology claims as blockers or explicit limitations, not as hidden future backend work
