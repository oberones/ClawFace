# Contract: Diary Timeline Boundaries

## Current Gateway Inputs

MVP may use:

- `doctor.memory.dreamDiary`
- `doctor.memory.status` only for disabled or availability context

MVP must not require:

- new OpenClaw gateway methods
- direct reads of `DREAMS.md` or other backend files from ClawFace
- dream event streams
- candidate provenance APIs
- Imported Insights or Memory Palace APIs for the primary diary reader

## `doctor.memory.dreamDiary` Assumptions

ClawFace expects a normalized diary source equivalent to:

```ts
type DreamDiarySource = {
  found: boolean;
  path: string;
  content: string | null;
  updatedAtMs: number | null;
  error: string | null;
};
```

Only `content` should drive readable diary entries. `updatedAtMs` may appear as freshness metadata only; it must not become an invented entry date. `path` may remain internal or appear only as subdued secondary metadata if needed; it should not become the primary UX.

## `doctor.memory.status` Assumptions

Status may be used to answer:

- whether dreaming appears disabled
- whether a dream status method is available
- whether a gateway supports dream visibility at all

Status must not drive:

- candidate cards
- waiting/grounded/promoted lanes
- signal metrics
- scoring explanations
- candidate-first related context

## Derived Renderer Model

The renderer should derive a diary timeline snapshot from the current diary source:

```ts
type DiaryTimelineAvailability =
  | "loading"
  | "ready"
  | "empty"
  | "disabled"
  | "unavailable"
  | "limited";

type DiaryTimelineEntryKind = "dated" | "heading" | "limited";
```

The exact TypeScript names can change during implementation, but the behavior boundary should stay intact: the primary dream model is diary entries and reading state, not candidates or memory signals.

## Future Related-Memory Boundary

Future Imported Insights and Memory Palace support should attach to a selected diary entry:

```ts
type DiaryEntryAttachment = {
  entryId: string;
  kind: "imported-insight" | "memory-palace";
  label: string;
  summary: string;
  target: {
    surface: "imported-insight" | "memory-palace";
    id: string;
  };
  relationship: "direct" | "inferred" | "limited";
};
```

MVP should preserve only this entry-scoped attachment boundary; it should not fetch, render, or navigate Imported Insights or Memory Palace attachments yet.

This future shape is intentionally entry-scoped. It should not require restoring the old candidate dashboard as the primary dream experience.
