# Data Model: Media Browser

## MediaArtifact

Represents one browser-visible media item.

### Fields

- `id`: stable artifact identifier for browser selection and dedupe
- `kind`: media kind (`image` in v1, with room for future `audio`, `video`, `pdf`, `file`)
- `displayName`: human-readable artifact label
- `sourceKey`: logical source root identifier
- `sourceLabel`: display label for the source root
- `sessionKey`: optional originating session key
- `runId`: optional originating run/tool linkage
- `createdAt`: best available creation timestamp
- `previewState`: `ready | loading | unsupported | error`
- `renderRef`: portable renderable reference used for preview/open behavior
- `chatReference`: reusable chat reference payload/value for draft insertion
- `provenance`: optional lightweight details such as generated/uploaded/session-linked/tool-derived

### Notes

- `renderRef` must preserve portable preview behavior and cannot assume a direct host filesystem path.
- `chatReference` is a user-facing reuse handle, not necessarily the final transport payload.

## MediaSourceRoot

Represents a top-level source-first root in the browser.

### Fields

- `key`: stable root identifier
- `label`: display label (for example `All media`, `Generated`, `Uploaded`, `Session-linked`)
- `count`: optional visible item count
- `supportsFilter`: whether lightweight narrowing/filtering is enabled for this root

### Notes

- v1 uses sources first, not sessions first.
- Session provenance remains available inside artifact metadata and lightweight filters.

## MediaBrowserFilterState

Represents the current narrowing state for the browser.

### Fields

- `query`: optional text filter
- `sortKey`: current sort dimension
- `sortDir`: ascending/descending
- `sessionKey`: optional session-level narrowing
- `provenance`: optional source/provenance narrowing

### Notes

- This is intentionally lightweight in v1.
- It must not imply a full metadata taxonomy system.

## MediaPreviewSelection

Represents the currently selected artifact in the preview pane.

### Fields

- `artifactId`: selected media artifact id
- `resolvedArtifact`: selected artifact snapshot
- `previewContentState`: render/load state for the main pane

## MediaReuseRequest

Represents a user’s request to insert a browser artifact into the active chat workflow.

### Fields

- `artifactId`: selected artifact id
- `chatReference`: reusable reference value
- `sessionKey`: current chat session receiving the reuse
- `status`: `idle | inserting | inserted | failed`

### Notes

- This is distinct from staged attachments.
- It should route through a dedicated insertion seam rather than directly mutating attachment state.
