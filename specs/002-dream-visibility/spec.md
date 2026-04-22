# Feature Specification: Dream Visibility

**Feature Branch**: `002-dream-visibility`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: User description: "Create a Dream Visibility feature for ClawFace that gives users a legible, workstation-style view into OpenClaw dreaming, memory consolidation, and related memory artifacts.

The feature should fit ClawFace’s product direction: desktop-first, OpenClaw-native, session-aware, and focused on making background AI activity visible and understandable rather than exposing backend admin internals.

For v1, specify a signal-first Dream Inspector rather than a generic “dreams dashboard.” It should help a user:
- see what memories are currently strongest or “heating up”
- understand which entries are still waiting, which are grounded by historical replay, and which have already promoted
- read the Dream Diary as a human-readable narrative layer
- cross-reference dreams with related memory structures like imported insights and memory palace pages when available
- understand “why this is sticking” at a lightweight level using currently available counts/signals, without requiring a deep backend scoring explainer yet

Assume v1 should primarily reuse existing OpenClaw gateway surfaces that already exist today:
- doctor.memory.status
- doctor.memory.dreamDiary
- wiki.importInsights
- wiki.palace

Assume v1 should not require a new backend method. If a stronger concept would benefit from a new gateway seam, call it out explicitly as future work and keep it out of MVP.

The spec should explicitly cover:
- user stories in priority order, with an MVP-first slice
- the core views for v1, likely including:
  - a signal-first overview
  - waiting vs grounded vs promoted memory lanes
  - a diary/evidence relationship
  - optional memory palace / imported insight cross-links
- what “dream visibility” means in product terms for ClawFace, and how it should differ from the existing OpenClaw Dreams UI
- how this feature should feel native to ClawFace’s session/workstation model instead of like a backend status page
- scope boundaries and non-goals for v1
- what data is available now versus what would require a future OpenClaw API addition
- how to present explanation without overclaiming: use currently exposed counts and phase hits, not hidden scoring internals
- loading, empty, disabled, and unavailable states
- how this feature relates to future possibilities like dream timelines, event journals, and richer promotion explanations
- measurable success criteria and a manual regression checklist for the core flows

Important non-goals for v1:
- do not turn this into a memory-admin/configuration panel
- do not require a new dream event-stream backend seam for MVP
- do not expose raw memory filesystem details as the main UX
- do not build a giant graph/visualization tool unless it clearly helps the first use cases
- do not simply reproduce the current OpenClaw Dreams tab one-for-one

The output should be a spec.md suitable for spec-kit, with clear assumptions where the current OpenClaw gateway surface is intentionally limited."

## Product Framing

Dream Visibility in ClawFace means making background memory consolidation legible inside the same desktop workstation where the user already chats, watches tool activity, and moves between sessions. The product goal is not to teach every internal dreaming mechanic. The goal is to answer practical questions such as:

- what seems to be strengthening right now
- what is still waiting versus historically grounded versus already promoted
- what story the Dream Diary is telling
- what related durable knowledge artifacts exist nearby

This should differ from the existing OpenClaw Dreams UI by emphasizing inspection and orientation over administration. ClawFace v1 should feel like a current-work surface for understanding background AI activity, not like a backend tab for toggles, repair actions, cron management, or raw file inspection.

Session-aware in v1 means the feature opens as a session-adjacent inspector pane from the user’s current working context in ClawFace, but it must stay honest about scope. Dreaming data is treated as workspace-level memory activity unless the available data explicitly supports a narrower claim.

## Clarifications

### Session 2026-04-22

- Q: Where should Dream Inspector primarily live in ClawFace? → A: Session-adjacent inspector pane opened from the current session context
- Q: How fresh should Dream Inspector be in v1? → A: Load a snapshot on open and provide explicit manual refresh
- Q: When should optional imported insight and memory palace context load? → A: Fetch related context when the user inspects a specific dream item
- Q: What should be the primary drill-down unit in Dream Inspector? → A: Candidate-first drill-down

### V1 Core Views

- **Signal-first overview**: a compact summary of dream readiness, strongest or heating-up memories, and the current shape of dream activity.
- **Memory lanes**: clear waiting, grounded, and promoted lanes that make state transitions legible.
- **Candidate-first detail flow**: the primary drill-down opens a dream candidate or memory item first, then shows its diary and related evidence context.
- **Diary and evidence relationship**: a readable Dream Diary layer paired with the related signals or items that give the narrative context.
- **Optional related-memory links**: imported insights and memory palace cross-references loaded when the user inspects a specific dream item, without making them mandatory for the primary flow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Dream State At A Glance (Priority: P1)

As a ClawFace user, I want a signal-first Dream Inspector that I can open from my current working context so I can quickly tell whether dreaming is active and which memories seem to be heating up without leaving the app or reading raw memory files.

**Why this priority**: This is the MVP slice. If the user cannot understand dream state at a glance, the rest of the feature becomes detail without orientation.

**Independent Test**: Can be fully tested by opening Dream Inspector from an active ClawFace context and confirming that the user can identify overall dream status, the strongest current items, and the main waiting or grounded or promoted distribution without using another surface.

**Acceptance Scenarios**:

1. **Given** dreaming data is available for the current workspace, **When** the user opens Dream Inspector, **Then** the first view shows a signal-first overview that highlights the strongest or heating-up memories and summarizes the current dream state.
2. **Given** the feature is opened from an active session or workstation context, **When** the overview loads, **Then** the user remains oriented to their current ClawFace context and the surface clearly communicates when dream data is workspace-level rather than session-local.
3. **Given** the backend only exposes counts, phase hits, and related status signals, **When** the UI explains why an item appears to be sticking, **Then** it uses those visible signals and does not imply access to hidden scoring internals.

---

### User Story 2 - Understand Where A Memory Sits (Priority: P2)

As a ClawFace user, I want to inspect waiting, grounded, and promoted memory lanes and read the Dream Diary alongside related evidence so I can understand where a memory sits in the consolidation flow and why it matters.

**Why this priority**: Once the user has orientation, the next job is interpretation. This is where Dream Visibility becomes more than a status badge and starts earning its place as a workstation surface.

**Independent Test**: Can be fully tested by opening a populated Dream Inspector, switching among the waiting, grounded, and promoted lanes, and opening at least one Dream Diary item to inspect how narrative and evidence relate.

**Acceptance Scenarios**:

1. **Given** dream items exist in multiple states, **When** the user switches between the waiting, grounded, and promoted lanes, **Then** each lane makes that state legible without requiring the user to infer meaning from raw backend terminology alone.
2. **Given** a Dream Diary narrative exists for a relevant item or run, **When** the user opens it, **Then** the diary reads as a human-facing narrative layer and shows the related evidence or clearly signals when the relationship detail is limited.
3. **Given** a memory has already promoted or has been grounded by historical replay, **When** the user inspects that item, **Then** the UI clearly distinguishes that status from still-waiting dream candidates.

---

### User Story 3 - Cross-Reference Related Memory Structures (Priority: P3)

As a ClawFace user, I want optional cross-links from dream activity into imported insights and memory palace pages when those structures exist so I can follow a durable idea across nearby memory surfaces without turning Dream Inspector into a wiki editor or backend browser.

**Why this priority**: Cross-linking makes the feature feel more OpenClaw-native and more like a personal workstation, but the core value still exists without it.

**Independent Test**: Can be fully tested by opening Dream Inspector in a workspace where related imported insights or memory palace pages are available and confirming that the user can follow those links, while also confirming graceful behavior when they are unavailable.

**Acceptance Scenarios**:

1. **Given** a dream item has related imported insight or memory palace context available, **When** the user inspects that item, **Then** the surface exposes those related artifacts as optional follow-on context.
2. **Given** the optional related-memory surfaces are unavailable, disabled, or unsupported for the current workspace, **When** the user opens Dream Inspector, **Then** the primary dream flows still work and the UI explains that the companion knowledge views are unavailable instead of surfacing raw method or plugin errors.
3. **Given** the user opens a related imported insight or memory palace reference, **When** that handoff occurs, **Then** the relationship feels like moving to adjacent workstation context rather than leaving for a backend admin panel.

---

### Edge Cases

- What happens when dreaming is disabled for the current workspace?
- What happens when memory is available but no dream artifacts or diary entries exist yet?
- How does the feature behave when `doctor.memory.status` succeeds but Dream Diary data is empty, stale, or temporarily unavailable?
- How does the feature behave when optional related-memory surfaces are missing because the companion wiki layer is not enabled?
- What happens when the user opens Dream Inspector from a session context even though the available data is workspace-scoped rather than session-specific?
- How does the feature behave when narrative text exists but item-level evidence mapping is partial or ambiguous?
- What happens when grounded replay content is present but no promoted items exist yet?
- How does the feature communicate partial freshness or a lag between the latest dream sweep and the currently visible diary content?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated Dream Inspector surface in ClawFace.
- **FR-002**: The Dream Inspector MUST present dream visibility as a workstation-readable inspection surface, not as a memory administration or configuration panel.
- **FR-003**: The system MUST let the user open Dream Inspector from an existing ClawFace working context without requiring the user to navigate raw backend files or a separate admin-first UI.
- **FR-003A**: The primary v1 presentation MUST be a session-adjacent inspector pane opened from the current session context, not a detached top-level admin page.
- **FR-004**: The Dream Inspector MUST preserve user orientation to the current workspace and, when opened from a session context, MUST make clear whether the displayed dream data is workspace-level or session-specific.
- **FR-005**: V1 MUST provide a signal-first overview that communicates overall dream readiness or availability plus the memories that currently appear strongest or are heating up.
- **FR-006**: The overview MUST use only currently exposed counts, phase hits, availability flags, and other visible signals when explaining why an item appears to be sticking.
- **FR-007**: The system MUST NOT imply access to hidden or exact scoring internals that are not currently exposed by the available data surfaces.
- **FR-008**: V1 MUST present distinct waiting, grounded, and promoted lanes, or equally legible equivalents, so that the user can understand where a memory sits in the dream flow.
- **FR-009**: The waiting lane MUST communicate that the memory has not yet promoted.
- **FR-010**: The grounded lane MUST communicate that the memory is supported by historical replay or grounded backfill rather than only live short-term dreaming.
- **FR-011**: The promoted lane MUST communicate that the memory has already reached durable promotion.
- **FR-012**: The system MUST provide a readable Dream Diary layer that prioritizes human comprehension over raw file or trace presentation.
- **FR-012A**: V1 MUST use a candidate-first drill-down model in which the user primarily opens a dream candidate or memory item, with diary and related context attached to that detail view.
- **FR-013**: The system MUST show the relationship between diary narrative and related evidence or memory items whenever that relationship can be derived from current data.
- **FR-014**: When a diary-to-evidence relationship cannot be derived confidently, the system MUST say that the relationship detail is limited instead of inventing precision.
- **FR-014A**: V1 MAY present a diary-to-candidate relationship as directly related only when that relationship can be derived from visible overlap such as matching candidate text, shared promoted memory text, or a clearly corresponding named item in the currently loaded snapshot; otherwise it MUST present the diary as nearby narrative context with an explicit limited-relationship label.
- **FR-015**: The system MUST support optional cross-references to imported insights and memory palace pages when those related structures are available in the current workspace.
- **FR-016**: The system MUST treat imported insights and memory palace cross-links as adjunct context, not as a requirement for the primary dream-inspection flow.
- **FR-016A**: V1 MUST load optional imported insight and memory palace context when the user inspects a specific dream item rather than requiring those companion surfaces to load eagerly on initial open.
- **FR-017**: When companion wiki data is unavailable, disabled, or unsupported, the system MUST degrade gracefully and keep the primary Dream Inspector usable.
- **FR-017A**: When the user opens an imported insight or memory palace reference from Dream Inspector, the handoff MUST reuse an existing ClawFace shell navigation or adjacent-context pattern rather than opening a backend-admin-style surface.
- **FR-018**: V1 MUST rely on existing gateway-visible data surfaces and MUST NOT require a new backend method to deliver the MVP slice.
- **FR-019**: V1 MUST NOT require a dream event stream, live telemetry feed, or step-by-step backend replay in order to be useful.
- **FR-020**: V1 MUST NOT use raw memory filesystem details as the primary interaction model.
- **FR-021**: V1 MUST NOT reproduce the existing OpenClaw Dreams UI one-for-one if doing so would make the feature feel like a backend status tab instead of a ClawFace workstation surface.
- **FR-022**: The Dream Inspector MUST emphasize what matters now to the user, including strongest current items, readable state lanes, and diary context, over backend maintenance controls.
- **FR-023**: The system MUST provide explicit loading, empty, disabled, unavailable, and partial-data states with user-facing explanations that distinguish those conditions from one another.
- **FR-023A**: V1 MUST load a dream snapshot when the inspector opens and MUST provide an explicit manual refresh action; it MUST NOT depend on continuous live updating to be understandable.
- **FR-023B**: If the primary dream snapshot loads but diary content or companion related-memory context is missing, stale, or fails independently, the inspector MUST remain usable and present that condition as partial data rather than as full failure.
- **FR-024**: If dreaming is disabled, the system MUST explain that dream visibility is unavailable because dreaming is off, and it MAY direct the user to the existing OpenClaw control surface rather than embedding configuration controls inline.
- **FR-025**: If no dream artifacts exist yet, the system MUST distinguish that empty state from disabled or broken behavior.
- **FR-026**: The feature MUST feel native to ClawFace’s session and workstation model by reading like adjacent runtime visibility, similar in spirit to tool activity visibility, rather than a detached dashboard.
- **FR-027**: The MVP slice MUST be independently valuable with the signal-first overview, state lanes, and diary reading flow even when optional related-memory links are absent.
- **FR-028**: The system MUST make scope boundaries explicit, including that session-aware entry does not automatically mean session-level dream provenance.
- **FR-029**: The feature MUST avoid giant graph or visualization-first treatments unless they are clearly necessary to satisfy the primary understanding flows.
- **FR-030**: The feature MUST support future expansion toward dream timelines, event journals, and richer promotion explanations without requiring those capabilities in v1.

### Scope Boundaries and Non-Goals

- The MVP slice is the Dream Inspector itself: signal-first overview, waiting or grounded or promoted lanes, and readable Dream Diary inspection.
- Optional imported insight and memory palace cross-links are in scope only as related context, not as full editing or management surfaces.
- Repair, reset, dedupe, backfill-trigger, cron-management, and configuration actions are out of scope for v1.
- Raw filesystem browsing of `DREAMS.md`, `MEMORY.md`, `memory/`, or dream artifact folders is out of scope as the primary UX.
- A global multi-workspace dreaming operations center is out of scope for v1.
- A giant graph explorer, candidate-debugger, or backend scoring explainer is out of scope for v1.
- A new backend dream event-stream seam is out of scope for MVP.

### Current Data Availability and Future API Seams

#### Available now for MVP

- `doctor.memory.status` can be treated as the current status and signal surface for the active default agent workspace.
- `doctor.memory.dreamDiary` can be treated as the current human-readable diary and dreaming narrative surface.
- `wiki.importInsights` and `wiki.palace` can be treated as optional companion knowledge surfaces when the related wiki layer is available.
- Current exposed data is sufficient for lightweight explanation based on visible counts, phase hits, diary state, and companion artifact availability.
- Current exposed data is not sufficient to claim a full per-item scoring breakdown or exhaustive per-session provenance map.

#### Likely future API additions, intentionally out of MVP

- A frontend-ready dream summary seam that returns normalized overview, lanes, diary links, and companion artifact links in one response.
- Stable candidate-level identifiers and relationships shared across status, diary, and promoted memory artifacts.
- Rich evidence maps that connect one dream item to explicit historical notes, replay sources, or session origins.
- A dream timeline or event journal seam for chronological replay of dream phases and promotions.
- Richer promotion explanations that expose the backend’s scoring factors safely enough for user-facing explanation.

### Key Entities *(include if feature involves data)*

- **Dream Snapshot**: The current user-visible summary of dream readiness, signal counts, lane distribution, and high-salience items for one workspace.
- **Dream Candidate**: A memory item or signal cluster that appears in Dream Inspector as waiting, grounded, or promoted.
- **Dream Lane**: A legible state grouping that tells the user whether a memory is still waiting, grounded by replay, or already promoted.
- **Dream Diary Entry**: A human-readable narrative record of dreaming or replay activity that helps explain memory movement over time.
- **Related Memory Artifact**: Optional adjacent knowledge context such as an imported insight or memory palace page that can be cross-referenced from dream activity.
- **Explanation Cue**: A lightweight user-facing reason signal, such as counts, phase hits, replay grounding, or promotion status, that helps explain why a memory appears to be sticking.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual testing, a user can open Dream Inspector from a current ClawFace working context and quickly determine whether dreaming is active, disabled, unavailable, or simply empty for the current workspace.
- **SC-002**: In manual testing, a user can identify at least one representative item as waiting, grounded, or promoted without reading raw memory files or leaving ClawFace.
- **SC-003**: In manual testing, a user can open a Dream Diary narrative and either connect it to related evidence or clearly see that relationship detail is limited, with no hidden-score claims.
- **SC-004**: In workspaces where companion knowledge artifacts exist, a user can open at least one imported insight or memory palace cross-reference from Dream Inspector; in workspaces where they do not exist, the feature remains understandable and usable without broken admin-style errors.
- **SC-005**: The v1 feature does not require a new backend method, event-stream seam, raw filesystem browser, or scoring-debugger view to satisfy the primary user stories.
- **SC-006**: The Dream Inspector is recognizable in manual review as a ClawFace workstation surface rather than a direct clone of the OpenClaw Dreams tab or a backend status page.

## Manual Regression Checklist

- Open Dream Inspector from an active ClawFace session and confirm the current workspace context remains legible.
- Verify the signal-first overview communicates active versus disabled versus unavailable versus empty state distinctly.
- Verify the overview can point to strongest or heating-up items without claiming hidden scoring details.
- Switch among waiting, grounded, and promoted lanes and confirm each lane’s meaning is understandable.
- Open at least one Dream Diary item and confirm the narrative is readable and paired with related evidence or an explicit limitation notice.
- Validate a populated workspace where optional imported insights or memory palace references are available and confirm those links open as adjacent context.
- Validate a workspace where optional companion wiki surfaces are unavailable and confirm the Dream Inspector still works without surfacing raw method failures as the primary UX.
- Validate that opening Dream Inspector loads a fresh snapshot and that manual refresh visibly updates the snapshot state without implying a continuous live event stream.
- Validate a workspace where dreaming is disabled and confirm the disabled copy explains the state without embedding a configuration panel inline.
- Validate a workspace with memory enabled but no dream artifacts yet and confirm the empty state is distinct from disabled or unavailable.
- Confirm the feature does not default to raw filesystem browsing, giant graph exploration, or backend maintenance actions in the primary flow.

## Assumptions

- V1 can reuse the currently available gateway surfaces `doctor.memory.status` and `doctor.memory.dreamDiary`, plus optional `wiki.importInsights` and `wiki.palace` when the companion wiki layer is enabled.
- Dream visibility data available in v1 is workspace-scoped unless the current gateway surface explicitly provides narrower provenance.
- V1 freshness is snapshot-based: the inspector loads current visible data on open and relies on explicit user refresh instead of continuous background updates.
- ClawFace should present Dream Inspector as a workstation-native sibling to other runtime visibility surfaces rather than as a copy of OpenClaw’s backend control UI.
- Imported insights and memory palace links are optional related context, not prerequisites for the MVP slice.
- Users who need repair, reset, dedupe, backfill, or configuration actions can continue using existing OpenClaw admin or control surfaces outside the Dream Inspector.
- V1 explanations should stay lightweight because the currently exposed data surfaces do not provide a safe, complete scoring explainer.
