# Tasks: Media Browser

**Input**: Design documents from `/specs/001-media-browser/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include focused helper-level tests for new normalization, source-adapter, and reference-insertion seams. Manual desktop validation is also required because this feature depends on renderer/media/runtime behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature scaffolding and the shared browser-shell seams the media browser will rely on.

- [X] T001 Create media browser scaffolding in `src/components/media-browser/`, `src/hooks/`, and `src/lib/` for the planned files in `/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/plan.md`
- [X] T002 [P] Extract shared browser-shell presentation primitives from `src/components/FileManager.tsx` into `src/components/browser-shell/BrowserShellLayout.tsx`, `src/components/browser-shell/BrowserRootTabs.tsx`, `src/components/browser-shell/BrowserBreadcrumbs.tsx`, and `src/components/browser-shell/BrowserEmptyState.tsx`
- [X] T003 Update `src/components/FileManager.tsx` to consume the shared browser-shell presentation pieces without changing existing filesystem behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the media-browser-specific state/model seams before any user story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Create `src/lib/media-browser-items.ts` with shared types and pure helpers for `MediaArtifact`, `MediaSourceRoot`, browser filtering, sorting, and stable dedupe keys
- [X] T005 [P] Add focused regression coverage for `src/lib/media-browser-items.ts` in `tests/media-browser-items.test.mjs`
- [X] T006 Create `src/lib/media-browser-sources.ts` to adapt normalized `sessions.list` / `sessions.preview` rows plus explicitly loaded or preloaded `chat.history` data into source-first media roots and browser-visible artifacts using `src/lib/shell-gateway-responses.ts`, `src/lib/shell-gateway-history.ts`, `src/lib/chat-message-attachments.ts`, and `src/lib/message-image-source.ts`
- [X] T007 [P] Add focused regression coverage for `src/lib/media-browser-sources.ts` in `tests/media-browser-sources.test.mjs`
- [X] T007A [P] Add focused remote-portability regression coverage in `tests/media-browser-sources.test.mjs` for remote-only image artifacts, portable render references, and host-path avoidance
- [ ] T008 Create `src/hooks/useMediaBrowserController.ts` to own selected source, selected artifact, filter/sort state, preview state, and reuse state without duplicating existing remote-image or lightbox logic
- [ ] T009 Create `src/lib/media-browser-reference.ts` to own the `DraftMediaReference` model, composer insertion/removal, serialization, and any send-time adaptation needed for the reference/link reuse contract
- [ ] T010 [P] Add focused regression coverage for `src/lib/media-browser-reference.ts` in `tests/media-browser-reference.test.mjs`

**Checkpoint**: Shared browser shell, source adapters, controller state, and reference insertion seams are ready. User story work can now proceed independently.

---

## Phase 3: User Story 1 - Browse and preview media artifacts (Priority: P1) 🎯 MVP

**Goal**: Deliver a source-first Media Browser that feels like a sibling of the existing FileManager and supports image preview using current media/runtime seams.

**Independent Test**: Open the media browser, switch among source roots, select image artifacts, and confirm previews work for local/shared-volume and already-supported remote/self-hosted media flows.

### Tests for User Story 1

- [X] T011 [P] [US1] Add or extend unit coverage in `tests/media-browser-sources.test.mjs` for source-root derivation such as `All media`, `Generated`, `Uploaded`, and `Session-linked`, including cache-backed behavior for preview-only sessions versus sessions whose history has been explicitly loaded
- [ ] T012 [P] [US1] Add or extend unit coverage in `tests/media-browser-items.test.mjs` for image-only v1 visibility rules, lightweight sorting, and unsupported-media state behavior

### Implementation for User Story 1

- [ ] T013 [P] [US1] Implement `src/components/media-browser/MediaBrowserEntryCard.tsx` for media-browser-specific artifact cards using the shared browser-shell language
- [ ] T014 [P] [US1] Implement `src/components/media-browser/MediaBrowserSidebar.tsx` for source-first root switching and lightweight filter/sort controls
- [ ] T015 [P] [US1] Implement `src/components/media-browser/MediaBrowserPreview.tsx` for preview-first image display, loading, unsupported, and error states using `src/lib/message-image-source.ts`, `src/hooks/useRemoteImageResolver.ts`, and `src/hooks/useImageLightboxController.ts`
- [ ] T016 [US1] Implement `src/components/media-browser/MediaBrowser.tsx` to compose the sidebar, preview pane, and shared browser-shell layout around `useMediaBrowserController`
- [ ] T017 [US1] Integrate the Media Browser into `src/app.tsx` by extending the current view switching and shell composition to add a `media` surface beside `chat` and `files`
- [ ] T018 [US1] Add navigation affordances into the existing shell so users can open the media browser from the same product family as FileManager without inventing a disconnected route pattern

**Checkpoint**: User Story 1 should now provide a usable read-only source-first media browser with image preview.

---

## Phase 4: User Story 2 - Reuse media in chat workflows (Priority: P2)

**Goal**: Let users reuse a selected media artifact in the current chat as a reference/link without defaulting to staged attachments.

**Independent Test**: Open the media browser while a chat session is active, choose a media artifact, insert it into chat as a reference/link, and confirm the draft/send flow behaves as intended.

### Tests for User Story 2

- [ ] T019 [P] [US2] Extend `tests/media-browser-reference.test.mjs` to cover draft insertion, no-active-session failure handling, and idempotent repeated insertion behavior
- [ ] T020 [P] [US2] Add targeted unit coverage for any send-time adaptation introduced in `src/lib/media-browser-reference.ts` or `src/app.tsx`

### Implementation for User Story 2

- [ ] T021 [US2] Add a media-browser-to-chat insertion callback in `src/app.tsx` that uses `src/lib/media-browser-reference.ts` to add or remove `DraftMediaReference` items instead of mutating `useStagedAttachments()` by default
- [ ] T022 [US2] Update `src/components/media-browser/MediaBrowser.tsx` and/or `src/components/media-browser/MediaBrowserPreview.tsx` to expose the primary “reuse in chat” action only when a valid active chat context exists
- [ ] T023 [US2] Update `src/components/Composer.tsx` and any draft-related seams only as needed to render inserted media references as removable reference pills/links, clearly distinct from staged attachments
- [ ] T024 [US2] Implement send-time conversion in `src/app.tsx` and `src/lib/media-browser-reference.ts` so the user-facing reference/link contract remains intact even if current `chat.send` transport requires a different concrete outbound form

**Checkpoint**: User Story 2 should now let the user reuse images from the media browser in the active chat workflow without path copy/paste or attachment-first UX.

---

## Phase 5: User Story 3 - Find the right media quickly (Priority: P3)

**Goal**: Add lightweight narrowing and grouping without turning the browser into a full media-management product.

**Independent Test**: Open a mixed set of media artifacts, use the available filters/grouping/sorting, and confirm results narrow predictably without breaking preview or chat reuse.

### Tests for User Story 3

- [ ] T025 [P] [US3] Extend `tests/media-browser-items.test.mjs` to cover the final lightweight filter/grouping rules
- [ ] T026 [P] [US3] Extend `tests/media-browser-sources.test.mjs` to cover session provenance filtering and source-specific narrowing behavior

### Implementation for User Story 3

- [ ] T027 [US3] Finalize lightweight filter/grouping controls in `src/components/media-browser/MediaBrowserSidebar.tsx`
- [ ] T028 [US3] Implement controller-side filter/grouping application in `src/hooks/useMediaBrowserController.ts`
- [ ] T029 [US3] Surface artifact context in `src/components/media-browser/MediaBrowserEntryCard.tsx` and `src/components/media-browser/MediaBrowserPreview.tsx` so users can distinguish generated, uploaded, and session-linked items without exposing raw backend path noise

**Checkpoint**: All three user stories should now work independently, with P1 browse/preview, P2 chat reuse, and P3 lightweight findability.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation follow-through, documentation, and regression protection that affects multiple stories.

- [ ] T030 [P] Update any affected product/architecture docs in `docs/` if the implementation materially changes browser-shell ownership or media workflow guidance
- [ ] T031 Run the automated validation set: `make test-unit`, `make typecheck`, `make build`
- [ ] T032 Run the targeted manual validation from `specs/001-media-browser/quickstart.md`
- [ ] T033 Verify the existing FileManager and current chat image flows still work after the shared browser-shell extraction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational - no dependency on other stories
- **User Story 2 (P2)**: Starts after Foundational, but practically depends on User Story 1’s Media Browser surface existing
- **User Story 3 (P3)**: Starts after Foundational and is easiest once User Story 1 exists

### Within Each User Story

- Shared helper/controller tests should be written before or alongside the logic they protect
- Shared data shaping before UI composition
- UI composition before app-shell integration
- App-shell integration before final manual validation

### Parallel Opportunities

- `T002` and parts of `T001` can run in parallel
- `T005`, `T007`, and `T010` can run in parallel with their corresponding helper seams once file scaffolding exists
- `T013`, `T014`, and `T015` can run in parallel after the foundational controller/source seams exist
- `T019` and `T020` can run in parallel with the reference insertion seam work
- `T025` and `T026` can run in parallel during the P3 refinement pass

---

## Parallel Example: User Story 1

```bash
# After foundational seams are in place, these can proceed together:
Task: "Implement src/components/media-browser/MediaBrowserEntryCard.tsx"
Task: "Implement src/components/media-browser/MediaBrowserSidebar.tsx"
Task: "Implement src/components/media-browser/MediaBrowserPreview.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE** User Story 1 with the quickstart browse/preview flows

### Incremental Delivery

1. Deliver browse/preview first
2. Add chat reuse as a second slice
3. Add lightweight filtering/grouping as the third slice
4. Finish with validation and regression follow-through

### Practical Guidance

- Do not turn this into a generalized browser framework before the first media slice works
- Do not let the reuse flow quietly collapse into “just another staged attachment picker”
- Prefer reusing current media preview/runtime seams over inventing new path/transport rules
