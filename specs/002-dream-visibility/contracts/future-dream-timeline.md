# Contract: Future Dream Timeline

## Purpose

Define a future OpenClaw gateway seam for Dream Timeline / Dream Journal work without coupling ClawFace MVP to raw memory host files.

## MVP boundary

This contract is explicitly out of MVP.

ClawFace v1 MUST NOT:

- read `memory/.dreams/events.jsonl` directly
- require event-stream or timeline access to make Dream Inspector useful
- expose raw event-log rows as the primary user experience

## Future seam goals

A future timeline seam should let ClawFace answer questions such as:

- when a dream run happened
- which candidate was replay-grounded versus newly heated up
- when a candidate promoted
- which visible phases contributed to a promotion or replay event

## Proposed seam shape

Illustrative future methods:

- `doctor.memory.timeline`
- `doctor.memory.events`

The exact name is less important than the contract shape: ClawFace needs a normalized, frontend-ready journal response rather than raw filesystem access.

## Contract expectations

The future seam should provide:

- stable event ids
- stable candidate ids shared with status/diary surfaces where possible
- event timestamps
- event kind labels such as `dream-run`, `grounded-replay`, `promotion`, or `diary-entry`
- lightweight user-safe explanation fields instead of hidden scoring internals
- optional links between events and visible diary entries or promoted memories

The future seam should avoid:

- backend repair or admin commands in the same response
- exposing opaque internal score vectors as user-facing truth
- requiring ClawFace to reconstruct chronology from raw files

## ClawFace renderer expectations

When this seam exists, ClawFace should:

- normalize it in a dedicated renderer seam parallel to `shell-gateway-memory.ts`
- present it as adjacent context from Dream Inspector, not a separate admin surface
- preserve the current signal-first overview as the primary landing view
