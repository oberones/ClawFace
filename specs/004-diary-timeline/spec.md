# Feature Specification: Dream Diary Timeline

**Feature Branch**: `004-diary-timeline`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: User description: "Refactor the dream integration to provide only an interactive timeline of diary entries. User feedback suggests the current visual surface is boring and not helpful. Most users are just interested in reading diary entries."

## Product Framing

The dream integration should become a readable Dream Diary surface first. Recent feedback says the current signal-heavy dream visuals are not doing enough useful work for users. The product should respond by simplifying the dream experience around what people actually want to do: read diary entries, move through them over time, and understand that they are looking at OpenClaw's narrative memory activity.

In ClawFace product terms, this feature replaces the current "dream visibility" emphasis with a diary-led reading experience. The dream surface should feel like opening a workstation journal: a chronological list of entries on one side, a readable entry view on the other, and lightweight status around freshness or availability. It should not feel like a backend dashboard, a memory admin console, a scoring explainer, or a graph of internal memory mechanics.

## Relationship To Existing Dream Surfaces

This refactor intentionally narrows the dream UX.

- The primary dream surface becomes an interactive timeline of Dream Diary entries.
- Signal-first overview cards, heating-up memory summaries, waiting/grounded/promoted lanes, candidate timelines, and related-memory panels are out of the primary MVP.
- Existing dream status data may still be used for availability, disabled, refresh, or empty-state messaging when already available, but it should not drive the main visual experience.
- Existing related-context or candidate helpers should not remain visible unless a later spec reintroduces them around a proven diary-reading need.

The goal is not to delete useful code blindly. The goal is to make the user-facing dream integration simpler, more readable, and more obviously valuable.

## Current Data Reality

Dream Diary Timeline v1 MUST use only gateway surfaces currently available to ClawFace:

- `doctor.memory.dreamDiary` for diary content and diary freshness metadata
- `doctor.memory.status` only as optional support for disabled, unavailable, or workspace dream-state messaging

The feature MUST NOT depend on a new OpenClaw method, private backend filesystem reads, a live dream event stream, or companion OpenClaw changes. If the diary content does not contain reliably parseable per-entry dates, the UI must still preserve readability by showing an undated or document-level fallback rather than pretending to know exact chronology.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read The Dream Diary As A Timeline (Priority: P1)

As a ClawFace user, I want the Dreams surface to open directly into a chronological Dream Diary timeline so I can read what OpenClaw has been dreaming about without first interpreting memory signals or dashboard widgets.

**Why this priority**: This is the MVP. The user feedback says the current visual surface is not helpful and that diary reading is the real value.

**Independent Test**: Can be fully tested by opening the Dreams surface in a workspace with diary content and confirming that the user can see a chronological list of diary entries, select an entry, and read it in a focused entry view.

**Acceptance Scenarios**:

1. **Given** Dream Diary content contains multiple parseable entries, **When** the user opens Dreams, **Then** the first view is an interactive timeline of diary entries with the most relevant recent entry available for reading.
2. **Given** the user selects a timeline entry, **When** the entry opens, **Then** the diary text is presented as the primary content with readable typography, useful date context, and no competing signal-dashboard panels.
3. **Given** the previous dream integration included candidate lanes or signal overview surfaces, **When** the user opens the refactored Dreams surface, **Then** those surfaces no longer dominate the primary dream experience.

---

### User Story 2 - Move Through Diary Entries Efficiently (Priority: P2)

As a ClawFace user, I want to move through diary entries by date, selection, and simple navigation controls so I can browse the dream history like a journal rather than scanning a static document.

**Why this priority**: Reading one entry is useful, but the timeline earns its place when users can move through entries quickly and keep their place.

**Independent Test**: Can be fully tested by opening a diary with several entries and confirming that the user can jump between entries, see which entry is selected, refresh the diary snapshot, and return to the latest entry without losing orientation.

**Acceptance Scenarios**:

1. **Given** a diary has dated entries across multiple days, **When** the user browses the timeline, **Then** entries are grouped or labeled clearly enough for the user to understand their order.
2. **Given** the user has selected an older entry, **When** the user chooses a latest-entry affordance, **Then** the surface returns to the newest available diary entry.
3. **Given** the user refreshes the diary, **When** new diary content is available, **Then** the timeline updates while making the refreshed state legible.

---

### User Story 3 - Understand Diary Availability And Limits (Priority: P3)

As a ClawFace user, I want clear states when the diary is empty, disabled, unavailable, or only partly parseable so I can tell whether there is nothing to read, something is off, or ClawFace simply has limited structure to work with.

**Why this priority**: The simplified surface still needs honest state handling. Without clear availability states, a diary-only experience can look broken or blank.

**Independent Test**: Can be fully tested by opening Dreams in workspaces with no diary, disabled dreaming, unavailable gateway data, and diary content that cannot be split into dated entries.

**Acceptance Scenarios**:

1. **Given** Dream Diary content exists but entry dates cannot be parsed, **When** the user opens Dreams, **Then** the UI shows a readable undated or document-level diary fallback and labels the chronology as limited.
2. **Given** dreaming is disabled or unavailable for the workspace, **When** the user opens Dreams, **Then** the UI explains the condition without exposing backend method names or raw filesystem details as the main UX.
3. **Given** no diary content exists yet, **When** the user opens Dreams, **Then** the empty state distinguishes "nothing written yet" from disabled or broken behavior.

---

### Edge Cases

- What happens when the diary endpoint succeeds but returns empty content?
- What happens when diary content is present but contains no parseable entry boundaries?
- What happens when diary entries have headings but no reliable dates?
- What happens when multiple entries share the same date?
- How does the timeline behave when the diary freshness timestamp updates but parsed entries are unchanged?
- How does the UI behave when `doctor.memory.dreamDiary` fails but `doctor.memory.status` still succeeds?
- What happens when the dream status suggests dreaming is disabled but stale diary content still exists?
- How does the surface avoid implying exact event chronology when only diary text and file freshness are available?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Dream Diary Timeline as the primary dream integration surface in ClawFace.
- **FR-002**: The Dream Diary Timeline MUST prioritize reading diary entries over signal cards, memory lanes, candidate lists, score explanations, and graph-style visualization.
- **FR-003**: The system MUST let the user open the diary timeline from the existing Dreams entry point or equivalent dream-adjacent ClawFace navigation.
- **FR-004**: The first loaded dream view MUST present diary chronology or a diary availability state rather than a dashboard overview.
- **FR-005**: The timeline MUST derive its primary content from `doctor.memory.dreamDiary`.
- **FR-006**: The feature MAY use `doctor.memory.status` only to support disabled, unavailable, or availability messaging; it MUST NOT use status data for refresh metrics, candidate dashboards, signal cards, memory lanes, or status-driven primary UI.
- **FR-007**: The feature MUST NOT require a new OpenClaw gateway method, direct backend filesystem reads, or companion OpenClaw changes.
- **FR-008**: The system MUST parse diary content into user-readable entries when reliable entry boundaries can be derived from the diary text.
- **FR-009**: Each parsed diary entry MUST have a stable-enough UI identity for selection within the current loaded diary snapshot.
- **FR-010**: The timeline MUST present entries in a clear chronological order when dates are available.
- **FR-010A**: For entries with reliable dates, the timeline MUST sort newest-first; for heading-only or undated entries, the timeline MUST preserve source document order and treat the first displayed readable entry as the latest entry for navigation purposes.
- **FR-011**: The timeline MUST provide a readable fallback for undated or only partly parseable diary content instead of dropping content or inventing dates.
- **FR-012**: The selected diary entry MUST render in a focused reading pane or equivalent detail area where the diary text is the primary content.
- **FR-013**: The UI MUST visibly indicate the selected timeline entry and preserve user orientation while moving between entries.
- **FR-014**: The UI MUST provide a way to return to the latest available diary entry after browsing older entries.
- **FR-015**: The UI MUST provide a manual refresh affordance and make snapshot freshness understandable without implying a live dream event stream.
- **FR-016**: The feature MUST provide distinct loading, empty, disabled, unavailable, and limited-parse states.
- **FR-017**: If diary content exists but cannot be parsed into dated entries, the feature MUST label the chronology as limited and still allow the user to read the available content.
- **FR-018**: If dreaming appears disabled while diary content exists, the feature MUST allow reading existing diary content while making the disabled state clear.
- **FR-018A**: When dreaming is disabled but readable diary content exists, the Dreams surface MUST render the diary timeline and reader with a visible disabled note; it MUST reserve the disabled empty state for cases where dreaming is disabled and no readable diary content exists.
- **FR-019**: The feature MUST avoid raw backend method names, raw memory filesystem paths, score vectors, and internal ranking details in the primary user-facing experience.
- **FR-020**: The feature MUST fit ClawFace's desktop workstation model by behaving like adjacent readable context rather than a backend admin panel.
- **FR-021**: The feature MUST remove or hide the previous primary dream surfaces from the main dream flow when they compete with diary reading.
- **FR-022**: The feature MUST preserve enough structure for future diary-focused enhancements such as search, bookmarks, or per-entry references without requiring those enhancements in MVP.
- **FR-023**: The feature SHOULD reuse existing dream diary normalization or parsing helpers where they already fit, but MUST avoid retaining unnecessary candidate or signal parsing in the diary-only presentation.
- **FR-024**: The feature SHOULD keep optional context minimal in v1; related memory, imported insight, or memory palace links are out of MVP unless they are directly attached to a specific diary entry and do not distract from reading.
- **FR-025**: The feature MUST include manual regression coverage for reading flow, timeline navigation, limited-parse fallback, and dream availability states.

### Scope Boundaries and Non-Goals

- The MVP is an interactive Dream Diary timeline and focused diary-entry reader.
- Signal-first overview cards are out of scope for the refactored primary surface.
- Waiting, grounded, and promoted memory lanes are out of scope for the refactored primary surface.
- Candidate timelines and candidate-first detail views are out of scope for this refactor.
- Imported Insights and Memory Palace cross-links are out of scope unless a later diary-specific requirement proves they help reading.
- Dream scoring, "why this is sticking" explanations, raw event journals, graph visualizations, repair tools, cron controls, and backend configuration are out of scope.
- Exact dream-run history remains out of scope because current gateway surfaces do not expose it.

### Data Availability

#### Available today

- Dream Diary content from `doctor.memory.dreamDiary`
- Diary freshness metadata, such as a file update timestamp, when exposed by the current gateway response
- Optional dream status or disabled information from `doctor.memory.status` if already loaded by the dream integration

#### Limited or unavailable today

- Authoritative per-entry identifiers across diary rewrites
- Guaranteed diary entry date format
- Exact dream-run event history
- Full backend event ordering
- Safe candidate-to-diary provenance for every diary entry

## Key Entities *(include if feature involves data)*

- **Dream Diary Timeline**: The user-facing dream surface that lists diary entries over time and keeps the selected entry readable.
- **Diary Entry**: A parsed or fallback unit of diary content, with display text, optional date, optional heading, and snapshot-local identity.
- **Diary Timeline Group**: A date or limited-parse grouping that helps users browse multiple entries without needing raw document structure.
- **Diary Reading State**: The user's current selected entry, timeline position, freshness state, and any limited-parse or availability condition.
- **Diary Availability State**: A user-facing state such as loading, empty, disabled, unavailable, ready, or limited parse.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual testing, a user can open Dreams and begin reading a Dream Diary entry without first interpreting memory lanes, signal cards, or candidate lists.
- **SC-002**: In manual testing, a user can move between at least three diary entries and always tell which entry is currently selected.
- **SC-003**: In manual testing, a user can return to the latest diary entry after browsing older entries.
- **SC-004**: When diary content is present but not fully parseable, the user can still read the content and see that chronology is limited.
- **SC-005**: Empty, disabled, unavailable, and loading states are distinguishable without exposing raw backend method names or filesystem paths as the main experience.
- **SC-006**: Manual review recognizes the refactored Dreams surface as a diary-led ClawFace workstation surface rather than a memory dashboard or backend operations page.

## Manual Regression Checklist

- Open the Dreams entry point and confirm the first meaningful surface is the Dream Diary Timeline.
- Verify a workspace with multiple dated diary entries shows a navigable timeline and focused entry reader.
- Select older entries and confirm the selected state remains visible.
- Use the latest-entry affordance and confirm it returns to the newest diary entry.
- Refresh the diary snapshot and confirm freshness or update state is understandable.
- Verify empty diary behavior is distinct from disabled and unavailable behavior.
- Verify disabled dreaming with existing diary content still allows reading existing entries.
- Verify partly parseable diary content renders as readable limited chronology rather than disappearing.
- Verify previous signal cards, candidate lanes, and candidate timelines do not dominate the main dream flow.
- Verify the surface does not expose raw filesystem paths, score internals, or backend admin controls.

## Assumptions

- The current product feedback is strong enough to make diary reading the primary dream interaction for this refactor.
- ClawFace must continue to treat OpenClaw as read-only and must ship against current gateway surfaces only.
- The existing Dreams navigation affordance remains the likely entry point, but the content behind it should become diary-first.
- Snapshot-local diary entry identity is acceptable for MVP because current surfaces do not provide stable diary entry ids.
- Search, bookmarks, export, rich related-memory links, and entry annotations may be valuable later but are intentionally outside this MVP.
