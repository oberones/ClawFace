# Feature Specification: Dream Timeline

**Feature Branch**: `003-dream-timeline`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: User description: "Follow up Dream Visibility with a Dream Timeline feature as the next feature slice. Build on the Dream Visibility plan's future timeline and event journal work, and draft the follow-up spec/plan for a ClawFace-native timeline view into OpenClaw dream runs, replay grounding, promotion moments, and related diary context."

## Product Framing

Dream Visibility answers "what looks important right now?" Dream Timeline should answer "what visible evidence do we have for how this memory got here?"

Under the current repo boundary, Dream Timeline is not a true backend event journal. It is a workstation-style chronology derived from the dream signals ClawFace already receives today. In product terms, it should help the user:

- see recent promotion moments that are visible through `promotedAt`
- see replay touchpoints that are visible through `lastRecalledAt`
- read Dream Diary chronology alongside those moments
- understand candidate status changes using current lane placement plus visible timestamps
- move between chronology, diary, and nearby memory context without turning the feature into a log browser

This feature should feel native to ClawFace's workstation model by opening as adjacent context from Dream Inspector, not as a detached operations dashboard. It should make background AI activity more legible without pretending that ClawFace has access to a full backend dream-event journal when it does not.

## Current Data Reality

Dream Timeline v1 MUST use only gateway surfaces ClawFace already depends on today:

- `doctor.memory.status`
- `doctor.memory.dreamDiary`
- `wiki.importInsights`
- `wiki.palace`

Available timestamped evidence today includes:

- per-candidate `promotedAt`
- per-candidate `lastRecalledAt`
- Dream Diary entry dates when they can be parsed from the diary document
- diary file `updatedAtMs`
- the snapshot's own `loadedAtMs`

What is **not** available today as a frontend-ready contract:

- exact dream run completion history
- exact replay wave journals beyond the latest visible recall touchpoints
- stable backend event ids
- full event ordering across all dream artifacts
- a current gateway method such as `doctor.memory.timeline`

Therefore Dream Timeline v1 is a **signal-derived evidence timeline**, not a full dream-event journal. If a chronology claim cannot be supported by current surfaces, the UI MUST omit it or label it as limited rather than inventing precision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Visible Dream Chronology From Dream Inspector (Priority: P1)

As a ClawFace user, I want to open a Dream Timeline from Dream Inspector so I can quickly understand the visible promotion, replay, and diary chronology for the current workspace without leaving my workstation context.

**Why this priority**: This is the MVP for the follow-up slice. If the timeline cannot make currently visible chronology legible, the feature does not add enough value beyond the existing Dream Inspector.

**Independent Test**: Can be fully tested by opening Dream Inspector in a workspace with timestamped dream evidence and confirming the user can identify visible promotion moments, replay touchpoints, and diary chronology from a grouped timeline view.

**Acceptance Scenarios**:

1. **Given** the current dream snapshot contains `promotedAt`, `lastRecalledAt`, or diary-entry dates, **When** the user opens Dream Timeline from Dream Inspector, **Then** the timeline presents those visible moments in chronological order with user-readable summaries.
2. **Given** Dream Timeline is opened from Dream Inspector, **When** the timeline renders, **Then** it stays visually and navigationally adjacent to the current workstation context rather than becoming a detached admin page.
3. **Given** the current gateway surfaces do not expose exact dream-run history, **When** the timeline explains what happened, **Then** it clearly presents itself as evidence-based chronology rather than a complete backend event journal.
4. **Given** only some chronology types are visible in the current snapshot, **When** the timeline renders, **Then** the unavailable chronology types are omitted or labeled as limited instead of being fabricated.

---

### User Story 2 - Follow Candidate Evidence Over Time (Priority: P2)

As a ClawFace user, I want to inspect a candidate-oriented timeline so I can understand whether a memory visibly heated up, got replay touchpoints, or promoted based on the evidence ClawFace can already see.

**Why this priority**: Once the user has a workspace-level chronology, the next valuable step is tracing one candidate through the visible evidence that Dream Inspector already exposes.

**Independent Test**: Can be fully tested by selecting a candidate with visible timestamps and confirming the user can follow its promotion or recall touchpoints, with explicit limited-state messaging when chronology is inferred rather than direct.

**Acceptance Scenarios**:

1. **Given** a selected candidate has `lastRecalledAt` or `promotedAt`, **When** the user opens candidate timeline detail, **Then** the UI shows those visible moments in order and labels the candidate's current status clearly.
2. **Given** the timeline must infer chronology from current lane placement plus timestamps instead of backend event ids, **When** the user inspects that candidate, **Then** the UI marks the relationship as inferred or limited rather than inventing deterministic provenance.
3. **Given** a candidate lacks timestamped evidence but is still visible in Dream Inspector, **When** the user inspects it, **Then** the timeline explains that a fuller chronology is not available from the current surfaces.

---

### User Story 3 - Cross-Reference Chronology With Diary And Nearby Context (Priority: P3)

As a ClawFace user, I want timeline moments to link to diary entries and nearby memory context when available so I can move between chronology and narrative without turning the feature into a raw event-log browser.

**Why this priority**: Cross-linking makes the timeline feel like part of a coherent workstation, but the main chronological value still exists without it.

**Independent Test**: Can be fully tested by opening timeline entries with companion diary or related-memory context and confirming the user can follow those links, while also verifying graceful fallback when links are unavailable.

**Acceptance Scenarios**:

1. **Given** a timeline moment can be associated with a diary entry or related memory context from currently available surfaces, **When** the user opens that moment, **Then** the timeline exposes those links as adjacent contextual handoffs.
2. **Given** a moment lacks diary links or related context, **When** the user inspects it, **Then** the timeline still reads coherently and explains the limited relationship state.
3. **Given** optional related-context sources such as Imported Insights or Memory Palace are unavailable, **When** the user uses Dream Timeline, **Then** the primary chronology flow still works and explains that those adjacent links are unavailable.

---

### Edge Cases

- What happens when Dream Inspector works but none of the visible candidates carry `promotedAt` or `lastRecalledAt`?
- What happens when only promoted moments are visible and replay touchpoints are absent?
- How does the timeline behave when diary entries exist but no candidate relationship can be derived safely?
- What happens when multiple candidates share the same `promotedAt` or `lastRecalledAt` and should be grouped into one visible moment?
- How does the UI behave when the diary file exists but entry dates cannot be parsed?
- What happens when the current workspace has a usable Dream Inspector snapshot but not enough timestamped evidence for a meaningful timeline?
- How does the feature communicate that chronology is derived from a current snapshot rather than from a complete backend journal?
- What happens when the user expects dream-run completion history that the current gateway surfaces do not expose?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Dream Timeline surface in ClawFace as an adjunct to Dream Inspector rather than as a detached top-level admin page.
- **FR-002**: Dream Timeline MUST present chronology as a workstation-readable evidence layer, not as a raw event-log browser.
- **FR-003**: The system MUST let the user open Dream Timeline from existing Dream Inspector or equivalent adjacent dream context.
- **FR-004**: The system MUST preserve user orientation to the current workspace and MUST clearly communicate that the timeline is workspace-scoped rather than session-specific.
- **FR-004A**: Dream Timeline MUST display a visible workspace-scope label or equivalent scope copy so the user can tell that chronology is workspace-level.
- **FR-005**: The feature MUST use only currently available gateway surfaces and MUST NOT require a new OpenClaw method or direct reads of `memory/.dreams/events.jsonl`.
- **FR-006**: The feature MUST derive chronology only from visible timestamped evidence already exposed through `doctor.memory.status`, `doctor.memory.dreamDiary`, and optional existing related-context surfaces.
- **FR-007**: The timeline MUST group or summarize visible evidence into user-readable moments such as promotion moments, replay touchpoints, diary-entry moments, or other explicitly derived chronology units.
- **FR-008**: The timeline MUST expose visible promotion moments when `promotedAt` data is available.
- **FR-009**: The timeline MUST expose visible replay touchpoints when `lastRecalledAt` data is available.
- **FR-010**: The timeline MUST expose diary chronology when diary entries or diary update metadata can be parsed.
- **FR-010A**: If Dream Diary content exists but entry dates cannot be parsed and `updatedAtMs` is available, the timeline MAY show a single limited `diary-update` moment labeled as file-level diary evidence rather than as entry-level chronology.
- **FR-011**: The feature MUST support candidate-oriented timeline inspection when a visible candidate has enough timestamped evidence to support it.
- **FR-012**: When chronology is inferred from current lane placement and timestamps rather than direct backend event ids, the system MUST mark the relationship as inferred or limited rather than inventing deterministic provenance.
- **FR-013**: The timeline MUST use only visible metadata, current lane/status context, diary dates, timestamps, and safe explanation fields when describing chronology.
- **FR-014**: The system MUST NOT expose hidden score vectors, raw ranking internals, or backend-only debugging details as user-facing truth in the timeline.
- **FR-015**: The feature MUST support optional links from timeline moments into Dream Diary context and nearby Dream Inspector memory context when those links are available from current surfaces.
- **FR-015A**: Imported Insights and Memory Palace links MUST appear only for candidate-specific moments or selected-candidate timeline detail where a safe candidate relationship exists; grouped workspace moments without a clear candidate target MUST prefer diary or candidate handoff links instead of direct related-context links.
- **FR-016**: When timeline links into adjacent artifacts are unavailable, the primary chronology flow MUST remain understandable and usable.
- **FR-017**: The feature MUST provide explicit loading, empty, unavailable, limited-relationship, and partial-data states for timeline rendering.
- **FR-017A**: Snapshot freshness metadata such as `loadedAtMs` MAY be shown in the Dream Timeline header, but it MUST NOT create timeline moments or prevent the timeline from entering an `empty` state when no promotion, replay, or diary chronology evidence exists.
- **FR-017B**: If Dream Inspector reports that dreaming is disabled for the current workspace, Dream Timeline MUST surface a `disabled` state that explains chronology cannot be derived because dreaming is off.
- **FR-018**: The feature MUST degrade gracefully when Dream Inspector is available but the current snapshot does not contain enough timestamped evidence for a meaningful timeline.
- **FR-019**: The timeline MUST be understandable as a snapshot-based historical view and MUST NOT imply access to a live event stream or a complete event journal.
- **FR-020**: The feature MUST avoid becoming a memory repair, reset, cron-management, or configuration surface.
- **FR-021**: The feature MUST avoid giant graph-first visualization or forensic log-reader UX unless later evidence shows those are needed for the primary understanding flows.
- **FR-022**: The feature MUST support grouped chronology views for shared visible moments such as multiple candidates with the same promotion timestamp.
- **FR-023**: The feature MUST allow ClawFace to show a workspace-level timeline first and candidate-specific chronology second, without requiring perfect candidate fidelity for every moment.
- **FR-024**: The feature SHOULD reuse existing Dream Inspector normalization and controller data instead of building a second raw gateway parsing path.
- **FR-025**: The feature SHOULD present concise user-facing summaries rather than requiring the user to interpret raw timestamp fields on their own.
- **FR-026**: If a requested chronology type is not supportable from current surfaces, the feature MUST treat that gap as blocked or limited rather than treating future OpenClaw changes as part of the implementation slice.
- **FR-027**: The feature MUST fit ClawFace's shell/navigation model by opening as adjacent runtime visibility within the chat workstation rather than as a new route stack.
- **FR-028**: The feature MUST remain independently valuable even when only a subset of promotion, replay, diary, and related-context signals are available.

### Scope Boundaries and Non-Goals

- The MVP of this follow-up slice is a visible evidence timeline built from current Dream Inspector snapshot data and Dream Diary content.
- Exact dream-run completion history is out of scope because current gateway surfaces do not expose it.
- A raw `events.jsonl` browser is out of scope.
- A live event stream, websocket feed, or continuous telemetry layer is out of scope for v1.
- Repair, reset, dedupe, cron-management, and dreaming configuration actions remain out of scope.
- A global multi-workspace memory operations center is out of scope.
- A graph explorer or backend debugger view is out of scope.
- Requiring timeline links for every moment is out of scope for v1; limited relationships are acceptable when current surfaces cannot express them safely.

### Data Availability and Current Blockers

#### Available today

- `doctor.memory.status` with candidate lanes plus `promotedAt` and `lastRecalledAt`
- `doctor.memory.dreamDiary` with diary content and file update metadata
- optional Imported Insights and Memory Palace context already used by Dream Visibility

#### Not available today and therefore blocked from this slice

- exact dream-run completion chronology
- authoritative replay wave history beyond visible recall touchpoints
- backend-stable event ids
- a current gateway seam such as `doctor.memory.timeline`

## Key Entities *(include if feature involves data)*

- **Dream Timeline Snapshot**: A user-visible chronology model derived from the active Dream Inspector snapshot, diary parsing, and optional related context.
- **Timeline Moment Group**: A user-facing unit such as a promotion moment, replay touchpoint, diary-entry moment, or another explicitly derived chronology group.
- **Timeline Candidate Reference**: A normalized link from a timeline group to one or more dream candidates, including inferred or limited relationship status when precision is weak.
- **Candidate Timeline Track**: A filtered or related sequence of visible moments relevant to one selected candidate.
- **Timeline Artifact Link**: An optional reference from a timeline moment into Dream Diary, selected candidate detail, Imported Insights, or nearby Dream Inspector context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual testing, a user can open Dream Timeline from Dream Inspector and identify at least one visible promotion, replay, or diary moment for the current workspace when such evidence exists.
- **SC-002**: In manual testing, a user can tell whether the timeline is showing full visible evidence, limited evidence, or no usable chronology for the current workspace.
- **SC-003**: In manual testing, a user can inspect a candidate with visible timestamps and understand whether it shows replay touchpoints, promotion evidence, or only limited chronology.
- **SC-004**: When chronology relationships are inferred or incomplete, the UI communicates that limitation explicitly and avoids overclaiming deterministic provenance.
- **SC-005**: When the current snapshot lacks enough evidence for a meaningful timeline, Dream Inspector remains usable and the timeline affordance clearly explains why chronology is limited or unavailable.
- **SC-006**: Manual review recognizes the feature as an extension of ClawFace's workstation-style dream visibility rather than a backend operations console or filesystem viewer.

## Manual Regression Checklist

- Open Dream Inspector and confirm Dream Timeline opens as adjacent context rather than a detached dashboard.
- Verify loading, empty, unavailable, limited-relationship, and partial-data timeline states are distinct.
- Verify visible promotion moments display in chronological order when `promotedAt` data exists.
- Verify visible replay touchpoints display in chronological order when `lastRecalledAt` data exists.
- Verify diary entries appear in chronology when diary dates can be parsed.
- Verify at least one candidate-specific timeline view can be opened when a candidate has visible timestamped evidence.
- Verify timeline entries can hand off into diary or nearby related-memory context when links are present.
- Verify the UI clearly marks inferred or limited relationships when chronology cannot be derived directly.
- Verify timeline refresh behavior reads as snapshot-based history, not a live stream.
- Verify Dream Inspector remains usable when the current snapshot cannot support a meaningful timeline.

## Assumptions

- OpenClaw is read-only from this repo's point of view; this feature cannot depend on companion backend work.
- Dream Timeline will be opened from Dream Inspector or an equivalent dream-adjacent inspector context, not from a new top-level app route.
- The first slice prioritizes truthful chronology from current data over completeness.
- Candidate-level timeline fidelity will be partial for some moments because the current surfaces do not expose stable event ids.
- Exact dream-run history remains blocked until OpenClaw exposes it on an already available gateway surface.
