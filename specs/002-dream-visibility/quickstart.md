# Quickstart: Dream Visibility

## Goal

Validate the first implementation of Dream Visibility as a session-adjacent Dream Inspector that gives ClawFace users a signal-first view into OpenClaw dreaming, waiting versus grounded versus promoted memory, diary narrative, and optional related memory-wiki context.

## Prerequisites

- ClawFace desktop app running locally
- OpenClaw gateway available
- A workspace where `doctor.memory.status` returns dreaming data
- Ideally one workspace in each of these conditions:
  - dreaming enabled with visible candidates
  - dreaming enabled but no dream artifacts yet
  - dreaming disabled
  - memory-wiki enabled for imported insights and memory palace

## Automated Validation

Run:

```bash
make test-unit
make typecheck
make build
```

## Manual Validation

### 1. Open the inspector from session context

1. Launch ClawFace.
2. Open an active chat session.
3. Open Dream Inspector from the session-adjacent entry point.
4. Confirm the app stays in chat context and the inspector reads like an adjacent workstation pane rather than a separate dashboard.

### 2. Validate overview and state handling

1. Open the inspector in a populated dreaming workspace.
2. Confirm the top section communicates:
   - dreaming active versus disabled versus unavailable
   - strongest or heating-up items
   - signal totals and promotion context
3. Confirm the explanation copy uses visible counts or phase hits only and does not claim hidden scoring internals.

### 3. Validate waiting, grounded, and promoted lanes

1. Switch among waiting, grounded, and promoted lanes.
2. Confirm the lane labels and empty copy make the distinctions understandable.
3. Confirm grounded replay reads as different from still-waiting items.
4. Confirm promoted items read as already durable rather than merely active signals.

### 4. Validate candidate-first detail and diary reading

1. Open a candidate from each available lane.
2. Confirm the detail flow is candidate-first.
3. Confirm diary content appears as readable narrative context.
4. Confirm the UI clearly says relationship detail is limited when no precise diary-to-candidate mapping is available.

### 5. Validate snapshot refresh behavior

1. Open Dream Inspector and note the snapshot state.
2. Use the manual refresh action.
3. Confirm the pane visibly refreshes its snapshot without behaving like a live event stream.

### 6. Validate optional imported insights and memory palace linkage

1. In a workspace with `memory-wiki` enabled, open a candidate detail view.
2. Confirm related imported insights and memory palace context load on demand.
3. Confirm cross-links open as adjacent knowledge context, not as backend admin controls.

### 7. Validate graceful degradation

1. In a workspace without `memory-wiki`, open a candidate detail view.
2. Confirm the primary dream-inspection flow still works.
3. Confirm optional related context explains unsupported or unavailable status cleanly.

### 8. Validate disabled and empty states

1. Open the inspector in a workspace where dreaming is disabled.
2. Confirm the disabled state explains that dreaming is off without embedding configuration controls inline.
3. Open the inspector in a workspace with memory enabled but no dream artifacts yet.
4. Confirm the empty state is distinct from disabled and unavailable.

### 9. Regression checks

1. Confirm normal chat flows still work when the inspector is closed.
2. Confirm Files and Media surfaces still behave normally.
3. Confirm tool activity visibility in the thread still behaves normally.
4. Confirm session switching while the inspector is open does not lose orientation or crash the shell.
