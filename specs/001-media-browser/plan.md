# Implementation Plan: Media Browser

**Branch**: `001-media-browser` | **Date**: 2026-04-20 | **Spec**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md)  
**Input**: Feature specification from `/specs/001-media-browser/spec.md`

## Summary

Add a source-first Media Browser to ClawFace that feels like a sibling of the existing FileManager surface, not a separate app. The implementation should reuse FileManager’s browse-and-preview interaction model and shared browser chrome where practical, while building media-specific state and transport on top of the renderer’s existing media seams: normalized history/session data, runtime image-source translation, remote image resolution, lightbox preview, and Electron local-image transport. The first version stays read-heavy and selection-focused: browse, lightly filter, preview, and insert media references into the current chat workflow, with images as the only fully supported first-class media type.

## Technical Context

**Language/Version**: TypeScript (Node.js `22.22.0` for development tooling, React/Electron renderer stack)  
**Primary Dependencies**: React, Electron, Vite, existing ClawFace hooks/controllers and gateway normalization seams  
**Storage**: Existing OpenClaw session/history/media data plus ClawFace local UI state; no new persistent store required for v1  
**Testing**: `make test-unit`, `make typecheck`, `make build`, plus targeted manual desktop media flows  
**Target Platform**: Desktop app (macOS-first development target; Electron renderer + main process)  
**Project Type**: Desktop app  
**Performance Goals**: Media browser open/select/preview interactions should feel immediate on normal desktop hardware; avoid repeated full-history reparsing or duplicate media normalization on hot paths  
**Constraints**: Must preserve remote/self-hosted media portability; must not require a new backend media index API for v1; must not create a parallel media resolution stack; must not turn into a full DAM/media-management product  
**Scale/Scope**: Phase-1-adjacent feature using existing ClawFace/OpenClaw media capabilities, focused on image artifacts and chat reuse flows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable boundaries over gravity wells**: Pass. The plan explicitly avoids reopening `src/app.tsx`, `src/components/ChatView.tsx`, and `electron/main.cjs` with more inline browser logic by introducing a dedicated media-browser controller/data seam and shared browser-shell extraction from FileManager.
- **Validation is a merge gate**: Pass. Required validation for implementation is `make test-unit`, `make typecheck`, `make build`, plus `node -c` if any Electron `.cjs` files change.
- **UX consistency beats novelty**: Pass. The browser is intentionally scoped as a specialized sibling of FileManager with the same interaction model and ClawFace-style chat/media reuse behavior.
- **Performance and responsiveness are product features**: Pass. The plan relies on normalized source adapters and on-demand loading instead of repeated brute-force scanning or a new heavy indexer.
- **Testable behavior over cleverness**: Pass. New parsing, source normalization, browser-item shaping, and reference-insertion rules will live behind helper/controller seams with focused regression tests.

## Project Structure

### Documentation (this feature)

```text
specs/001-media-browser/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── media-browser-boundaries.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app.tsx
├── components/
│   ├── FileManager.tsx
│   ├── ChatView.tsx
│   ├── Composer.tsx
│   ├── media-browser/
│   │   ├── MediaBrowser.tsx
│   │   ├── MediaBrowserSidebar.tsx
│   │   ├── MediaBrowserPreview.tsx
│   │   └── MediaBrowserEntryCard.tsx
│   └── browser-shell/
│       ├── BrowserShellLayout.tsx
│       ├── BrowserRootTabs.tsx
│       ├── BrowserBreadcrumbs.tsx
│       └── BrowserEmptyState.tsx
├── hooks/
│   ├── useMediaBrowserController.ts
│   ├── useRemoteImageResolver.ts
│   ├── useImageLightboxController.ts
│   └── useStagedAttachments.ts
└── lib/
    ├── media-browser-items.ts
    ├── media-browser-sources.ts
    ├── media-browser-reference.ts
    ├── message-image-source.ts
    ├── chat-message-attachments.ts
    ├── shell-gateway-history.ts
    └── shell-gateway-responses.ts

electron/
├── ipc/
│   └── register-desktop-ipc.cjs
└── protocols/
    └── local-image.cjs

tests/
├── media-browser-items.test.mjs
├── media-browser-sources.test.mjs
├── media-browser-reference.test.mjs
└── [existing media/path regression tests]
```

**Structure Decision**: Keep media browsing in the renderer, but do not clone FileManager wholesale. Extract reusable browse-shell presentation pieces from `src/components/FileManager.tsx` into shared browser-shell components, then build a dedicated `useMediaBrowserController` and media source adapters on top of existing media normalization and preview transport seams. This preserves UX consistency without forcing filesystem semantics onto media artifacts.

## Phase 0 Research

See [research.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/research.md).

## Phase 1 Design

See:
- [data-model.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/data-model.md)
- [quickstart.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/quickstart.md)
- [contracts/media-browser-boundaries.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/contracts/media-browser-boundaries.md)

## Implementation Approach

### 1. Reuse the FileManager interaction language, not its filesystem assumptions

The Media Browser should share:
- left-side browsing/navigation pane
- preview-first main pane
- root switching
- lightweight sorting/filtering affordances
- empty/loading/error state language

It should not inherit:
- raw filesystem path ownership
- directory mutation actions
- file upload/new-folder toolbars
- direct FS API assumptions

The safest implementation path is to extract shared browser-shell presentation pieces from `FileManager` while leaving `FileManagerProvider` filesystem-specific.

### 2. Build source adapters from existing normalized shell/media data

OpenClaw does not currently provide a clearly documented first-class media-browser listing API for ClawFace to depend on. For v1, the browser should derive its source-first roots from data ClawFace already knows how to normalize:

- `sessions.list` / `sessions.preview` via `src/lib/shell-gateway-responses.ts`
- `chat.history` via `src/lib/shell-gateway-history.ts`
- attachment shaping via `src/lib/chat-message-attachments.ts`
- renderable image translation via `src/lib/message-image-source.ts`

This suggests a dedicated `media-browser-sources.ts` seam that can:
- union media-bearing attachments from normalized session/history data
- derive source roots such as `All media`, `Generated`, `Uploaded`, `Session-linked`
- preserve portable render references instead of collapsing immediately to host-only paths
- avoid reparsing whole histories when cached normalized results already exist

V1 completeness contract: the Media Browser is authoritative over media already exposed by normalized `sessions.list` / `sessions.preview` data and any `chat.history` payloads ClawFace has explicitly loaded or preloaded. The browser will not trigger an exhaustive history crawl across every session just to make the library appear globally complete.

### 3. Reuse existing preview transport instead of inventing a new one

Preview and open behavior should reuse current media seams:
- `useRemoteImageResolver` for remote/self-hosted image portability
- `message-image-source.ts` for desktop/web renderable source normalization
- `useImageLightboxController` for richer image inspection
- Electron local-image transport in `electron/protocols/local-image.cjs`
- desktop IPC image reads/fetches from `electron/ipc/register-desktop-ipc.cjs` if additional preview helpers are needed

This keeps the media browser from becoming a second place that understands local decode, remote fallback, and path mapping differently from chat attachments.

### 4. Add a reference-style chat insertion seam

The clarified v1 UX is “insert as a reference/link,” not “add to staged attachments.” The current send path is attachment-array based, so v1 needs a distinct draft-side insertion boundary.

Recommended v1 contract:
- selecting `Reuse in chat` inserts a `DraftMediaReference` item into composer state
- the composer renders that item as a removable media reference pill/link
- the reference is not a staged attachment and never exposes a raw backend path in draft UI
- `src/lib/media-browser-reference.ts` owns the draft model plus send-time conversion into the concrete `chat.send` payload shape

This keeps the user-visible behavior faithful to the “reference/link” requirement while allowing transport adaptation to stay an implementation detail.

### 5. Keep non-image media visible but not “fake-supported”

Images are the only fully supported preview/reuse target in v1. If other media artifacts appear in source lists, the browser should:
- keep them visible when they belong to the same logical source model
- show limited or unsupported states clearly
- avoid implying that audio/video/PDF preview is complete if it is not

### 6. App-shell integration

Likely integration points in `src/app.tsx`:
- active view switching (`chat` / `files`) likely expands to include `media`
- sidebar flip/navigation affordance likely grows to expose Media Browser as a sibling surface
- selected-session context and draft insertion callbacks need to be passed into the media browser

The plan should keep app-shell work narrow:
- route into the media browser surface
- provide selected-session/draft callbacks
- avoid rebuilding media discovery logic in the root component

## Validation Strategy

Implementation must validate with:

- `make test-unit`
- `make typecheck`
- `make build`

If Electron `.cjs` files change:

- `node -c electron/main.cjs`
- `node -c` for each edited new or existing `.cjs` file

Targeted manual desktop flows must include:

- open Media Browser from desktop app and browse source roots
- preview local/shared-volume generated images
- preview remote/self-hosted media through the existing portable resolver path
- reuse an image into an active chat as a reference/link
- verify no regression to existing FileManager behavior
- verify no regression to existing generated-image rendering in chat/history/lightbox

Automated coverage must include at least one helper-level regression proving that a remote/self-hosted media artifact preserves its portable render reference through media-browser source adaptation and preview selection, rather than collapsing to a host-only filesystem path.

## Complexity Tracking

No constitution violations are required by this plan at this stage.
