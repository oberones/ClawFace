# Data Model: Dream Timeline

## Dream Timeline Snapshot

Represents the full user-visible timeline model derived from the active Dream Inspector snapshot.

### Fields

- `workspaceScopeLabel`: Human-readable label for the active workspace context.
- `workspaceScopeDetail`: Supporting scope copy shown in the panel.
- `loadedAtMs`: When ClawFace loaded the current Dream Inspector snapshot.
- `availability`: One of `loading`, `ready`, `empty`, `disabled`, `unavailable`, `partial`.
- `range`: Derived chronology window based on visible moments.
- `momentGroups`: Ordered grouped chronology units for display.
- `candidateTracks`: Optional candidate-linked indices or track summaries derived from visible evidence.
- `note`: User-facing explanatory note for limited or unavailable states.
- `error`: Optional user-safe error string.

## Timeline Range

Describes the visible chronology window represented by the current snapshot.

### Fields

- `startAt`: Oldest visible timestamp represented by a timeline moment.
- `endAt`: Newest visible timestamp represented by a timeline moment.
- `derivedFrom`: One or more visible source types used to compute the window, such as `promotedAt`, `lastRecalledAt`, `diaryDate`, or `diaryUpdatedAt`.

## Timeline Moment Group

The primary user-facing chronology unit.

### Fields

- `id`: Deterministic UI id derived from visible source data for the current snapshot.
- `kind`: One of `promotion`, `replay`, `diary-entry`, `diary-update`, `mixed`, or `limited`.
- `headline`: Concise workstation-readable label.
- `summary`: User-safe explanation string.
- `timestamp`: Primary visible timestamp for the moment.
- `phaseLabel`: Optional visible phase wording when it can be stated safely from current data.
- `candidateRefs`: Zero or more candidate references linked to the moment.
- `artifactLinks`: Zero or more links into Dream Diary or nearby Dream Inspector context.
- `sourceKinds`: One or more evidence kinds backing the moment, such as `promotedAt`, `lastRecalledAt`, `diaryDate`, or `diaryUpdatedAt`.
- `limitationNote`: Optional explicit note when chronology is inferred or incomplete.

## Timeline Candidate Reference

Links one moment group to a candidate or candidate-like memory reference.

### Fields

- `candidateKey`: Shared candidate id from Dream Inspector when available.
- `path`: Memory path when available.
- `startLine`: Optional start line.
- `endLine`: Optional end line.
- `label`: UI-facing snippet or memory label.
- `relationship`: One of `direct`, `grouped`, `inferred`, `limited`.
- `status`: Optional visible state such as `waiting`, `grounded`, or `promoted`.

## Candidate Timeline Track

Represents a filtered chronology relevant to one selected candidate.

### Fields

- `candidateKey`: Stable candidate identifier from Dream Inspector.
- `headline`: Candidate label or snippet.
- `currentStatus`: Visible status from Dream Inspector.
- `momentGroupIds`: Ordered moment-group ids related to the candidate.
- `limitationNote`: Optional note when candidate linkage is incomplete or inferred.

## Timeline Artifact Link

Represents an optional handoff from a timeline moment into adjacent dream context.

### Fields

- `kind`: One of `diary-entry`, `dream-candidate`, `related-insight`, `related-palace`, or another explicit UI-facing link kind.
- `targetId`: Stable UI target id when available.
- `label`: UI-facing link label.
- `detail`: Optional supporting text.
- `relationship`: One of `direct`, `nearby`, `inferred`, `limited`.

## Availability States

### `loading`

Dream Inspector is still loading the current snapshot, so the timeline cannot be derived yet.

### `ready`

Visible chronology loaded successfully and has meaningful moments to show.

### `empty`

Dream Inspector is available, but the current snapshot does not contain enough timestamped evidence to form a meaningful timeline.

### `disabled`

Dream Inspector reports that dreaming is off for the current workspace, so no timeline can be derived.

### `unavailable`

Dream Inspector itself is unavailable or disconnected, so the timeline cannot be derived.

### `partial`

The main chronology loaded, but some candidate relationships, diary dates, or adjacent context links are missing or only partially derivable.
