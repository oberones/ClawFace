# Research: Dream Timeline

## Decision 1: Keep Dream Timeline as adjacent context from Dream Inspector

### Decision

Implement Dream Timeline as a second-level adjunct to the existing Dream Inspector rather than as a new top-level ClawFace route.

### Rationale

Dream Visibility already established the product split:

- Dream Inspector answers what matters now
- Dream Timeline should answer how the current state emerged over time

Keeping the timeline adjacent preserves the workstation model and avoids inventing a detached operations dashboard for one dream feature.

### Evidence / references

- ClawFace Dream Visibility plan already reserved timeline work as adjacent context rather than a detached admin surface.
- `src/app.tsx` and current shell guidance favor auxiliary panes over new top-level routes for dream features.

### Alternatives considered

- **Create a full-screen Dream Timeline dashboard**: rejected because it weakens workstation continuity and feels more like backend operations.
- **Embed all chronology inline in the Dream Inspector overview**: rejected because it would overcrowd the signal-first pane and blur "now" versus "history."

## Decision 2: Depend on a new gateway seam rather than raw file access

### Decision

Require a new OpenClaw gateway seam for timeline data instead of reading `memory/.dreams/events.jsonl` directly from ClawFace.

### Rationale

The raw event log is real backend evidence, but it is not a stable frontend contract. Direct file access would:

- leak filesystem details into the product UX
- create portability issues for remote or self-hosted configurations
- force ClawFace to become a log parser

### Evidence / references

- OpenClaw raw memory host events live in `/Users/oberon/Projects/coding/other/openclaw/src/memory-host-sdk/events.ts`
- Existing event kinds include `memory.recall.recorded`, `memory.dream.completed`, and `memory.promotion.applied`

### Alternatives considered

- **Read `events.jsonl` directly from ClawFace**: rejected for portability and product-boundary reasons.
- **Pretend current `doctor.memory.status` plus `dreamDiary` is enough for chronology**: rejected because those surfaces do not provide real event ordering or batch history.

## Decision 3: Prefer grouped chronology over raw event rows

### Decision

The timeline seam should expose grouped, user-facing chronology rather than raw log rows.

### Rationale

Users care about meaningful moments:

- a dream run happened
- a promotion batch applied
- a replay wave reinforced a memory

They do not primarily care about individual backend event rows or file offsets.

### Evidence / references

- Current raw events record useful facts but not polished workstation-ready narratives.
- Dream Visibility already established the product rule that ClawFace should show understandable signals, not backend trace internals.

### Alternatives considered

- **Expose raw event rows and let the renderer narrate them all**: rejected because it makes the frontend overly responsible for backend semantics.
- **Reduce everything to one opaque summary card**: rejected because it loses the actual chronological value of the feature.

## Decision 4: Candidate timelines should be supported but not required for every event

### Decision

Workspace chronology is the guaranteed baseline; candidate-level timeline tracks are an enhanced path when the seam can supply stable candidate references.

### Rationale

The raw event types are uneven:

- promotion events already include candidate keys
- recall events currently point to result ranges, not always shared candidate ids
- dream completion events are phase/run oriented, not candidate oriented

The product should stay useful even while candidate linkage is partial.

### Evidence / references

- `memory.promotion.applied` includes candidate keys in the raw event shape
- `memory.recall.recorded` includes result path ranges
- `memory.dream.completed` captures phase/run completion without candidate lists

### Alternatives considered

- **Require candidate linking for every event before shipping**: rejected because it would stall the feature unnecessarily.
- **Ignore candidate linking entirely**: rejected because candidate provenance is a key part of the follow-up value.

## Decision 5: Keep the first timeline slice snapshot-based

### Decision

Dream Timeline v1 should load a bounded snapshot and refresh manually, not depend on a live event stream.

### Rationale

This keeps the feature aligned with Dream Visibility, reduces architectural churn, and avoids overcommitting to streaming semantics before users need them.

### Alternatives considered

- **Add a live event stream now**: rejected because it increases backend and frontend complexity without being necessary for the first slice.
- **Make the timeline static with no refresh**: rejected because users should be able to re-check recent chronology without reopening the pane.
