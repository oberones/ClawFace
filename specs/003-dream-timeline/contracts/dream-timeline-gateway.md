# Contract: Dream Timeline Current-Surface Boundary

## Purpose

Define the current integration boundary for Dream Timeline inside ClawFace.

This contract intentionally **does not** introduce a new OpenClaw gateway seam. Instead, it documents which existing gateway surfaces Dream Timeline may use and which chronology claims are blocked because current data does not support them.

## Allowed source surfaces

Dream Timeline v1 may derive its chronology only from:

- `doctor.memory.status`
- `doctor.memory.dreamDiary`
- `wiki.importInsights`
- `wiki.palace`

The timeline renderer should consume those sources through existing Dream Inspector normalization and helper seams, not through new raw gateway parsing inside components.

## Visible evidence available today

The current surfaces expose enough information to derive:

- promotion moments from candidate `promotedAt`
- replay touchpoints from candidate `lastRecalledAt`
- diary chronology from parsed diary entry dates or diary update metadata
- candidate status framing from current Dream Inspector lanes
- optional adjacent links into diary, Imported Insights, and Memory Palace context

## Blocked chronology claims

The current surfaces do **not** expose enough data to support:

- exact dream-run completion history
- exact replay wave journals beyond visible recall touchpoints
- backend-stable event ids
- authoritative event ordering across every dream artifact
- a current gateway method such as `doctor.memory.timeline`

When those missing capabilities matter, the feature must:

- omit that chronology type
- or label it as unavailable from current data

It must not fabricate that history or assume companion OpenClaw work as part of the slice.

## Derived model sketch

```ts
type DerivedDreamTimelineModel = {
  workspaceScopeLabel: string;
  workspaceScopeDetail: string;
  loadedAtMs: number | null;
  availability: "loading" | "ready" | "empty" | "disabled" | "unavailable" | "partial";
  range: {
    startAt?: string;
    endAt?: string;
    derivedFrom: Array<"promotedAt" | "lastRecalledAt" | "diaryDate" | "diaryUpdatedAt">;
  } | null;
  momentGroups: Array<{
    id: string;
    kind: "promotion" | "replay" | "diary-entry" | "diary-update" | "mixed" | "limited";
    headline: string;
    summary: string;
    timestamp: string;
    sourceKinds: Array<"promotedAt" | "lastRecalledAt" | "diaryDate" | "diaryUpdatedAt">;
    limitationNote?: string;
    candidateRefs: Array<{
      candidateKey?: string;
      label: string;
      relationship: "direct" | "grouped" | "inferred" | "limited";
      status?: "waiting" | "grounded" | "promoted";
    }>;
    artifactLinks: Array<{
      kind: "diary-entry" | "dream-candidate" | "related-insight" | "related-palace";
      targetId?: string;
      label: string;
      relationship: "direct" | "nearby" | "inferred" | "limited";
    }>;
  }>;
  candidateTracks: Array<{
    candidateKey: string;
    headline: string;
    currentStatus?: "waiting" | "grounded" | "promoted";
    momentGroupIds: string[];
    limitationNote?: string;
  }>;
};
```

## ClawFace renderer expectations

ClawFace should:

- reuse the existing Dream Inspector snapshot as the source of truth
- normalize and group visible chronology in `src/lib/dream-timeline.ts`
- keep link shaping and limitation handling in `src/lib/dream-timeline-links.ts`
- mount Dream Timeline as adjacent context from Dream Inspector
- preserve Dream Inspector as the default dream landing surface

ClawFace should not:

- read `memory/.dreams/events.jsonl` directly
- depend on unavailable gateway seams
- treat `loadedAtMs` as a timeline moment source
- imply that the UI is showing a complete backend dream-event journal
