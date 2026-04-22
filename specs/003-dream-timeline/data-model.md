# Data Model: Dream Timeline

## Dream Timeline Snapshot

Represents the full user-visible timeline payload for the active workspace.

### Fields

- `workspaceScopeLabel`: Human-readable label for the active workspace context.
- `loadedAtMs`: When ClawFace loaded the current snapshot.
- `availability`: One of `loading`, `ready`, `empty`, `unavailable`, `partial`.
- `range`: Backend-provided window metadata, including start/end timestamps and truncation state.
- `eventGroups`: Ordered grouped chronology units for display.
- `candidateTracks`: Optional candidate-linked indices or track summaries.
- `note`: User-facing explanatory note for limited or unavailable states.
- `error`: Optional user-safe error string.

## Timeline Range

Describes the chronology window represented by the snapshot.

### Fields

- `startAt`: Oldest event timestamp in the payload.
- `endAt`: Newest event timestamp in the payload.
- `truncated`: Whether older events were omitted by backend limit or retention window.
- `limit`: Optional backend limit used for the response.

## Timeline Event Group

The primary user-facing chronology unit.

### Fields

- `id`: Stable event-group id for UI selection.
- `kind`: One of `dream-run`, `promotion-batch`, `recall-wave`, `diary-entry`, `mixed`, or another explicit normalized label.
- `headline`: Concise workstation-readable label.
- `summary`: User-safe explanation string.
- `startedAt`: Group start timestamp.
- `endedAt`: Optional group end timestamp for batched or run-based events.
- `phase`: Optional dreaming phase such as `light`, `deep`, or `rem`.
- `candidateRefs`: Zero or more candidate references linked to the event group.
- `artifactLinks`: Zero or more links into Dream Diary, promoted memory, or adjacent dream context.
- `rawEventCount`: Count of source events represented by the group.
- `limitationNote`: Optional explicit note when relationships are partial or grouped conservatively.

## Timeline Candidate Reference

Links one event group to a candidate or candidate-like memory reference.

### Fields

- `candidateKey`: Shared candidate id when available.
- `path`: Memory path or durable memory path when available.
- `startLine`: Optional start line.
- `endLine`: Optional end line.
- `label`: UI-facing snippet or memory label.
- `relationship`: One of `direct`, `batched`, `inferred`, `limited`.
- `status`: Optional visible state such as `heating`, `grounded`, `promoted`.

## Candidate Timeline Track

Represents a filtered chronology relevant to one selected candidate.

### Fields

- `candidateKey`: Stable candidate identifier.
- `headline`: Candidate label or snippet.
- `currentStatus`: Visible status from Dream Inspector or timeline seam.
- `eventGroupIds`: Ordered event-group ids related to the candidate.
- `limitationNote`: Optional note when candidate linkage is incomplete.

## Timeline Artifact Link

Represents an optional handoff from a timeline event group into adjacent dream context.

### Fields

- `kind`: One of `diary-entry`, `promoted-memory`, `dream-candidate`, or other explicit normalized kinds.
- `targetId`: Stable target id when available.
- `label`: UI-facing link label.
- `detail`: Optional supporting text.
- `relationship`: One of `direct`, `nearby`, `limited`.

## Availability States

### `loading`

Timeline data is currently being fetched.

### `ready`

Timeline data loaded successfully and has meaningful chronology to show.

### `empty`

The seam is available but there are no timeline events in the requested window.

### `unavailable`

The seam is unsupported, the gateway is disconnected, or the current workspace cannot provide timeline history.

### `partial`

The main chronology loaded, but some candidate relationships or artifact links are missing or failed independently.
