# Contract: Dream Timeline Gateway Seam

## Purpose

Define the frontend-ready OpenClaw gateway seam needed for ClawFace Dream Timeline.

This contract intentionally replaces direct renderer access to `memory/.dreams/events.jsonl` with a normalized journal response that ClawFace can render safely and portably.

## Why a new seam is required

The raw memory host event log already captures useful backend events:

- `memory.recall.recorded`
- `memory.dream.completed`
- `memory.promotion.applied`

But the raw log is not sufficient as a UI contract because it:

- is filesystem-based rather than gateway-exposed
- does not group events into workstation-readable moments
- does not consistently provide candidate, diary, or durable-memory links
- would force ClawFace to reconstruct chronology from backend rows

## Proposed seam

Illustrative method names:

- `doctor.memory.timeline`
- `doctor.memory.events`

The exact name is less important than the shape of the response.

## Required response qualities

The seam should provide:

- stable timeline event-group ids
- event timestamps
- explicit grouped event kinds such as `dream-run`, `promotion-batch`, `recall-wave`, or `diary-entry`
- optional dreaming phase labels such as `light`, `deep`, or `rem`
- user-safe headline and summary fields
- optional stable candidate references shared with Dream Inspector status surfaces where possible
- optional diary-entry and promoted-memory links where available
- truncation metadata so the UI can explain when older history was omitted
- limitation metadata when relationships are partial

## Response sketch

```ts
type DoctorMemoryTimelinePayload = {
  workspaceScope: {
    agentId: string;
    label: string;
  };
  generatedAt: string;
  range: {
    startAt?: string;
    endAt?: string;
    truncated: boolean;
    limit?: number;
  };
  supportsCandidateTracks: boolean;
  eventGroups: Array<{
    id: string;
    kind: "dream-run" | "promotion-batch" | "recall-wave" | "diary-entry" | "mixed";
    headline: string;
    summary: string;
    startedAt: string;
    endedAt?: string;
    phase?: "light" | "deep" | "rem";
    rawEventCount: number;
    limitationNote?: string;
    candidateRefs: Array<{
      candidateKey?: string;
      path?: string;
      startLine?: number;
      endLine?: number;
      label: string;
      relationship: "direct" | "batched" | "inferred" | "limited";
      status?: "heating" | "grounded" | "promoted";
    }>;
    artifactLinks: Array<{
      kind: "diary-entry" | "promoted-memory" | "dream-candidate";
      targetId?: string;
      label: string;
      detail?: string;
      relationship: "direct" | "nearby" | "limited";
    }>;
  }>;
  candidateTracks?: Array<{
    candidateKey: string;
    headline: string;
    currentStatus?: "waiting" | "grounded" | "promoted";
    eventGroupIds: string[];
    limitationNote?: string;
  }>;
};
```

## Backend shaping guidance

The seam should prefer:

- grouped chronology over raw log rows
- explicit limitation flags over implicit missingness
- stable identifiers over string-only matching when possible
- user-safe summaries over hidden score internals

The seam should avoid:

- exposing raw filesystem paths as the main relationship mechanism
- mixing repair/admin commands into the same response
- requiring ClawFace to merge unrelated raw events into meaningful runs
- implying deterministic candidate provenance when only loose correlation exists

## ClawFace renderer expectations

When this seam exists, ClawFace should:

- normalize it in `shell-gateway-memory-timeline.ts`
- mount Dream Timeline as adjacent context from Dream Inspector
- keep timeline refresh snapshot-based in the first slice
- preserve Dream Inspector as the default dream landing surface
