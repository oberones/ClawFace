# Quickstart: Dream Timeline

## Goal

Validate Dream Timeline as a ClawFace-native chronological extension to Dream Inspector that explains visible promotion, replay, and diary chronology from the data ClawFace already has today.

## Prerequisites

- ClawFace desktop app running locally
- OpenClaw gateway available
- A workspace with enough dream evidence to show at least one visible promotion moment, replay touchpoint, or diary entry chronology
- No OpenClaw backend changes are required for this slice

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

### 2. Validate visible chronology meaning

1. Confirm visible timeline entries appear in chronological order.
2. Confirm promotion moments are readable when `promotedAt` data is present.
3. Confirm replay touchpoints are readable when `lastRecalledAt` data is present.
4. Confirm diary chronology appears when diary dates can be parsed.
5. Confirm the copy presents evidence-based chronology rather than pretending to show a full backend event journal.

### 3. Validate candidate provenance

1. Open a candidate with visible timestamps.
2. Confirm the candidate detail or candidate-filtered track is understandable.
3. Confirm inferred or limited relationship copy appears when chronology cannot be tied directly.

### 4. Validate adjacent artifact handoffs

1. Open a timeline moment with a diary or nearby related-context link.
2. Confirm the handoff moves into nearby dream context rather than a backend-style debug page.

### 5. Validate sparse and empty states

1. Test a workspace where Dream Inspector works but there is not enough timestamped evidence for a meaningful timeline.
2. Confirm the timeline explains why chronology is limited or empty.
3. Test a workspace with only one visible chronology type, such as promotions but no replay touchpoints.
4. Confirm the missing chronology type is omitted or labeled as unavailable from current data rather than fabricated.

### 6. Validate snapshot semantics

1. Note the loaded-at state in Dream Inspector.
2. Trigger the existing manual refresh.
3. Confirm the timeline updates as derived snapshot history rather than implying a live stream.

### 7. Regression checks

1. Confirm the existing Dream Inspector overview, lanes, diary flow, and related context still behave normally.
2. Confirm normal chat, Files, Media, and tool activity flows still behave normally after timeline integration.
