# Tasks: Dream Visibility

**Input**: Design documents from `/specs/002-dream-visibility/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include focused helper-level tests for new dream normalization, lane derivation, diary parsing, and related-context matching. Manual desktop validation is also required because this feature lives in the renderer shell.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Dream Visibility scaffolding and reserve the shell integration points without building a separate dashboard stack.

- [ ] T001 Create Dream Visibility scaffolding in `src/components/dreams/`, `src/hooks/`, `src/lib/`, and `tests/` for the planned files in `/Users/oberon/.openclaw/workspace/ClawFace/specs/002-dream-visibility/plan.md`
- [ ] T002 [P] Add the Dream Visibility task/design artifact references to `specs/002-dream-visibility/tasks.md` support files only as needed, keeping `.github/copilot-instructions.md` and the feature docs aligned with the active plan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the renderer-side dream domain seams before any user story UI work begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T003 Create `src/lib/shell-gateway-memory.ts` to normalize `doctor.memory.status`, `doctor.memory.dreamDiary`, optional `wiki.importInsights`, and optional `wiki.palace` payloads into shell-facing Dream Visibility state using existing hello/config capability inputs instead of raw UI parsing
- [ ] T004 [P] Add focused normalization and capability-gating coverage for `src/lib/shell-gateway-memory.ts` in `tests/shell-gateway-memory.test.mjs`
- [ ] T005 Create `src/lib/dream-candidates.ts` to derive waiting, grounded, and promoted lanes plus signal-first overview ranking and lightweight explanation cues from normalized dream snapshot data
- [ ] T006 [P] Add focused lane-derivation and ranking coverage for `src/lib/dream-candidates.ts` in `tests/dream-candidates.test.mjs`
- [ ] T007 Create `src/lib/dream-diary.ts` to parse dream diary snapshot content into readable diary entries and explicit limited-relationship states
- [ ] T008 [P] Add focused diary parsing and missing/empty-state coverage for `src/lib/dream-diary.ts` in `tests/dream-diary.test.mjs`
- [ ] T009 Create `src/lib/dream-related-context.ts` to perform best-effort imported-insight and memory-palace matching for candidate detail views without assuming deterministic backend relation ids
- [ ] T010 [P] Add focused matching and graceful-degradation coverage for `src/lib/dream-related-context.ts` in `tests/dream-related-context.test.mjs`

**Checkpoint**: Dream payload normalization, lane derivation, diary parsing, and related-context helpers are ready. User story UI work can now proceed without duplicating raw parsing in app surfaces.

---

## Phase 3: User Story 1 - Signal-First Dream Inspector (Priority: P1) 🎯 MVP

**Goal**: Deliver a session-adjacent Dream Inspector that makes active memory consolidation legible through overview, waiting/grounded/promoted organization, and clear loading/empty/disabled/unavailable states.

**Independent Test**: Open Dream Inspector from an active ClawFace session and confirm the user can understand dream availability, strongest or heating-up items, and lane distinctions without leaving the chat shell or reading raw memory files.

### Tests for User Story 1

- [ ] T011 [P] [US1] Extend `tests/shell-gateway-memory.test.mjs` to cover signal-first overview state shaping, disabled/unavailable handling, partial-data handling, and snapshot refresh metadata used by the Dream Inspector
- [ ] T012 [P] [US1] Extend `tests/dream-candidates.test.mjs` to cover grounded replay distinction, promoted grouping, and “why this is sticking” cue derivation based only on visible counts and phase hits

### Implementation for User Story 1

- [ ] T013 [US1] Create `src/hooks/useDreamInspectorController.ts` to own dream snapshot loading, capability checks, open lane, selected candidate, manual refresh state, and shell-facing Dream Inspector view-model shaping on top of the normalized dream helper seams
- [ ] T014 [P] [US1] Implement `src/components/dreams/DreamSignalOverview.tsx` for the signal-first summary, strongest/heating-up items, and top-level availability/status presentation
- [ ] T015 [P] [US1] Implement `src/components/dreams/DreamLaneList.tsx` for waiting, grounded, and promoted lane switching using `src/components/browser-shell/BrowserRootTabs.tsx` and `src/components/browser-shell/BrowserEmptyState.tsx` where appropriate
- [ ] T016 [US1] Implement `src/components/dreams/DreamInspectorPane.tsx` to compose overview, lane list, snapshot refresh affordance, and primary empty/disabled/unavailable/partial-data states in a session-adjacent inspector layout
- [ ] T017 [US1] Integrate Dream Inspector visibility and pane placement into `src/app.tsx` without extending `activeView`, passing current workspace/session context into the controller without moving gateway fetch or normalization logic into the root shell
- [ ] T018 [US1] Update `src/components/ChatView.tsx` to add a Dream Inspector entry point in the existing header action pattern without moving domain parsing into the component
- [ ] T019 [US1] Update `src/components/SessionSidebar.tsx` to add a shell-level Dreams shortcut alongside Files and Media while keeping dream data scoped as workspace-level context rather than per-session row state
- [ ] T020 [US1] Add Dream Inspector shell and pane styling in `src/styles.css` so the feature reads like a ClawFace workstation surface instead of a detached dashboard

**Checkpoint**: User Story 1 should now provide a usable signal-first Dream Inspector with current-API snapshot loading, lane organization, and explicit availability states.

---

## Phase 4: User Story 2 - Dream Diary and Evidence/Context Cross-Reference (Priority: P2)

**Goal**: Add candidate-first detail views that pair visible explanation cues with readable Dream Diary narrative and explicit relationship-limit handling.

**Independent Test**: Open a candidate from the Dream Inspector, confirm the detail flow is candidate-first, read associated diary context, and verify the UI clearly communicates when evidence mapping is limited.

### Tests for User Story 2

- [ ] T021 [P] [US2] Extend `tests/dream-diary.test.mjs` to cover direct diary-context matches from visible text overlap, parsed-entry navigation, and explicit limited-relationship fallback behavior
- [ ] T022 [P] [US2] Extend `tests/dream-candidates.test.mjs` to cover candidate explanation cue formatting for recall, grounded replay, and phase-hit context shown in the detail view

### Implementation for User Story 2

- [ ] T023 [P] [US2] Implement `src/components/dreams/DreamCandidateDetail.tsx` for candidate-first detail rendering, visible explanation cues, and relationship-limit copy
- [ ] T024 [P] [US2] Implement `src/components/dreams/DreamDiaryPanel.tsx` for parsed diary entry rendering, diary navigation, human-readable narrative presentation, and partial-data fallback copy when diary content is unavailable independently
- [ ] T025 [US2] Update `src/hooks/useDreamInspectorController.ts` to drive candidate selection, diary entry selection, and manual refresh behavior for detail views without introducing a live event-stream dependency
- [ ] T026 [US2] Update `src/components/dreams/DreamInspectorPane.tsx` to compose candidate detail and diary panels into the session-adjacent inspector flow
- [ ] T027 [US2] Update `src/hooks/useDreamInspectorController.ts` and `src/app.tsx` so diary refresh and snapshot refresh remain controller-owned and snapshot-based, with `src/app.tsx` limited to shell context handoff rather than fetch ownership

**Checkpoint**: User Story 2 should now let users drill into a candidate, understand why it is sticking using current signals, and read Dream Diary narrative as contextual evidence.

---

## Phase 5: User Story 3 - Optional Imported Insight / Memory Palace Linkage (Priority: P3)

**Goal**: Add on-demand imported-insight and memory-palace linkage when supported, plus lightweight detail polish that strengthens the Dream Inspector without bloating MVP.

**Independent Test**: Open a candidate detail view in a workspace with `memory-wiki` enabled and confirm related imported insights or memory palace pages load on demand; repeat in a workspace without `memory-wiki` and confirm the primary flow still works cleanly.

### Tests for User Story 3

- [ ] T028 [P] [US3] Extend `tests/shell-gateway-memory.test.mjs` to cover optional `wiki.importInsights` and `wiki.palace` availability, unsupported-method handling, and lazy-load gating
- [ ] T029 [P] [US3] Extend `tests/dream-related-context.test.mjs` to cover best-effort related-context matching, empty matches, and limited/unsupported states

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement `src/components/dreams/DreamRelatedContextPanel.tsx` for optional imported-insight and memory-palace linkage, including unsupported and limited-state treatment
- [ ] T031 [US3] Update `src/hooks/useDreamInspectorController.ts` to lazily load related context on candidate inspection and cache it for the current pane session
- [ ] T032 [US3] Update `src/components/dreams/DreamCandidateDetail.tsx`, `src/components/dreams/DreamInspectorPane.tsx`, and `src/app.tsx` to compose optional related context without blocking the primary Dream Inspector flow and to route imported-insight and memory-palace handoffs through an existing ClawFace adjacent-context navigation pattern
- [ ] T033 [US3] Apply lightweight detail polish in `src/styles.css` and any touched dream components so related context feels integrated with the existing ClawFace shell language rather than like an embedded backend wiki surface

**Checkpoint**: All three user stories should now work independently, with MVP value in US1 and US2, and optional OpenClaw-native related-memory linkage in US3.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, regression protection, and documentation follow-through that affect multiple stories.

- [ ] T034 [P] Update relevant product or architecture notes in `docs/` only if implementation materially changes shell ownership or inspector/navigation guidance
- [ ] T035 Run the automated validation set: `make test-unit`, `make typecheck`, `make build`
- [ ] T036 Run the targeted manual validation from `specs/002-dream-visibility/quickstart.md`, including dream visibility, diary reading, grounded replay distinction, and optional cross-link navigation
- [ ] T037 Verify existing chat shell, Files, Media, and tool activity flows still behave normally after Dream Inspector integration in `src/app.tsx`, `src/components/ChatView.tsx`, `src/components/SessionSidebar.tsx`, and `src/styles.css`

---

## Phase 7: Follow-Up (Future Gateway Seams, Not for MVP)

**Purpose**: Capture post-MVP work that would benefit from stronger OpenClaw gateway support without mixing it into the current implementation path.

- [ ] T038 [P] Draft a future normalized dream event journal contract in `specs/002-dream-visibility/contracts/future-dream-timeline.md` based on OpenClaw memory host event log concepts rather than raw file access from ClawFace
- [ ] T039 Document a future renderer-side timeline strategy in `specs/002-dream-visibility/research.md` or a follow-up artifact once a gateway seam for dream runs or event journals exists

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete
- **Follow-Up (Phase 7)**: Explicitly outside the MVP implementation path

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependency on other stories
- **User Story 2 (P2)**: Starts after Foundational, but practically depends on the US1 inspector shell existing
- **User Story 3 (P3)**: Starts after Foundational and is easiest once US2 detail flow exists

### Within Each User Story

- Helper-level tests should be written before or alongside the logic they protect
- Domain normalization and derivation helpers before controller behavior
- Controller behavior before shell/component composition
- Shell/component composition before final manual validation

### Parallel Opportunities

- `T004`, `T006`, `T008`, and `T010` can run in parallel with their corresponding helper seams once scaffolding exists
- `T014` and `T015` can run in parallel after the controller contract is settled
- `T021` and `T022` can run in parallel during the diary/detail pass
- `T028` and `T029` can run in parallel during the optional related-context pass
- `T034` can run in parallel with final validation if documentation changes are required

---

## Parallel Example: User Story 1

```bash
# After foundational seams are in place, these can proceed together:
Task: "Implement src/components/dreams/DreamSignalOverview.tsx"
Task: "Implement src/components/dreams/DreamLaneList.tsx"
Task: "Add focused overview and lane tests in tests/shell-gateway-memory.test.mjs and tests/dream-candidates.test.mjs"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the signal-first Dream Inspector independently
5. Complete Phase 4: User Story 2
6. Validate diary plus evidence/context cross-reference independently

### Incremental Delivery

1. Deliver the signal-first Dream Inspector first
2. Add candidate-first diary/context detail second
3. Add optional imported-insight and memory-palace linkage third
4. Finish with validation and regression follow-through

### Practical Guidance

- Do not add a new gateway event stream or timeline dependency for MVP
- Do not duplicate raw OpenClaw dream payload parsing inside `app.tsx`, `ChatView.tsx`, or `SessionSidebar.tsx`
- Prefer shell-facing helper seams and controller ownership over inline UI logic
- Keep future event-journal work explicitly separated from the main implementation path
