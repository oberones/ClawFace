# Tasks: Pixel-Art Session Avatar

**Input**: Design documents from `/specs/005-pixel-avatar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests are required by the feature spec for avatar state derivation. Visual/manual validation is required by quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase when files do not overlap
- **[Story]**: Which user story the task supports
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare static asset and style locations without changing runtime behavior.

- [X] T001 Create avatar static asset directory in `public/avatars/`
- [X] T002 [P] Add avatar implementation notes for sprite geometry and packaging in `public/avatars/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the state contract and default visual asset shape used by all user stories.

**Critical**: No user story work should begin until this phase is complete.

- [X] T003 Add default sprite sheet asset with all MVP state rows in `public/avatars/clawface-default.png`
- [X] T004 [P] Define exported `AvatarState`, `AvatarFinalOutcome`, and `AvatarSignalSnapshot` types in `src/lib/avatar-state.ts`
- [X] T005 [P] Define avatar labels and helper-safe constants for all MVP states in `src/lib/avatar-state.ts`

**Checkpoint**: Avatar types and asset location exist; user story implementation can begin.

---

## Phase 3: User Story 1 - See Active Session Runtime State At A Glance (Priority: P1) MVP

**Goal**: Show idle, thinking, streaming, tool-running, approval-needed, and disconnected/pairing states from existing active-session signals.

**Independent Test**: Drive or mock connected idle, thinking, streaming, tool-running, approval-needed, disconnected, and pairing-required states and verify the avatar state changes while existing explicit status UI remains visible.

### Tests for User Story 1

- [X] T006 [P] [US1] Add unit tests for idle, disconnected, pairing-required, approval-needed, tool-running, thinking, streaming, and idle fallback in `tests/avatar-state.test.mjs`
- [X] T007 [P] [US1] Add unit tests for priority ordering between disconnected, approval-needed, tool-running, thinking, streaming, and idle in `tests/avatar-state.test.mjs`

### Implementation for User Story 1

- [X] T008 [US1] Implement pure `deriveAvatarState` live-state priority logic in `src/lib/avatar-state.ts`
- [X] T009 [P] [US1] Create `AnimatedAvatar` component shell with `state`, `animationsEnabled`, and `className` props in `src/components/AnimatedAvatar.tsx`
- [X] T010 [US1] Render meaningful `aria-label` and `title` text from avatar state labels in `src/components/AnimatedAvatar.tsx`
- [X] T011 [US1] Add base avatar sprite, state, sizing, label, and pixelated rendering CSS near chat/sidebar status styles in `src/styles.css`
- [X] T012 [US1] Integrate `deriveAvatarState` and `AnimatedAvatar` into a lower-left status pane below Sessions in the app shell
- [X] T013 [US1] Build `AvatarSignalSnapshot` from existing app-shell connection status, pending approval, active tools, thinking, and stream text state in `src/hooks/useAvatarStatus.ts`
- [X] T014 [US1] Ensure existing gateway status, session runtime pill, approval banners, and tool activity UI remain visible and unchanged in `src/components/ChatView.tsx`

**Checkpoint**: User Story 1 is functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Understand Final Response Tone From Explicit Outcomes (Priority: P2)

**Goal**: Support conservative final-response states for success, serious, caution, and warning/blocked outcomes without classifying assistant text.

**Independent Test**: Mock completed responses with explicit success, serious, cautionary, blocked, denied, and error outcomes and verify the avatar selects only the corresponding explicit final-response state.

### Tests for User Story 2

- [X] T015 [P] [US2] Add unit tests for success, serious, caution, blocked, denied, error, and none final outcomes in `tests/avatar-state.test.mjs`
- [X] T016 [P] [US2] Add unit tests proving blocked, denied, and error final outcomes override success and normal moods in `tests/avatar-state.test.mjs`

### Implementation for User Story 2

- [X] T017 [US2] Extend `deriveAvatarState` final-outcome handling for success, serious, caution, blocked, denied, error, and none in `src/lib/avatar-state.ts`
- [X] T018 [US2] Add final-outcome state CSS classes and static frame positions in `src/styles.css`
- [X] T019 [US2] Wire only existing explicit or obvious local final-outcome signals into the avatar snapshot in `src/hooks/useAvatarStatus.ts`
- [X] T020 [US2] Implement transient final-state expiry and selected-session reset behavior in `src/hooks/useAvatarStatus.ts`
- [X] T021 [US2] Guard avatar status adaptation so assistant message text is never parsed for avatar mood in `src/hooks/useAvatarStatus.ts`

**Checkpoint**: Final-response presentation states work only from explicit local signals and do not affect live runtime priority.

---

## Phase 5: User Story 3 - Respect Reduced Motion And Animation Settings (Priority: P2)

**Goal**: Respect existing Enable UI animations behavior and `prefers-reduced-motion` while keeping every avatar state informative as a static frame.

**Independent Test**: Toggle Enable UI animations off and enable reduced motion; verify every avatar state renders a static recognizable frame with no looping animation.

### Tests for User Story 3

- [X] T022 [P] [US3] Add state label coverage for all avatar states in `tests/avatar-state.test.mjs`

### Implementation for User Story 3

- [X] T023 [US3] Ensure `AnimatedAvatar` uses CSS classes/data attributes only, with no timer or effect hooks, in `src/components/AnimatedAvatar.tsx`
- [X] T024 [US3] Apply `animationsEnabled` as a data attribute or class on the avatar root in `src/components/AnimatedAvatar.tsx`
- [X] T025 [US3] Add CSS `steps()` sprite animations for animated states in `src/styles.css`
- [X] T026 [US3] Add `[data-animations-off]` and component static-mode CSS rules that disable avatar loops in `src/styles.css`
- [X] T027 [US3] Add `@media (prefers-reduced-motion: reduce)` avatar overrides that force static frames in `src/styles.css`
- [X] T028 [US3] Pass existing `uiSettings.enableAnimations` into `AvatarStatusPane` from `src/app.tsx`

**Checkpoint**: Avatar motion follows existing app animation settings and reduced-motion behavior.

---

## Phase 6: User Story 4 - Preserve A Small Desktop-Native Companion Surface (Priority: P3)

**Goal**: Keep the avatar tasteful, lower-left, and non-blocking across light/dark themes and supported desktop widths.

**Independent Test**: View normal chat, streaming, tool output, approvals, disconnected states, and narrow desktop widths; verify the avatar stays below Sessions or collapses without covering controls.

### Implementation for User Story 4

- [X] T029 [US4] Tune lower-left avatar pane spacing, fixed dimensions, and non-shrinking behavior in `src/styles.css`
- [X] T030 [US4] Add responsive collapse or scale rules for constrained desktop widths in `src/styles.css`
- [X] T031 [US4] Verify avatar markup places the pane below `SessionSidebar` in the app shell
- [X] T032 [US4] Add light and dark theme-safe border/background styling using existing CSS tokens in `src/styles.css`

**Checkpoint**: Avatar placement and responsive behavior satisfy the clarified lower-left pane requirement.

---

## Phase 7: User Story 5 - Keep The Feature Future-Friendly Without Expanding MVP Scope (Priority: P3)

**Goal**: Preserve clean seams for later skins or OpenClaw-provided metadata without adding v1 marketplace/editor/backend scope.

**Independent Test**: Review helper, component, CSS, and docs to confirm state resolution, rendering assets, and placement are separable and no new backend contract exists.

### Implementation for User Story 5

- [X] T033 [US5] Keep avatar profile constants separate from state derivation logic in `src/components/AnimatedAvatar.tsx`
- [X] T034 [US5] Add concise comments documenting future optional profile/metadata extension points in `src/lib/avatar-state.ts`
- [X] T035 [US5] Confirm no new OpenClaw request, gateway protocol, or Electron IPC contract is introduced in `src/components/ChatView.tsx`

**Checkpoint**: Feature remains future-friendly without expanding MVP scope.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, manual regression, and cleanup across all user stories.

- [X] T036 [P] Run `make test-unit` and fix avatar-related failures in `src/lib/avatar-state.ts`, `src/components/AnimatedAvatar.tsx`, or `tests/avatar-state.test.mjs`
- [X] T037 [P] Run `make typecheck` and fix TypeScript errors in `src/lib/avatar-state.ts`, `src/components/AnimatedAvatar.tsx`, or `src/components/ChatView.tsx`
- [X] T038 Run `make build` and fix packaging or Vite asset issues involving `public/avatars/clawface-default.png`
- [ ] T039 Execute the manual regression checklist in `specs/005-pixel-avatar/quickstart.md`
- [X] T040 [P] Remove any unused imports, dead CSS, or speculative avatar-skin code from `src/components/AnimatedAvatar.tsx`, `src/lib/avatar-state.ts`, and `src/styles.css`
- [X] T041 [P] Update `specs/005-pixel-avatar/quickstart.md` if implementation changes the asset filename, state labels, or manual validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers MVP
- **User Story 2 (Phase 4)**: Depends on User Story 1 helper/component foundation
- **User Story 3 (Phase 5)**: Depends on User Story 1 component and CSS foundation
- **User Story 4 (Phase 6)**: Depends on User Story 1 header integration
- **User Story 5 (Phase 7)**: Depends on User Stories 1-4 enough to review final seams
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: First implementable story after Foundational; recommended MVP
- **US2 (P2)**: Uses `deriveAvatarState` and `AnimatedAvatar` from US1
- **US3 (P2)**: Uses `AnimatedAvatar` and CSS from US1
- **US4 (P3)**: Uses the lower-left pane placement from US1
- **US5 (P3)**: Cross-checks the completed implementation boundaries

### Within Each User Story

- Write listed tests before implementation tasks when tests are present
- Implement pure helper behavior before component or header integration
- Implement CSS before final visual/manual verification
- Keep `ChatView.tsx` changes limited to snapshot assembly and rendering

---

## Parallel Opportunities

- T002 can run in parallel with T001 after deciding the asset directory name.
- T004 and T005 both touch `src/lib/avatar-state.ts`; do T004 before T005 unless one owner coordinates the file.
- T006 and T007 can be authored together before T008.
- T009 can begin while T008 is implemented because it depends only on exported types from T004.
- T015 and T016 can be authored together before T017.
- T022 and T023 can run in parallel because they touch different concerns.
- T029, T030, and T032 all touch `src/styles.css`; do not run them in parallel unless one owner coordinates the CSS edits.
- T036 and T037 can run in parallel after implementation, while T038 should follow once both pass.

## Parallel Example: User Story 1

```text
Task: "Add unit tests for idle, disconnected, pairing-required, approval-needed, tool-running, thinking, streaming, and idle fallback in tests/avatar-state.test.mjs"
Task: "Create AnimatedAvatar component shell with state, animationsEnabled, and className props in src/components/AnimatedAvatar.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Add unit tests for success, serious, caution, blocked, denied, error, and none final outcomes in tests/avatar-state.test.mjs"
Task: "Add unit tests proving blocked, denied, and error final outcomes override success and normal moods in tests/avatar-state.test.mjs"
```

## Parallel Example: User Story 3

```text
Task: "Add state label coverage for all avatar states in tests/avatar-state.test.mjs"
Task: "Ensure AnimatedAvatar uses CSS classes/data attributes only, with no timer or effect hooks, in src/components/AnimatedAvatar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Run `make test-unit`, `make typecheck`, and a focused manual check of idle, thinking, streaming, tool-running, approval-needed, and disconnected states
5. Stop and demo if only MVP behavior is desired

### Incremental Delivery

1. Add US1 for live runtime state
2. Add US2 for conservative final-response states
3. Add US3 for complete animation/reduced-motion handling
4. Add US4 for final placement/responsive polish
5. Add US5 for boundary/future-readiness review
6. Run full validation and quickstart manual regression

### Parallel Team Strategy

1. One developer owns `src/lib/avatar-state.ts` and `tests/avatar-state.test.mjs`
2. One developer owns `src/components/AnimatedAvatar.tsx` and `public/avatars/`
3. One developer owns `src/styles.css`
4. One developer owns minimal `src/app.tsx` shell integration after helper/component APIs settle

## Notes

- Every task should preserve explicit existing status, approval, connection, and tool activity UI.
- Do not add new runtime dependencies.
- Do not add new OpenClaw backend or Electron IPC contracts.
- Do not inspect assistant response text to determine avatar mood.
- Keep avatar logic out of `src/app.tsx` beyond thin shell wiring; use a focused hook for signal adaptation.
