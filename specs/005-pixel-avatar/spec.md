# Feature Specification: Pixel-Art Session Avatar

**Feature Branch**: `005-pixel-avatar`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Add an animated pixel-art avatar to ClawFace as a desktop-native status and personality surface for the active OpenClaw session."

## Clarifications

### Session 2026-04-25

- Q: Where should the avatar live in the ClawFace UI? → A: In its own lower-left status pane below the Sessions pane.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Active Session Runtime State At A Glance (Priority: P1)

As a ClawFace user, I want a small pixel-art avatar near the active conversation context so I can quickly understand whether the current OpenClaw session is idle, thinking, responding, running a tool, waiting for approval, or disconnected without losing the chat-centered workflow.

**Why this priority**: This is the core value of the feature. The avatar must reinforce real runtime status before it adds personality.

**Independent Test**: Can be fully tested by driving the app through idle, thinking, streaming, tool-running, approval-needed, and disconnected states using existing ClawFace/OpenClaw signals and verifying that the avatar changes state without hiding existing status, approval, connection, or tool UI.

**Acceptance Scenarios**:

1. **Given** ClawFace is connected to OpenClaw and the active session has no request in progress, **When** the user views the chat surface, **Then** the avatar appears in an idle visual state and the existing chat controls remain primary.
2. **Given** a user sends a prompt and ClawFace has an in-flight request before response text streams, **When** the session enters its thinking state, **Then** the avatar changes to a thinking visual state while existing progress/status indicators remain visible.
3. **Given** response text is actively streaming for the active session, **When** new stream text arrives, **Then** the avatar shows a streaming/responding state without causing message layout jumps.
4. **Given** one or more tool items are active for the current session, **When** tool execution is visible in existing tool activity UI, **Then** the avatar shows a tool-running state that reinforces the same tool activity.
5. **Given** OpenClaw requires user approval for an action, **When** the approval prompt is visible through existing approval UI, **Then** the avatar shows an approval-needed state and does not replace or obscure the explicit approval controls.
6. **Given** ClawFace is disconnected or requires pairing, **When** the active session cannot communicate with OpenClaw, **Then** the avatar shows a disconnected or pairing-required state alongside existing connection recovery UI.

---

### User Story 2 - Understand Final Response Tone From Explicit Outcomes (Priority: P2)

As a user, I want the avatar to briefly reflect clear final response outcomes such as success, serious information, caution, or blocked/guardrail outcomes when ClawFace already has explicit signals for those outcomes.

**Why this priority**: It adds useful personality and scanability, but it must be subordinate to live runtime state and must not invent emotional classification.

**Independent Test**: Can be tested by replaying or mocking completed responses with explicit success, serious, cautionary, blocked, denied, or error outcomes and verifying that the avatar chooses the matching final-response state only when those signals are available.

**Acceptance Scenarios**:

1. **Given** a response completes successfully with an explicit success/completion outcome, **When** no higher-priority runtime state is active, **Then** the avatar briefly shows an excited/successful response state before returning to idle.
2. **Given** a response is associated with an explicit serious or cautionary outcome already surfaced by ClawFace/OpenClaw, **When** the response completes, **Then** the avatar briefly shows the corresponding serious or cautionary state.
3. **Given** a response is blocked, denied, refused, or guardrail-limited by an existing explicit outcome, **When** that outcome is visible in the conversation, **Then** the avatar shows a warning/blocked state and the explicit blocked/denied UI remains visible.
4. **Given** no explicit outcome signal exists for a completed response, **When** the response finishes normally, **Then** the avatar uses the default successful-or-idle behavior and does not infer mood from response text.

---

### User Story 3 - Respect Reduced Motion And Animation Settings (Priority: P2)

As a user who disables animation or uses reduced-motion settings, I want the avatar to remain informative without animated motion.

**Why this priority**: Motion sensitivity and app-wide animation preferences are product requirements, not polish. The avatar must not become an exception to existing behavior.

**Independent Test**: Can be tested by enabling existing reduced-motion or animation-disabled behavior and verifying that every avatar state renders as a static, recognizable frame with no looping animation.

**Acceptance Scenarios**:

1. **Given** animation is enabled, **When** the avatar enters thinking, streaming, tool-running, or approval-needed states, **Then** it may use tasteful low-intensity animation appropriate to a small desktop status surface.
2. **Given** animation is disabled through existing animation or reduced-motion behavior, **When** any avatar state is active, **Then** the avatar shows a static representative frame for that state.
3. **Given** animation settings change while ClawFace is open, **When** the preference is applied, **Then** the avatar updates without requiring a session reload.

---

### User Story 4 - Preserve A Small Desktop-Native Companion Surface (Priority: P3)

As a user, I want the avatar to make ClawFace feel more personal without becoming a mascot, landing-page element, or distraction from the active session.

**Why this priority**: The avatar should improve the feel of the daily-use desktop app, but it must not compete with chat, tools, media, approvals, or connection recovery.

**Independent Test**: Can be tested by viewing normal chat, long streaming responses, active tool output, approval prompts, disconnected states, and narrow window sizes to confirm that the avatar stays small, tasteful, and non-blocking.

**Acceptance Scenarios**:

1. **Given** the user is working in an active chat, **When** the avatar is visible, **Then** it occupies a small fixed lower-left pane below the Sessions pane and does not overlap messages, the composer, session navigation, media previews, tool activity, or approval controls.
2. **Given** the window is resized to compact desktop widths supported by ClawFace, **When** the chat surface reflows, **Then** the avatar remains legible or gracefully reduces/hides according to available space without breaking the workflow.
3. **Given** users inspect existing explicit status UI, **When** the avatar is present, **Then** it reinforces those statuses and does not become the only source of critical information.

---

### User Story 5 - Keep The Feature Future-Friendly Without Expanding MVP Scope (Priority: P3)

As a future ClawFace maintainer, I want the avatar system to have clear conceptual boundaries so later versions can support agent-specific skins or OpenClaw-provided mood/status metadata without rewiring core chat behavior.

**Why this priority**: The first version should avoid speculative systems while still preventing another gravity well inside the chat surface.

**Independent Test**: Can be tested by reviewing the specification, plan, and implementation boundary to confirm that avatar state selection, rendering assets, and runtime signal adaptation are separable concerns.

**Acceptance Scenarios**:

1. **Given** the MVP includes only one default avatar, **When** future skin support is considered, **Then** the current behavior can be extended through a defined avatar profile/state mapping rather than changing OpenClaw protocol assumptions.
2. **Given** OpenClaw may someday provide mood or richer status metadata, **When** that metadata becomes available, **Then** it can be treated as an optional input to avatar state selection rather than a dependency for MVP behavior.

### Edge Cases

- If multiple states are true at once, the avatar uses deterministic priority order: disconnected or pairing required, approval needed, warning/blocked, tool-running, thinking, streaming/responding, cautionary response, serious response, excited/successful response, idle.
- If the active session changes while a transient final-response state is showing, the avatar immediately reflects the newly selected session rather than continuing the previous session's state.
- If tool activity and streaming text occur simultaneously, tool-running wins only while a tool is actively running; once the tool is no longer active, streaming/responding may resume if text is still streaming.
- If approval is requested while disconnected or pairing is required, disconnected or pairing-required state wins because the user must restore connectivity before acting reliably.
- If an explicit blocked/denied/error outcome is visible at the same time as normal completion, warning/blocked wins over success.
- If a response contains cautionary or serious language but no explicit outcome signal, the avatar must not classify the text and should fall back to normal completion behavior.
- If pixel-art assets fail to load, the UI shows a minimal non-animated fallback status indicator with an accessible state label and does not break the chat surface.
- If reduced-motion is enabled, no sprite loops, blinking, bobbing, flashing, or rapid frame changes are allowed.
- If the active session has no conversation loaded yet, the avatar shows idle when connected and disconnected/pairing-required when not connected.
- If window space is constrained, the avatar must not force horizontal scrolling or cover controls; it may collapse to a smaller static status glyph or hide behind an existing status affordance if necessary.
- If existing status signals are delayed or temporarily unavailable, the avatar should prefer idle or the last reliable high-level connection state rather than showing speculative status.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide one default 2D retro pixel-art avatar for MVP.
- **FR-002**: The avatar MUST appear as a small desktop-native status companion for the active OpenClaw session, not as a large mascot, landing-page hero, or replacement for chat.
- **FR-003**: The avatar MUST support distinct visual states for idle, thinking, streaming/responding, tool-running, excited/successful response, serious response, cautionary response, warning/blocked/guardrail-style response, approval needed, and disconnected or pairing required.
- **FR-004**: The avatar state MUST be selected deterministically from existing ClawFace/OpenClaw signals available to the frontend, including connection status, pairing state, in-flight request/thinking state, stream text activity, active tool items, approval events, and existing explicit error, blocked, denied, or guardrail outcomes.
- **FR-005**: The feature MUST NOT require new OpenClaw backend APIs, companion OpenClaw code changes, private backend filesystem access, or new protocol contracts.
- **FR-006**: The feature MUST NOT use an AI mood classifier or infer serious, cautionary, or blocked state from free-form response text.
- **FR-007**: The avatar MUST NOT hide, replace, obscure, or become the only representation of existing explicit status, approval, connection, error, or tool activity UI.
- **FR-008**: The avatar MUST follow existing animation and reduced-motion behavior. When animation is disabled, every supported state MUST have a static representative frame.
- **FR-009**: The avatar MUST remain associated with the active session and update promptly when the selected session changes.
- **FR-010**: The avatar MUST use a documented state precedence order so simultaneous signals produce predictable output.
- **FR-011**: Transient final-response states, including excited/successful, serious, cautionary, and warning/blocked, MUST expire or be superseded by newer active-session signals without requiring user action.
- **FR-012**: The avatar MUST have accessible state text available to assistive technologies and tooltips or labels where consistent with existing ClawFace UI patterns.
- **FR-013**: The avatar MUST be responsive across ClawFace's supported desktop window sizes and MUST NOT cause message, composer, media preview, tool activity, approval, or connection UI overlap.
- **FR-014**: The state-selection behavior MUST be testable at a narrow seam with representative input snapshots and expected avatar states.
- **FR-015**: The visual rendering behavior MUST be testable with animation enabled and disabled.
- **FR-016**: The feature SHOULD be structured so avatar state resolution, avatar asset/state mapping, and placement in the chat/session shell are separable concerns.
- **FR-017**: The MVP MUST NOT include a user avatar editor, marketplace, skin system, multiple selectable avatars, new backend-provided avatar assets, or backend-managed mood metadata.
- **FR-018**: The avatar SHOULD be future-compatible with optional agent-specific skins, richer emotion states, or OpenClaw-provided mood/status metadata if those surfaces become available later.
- **FR-019**: The avatar MUST be placed in its own lower-left application shell pane below the Sessions pane.

### Key Entities *(include if feature involves data)*

- **Avatar State**: The normalized state rendered by the avatar. Values include idle, thinking, streaming/responding, tool-running, excited/successful response, serious response, cautionary response, warning/blocked/guardrail-style response, approval needed, and disconnected/pairing required.
- **Avatar Signal Snapshot**: A frontend-owned summary of existing app/session signals used for state selection. It may include connection status, selected session identity, request lifecycle state, stream activity, active tool count/status, pending approval presence, and explicit outcome severity.
- **Avatar Profile**: The default pixel-art visual mapping from avatar states to animated and static frames. MVP has one profile, but the concept allows later skins without changing state semantics.
- **Avatar Motion Mode**: Whether the avatar may animate or must render static frames, derived from existing animation or reduced-motion behavior.
- **Avatar Placement**: The small lower-left application shell pane below the Sessions pane, constrained so it reinforces status without blocking core workflows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a manual regression pass covering all ten MVP avatar states, each state is visually distinguishable from idle in both animated and reduced-motion modes.
- **SC-002**: Given a representative test matrix of simultaneous signals, 100% of cases resolve to the documented precedence order.
- **SC-003**: In reduced-motion mode, no avatar state uses looping animation, flashing, bobbing, blinking, or rapid frame changes.
- **SC-004**: During normal streaming and tool-running sessions, the avatar does not introduce visible message list reflow, composer reflow, or overlapping UI at supported desktop window sizes.
- **SC-005**: Existing explicit connection, approval, tool activity, and error/blocked UI remains visible and operable in every avatar state that corresponds to those statuses.
- **SC-006**: Implementation validation passes `make typecheck` and `make build`; if implementation touches approval/event routing, helper-heavy runtime state resolution, or media/image asset resolution, `make test-unit` also passes.
- **SC-007**: State resolution is covered by focused tests for idle, thinking, streaming/responding, tool-running, approval-needed, disconnected/pairing-required, success, serious, cautionary, and warning/blocked inputs.
- **SC-008**: The feature adds no required OpenClaw backend changes and can be demonstrated against existing ClawFace/OpenClaw signals.
- **SC-009**: In supported desktop window sizes, the avatar remains in the lower-left shell below Sessions or gracefully collapses without covering session controls.

## Assumptions

- The target user is the existing ClawFace desktop user: a technically sophisticated single-user OpenClaw operator.
- The avatar is part of the desktop renderer experience and is not intended as a web-first collaboration or marketing surface.
- Existing ClawFace state already exposes enough frontend-observable signals to distinguish the primary live states: connected/disconnected, request in progress, streaming, tool-running, and approval-needed.
- Explicit serious and cautionary states may only appear when existing ClawFace/OpenClaw-visible outcomes or metadata already distinguish them; otherwise the MVP falls back to success or idle.
- "Disconnected or pairing required" may be represented as one combined MVP state if existing UI does not distinguish them cleanly at the avatar seam.
- The avatar is placed in its own lower-left application shell pane below the Sessions pane.
- Animation disabling is derived from existing reduced-motion or animation settings rather than introducing a separate avatar-only preference.
- Pixel-art assets are local frontend assets bundled with ClawFace for MVP.
- No docs outside the spec need product-direction updates unless implementation materially changes architecture boundaries, milestone scope, or roadmap sequencing.

## Constitution Alignment

- **Maintainable Boundaries Over Gravity Wells**: The feature must introduce a clear avatar state resolver and presentation boundary instead of adding more state-machine logic directly into `ChatView.tsx`.
- **Validation Is a Merge Gate**: Implementation is not complete until required validation passes, with focused tests for deterministic state selection.
- **UX Consistency Beats Novelty**: The avatar reinforces existing ClawFace status, tool, approval, and connection surfaces; it does not replace them or turn ClawFace into a mascot-led product.
- **Performance And Responsiveness Are Product Features**: Avatar updates must be lightweight and must not add avoidable recomputation to streaming, tool, session-switch, or approval hot paths.
- **Testable Behavior Over Cleverness**: Runtime signal normalization and state precedence must be testable independently from the rendered pixel-art component.
- **Current OpenClaw Surface Is The Integration Boundary**: MVP behavior must ship against current frontend-observable OpenClaw signals only, with future metadata treated as optional follow-up input.
