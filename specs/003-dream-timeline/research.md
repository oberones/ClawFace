# Research: Dream Timeline

## Decision 1: Keep Dream Timeline as adjacent context from Dream Inspector

### Decision

Implement Dream Timeline as a second-level adjunct to the existing Dream Inspector rather than as a new top-level ClawFace route.

### Rationale

Dream Visibility already established the product split:

- Dream Inspector answers what matters now
- Dream Timeline should answer what visible chronology supports that current state

Keeping the timeline adjacent preserves the workstation model and avoids inventing a detached operations dashboard for one dream feature.

### Alternatives considered

- **Create a full-screen Dream Timeline dashboard**: rejected because it weakens workstation continuity and feels more like backend operations.
- **Embed all chronology inline in the Dream Inspector overview**: rejected because it would overcrowd the signal-first pane and blur "now" versus "history."

## Decision 2: Treat current OpenClaw gateway surfaces as the hard implementation boundary

### Decision

Build Dream Timeline only from current gateway surfaces already used by ClawFace rather than depending on new OpenClaw seams or direct file access.

### Rationale

The repo constitution now requires ClawFace to treat OpenClaw as read-only from this repo's point of view. That means this slice must ship entirely from the data ClawFace already receives today.

The usable inputs are:

- `doctor.memory.status`
- `doctor.memory.dreamDiary`
- optional `wiki.importInsights`
- optional `wiki.palace`

### Alternatives considered

- **Require a new `doctor.memory.timeline` seam**: rejected because companion OpenClaw changes are outside the implementation boundary for this repo.
- **Read `memory/.dreams/events.jsonl` directly from ClawFace**: rejected because it breaks the product boundary, creates portability problems, and still would not produce a stable frontend contract.

## Decision 3: Derive chronology from visible timestamped evidence

### Decision

The first timeline slice should be built from timestamped evidence already present in current Dream Inspector data:

- `promotedAt`
- `lastRecalledAt`
- Dream Diary entry dates
- diary `updatedAtMs`
- the current snapshot's `loadedAtMs`

### Rationale

These fields are enough to produce a truthful evidence timeline that explains some visible chronology without pretending to be a full backend journal.

### Alternatives considered

- **Wait for exact dream-run events**: rejected because it would stall the feature even though meaningful chronology can already be shown.
- **Render raw timestamp fields with no grouping**: rejected because it would feel like a debugging aid instead of a workstation surface.

## Decision 4: Prefer grouped visible moments over raw timestamp lists

### Decision

The timeline should group visible evidence into user-facing moments such as:

- promotion moment
- replay touchpoint
- diary-entry moment
- limited or inferred chronology note

### Rationale

Users care about understandable moments:

- something promoted here
- this memory was recently replayed here
- the diary discussed this around here

They do not primarily care about reading every raw timestamp field separately.

### Alternatives considered

- **Expose a flat table of candidate timestamps**: rejected because it is harder to scan and does not feel like a coherent chronology surface.
- **Synthesize fake dream-run moments from missing data**: rejected because the current data cannot support that claim honestly.

## Decision 5: Candidate timelines should be supported but explicitly inferred when needed

### Decision

Workspace chronology is the guaranteed baseline; candidate-level timeline tracks are an enhanced path when the selected candidate has enough visible evidence to support them.

### Rationale

Current surfaces are uneven:

- promotion timing can be reasonably shown from `promotedAt`
- replay touchpoints can be reasonably shown from `lastRecalledAt`
- there are no stable backend event ids tying every visible moment to every candidate

The feature should therefore stay useful even while some candidate provenance is inferred rather than direct.

### Alternatives considered

- **Require deterministic provenance for every moment before shipping**: rejected because it would block the feature unnecessarily.
- **Ignore candidate linking entirely**: rejected because candidate evidence is a key part of the follow-up value.

## Decision 6: Treat exact dream-run history as blocked, not as hidden future work inside MVP

### Decision

Exact dream-run completion history, stable backend event ids, and full replay wave journals are blocked from this slice because current surfaces do not expose them.

### Rationale

The new repo boundary means missing backend support is a real blocker, not an invitation to promise companion work in another repo. The product should stay explicit about that gap instead of smuggling in a dependency on future OpenClaw changes.

### Alternatives considered

- **Describe blocked history as a future implementation detail**: rejected because that would violate the current constitution and create misleading implementation expectations.
- **Pretend the diary or current snapshot can stand in for a full event journal**: rejected because that would overclaim what the current data actually proves.
