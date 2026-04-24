# Tasks: Dream Diary Timeline

**Input**: Design documents from `/specs/004-diary-timeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include focused helper-level tests for diary parsing, timeline grouping, selection defaults, freshness handling, and availability states. Manual desktop validation is required because this refactor changes the primary Dreams surface.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files do not overlap
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the lean diary-first refactor without preserving the old dream dashboard as a compatibility layer.

- [x] T001 Inventory current dream imports and active rendering paths in `src/app.tsx`, `src/components/dreams/`, `src/hooks/`, `src/lib/`, and `tests/` so implementation can replace the primary Dreams flow cleanly
- [x] T002 Create the diary timeline scaffolding files `src/lib/dream-diary-timeline.ts`, `src/hooks/useDreamDiaryTimelineController.ts`, `src/components/dreams/DreamDiaryTimelinePane.tsx`, `src/components/dreams/DreamDiaryTimelineList.tsx`, `src/components/dreams/DreamDiaryReader.tsx`, and `src/components/dreams/DreamDiaryTimelineEmptyState.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish diary-only data derivation and controller boundaries before replacing the visible Dreams surface.

**CRITICAL**: No user story UI work should begin until this phase is complete.

- [x] T003 [P] Extend `tests/dream-diary.test.mjs` to cover parser metadata needed by a diary-only surface, including dated entries, heading-only entries, document-level fallback content, and no invented dates from `updatedAtMs`
- [x] T004 Update `src/lib/dream-diary.ts` to expose minimal diary parse metadata such as entry kind or parse status while preserving current readable entry output
- [x] T005 [P] Add focused timeline derivation coverage in `tests/dream-diary-timeline.test.mjs` for entry grouping, newest-first ordering, same-date stable ordering, limited fallback grouping, and future `DiaryEntryAttachment` shape staying entry-scoped
- [x] T006 Implement `src/lib/dream-diary-timeline.ts` to derive `DreamDiaryTimelineSnapshot`, `DiaryTimelineEntry`, `DiaryTimelineGroup`, latest-entry defaults, freshness metadata, and entry-scoped future attachment types from parsed diary data
- [x] T007 Implement `src/hooks/useDreamDiaryTimelineController.ts` to own diary loading, optional status loading for disabled context, manual refresh, selected entry state, latest-entry selection, and shell-facing view-model shaping
- [x] T008 [P] Review `src/lib/shell-gateway-memory.ts` and `tests/shell-gateway-memory.test.mjs`, then either add diary-source normalization coverage for changed behavior or record in `tasks.md` that no normalization change was made

Note: No normalization behavior changed in `src/lib/shell-gateway-memory.ts`; existing `normalizeDoctorMemoryDreamDiary` coverage remains sufficient for this slice.

**Checkpoint**: Diary parsing, grouping, availability derivation, and controller ownership are ready. User story work can replace the dream UI without duplicating gateway parsing in components.

---

## Phase 3: User Story 1 - Read The Dream Diary As A Timeline (Priority: P1) MVP

**Goal**: Opening Dreams shows an interactive Dream Diary timeline and focused reader, not signal cards, memory lanes, candidate detail, or graph/dashboard-style dream UI.

**Independent Test**: Open Dreams in a workspace with diary content and confirm the user can select a diary timeline entry and read it as the primary content.

### Tests for User Story 1

- [x] T009 [P] [US1] Extend `tests/dream-diary-timeline.test.mjs` to cover the ready-state MVP model for multiple diary entries, selected entry defaults, and reader-ready paragraph output

### Implementation for User Story 1

- [x] T010 [P] [US1] Implement `src/components/dreams/DreamDiaryTimelineList.tsx` to render grouped diary entries with visible selected-entry state and no candidate or signal terminology
- [x] T011 [P] [US1] Implement `src/components/dreams/DreamDiaryReader.tsx` to render the selected diary entry with readable typography, date or limited labels, and diary text as the primary content
- [x] T012 [US1] Implement `src/components/dreams/DreamDiaryTimelinePane.tsx` to compose header, timeline list, focused reader, refresh action, and close action as the replacement Dreams pane
- [x] T013 [US1] Replace `DreamInspectorPane` and `useDreamInspectorController` usage in `src/app.tsx` with `DreamDiaryTimelinePane` and `useDreamDiaryTimelineController`, keeping `src/app.tsx` responsible only for pane visibility and context handoff
- [x] T014 [US1] Update `src/components/ChatView.tsx` and `src/components/SessionSidebar.tsx` labels or prop names only where useful so the Dreams entry point opens the diary-first pane without leaking old inspector wording into the UI
- [x] T015 [US1] Remove the previous dashboard-first dream UI from the active flow by deleting or disconnecting obsolete imports for `DreamSignalOverview`, `DreamLaneList`, `DreamCandidateDetail`, `DreamTimelinePanel`, `DreamCandidateTimeline`, and `DreamRelatedContextPanel` in `src/components/dreams/`
- [x] T016 [US1] Add diary timeline and reader styling in `src/styles.css`, pruning obsolete dream-dashboard CSS once the old components are no longer rendered

**Checkpoint**: User Story 1 should provide the product MVP: Dreams opens directly into a readable interactive diary timeline.

---

## Phase 4: User Story 2 - Move Through Diary Entries Efficiently (Priority: P2)

**Goal**: Users can browse older entries, keep orientation, refresh the diary snapshot, and jump back to the latest entry.

**Independent Test**: Open a diary with several entries, select an older entry, refresh, and return to the latest entry while always knowing which entry is selected.

### Tests for User Story 2

- [x] T017 [P] [US2] Extend `tests/dream-diary-timeline.test.mjs` to cover latest-entry selection for dated, heading-only, and undated entries, `canReturnToLatest`, same-date ordering, and selected-entry preservation across unchanged refreshes

### Implementation for User Story 2

- [x] T018 [US2] Update `src/hooks/useDreamDiaryTimelineController.ts` to preserve selected diary entry when still present after refresh and fall back to the latest readable entry when it disappears
- [x] T019 [US2] Update `src/components/dreams/DreamDiaryTimelinePane.tsx` to expose refresh state and a latest-entry affordance without implying live event-stream behavior
- [x] T020 [P] [US2] Update `src/components/dreams/DreamDiaryTimelineList.tsx` to make date grouping, selected state, and same-date entry ordering easy to scan
- [x] T021 [P] [US2] Update `src/components/dreams/DreamDiaryReader.tsx` to keep heading/date/source context readable while maintaining comfortable diary text line length
- [x] T022 [US2] Refine `src/styles.css` for compact workstation-reader behavior across normal desktop widths and narrower sidebar/pane combinations

**Checkpoint**: User Story 2 should make diary browsing feel like a usable journal rather than a static document dump.

---

## Phase 5: User Story 3 - Understand Diary Availability And Limits (Priority: P3)

**Goal**: The diary-first Dreams surface clearly explains loading, empty, disabled, unavailable, and limited-parse states while still allowing stale readable diary content when dreaming is disabled.

**Independent Test**: Open Dreams against empty, disabled, unavailable, and partly parseable diary cases and confirm each state is distinct and avoids backend-admin language.

### Tests for User Story 3

- [x] T023 [P] [US3] Extend `tests/dream-diary-timeline.test.mjs` to cover empty, disabled with readable content, disabled with no content, unavailable diary fetch, and limited-parse fallback states
- [x] T024 [P] [US3] Extend `tests/dream-diary.test.mjs` to cover diary error normalization and parser behavior when `doctor.memory.dreamDiary` content is unavailable but optional status data is still available to the controller

### Implementation for User Story 3

- [x] T025 [P] [US3] Implement `src/components/dreams/DreamDiaryTimelineEmptyState.tsx` for loading, empty, disabled-without-readable-content, unavailable, and limited states using existing `BrowserEmptyState` patterns where appropriate
- [x] T026 [US3] Update `src/hooks/useDreamDiaryTimelineController.ts` to map gateway disconnected, unsupported diary method, diary fetch failure, empty content, disabled status, and limited parsing into distinct user-facing states
- [x] T027 [US3] Update `src/components/dreams/DreamDiaryTimelinePane.tsx` and `src/components/dreams/DreamDiaryReader.tsx` so disabled-with-readable-content renders the normal diary timeline and reader with a visible disabled note instead of replacing content with an empty state
- [x] T028 [US3] Audit dream-facing copy in `src/components/dreams/` and `src/hooks/useDreamDiaryTimelineController.ts` to remove raw backend method names, filesystem paths as primary UX, score terminology, and old candidate-dashboard language

**Checkpoint**: All diary availability states should be understandable without restoring the old dream dashboard.

---

## Phase 6: Cleanup & Cross-Cutting Concerns

**Purpose**: Remove obsolete code paths, preserve future extension shape, and validate the refactor end to end.

- [x] T029 Delete obsolete dream dashboard files after replacement once import checks confirm they are unused, including `src/components/dreams/DreamInspectorPane.tsx`, `src/components/dreams/DreamSignalOverview.tsx`, `src/components/dreams/DreamLaneList.tsx`, `src/components/dreams/DreamCandidateDetail.tsx`, `src/components/dreams/DreamTimelinePanel.tsx`, `src/components/dreams/DreamTimelineEventGroup.tsx`, `src/components/dreams/DreamTimelineEmptyState.tsx`, `src/components/dreams/DreamCandidateTimeline.tsx`, and `src/components/dreams/DreamRelatedContextPanel.tsx`
- [x] T030 Delete obsolete candidate/timeline helper and hook files after replacement if no imports remain, including `src/hooks/useDreamInspectorController.ts`, `src/hooks/useDreamTimelineController.ts`, `src/lib/dream-candidates.ts`, `src/lib/dream-related-context.ts`, `src/lib/dream-timeline.ts`, and `src/lib/dream-timeline-links.ts`
- [x] T031 Remove or rewrite obsolete tests that only protect the removed dashboard behavior, including `tests/dream-candidates.test.mjs`, `tests/dream-related-context.test.mjs`, `tests/dream-timeline.test.mjs`, and `tests/dream-timeline-links.test.mjs`
- [x] T032 [P] Update `docs/ARCHITECTURE.md` to describe the diary-first Dreams surface, the current OpenClaw boundary, and future entry-scoped Imported Insights / Memory Palace attachment direction
- [x] T033 Update `specs/004-diary-timeline/quickstart.md` after implementation so the manual validation flow matches the final diary timeline UI
- [x] T034 Run `make test-unit` in `/Users/oberon/.openclaw/workspace/ClawFace`
- [x] T035 Run `make typecheck` in `/Users/oberon/.openclaw/workspace/ClawFace`
- [x] T036 Run `make build` in `/Users/oberon/.openclaw/workspace/ClawFace`
- [ ] T037 Run the targeted manual desktop validation from `specs/004-diary-timeline/quickstart.md`, including diary reading, timeline selection, latest-entry navigation, refresh, limited parse, disabled, empty, and unavailable states
- [ ] T038 Verify chat shell, session sidebar, Files, Media, and tool activity flows still behave normally after replacing the Dreams pane in `src/app.tsx`, `src/components/ChatView.tsx`, `src/components/SessionSidebar.tsx`, and `src/styles.css`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion and is the MVP
- **User Story 2 (Phase 4)**: Depends on the US1 pane/list/reader existing
- **User Story 3 (Phase 5)**: Depends on the controller and pane from US1, but state tests can begin after Foundational
- **Cleanup (Phase 6)**: Depends on the replacement flow being wired and validated enough to reveal unused files

### User Story Dependencies

- **US1**: Can ship independently as the MVP diary reader
- **US2**: Adds browsing efficiency on top of the MVP
- **US3**: Adds full state honesty and can be implemented after US1 or alongside US2 once the controller contract is stable

### Within Each User Story

- Helper tests before helper implementation
- Controller state before pane composition
- List and reader components before app integration
- App integration before deleting obsolete dashboard files
- Automated validation before manual desktop verification

### Parallel Opportunities

- `T003`, `T005`, and `T008` can run in parallel once scaffolding exists
- `T010` and `T011` can run in parallel after the timeline view model is defined
- `T020` and `T021` can run in parallel during the navigation pass
- `T023`, `T024`, and `T025` can run in parallel during state handling
- `T032` and `T033` can run in parallel with final cleanup once implementation behavior is settled

---

## Parallel Example: User Story 1

```bash
# After src/lib/dream-diary-timeline.ts and useDreamDiaryTimelineController.ts are in place:
Task: "Implement src/components/dreams/DreamDiaryTimelineList.tsx"
Task: "Implement src/components/dreams/DreamDiaryReader.tsx"
Task: "Extend tests/dream-diary-timeline.test.mjs for the ready-state MVP model"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate that Dreams opens directly into diary reading.

### Incremental Delivery

1. Deliver the diary timeline and focused reader.
2. Add efficient navigation, latest-entry behavior, and refresh preservation.
3. Add full state handling for empty, disabled, unavailable, and limited cases.
4. Remove obsolete dashboard files and run full validation.

### Practical Guidance

- Do not preserve old dream dashboard surfaces for backward compatibility.
- Do not require new OpenClaw gateway methods or filesystem reads.
- Do not reintroduce candidate-first Imported Insights or Memory Palace panels in MVP.
- Keep future related-memory support entry-scoped through `DiaryEntryAttachment`-style data.
- Keep `src/app.tsx` and `src/components/ChatView.tsx` focused on opening and closing Dreams, not diary parsing or loading.
