# Contract: Media Browser Boundaries

## Purpose

Define the intended internal boundaries for the Media Browser so implementation work reuses existing ClawFace seams instead of introducing another parallel browser/media stack.

## 1. Browser Shell Contract

Shared browser-shell presentation may be reused between FileManager and Media Browser, but it must stay presentation-focused.

### Allowed responsibilities

- layout
- root tab presentation
- breadcrumb or header presentation
- empty/loading/error shell rendering
- browse pane and preview pane composition

### Forbidden responsibilities

- filesystem endpoint ownership
- media source discovery
- remote preview transport logic
- chat insertion behavior

## 2. Media Browser Controller Contract

`useMediaBrowserController` (or equivalent) owns media-browser-specific state.

### Responsibilities

- selected root/source
- selected artifact
- lightweight filter/sort state
- artifact list shaping
- preview state
- reuse/request state

### Must consume

- normalized session/history/media seams
- shared preview transport seams

### Must not own

- a duplicate remote image resolver
- direct Electron transport code
- raw `app.tsx`-style gateway payload parsing

## 3. Media Source Adapter Contract

`media-browser-sources.ts` (or equivalent) is the authoritative place that turns existing normalized app data into browser-visible media artifacts.

### Inputs

- normalized session rows/previews
- normalized history results
- attachment-bearing chat messages/tool outputs

### Outputs

- source roots
- browser-visible media artifacts
- stable ids and dedupe keys
- portable preview references
- reusable chat references

## 4. Preview Transport Contract

The Media Browser preview path must reuse current ClawFace media transport and normalization seams.

### Required reuse points

- `src/lib/message-image-source.ts`
- `src/hooks/useRemoteImageResolver.ts`
- `src/hooks/useImageLightboxController.ts`
- Electron local-image transport / desktop IPC only through existing abstractions

### Forbidden behavior

- new ad hoc path-prefix logic inside the browser component
- duplicate local-vs-remote preview transport stacks
- direct filesystem assumptions as the only preview path

## 5. Chat Reuse Contract

The browser’s default user-facing reuse behavior is “insert as a reference/link.”

### Requirements

- not staged-attachment-first by default
- must work against the current selected chat/session context
- must expose failure clearly when no valid chat context exists
- may adapt transport under the hood if required by current `chat.send` capabilities

### Forbidden behavior

- silently mutating staged attachments as the only v1 path
- requiring raw path copy/paste
- forcing backend/admin knowledge onto the user
