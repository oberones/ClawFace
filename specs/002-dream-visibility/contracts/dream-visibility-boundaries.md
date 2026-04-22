# Contract: Dream Visibility Boundaries

## Purpose

Define the intended internal boundaries for Dream Visibility so implementation work fits the current ClawFace shell and reuses established seams instead of introducing a parallel dashboard stack.

## 1. Chat-Shell Integration Contract

Dream Visibility belongs to the existing chat/session shell.

### Allowed responsibilities

- open and close a session-adjacent inspector pane
- preserve the current selected-session context
- expose narrow entry points from `ChatView` and `SessionSidebar`
- own local pane UI state such as open lane and selected candidate

### Forbidden responsibilities

- add a new full-screen dashboard route for MVP
- represent workspace dream state as per-session row badges without real per-session provenance
- move dream payload parsing into `ChatView.tsx` or `SessionSidebar.tsx`

## 2. Shell Gateway Memory Contract

`shell-gateway-memory.ts` (or equivalent) is the authoritative place that turns gateway dream and memory-wiki payloads into UI-ready state.

### Inputs

- `doctor.memory.status`
- `doctor.memory.dreamDiary`
- optional `wiki.importInsights`
- optional `wiki.palace`
- hello/config capability snapshots already known to the shell

### Outputs

- normalized dream snapshot
- waiting, grounded, and promoted candidate collections
- normalized diary document state
- normalized optional related-memory summaries
- explicit availability or disabled or unsupported states

### Forbidden behavior

- inline raw payload parsing in UI components
- hidden-score inference
- direct filesystem reads for MVP

## 3. Dream Candidate Derivation Contract

`dream-candidates.ts` (or equivalent) owns lane derivation, ranking, and explanation cues.

### Responsibilities

- derive waiting versus grounded versus promoted lanes from normalized payloads
- rank overview candidates using visible counts and timestamps only
- produce lightweight explanation cues such as total signals, grounded replay, and phase hits

### Must not do

- infer proprietary or hidden backend score internals
- invent relationships that current payloads do not expose

## 4. Dream Diary Contract

`dream-diary.ts` (or equivalent) owns diary parsing and readable narrative shaping.

### Responsibilities

- normalize found versus missing diary state
- parse diary content into readable entries or day chunks
- support candidate detail views with diary narrative context
- expose limitation copy when diary relationships are weak or absent

### Must not do

- treat raw diary text as guaranteed structured evidence
- depend on a live event stream

## 5. Related Context Contract

`dream-related-context.ts` (or equivalent) owns optional imported-insight and memory-palace matching.

### Responsibilities

- lazily load related context on candidate inspection
- perform best-effort matching from normalized wiki payloads
- expose ready versus unsupported versus limited states explicitly

### Must not do

- eagerly block initial pane open on wiki loading
- assume deterministic candidate-to-wiki ids exist today
- fail the primary dream-inspection flow when companion context is unavailable

## 6. Future Event Journal Contract

Timeline and event-journal work is future-only and requires a gateway seam.

### MVP rule

- ClawFace MVP must not read `memory/.dreams/events.jsonl` directly.

### Future seam expectation

- a gateway method should expose normalized journal events derived from the memory host event log
- the returned contract should be frontend-ready for timeline, run history, and promotion-event explanation

### Why

- direct file reads would break remote portability
- raw event logs are not an acceptable primary UX for ClawFace
