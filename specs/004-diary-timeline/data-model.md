# Data Model: Dream Diary Timeline

## `DreamDiaryTimelineSnapshot`

The shell-facing model returned by the diary timeline controller/helper for the current loaded Dreams pane.

- `availability`: one of `loading`, `ready`, `empty`, `disabled`, `unavailable`, or `limited`
- `workspaceScope`: existing workspace label/detail used by dream surfaces
- `loadedAtMs`: when ClawFace loaded the current snapshot
- `diaryUpdatedAtMs`: freshness metadata from the diary source, if available
- `groups`: ordered `DiaryTimelineGroup[]`
- `entriesById`: lookup of `DiaryTimelineEntry` by snapshot-local id
- `selectedEntryId`: currently selected entry id, or `null`
- `latestEntryId`: first displayed readable entry after ordering rules are applied, or `null`
- `note`: user-facing limitation or state copy
- `error`: user-facing failure detail suitable for the pane, or `null`

## `DiaryTimelineEntry`

A readable unit of diary content.

- `id`: stable within the loaded diary snapshot
- `kind`: `dated`, `heading`, or `limited`
- `title`: short display title derived from heading/date/content
- `dateLabel`: user-readable date or heading label, if available
- `sortKey`: chronological/order key when available; otherwise document order
- `body`: full entry text
- `paragraphs`: reader-ready paragraphs
- `sourceRange`: original line range in the diary document, used only for internal traceability
- `attachmentAnchor`: future-safe anchor for entry-level Imported Insights or Memory Palace links

## `DiaryTimelineGroup`

A group in the left/top timeline.

- `id`: group id derived from date label or limited state
- `label`: display grouping label such as a day, month, or "Undated diary"
- `kind`: `dated` or `limited`
- `entryIds`: ordered entry ids in the group

## `DiaryReadingState`

Local UI state owned by the diary timeline controller.

- `selectedEntryId`: selected diary entry id
- `refreshState`: `idle`, `loading`, `refreshing`, or `failed`
- `hasReadableContent`: whether any entry can be rendered
- `canReturnToLatest`: true when the selected entry is not the latest readable entry

## `DiaryEntryAttachment` (Future)

Reserved shape for future entry-level related context.

- `entryId`: diary entry id for the current snapshot
- `kind`: `imported-insight` or `memory-palace`
- `label`: human-readable link label
- `summary`: short contextual preview
- `target`: existing shell navigation or adjacent-context target
- `relationship`: `direct`, `inferred`, or `limited`

MVP should not implement attachments. The model exists to keep future related-memory support centered on diary entries rather than reintroducing candidate-first UI.

## State Rules

- `loading`: initial diary load is in progress.
- `ready`: at least one parsed diary entry is readable with reliable enough entry boundaries.
- `limited`: diary content is readable but chronology or entry boundaries are limited.
- `empty`: diary request succeeds but no readable content exists.
- `disabled`: status says dreaming is disabled; if readable diary content exists, render the reader with a disabled note, otherwise render the disabled empty state.
- `unavailable`: gateway or diary method failure prevents loading a useful diary snapshot.

## Ordering Rules

- Dated entries sort newest-first by parsed date/timestamp when reliable.
- Same-date entries keep source document order within the date group.
- Heading-only and undated entries keep source document order and are labeled without invented chronology.
- `latestEntryId` is the first displayed readable entry after those ordering rules are applied.
- `updatedAtMs` is freshness metadata only and must not become a diary entry date.
