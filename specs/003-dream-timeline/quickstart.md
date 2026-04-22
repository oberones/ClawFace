# Quickstart: Dream Timeline

## Goal

Validate Dream Timeline as a ClawFace-native chronological extension to Dream Inspector that explains dream runs, replay grounding, and promotion moments over time.

## Prerequisites

- ClawFace desktop app running locally
- OpenClaw gateway available
- An OpenClaw build that exposes the new dream timeline seam
- A workspace with enough dream history to show at least one dream run and one promotion or replay-related moment

## Automated Validation

Run:

```bash
make test-unit
make typecheck
make build
```

## Manual Validation

### 1. Open timeline from Dream Inspector

1. Launch ClawFace.
2. Open an active chat session.
3. Open Dream Inspector.
4. Open Dream Timeline from within the dream surface.
5. Confirm the UI stays in the same workstation shell instead of switching to a detached admin page.

### 2. Validate chronology and grouped event meaning

1. Confirm recent timeline entries appear in chronological order.
2. Confirm at least one dream run or phase completion moment is readable.
3. Confirm at least one promotion or replay-related moment is readable when present.
4. Confirm the copy summarizes chronology rather than exposing raw JSON-like log rows.

### 3. Validate candidate provenance

1. Open a timeline event with candidate references.
2. Confirm the candidate detail or candidate-filtered track is understandable.
3. Confirm limited relationship copy appears when candidate linkage is incomplete.

### 4. Validate adjacent artifact handoffs

1. Open a timeline event with a diary or promoted-memory link.
2. Confirm the handoff moves into nearby dream context rather than a backend-style debug page.

### 5. Validate unavailable and empty states

1. Test a workspace or gateway without the timeline seam.
2. Confirm Dream Inspector still works and the timeline affordance explains why chronology is unavailable.
3. Test a workspace with the seam enabled but no relevant history.
4. Confirm empty state is distinct from unavailable.

### 6. Validate snapshot semantics

1. Note the loaded-at state.
2. Trigger manual refresh.
3. Confirm the timeline updates as a snapshot rather than implying a live stream.

### 7. Regression checks

1. Confirm the existing Dream Inspector overview, lanes, diary flow, and related context still behave normally.
2. Confirm normal chat, Files, Media, and tool activity flows still behave normally after timeline integration.
