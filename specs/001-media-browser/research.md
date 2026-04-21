# Research: Media Browser

## Decision 1: Reuse FileManager’s interaction model through shared browser chrome, not a shared data provider

### Decision

Extract reusable presentation/layout primitives from `src/components/FileManager.tsx`, but keep media browsing on a dedicated controller/provider instead of trying to generalize `FileManagerProvider` into a single filesystem-and-media store.

### Rationale

`FileManager` already has the right user-facing mental model:
- root/source switching
- browse pane + preview pane
- preview-first workflow
- desktop-native empty/loading/error treatment

But its provider is tightly coupled to filesystem concepts such as:
- `roots`
- directory listing endpoints
- upload/mkdir/write/download

Trying to force media artifacts into that provider would import the wrong semantics and likely create another gravity well.

### Alternatives considered

- **Copy FileManager into a new MediaBrowser stack**: rejected because it duplicates UX language and increases maintenance drift.
- **Make one generic BrowserProvider for files and media immediately**: rejected because the underlying state models are too different for a safe first cut.

## Decision 2: Use source adapters built from existing normalized session/history/media seams

### Decision

Build v1 media discovery from existing ClawFace normalized data rather than requiring a new OpenClaw media-listing backend API.

### Rationale

ClawFace already has good normalized seams around:
- `sessions.list` / `sessions.preview`
- `chat.history`
- attachment shaping
- runtime image source normalization

OpenClaw’s documented protocol clearly supports session/history flows, and generated tool/media output already re-enters the UI as attachments. That makes a source-adapter layer viable for a read-heavy first version.

### Evidence / references

- ClawFace:
  - `src/lib/shell-gateway-responses.ts`
  - `src/lib/shell-gateway-history.ts`
  - `src/lib/chat-message-attachments.ts`
  - `src/lib/message-image-source.ts`
- OpenClaw:
  - `docs/gateway/protocol.md` documents `sessions.preview` and `chat.history`
  - `docs/tools/image-generation.md` says generated images are delivered as media attachments

### Alternatives considered

- **Require a new backend `media.list` API before implementing the browser**: rejected for v1 because it blocks useful browse/preview/reuse work on an unlanded backend contract.
- **Scan host-local media directories directly as the primary source**: rejected because it breaks remote/self-hosted portability and leaks filesystem assumptions into the product.

## Decision 3: Treat remote/self-hosted portability as a preview transport requirement, not a listing requirement

### Decision

Reuse the existing renderer preview/transport seams for portable image opening and preview, even if list discovery is source-adapter driven.

### Rationale

The portability problem is different from the discovery problem:
- discovery = which artifacts should appear in the browser?
- preview = how do we actually render the selected item safely and portably?

ClawFace already has preview/transport seams for this:
- `useRemoteImageResolver`
- `message-image-source.ts`
- Electron local-image transport and desktop IPC

The browser should consume these seams rather than invent another local/remote image transport path.

## Decision 4: Keep the v1 reuse UX reference-style even if send transport adapts later

### Decision

The browser inserts a media reference into the chat workflow as the user-visible action. Transport adaptation can be resolved under the hood if OpenClaw requires attachments or another concrete send form.

### Rationale

The clarified product intent is not “open a hidden attachment picker from another surface.” It is “reuse something already in the workspace/history as a first-class reference.” That distinction matters for UX and future extensibility.

### Implementation implication

Add a dedicated draft/reference seam instead of routing the browser through `useStagedAttachments()` by default.

## Decision 5: Images are first-class in v1; other media must fail honestly

### Decision

Design v1 around images only for full preview/reuse support. Non-image artifacts may still appear where they come from the same source model, but the UI must communicate limited support clearly.

### Rationale

This keeps the initial browser shippable and aligned with the strongest existing ClawFace media seams, which are image-heavy and already validated through Track B work.
