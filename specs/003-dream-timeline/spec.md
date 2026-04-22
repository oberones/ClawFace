# Feature Specification: Dream Timeline

**Feature Branch**: `003-dream-timeline`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: User description: "Follow up Dream Visibility with a Dream Timeline feature as the next feature slice. Build on the Dream Visibility plan's future timeline and event journal work, and draft the follow-up spec/plan for a ClawFace-native timeline view into OpenClaw dream runs, replay grounding, promotion moments, and related diary context."

## Product Framing

Dream Visibility answers "what looks important right now?" Dream Timeline should answer "what happened over time, and why did this candidate get here?"

In product terms, Dream Timeline is not a separate admin console. It is a deeper chronological layer attached to Dream Inspector that helps the user understand:

- when dreaming phases ran
- when historical replay grounded a memory
- when a promotion batch happened
- how diary entries and durable memory changes relate to those events when that relationship is available

This feature should feel native to ClawFace's workstation model by opening as adjacent context from Dream Inspector, not as a detached operations dashboard. It should make background AI activity more legible without asking the user to inspect raw backend files or pretend that hidden score vectors are user-facing truth.

## Current Data Reality

OpenClaw already records memory host events in `memory/.dreams/events.jsonl`, including:

- `memory.recall.recorded`
- `memory.dream.completed`
- `memory.promotion.applied`

However, ClawFace MUST NOT read that file directly. The raw event log is not a frontend-ready contract and does not yet provide the grouped, user-safe, stable timeline shape this feature needs. This feature therefore depends on a new gateway seam such as `doctor.memory.timeline` or equivalent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Dream Chronology From Dream Inspector (Priority: P1)

As a ClawFace user, I want to open a Dream Timeline from Dream Inspector so I can quickly understand when recent dream runs, replay grounding, and promotion moments happened without leaving my current workstation context.

**Why this priority**: This is the MVP for the follow-up slice. If the timeline cannot explain recent chronology at a glance, the feature does not add enough value beyond the existing Dream Inspector.

**Independent Test**: Can be fully tested by opening Dream Inspector in a workspace where the timeline seam is available and confirming the user can identify recent dream runs, promotion moments, and replay-related events from a grouped chronological view.

**Acceptance Scenarios**:

1. **Given** the timeline seam is available and returns recent dream activity, **When** the user opens Dream Timeline from Dream Inspector, **Then** the timeline presents recent dream runs and promotion moments in chronological order with user-readable summaries.
2. **Given** Dream Timeline is opened from Dream Inspector, **When** the timeline renders, **Then** it stays visually and navigationally adjacent to the current workstation context rather than becoming a detached admin page.
3. **Given** the backend only exposes visible event categories and user-safe metadata, **When** the timeline explains what happened, **Then** it uses event timing, event kinds, candidate references, and phase labels without implying access to hidden scoring internals.
4. **Given** replay or recall-related chronology is present in the seam, **When** the user opens Dream Timeline, **Then** replay or recall waves are distinguishable from dream runs and promotion moments in the grouped chronology view.

---

### User Story 2 - Follow Candidate Provenance Over Time (Priority: P2)

As a ClawFace user, I want to inspect a candidate-oriented timeline so I can understand whether a memory heated up, got grounded by replay, or promoted across multiple dream events.

**Why this priority**: Once the user has a workspace-level chronology, the next valuable step is tracing one candidate through that chronology.

**Independent Test**: Can be fully tested by selecting a candidate with multiple related events and confirming the user can follow its visible progression across replay, dream phases, and promotion outcomes.

**Acceptance Scenarios**:

1. **Given** a selected candidate has timeline-linked events, **When** the user opens candidate timeline detail, **Then** the UI shows those related events in order and labels the candidate's visible status transitions clearly.
2. **Given** the backend cannot confidently relate a timeline event to a single candidate, **When** the user inspects that event, **Then** the UI marks the relationship as limited rather than inventing precision.
3. **Given** a candidate was promoted as part of a promotion batch, **When** the user reads its timeline, **Then** the timeline distinguishes that promotion moment from earlier replay or signal-building events.

---

### User Story 3 - Cross-Reference Timeline Events With Nearby Artifacts (Priority: P3)

As a ClawFace user, I want timeline events to link to nearby diary or durable-memory context when available so I can move between chronology and narrative without turning the feature into a raw event-log browser.

**Why this priority**: Cross-linking makes the timeline feel like part of a coherent workstation, but the main chronological value still exists without it.

**Independent Test**: Can be fully tested by opening timeline entries with companion diary or promoted-memory references and confirming the user can follow those links, while also verifying graceful fallback when the links are unavailable.

**Acceptance Scenarios**:

1. **Given** a timeline event includes a diary, candidate, or promoted-memory reference, **When** the user opens that event, **Then** the timeline exposes those links as adjacent contextual handoffs.
2. **Given** an event lacks diary links, candidate ids, or promoted-memory references, **When** the user inspects it, **Then** the timeline still reads coherently and explains the limited relationship state.
3. **Given** the timeline seam is unavailable for the current workspace or gateway, **When** the user looks for timeline context, **Then** Dream Inspector remains usable and the timeline affordance explains that chronological detail is unavailable.

---

### Edge Cases

- What happens when Dream Inspector works but the timeline seam is missing from the gateway?
- What happens when events exist but only some of them carry stable candidate identifiers?
- How does the UI behave when chronology is truncated by backend limits or retention windows?
- What happens when multiple promotion candidates are applied in one batch and need one grouped timeline moment?
- How does the timeline behave when diary content exists but no timeline-level diary link is available?
- What happens when events arrive from multiple workspaces or agents and the active ClawFace context is only one workspace?
- How does the feature communicate that a timeline is snapshot-based rather than a live event stream?
- What happens when older raw events exist in the log but do not carry enough metadata to support candidate-level linking?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Dream Timeline surface in ClawFace as an adjunct to Dream Inspector rather than as a detached top-level admin page.
- **FR-002**: Dream Timeline MUST present chronological dream visibility as a workstation-readable history layer, not as a raw event-log browser.
- **FR-003**: The system MUST let the user open Dream Timeline from existing Dream Inspector or equivalent adjacent dream context.
- **FR-004**: The system MUST preserve user orientation to the current workspace and MUST clearly communicate when the timeline is workspace-scoped rather than session-specific.
- **FR-004A**: Dream Timeline MUST display a visible workspace-scope label or equivalent scope copy so the user can tell that chronology is workspace-level unless the seam explicitly provides narrower provenance.
- **FR-005**: The feature MUST depend on a frontend-ready OpenClaw gateway seam for timeline data and MUST NOT read `memory/.dreams/events.jsonl` directly from ClawFace.
- **FR-006**: The gateway seam used by this feature MUST provide chronological event data with stable event identifiers and timestamps suitable for UI rendering.
- **FR-007**: The timeline MUST group or summarize events into user-readable chronology such as dream runs, recall or replay waves, and promotion moments instead of surfacing raw backend rows as the primary UX.
- **FR-008**: The timeline MUST expose recent dream run moments, including phase information when available.
- **FR-009**: The timeline MUST expose promotion moments, including promoted candidate references when available.
- **FR-010**: The timeline MUST expose replay or recall-related chronology when the seam provides enough data to make that history legible.
- **FR-011**: The feature MUST support candidate-oriented timeline inspection when stable candidate relationships are available from the seam.
- **FR-012**: When candidate relationships are partial or ambiguous, the system MUST mark the relationship as limited rather than inventing deterministic provenance.
- **FR-013**: The timeline MUST use only visible event metadata, event kind labels, timing, phase labels, and safe explanation fields when describing chronology.
- **FR-014**: The system MUST NOT expose hidden score vectors, raw ranking internals, or backend-only debugging details as user-facing truth in the timeline.
- **FR-015**: The feature MUST support optional links from timeline events into Dream Diary context, promoted memory, or other nearby Dream Inspector artifacts when those links are available.
- **FR-016**: When timeline links into adjacent artifacts are unavailable, the primary chronology flow MUST remain understandable and usable.
- **FR-017**: The feature MUST provide explicit loading, empty, unavailable, limited-relationship, and partial-data states for timeline rendering.
- **FR-018**: The feature MUST degrade gracefully when Dream Inspector is available but the timeline seam is unavailable.
- **FR-019**: The timeline MUST be understandable as a snapshot-based historical surface and MUST NOT require a live event stream to be useful in v1.
- **FR-020**: The feature MUST avoid becoming a memory repair, reset, cron-management, or configuration surface.
- **FR-021**: The feature MUST avoid giant graph-first visualization or forensic log-reader UX unless later evidence shows those are needed for the primary understanding flows.
- **FR-022**: The feature MUST support grouped chronological views for batch events such as promotions that affect multiple candidates at once.
- **FR-023**: The feature MUST allow ClawFace to show a workspace-level timeline first and candidate-specific chronology second, without requiring candidate-level fidelity for every event.
- **FR-024**: The gateway seam SHOULD provide stable candidate identifiers shared with Dream Inspector status surfaces where possible.
- **FR-025**: The gateway seam SHOULD provide diary, durable-memory, or candidate references in a normalized way so ClawFace can cross-link chronology to nearby artifacts without reconstructing relationships from raw files.
- **FR-026**: The timeline SHOULD present event groups with concise user-facing summaries rather than requiring the renderer to synthesize all narrative copy from raw event rows.
- **FR-027**: The feature MUST fit ClawFace's shell/navigation model by opening as adjacent runtime visibility within the chat workstation rather than as a new route stack.
- **FR-028**: The feature MUST remain independently valuable even when only workspace-level chronology is available and candidate-level linking is partial.

### Scope Boundaries and Non-Goals

- The MVP of this follow-up slice is chronological visibility into dream runs, replay/recall history, and promotion moments using a new gateway seam.
- A raw `events.jsonl` browser is out of scope.
- A live event stream, websocket feed, or continuous telemetry layer is out of scope for v1.
- Repair, reset, dedupe, cron-management, and dreaming configuration actions remain out of scope.
- A global multi-workspace memory operations center is out of scope.
- A graph explorer or backend debugger view is out of scope.
- Requiring timeline links for every event is out of scope for v1; limited relationships are acceptable when the seam cannot express them safely.

### Data Availability and Required New API Work

#### Available today, but not frontend-ready

- OpenClaw records memory host events in `memory/.dreams/events.jsonl`.
- Raw event types already include recall recording, dream completion, and promotion application events.
- The raw log does not currently provide a gateway seam or a grouped, ClawFace-ready chronology model.

#### Required for this feature

- A new OpenClaw gateway seam such as `doctor.memory.timeline`, `doctor.memory.events`, or equivalent.
- Stable event ids, timestamps, and grouped event kinds.
- Candidate references where available.
- Optional diary and promoted-memory references where available.
- User-safe explanation fields suitable for a workstation UI.

## Key Entities *(include if feature involves data)*

- **Dream Timeline Snapshot**: A user-visible chronology payload for the active workspace, including grouped event history and metadata about freshness or truncation.
- **Timeline Event Group**: A user-facing unit such as a dream run, replay wave, promotion batch, or diary-linked moment shown in chronological order.
- **Timeline Candidate Reference**: A normalized link from an event group to one or more dream candidates, including limited-relationship status when precision is weak.
- **Candidate Timeline Track**: A filtered or related sequence of event groups relevant to one selected candidate.
- **Timeline Artifact Link**: An optional reference from a timeline event into Dream Diary, promoted memory, or nearby Dream Inspector context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual testing, a user can open Dream Timeline from Dream Inspector and identify when the most recent dream run or promotion moment happened for the current workspace.
- **SC-002**: In manual testing, a user can distinguish at least one dream run, one promotion-related moment, and one replay or recall-related moment when the seam provides those events.
- **SC-003**: In manual testing, a user can inspect a candidate with timeline-linked history and understand whether it heated up, grounded, or promoted over time without reading raw event-log rows.
- **SC-004**: When timeline relationships are incomplete, the UI communicates that limitation explicitly and avoids overclaiming deterministic provenance.
- **SC-005**: When the timeline seam is unavailable, Dream Inspector remains usable and the timeline affordance clearly explains that chronological detail is unavailable.
- **SC-006**: Manual review recognizes the feature as an extension of ClawFace's workstation-style dream visibility rather than a backend operations console or filesystem viewer.

## Manual Regression Checklist

- Open Dream Inspector and confirm Dream Timeline opens as adjacent context rather than a detached dashboard.
- Verify loading, empty, unavailable, and limited-relationship timeline states are distinct.
- Verify recent dream runs display in chronological order with readable phase or run labels when available.
- Verify promotion batches show grouped promotion moments and candidate references when available.
- Verify at least one candidate-specific timeline view can be opened when candidate relationships exist.
- Verify timeline entries can hand off into diary or durable-memory context when links are present.
- Verify the UI clearly marks partial or limited relationships when event metadata is incomplete.
- Verify timeline refresh behavior reads as snapshot-based history, not a live stream.
- Verify Dream Inspector remains usable when the timeline seam is unavailable.

## Assumptions

- This feature is the first dream feature that intentionally depends on a new backend gateway seam.
- Dream Timeline will be opened from Dream Inspector or an equivalent dream-adjacent inspector context, not from a new top-level app route.
- The initial seam should prioritize grouped, user-safe chronology over raw event completeness.
- Candidate-level timeline fidelity will be partial for some events until OpenClaw can expose shared stable ids broadly enough.
- ClawFace should remain explicit that chronology is workspace-level unless the seam provides narrower provenance.
