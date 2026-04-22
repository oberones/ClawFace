# Data Model: Dream Visibility

## DreamInspectorSnapshot

Represents the normalized snapshot the Dream Inspector renders for one workspace at one point in time.

### Fields

- `workspaceScope`: visibility scope label for the active default-agent workspace
- `loadedAtMs`: when ClawFace last loaded or refreshed the snapshot
- `availability`: inspector availability state such as `ready`, `loading`, `empty`, `disabled`, `unavailable`, or `partial`
- `methods`: optional capability summary for dream status, diary, imported insights, and memory palace availability
- `overview`: signal-first summary values used in the top section
- `lanes`: grouped candidate collections for waiting, grounded, and promoted
- `diary`: current diary document snapshot
- `relatedContext`: optional cached imported-insight and memory-palace summaries

### Notes

- This is snapshot-based in MVP, not a live event stream.
- `partial` is valid when some companion context fails but the primary dream snapshot still renders.

## DreamOverview

Represents the high-signal summary shown first when the pane opens.

### Fields

- `enabled`: whether dreaming is enabled
- `shortTermCount`: current waiting/short-term count
- `groundedSignalCount`: grounded replay signal count
- `totalSignalCount`: total signal count
- `phaseSignalCount`: total phase-hit count
- `promotedTotal`: all-time promoted total
- `promotedToday`: promoted-today count
- `topCandidates`: strongest or heating-up candidates ranked from visible signals only
- `phaseSummary`: optional light/deep/rem phase availability and schedule summary

### Notes

- `topCandidates` must not imply hidden score internals.
- This object exists to answer “what matters now?” before the user reads the lanes.

## DreamCandidate

Represents one memory candidate or promoted memory item that can appear in overview, lanes, and detail.

### Fields

- `key`: stable item key from gateway-visible payloads
- `lane`: `waiting | grounded | promoted`
- `path`: source memory path
- `startLine`: source start line
- `endLine`: source end line
- `snippet`: human-readable excerpt
- `recallCount`: live recall count
- `dailyCount`: daily-note signal count
- `groundedCount`: grounded replay count
- `totalSignalCount`: total visible signal count
- `lightHits`: light-dream phase hits
- `remHits`: rem-dream phase hits
- `phaseHitCount`: total visible phase hits
- `promotedAt`: promotion timestamp when present
- `lastRecalledAt`: latest recall timestamp when present
- `originLabel`: lightweight user-facing explanation such as live, grounded, or mixed support
- `explanationCues`: concise chips or facts explaining why it appears to be sticking

### Notes

- `lane` is derived in ClawFace MVP:
  - waiting: short-term candidate with no grounded replay
  - grounded: short-term candidate with grounded replay
  - promoted: promoted entry returned by status
- A promoted item may still carry grounded counts, but lane identity remains promoted.

## DreamLane

Represents one user-visible lane in the inspector.

### Fields

- `key`: `waiting | grounded | promoted`
- `label`: user-facing title
- `count`: item count
- `items`: ordered `DreamCandidate[]`
- `emptyCopy`: empty-state explanation for that lane

### Notes

- Ordering rules can differ by lane, but must stay based on visible counts and timestamps only.
- Waiting and grounded lanes are derived from short-term entries; promoted is direct.

## DreamDiaryDocument

Represents the dream diary snapshot returned by `doctor.memory.dreamDiary`.

### Fields

- `found`: whether a diary file exists
- `path`: diary path such as `DREAMS.md`
- `updatedAtMs`: latest modified timestamp when present
- `content`: raw diary markdown or text
- `entries`: parsed diary sections or day chunks suitable for the UI

### Notes

- The diary is a human-readable narrative layer, not a guaranteed structured evidence map.
- `entries` may be empty even when `content` exists if parsing finds no distinct sections.

## DreamDiaryEntry

Represents one parsed narrative chunk from the diary.

### Fields

- `id`: stable in-memory key for selection
- `dateLabel`: day or section label when present
- `body`: full narrative body for the entry
- `paragraphs`: flattened paragraphs for display
- `sourceRange`: optional file-relative range metadata if derivable

### Notes

- This entity is optimized for readable diary presentation, not round-tripping the raw file format.

## DreamRelatedContext

Represents optional imported-insight and memory-palace context cached for the active candidate detail flow.

### Fields

- `status`: `idle | loading | ready | unsupported | error | limited`
- `insights`: zero or more best-effort imported insight matches
- `palacePages`: zero or more best-effort memory palace matches
- `limitationNote`: optional explicit explanation when matching is weak or unavailable

### Notes

- `limited` is an expected outcome when the current APIs do not provide strong relationship evidence.
- This context is loaded lazily when the user inspects a candidate.

## DreamInspectorUiState

Represents session-shell UI state for the inspector.

### Fields

- `open`: whether the inspector pane is visible
- `activeLane`: currently selected lane
- `selectedCandidateKey`: active candidate detail target
- `selectedDiaryEntryId`: active diary entry target if the UI allows direct diary navigation
- `refreshState`: `idle | loading | refreshing | failed`

### Notes

- This state should live in the chat shell UI domain, not in a separate route store.
