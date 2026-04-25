# Tasks: Selectable Avatar Styles

**Input**: Design documents from `/specs/006-selectable-avatar-styles/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Focused unit tests are required by the feature spec for avatar profile normalization, registry completeness, and state behavior remaining independent from selected profile. Manual visual validation is required by quickstart.md.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase when files do not overlap
- **[Story]**: Which user story the task supports
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the selectable-profile implementation boundary without changing live avatar behavior.

- [X] T001 Create `src/lib/avatar-profile.ts` with `AvatarProfileId`, `AvatarProfile`, `DEFAULT_AVATAR_PROFILE_ID`, `AVATAR_PROFILES`, `normalizeAvatarProfileId`, and `getAvatarProfile`
- [X] T002 [P] Add profile asset and geometry notes for all bundled avatars in `public/avatars/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared profile/settings model that all selectable-avatar stories depend on.

**Critical**: No user story work should begin until this phase is complete.

- [X] T003 [P] Add unit tests for profile registry size, unique ids, default profile presence, shared geometry, and bundled asset paths in `tests/avatar-profile.test.mjs`
- [X] T004 [P] Add unit tests for invalid, missing, empty, and valid avatar profile id normalization in `tests/avatar-profile.test.mjs`
- [X] T005 Add `avatarProfileId` to `UiSettings` and `DEFAULT_UI_SETTINGS` in `src/lib/ui-settings.ts`
- [X] T006 Update `parseUiSettings` in `src/app.tsx` to normalize `avatarProfileId` through `normalizeAvatarProfileId`
- [X] T007 Update existing UI settings scheme load/apply behavior in `src/app.tsx` only as needed so saved schemes normalize avatar profile ids through the same parser

**Checkpoint**: The app can store and normalize a selected avatar profile id, but the live avatar can still render the default profile.

---

## Phase 3: User Story 1 - Choose An Avatar Style In Settings (Priority: P1) MVP

**Goal**: Let users choose exactly one of three bundled avatar styles from thumbnail previews in Settings and immediately update the lower-left avatar pane.

**Independent Test**: Open Settings, choose each thumbnail option, close and reopen Settings, and verify the lower-left avatar pane uses the selected artwork without moving or resetting the current avatar state.

### Tests for User Story 1

- [X] T008 [P] [US1] Add profile lookup test coverage proving `getAvatarProfile` returns the selected valid profile and falls back to default for unknown values in `tests/avatar-profile.test.mjs`

### Implementation for User Story 1

- [X] T009 [US1] Update `src/components/AnimatedAvatar.tsx` to accept an `AvatarProfile` prop and set `--avatar-image` from `profile.spriteSrc`
- [X] T010 [US1] Update `src/components/AvatarStatusPane.tsx` to accept and pass an `AvatarProfile` without changing status copy or state derivation
- [X] T011 [US1] Resolve the selected profile with `getAvatarProfile(uiSettings.avatarProfileId)` in `src/app.tsx` and pass it to `AvatarStatusPane`
- [X] T012 [P] [US1] Create `src/components/settings-sections/AvatarStyleSection.tsx` with exactly three selectable thumbnail options sourced from `AVATAR_PROFILES`
- [X] T013 [US1] Mount `AvatarStyleSection` from `src/components/SettingsModal.tsx` using the existing `patch({ avatarProfileId })` settings flow
- [X] T014 [US1] Add selected, hover, focus, and thumbnail layout styles for the avatar selector in `src/styles.css`
- [ ] T015 [US1] After T032-T034 are complete, verify selecting each profile updates the live lower-left avatar pane within one second and persists after Settings is reopened

**Checkpoint**: User Story 1 is functional and testable as the MVP.

---

## Phase 4: User Story 2 - Preserve Existing Avatar Behavior Across Styles (Priority: P1)

**Goal**: Ensure style selection changes artwork only; all avatar states, priorities, animation behavior, reduced-motion behavior, labels, and pane dimensions stay shared.

**Independent Test**: For each avatar style, drive idle, thinking, streaming, tool-running, success, serious, caution, warning, approval-needed, and disconnected states and verify the same state priority and motion rules as the default avatar.

### Tests for User Story 2

- [X] T016 [P] [US2] Add or extend tests proving avatar state derivation does not accept or depend on avatar profile id in `tests/avatar-state.test.mjs`
- [X] T017 [P] [US2] Add unit coverage that every profile can be paired with every exported `AvatarState` without missing labels or geometry metadata in `tests/avatar-profile.test.mjs`

### Implementation for User Story 2

- [X] T018 [US2] Keep `FRAME_COUNTS`, animated-state selection, ARIA status label, and `data-avatar-state` behavior profile-independent in `src/components/AnimatedAvatar.tsx`
- [X] T019 [US2] Ensure avatar selector thumbnails render static representative frames without requiring CSS animation in `src/components/settings-sections/AvatarStyleSection.tsx`
- [X] T020 [US2] Update `src/styles.css` only as needed so all profiles use the existing `.animated-avatar` row mapping, `steps()` playback, `[data-animations-off]`, and `prefers-reduced-motion` rules
- [ ] T021 [US2] Manually verify animations enabled, UI animations disabled, and OS/browser reduced-motion behavior for all three profiles

**Checkpoint**: All three profiles communicate the same runtime and final-response states with shared behavior.

---

## Phase 5: User Story 3 - Keep Avatar Choice A Small Desktop-Native Preference (Priority: P2)

**Goal**: Keep the Settings selector compact, thumbnail-based, accessible, and free of editor, upload, download, marketplace, account, or backend concepts.

**Independent Test**: Review the Settings UI and confirm it presents exactly three bundled thumbnail choices with accessible labels and no new controls in the live avatar pane.

### Implementation for User Story 3

- [X] T022 [US3] Place `AvatarStyleSection` near existing UI personalization controls in `src/components/SettingsModal.tsx` without expanding `SettingsModal` with profile-specific logic
- [X] T023 [US3] Add accessible names, selected-state indication, keyboard-operable controls, and concise descriptions in `src/components/settings-sections/AvatarStyleSection.tsx`
- [X] T024 [US3] Tune light/dark theme selector styling, compact grid behavior, and text fitting in `src/styles.css`
- [X] T025 [US3] Confirm no avatar editor, upload, marketplace, downloadable skin, account sync, backend setting, or Electron IPC affordance appears in `src/components/settings-sections/AvatarStyleSection.tsx`
- [X] T026 [US3] Confirm the live `AvatarStatusPane` in `src/components/AvatarStatusPane.tsx` gains no selection controls and keeps the existing lower-left placement below Sessions

**Checkpoint**: Avatar choice behaves like a small desktop-native preference rather than a new customization product surface.

---

## Phase 6: User Story 4 - Keep Future Style Expansion Maintainable (Priority: P3)

**Goal**: Make future bundled styles or optional OpenClaw-provided metadata possible without duplicating state logic or increasing known hotspot load.

**Independent Test**: Review the implementation and verify adding a fourth bundled profile would require adding a profile entry and sprite asset, not changing state derivation or chat/session runtime logic.

### Implementation for User Story 4

- [X] T027 [US4] Keep profile registration, profile lookup, fallback behavior, and asset metadata centralized in `src/lib/avatar-profile.ts`
- [X] T028 [US4] Ensure `src/components/AnimatedAvatar.tsx` and `src/components/settings-sections/AvatarStyleSection.tsx` render from `AvatarProfile` data rather than hard-coded profile conditionals
- [X] T029 [US4] Confirm `src/components/ChatView.tsx` is not modified for avatar style selection
- [X] T030 [US4] Confirm `src/app.tsx` changes are limited to settings normalization, selected profile lookup, and thin prop passing
- [X] T031 [US4] Add concise future-extension notes in `src/lib/avatar-profile.ts` only if helpful for later bundled skins or optional metadata

**Checkpoint**: The profile boundary is data-driven and does not fork avatar state behavior.

---

## Phase 7: Bundled Asset Generation

**Purpose**: Generate and package the two new creative avatar styles required by the feature.

- [X] T032 [P] Generate `public/avatars/clawface-neon-console.png` as a 4-column by 10-row pixel-art sprite sheet with the same state row order as `clawface-default.png`
- [X] T033 [P] Generate `public/avatars/clawface-prism-node.png` as a 4-column by 10-row pixel-art sprite sheet with the same state row order as `clawface-default.png`
- [X] T034 Verify both new sprite sheets are visually distinct from the default and from each other at the live pane size and collapsed sidebar size
- [X] T035 Update `public/avatars/README.md` with the two new filenames, profile names, geometry, state row order, and packaged-asset expectations
- [X] T036 Confirm implementation-time image generation does not add any runtime animation or image-generation dependency to `package.json`

**Checkpoint**: All required avatar images exist as bundled static assets.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, manual regression, and cleanup across all user stories.

- [X] T037 [P] Run `make test-unit` and fix failures in `src/lib/avatar-profile.ts`, `src/lib/avatar-state.ts`, or `tests/avatar-profile.test.mjs`
- [X] T038 [P] Run `make typecheck` and fix TypeScript errors in `src/lib/avatar-profile.ts`, `src/lib/ui-settings.ts`, `src/components/AnimatedAvatar.tsx`, `src/components/AvatarStatusPane.tsx`, `src/components/settings-sections/AvatarStyleSection.tsx`, `src/components/SettingsModal.tsx`, or `src/app.tsx`
- [X] T039 Run `make build` and fix Vite/Electron packaged asset issues involving `public/avatars/*.png`
- [ ] T040 Execute the manual regression checklist in `specs/006-selectable-avatar-styles/quickstart.md`
- [ ] T041 [US3] Define and manually verify sprite load failure behavior so `AvatarStatusPane` keeps accessible status text and either falls back to the default profile or remains non-blocking when a selected sprite cannot load
- [X] T042 [P] Remove unused imports, dead CSS, speculative marketplace/editor code, or profile-specific state branches from changed source files
- [X] T043 [P] Review docs in `specs/006-selectable-avatar-styles/` and update them if implementation changes filenames, profile names, geometry, or validation steps
- [ ] T044 Prepare implementation commit with Conventional Commit format, for example `feat(avatar): add selectable avatar styles`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP selector and live pane update
- **US2 (Phase 4)**: Depends on US1 component/profile wiring
- **US3 (Phase 5)**: Depends on US1 selector UI
- **US4 (Phase 6)**: Can run after US1 wiring is present; final review depends on US2 and US3
- **Bundled Assets (Phase 7)**: Can begin after profile filenames are chosen in Setup; T032-T034 must complete before final US1 visual verification in T015
- **Polish (Phase 8)**: Depends on selected user stories and assets being complete

### User Story Dependencies

- **US1 (P1)**: First implementable story after Foundational; required for the feature to be useful
- **US2 (P1)**: Uses the US1 profile plumbing to verify behavior stays shared across styles
- **US3 (P2)**: Uses the US1 Settings section and ensures it remains compact and accessible
- **US4 (P3)**: Reviews and tightens the profile boundary after core implementation exists

### Within Each User Story

- Write listed tests before implementation tasks when tests are present
- Add settings persistence before Settings UI wiring
- Add profile-aware rendering before live app shell integration
- Generate assets before final visual validation
- Keep `ChatView.tsx` unchanged unless a blocker is documented and the plan is revised

## Parallel Opportunities

- T002 can run in parallel with T001.
- T003 and T004 can be authored in parallel with T005 because they touch different files.
- T009 and T012 can start in parallel after `AvatarProfile` types exist.
- T016 and T017 can run in parallel because they cover different test files/concerns.
- T022 and T023 both touch `AvatarStyleSection`; do not run them in parallel unless one owner coordinates that file.
- T032 and T033 can run in parallel because they produce separate image files.
- T037 and T038 can run in parallel after implementation, while T039 should follow once typecheck and unit tests pass.

## Parallel Example: User Story 1

```text
Task: "Update src/components/AnimatedAvatar.tsx to accept an AvatarProfile prop and set --avatar-image from profile.spriteSrc"
Task: "Create src/components/settings-sections/AvatarStyleSection.tsx with exactly three selectable thumbnail options sourced from AVATAR_PROFILES"
```

## Parallel Example: Bundled Assets

```text
Task: "Generate public/avatars/clawface-neon-console.png as a 4-column by 10-row pixel-art sprite sheet"
Task: "Generate public/avatars/clawface-prism-node.png as a 4-column by 10-row pixel-art sprite sheet"
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete the profile registry, Settings selector, and live pane wiring from User Story 1.
3. Generate the two sprite sheets, verify thumbnails render, and complete T015.
4. Run `make test-unit` and a focused manual check for selecting all three styles.

### Incremental Delivery

1. Add profile registry and persisted selected profile.
2. Add Settings selector and live pane integration.
3. Add new bundled assets and thumbnail styling.
4. Verify all shared states and motion modes across profiles.
5. Tighten accessibility, compact Settings layout, and future-ready boundaries.
6. Run full validation and manual regression.

### Parallel Team Strategy

1. One developer owns `src/lib/avatar-profile.ts`, `src/lib/ui-settings.ts`, `src/app.tsx`, and `tests/avatar-profile.test.mjs`.
2. One developer owns `src/components/AnimatedAvatar.tsx`, `src/components/AvatarStatusPane.tsx`, and shared avatar rendering CSS.
3. One developer owns `src/components/settings-sections/AvatarStyleSection.tsx`, `src/components/SettingsModal.tsx`, and selector CSS.
4. One developer owns `public/avatars/*.png` generation and `public/avatars/README.md`.

## Notes

- All commits for this work must use Conventional Commit format.
- Do not add runtime animation dependencies.
- Do not add backend, gateway protocol, Electron IPC, marketplace, upload, or account-sync scope.
- Do not parse assistant response text for avatar mood.
- Keep avatar state priority in `src/lib/avatar-state.ts`; keep profile selection in `src/lib/avatar-profile.ts`.
