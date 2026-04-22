# Research: Dream Visibility

## Decision 1: Keep Dream Visibility as a session-adjacent inspector pane, not a new top-level shell view

### Decision

Implement Dream Visibility as an auxiliary inspector pane opened from the current chat/session context instead of extending `activeView` with another full-screen dashboard route.

### Rationale

ClawFace already has a clear product-shell split:

- `activeView` handles full auxiliary browser surfaces such as Files and Media
- chat remains the conversational/workstation center

The clarified Dream Visibility spec explicitly wants a session-adjacent pane. Reusing the chat shell keeps the feature anchored to the user’s current work context and avoids making dreaming feel like backend administration.

### Evidence / references

- ClawFace:
  - `src/app.tsx` already limits `activeView` to `chat | files | media`
  - `src/components/ChatView.tsx` already owns the primary session header/action language
  - `src/components/SessionSidebar.tsx` already surfaces shell-level entry points for Files and Media
- Spec:
  - `specs/002-dream-visibility/spec.md` clarifies the primary presentation as a session-adjacent inspector pane

### Alternatives considered

- **Add `dreams` as a fourth top-level `activeView`**: rejected because it turns the feature into another shell surface instead of a session-adjacent inspector.
- **Use a modal overlay only**: rejected because the feature benefits from persistent adjacent visibility and manual refresh while the user stays in the session.

## Decision 2: Add a dedicated shell-facing memory normalization seam

### Decision

Create a renderer-side normalization module for dream and memory-wiki payloads, following the existing `shell-gateway-*` pattern, instead of parsing `doctor.memory.status` and related methods inline in components or `app.tsx`.

### Rationale

ClawFace has already established a strong pattern for risky gateway parsing:

- `shell-gateway-state.ts`
- `shell-gateway-responses.ts`
- `shell-gateway-history.ts`
- `shell-gateway-config.ts`

Dream Visibility is another shell-facing domain that needs the same treatment. This keeps parsing, coercion, capability checks, and gateway-shape drift out of UI code.

### Evidence / references

- ClawFace:
  - `docs/APP-STATE-DOMAINS.md`
  - `src/lib/shell-gateway-state.ts`
  - `src/lib/shell-gateway-responses.ts`
  - `tests/shell-gateway-state.test.mjs`
  - `tests/shell-gateway-responses.test.mjs`
- OpenClaw:
  - `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/controllers/dreaming.ts`

### Alternatives considered

- **Parse dream payloads directly in `app.tsx`**: rejected because it recreates the centralization ClawFace has been intentionally unwinding.
- **Parse them only inside a `DreamInspectorPane` component**: rejected because it would make helper-level testing weaker and entangle rendering with data normalization.

## Decision 3: Build waiting, grounded, and promoted lanes from existing `doctor.memory.status` fields

### Decision

Use `shortTermEntries`, `signalEntries`, `promotedEntries`, and the visible count fields already returned by `doctor.memory.status` to derive the MVP overview and lanes.

### Rationale

The current gateway method already exposes enough for a meaningful v1:

- counts for short-term, grounded, signal, and promoted memory
- per-entry signal counts and phase-hit data
- grounded replay presence on short-term entries
- promoted entries directly

That lets ClawFace ship the spec’s requested lanes without waiting on a stronger backend summary seam.

### Evidence / references

- OpenClaw:
  - `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.test.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/controllers/dreaming.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/views/dreaming.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/docs/concepts/dreaming.md`

### Lane derivation

- **Waiting**: `shortTermEntries` where `groundedCount === 0`
- **Grounded**: `shortTermEntries` where `groundedCount > 0`
- **Promoted**: `promotedEntries`
- **Heating up / strongest**: ranked from signal-aware entries using visible totals such as `totalSignalCount`, `phaseHitCount`, `lightHits`, `remHits`, and recency when present

### Alternatives considered

- **Require a new `doctor.memory.summary` method before implementing the feature**: rejected for MVP because the current status method is already strong enough.
- **Clone the OpenClaw Dreams tab grouping one-for-one**: rejected because ClawFace needs a more signal-first, inspector-style interpretation.

## Decision 4: Treat the diary as a narrative layer parsed locally from snapshot data

### Decision

Load the dream diary as a snapshot on open/manual refresh and parse it locally into navigable narrative entries, while keeping candidate-to-diary relationships explicitly best-effort.

### Rationale

`doctor.memory.dreamDiary` returns file content, not structured candidate mappings. The best MVP fit is:

- snapshot load
- local parser for readable diary sections
- narrative context attached to candidate detail
- explicit “relationship detail is limited” fallback when precise linkage is unavailable

This matches the product goal of human-readable narrative without pretending the backend currently exposes an evidence graph.

### Evidence / references

- OpenClaw:
  - `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/src/gateway/server-methods/doctor.test.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/controllers/dreaming.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/views/dreaming.ts`

### Alternatives considered

- **Render raw Markdown or file text only**: rejected because it does not meet the legibility goal.
- **Claim deterministic candidate-to-diary evidence links from current APIs**: rejected because the current gateway shape does not support that claim safely.

## Decision 5: Load optional memory-wiki context lazily and match it best-effort

### Decision

Fetch `wiki.importInsights` and `wiki.palace` only when the user inspects a specific candidate, then derive related context using a small pure matching helper instead of assuming hard-linked relationships.

### Rationale

The clarified spec says optional related context should load on detail open, not on initial pane open. Current wiki payloads provide summaries and clusters, but not guaranteed cross-ids back to dream candidates. Best-effort matching plus honest fallback is the lowest-risk MVP.

### Evidence / references

- ClawFace:
  - `src/components/media-browser/MediaBrowser.tsx`
  - `src/hooks/useMediaBrowserController.ts`
  - `src/lib/media-browser-sources.ts`
- OpenClaw:
  - `/Users/oberon/Projects/coding/other/openclaw/extensions/memory-wiki/src/gateway.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/ui/src/ui/controllers/dreaming.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/docs/plugins/memory-wiki.md`

### Alternatives considered

- **Load wiki summaries eagerly with every pane open**: rejected because it makes the first render heavier and is unnecessary when many users will only inspect overview/lanes.
- **Hide cross-links entirely until a future relation API exists**: rejected because optional linkage still adds meaningful OpenClaw-native value today.

## Decision 6: Reserve dream timeline and event journal work for a future gateway seam backed by memory host events

### Decision

Document dream timeline/event journal as explicit future work that should depend on a new gateway seam shaped from the memory host event log, not on direct file access in ClawFace MVP.

### Rationale

OpenClaw already records memory host dream/recall/promotion events in `memory/.dreams/events.jsonl`, but that is not currently a frontend-ready gateway contract. Building timeline UI directly on raw files would violate the ClawFace product direction and create portability problems.

### Evidence / references

- OpenClaw:
  - `/Users/oberon/Projects/coding/other/openclaw/src/memory-host-sdk/events.ts`
  - `/Users/oberon/Projects/coding/other/openclaw/docs/plugins/memory-wiki.md`

### Alternatives considered

- **Read the event log file directly from ClawFace for MVP**: rejected because it leaks filesystem details and breaks remote/self-hosted portability.
- **Pretend current status/diary payloads already support a real timeline**: rejected because they do not expose chronological event history.

## Future renderer-side timeline strategy

If OpenClaw exposes a future dream journal seam, ClawFace should treat it as a second-level adjunct to Dream Inspector rather than as a replacement for the signal-first pane.

Recommended renderer strategy:

- keep the current Dream Inspector as the default entry because overview, lanes, and diary context answer the fastest user questions
- mount timeline/journal detail as a deeper adjacent context inside the same workstation shell, not as a detached admin dashboard
- normalize journal payloads in a dedicated helper seam parallel to `shell-gateway-memory.ts`
- keep candidate timelines and run/event journals optional so the MVP snapshot flow stays usable when the future seam is absent
- prefer explicit event groups such as dream run, replay grounding, and promotion moments over raw event-log rows
