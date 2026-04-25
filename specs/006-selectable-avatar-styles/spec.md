# Feature Specification: Selectable Avatar Styles

**Feature Branch**: `006-selectable-avatar-styles`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "I'd like to add two more animated avatars in totally different styles and make them selectable in the settings panel. Same size, same behavior, same placement but different style of avatar"

## Clarifications

### Session 2026-04-25

- Q: Should the two new avatar styles follow specific visual concepts? → A: No specific concepts beyond supporting the same states as the existing avatar.
- Q: Should avatar style be global or per agent/session? → A: Global setting.
- Q: Should Settings show visual previews or a compact named selector for v1? → A: Thumbnail previews.
- Follow-up: Add one more avatar style inspired by the ClawFace logo itself.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose An Avatar Style In Settings (Priority: P1)

As a ClawFace user, I want to choose between the default avatar and two additional visually distinct animated avatar styles from the settings panel so the status companion feels more personal without changing how the active OpenClaw session works.

**Why this priority**: The core value of this feature is user choice. It is only useful if the selected style is discoverable in existing settings and immediately affects the existing avatar pane.

**Independent Test**: Open Settings, choose each available avatar style from thumbnail previews, close Settings, and verify that the lower-left avatar pane updates to the selected style while preserving the current state, size, placement, and status text.

**Acceptance Scenarios**:

1. **Given** ClawFace has the default avatar selected, **When** the user opens Settings and chooses another avatar style, **Then** the lower-left avatar pane updates to the chosen style without moving or changing behavior.
2. **Given** the user selects another avatar style, **When** Settings is closed and reopened, **Then** that style remains selected.
3. **Given** the avatar is currently showing thinking, streaming, tool-running, approval-needed, or disconnected state, **When** the user changes avatar style, **Then** the new style shows the same state rather than resetting to idle.

---

### User Story 2 - Preserve Existing Avatar Behavior Across Styles (Priority: P1)

As a ClawFace user, I want every avatar style to communicate the same session states with the same timing and accessibility behavior so style choice never changes the reliability of the status surface.

**Why this priority**: Avatar style is presentation only. The selectable styles must not fork state logic or make one style less clear than another.

**Independent Test**: For each avatar style, drive the existing avatar state matrix and verify idle, thinking, streaming, tool-running, successful response, serious response, cautionary response, warning/blocked, approval-needed, and disconnected/pairing-required states render correctly.

**Acceptance Scenarios**:

1. **Given** any avatar style is selected, **When** the active session enters thinking, streaming, tool-running, approval-needed, or disconnected state, **Then** the avatar pane reflects the same state priority used by the default avatar.
2. **Given** animations are disabled through ClawFace settings or reduced-motion behavior, **When** any avatar style is selected, **Then** the avatar renders a static representative frame for the current state.
3. **Given** an avatar style is selected, **When** the active session changes, **Then** the selected style persists while the displayed state updates for the new active session.

---

### User Story 3 - Keep Avatar Choice A Small Desktop-Native Preference (Priority: P2)

As a ClawFace user, I want avatar style selection to feel like a lightweight desktop preference rather than an editor, marketplace, or theme system.

**Why this priority**: The feature should add personality without expanding settings into a skin management surface or distracting from chat, sessions, tools, and connection status.

**Independent Test**: Review the Settings UI and verify that avatar style selection is compact, understandable, presented with thumbnails, and placed with related UI/personalization settings without adding editor controls, imports, downloads, accounts, or marketplace affordances.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** they inspect avatar controls, **Then** they see exactly four bundled avatar style choices with thumbnail previews: the existing default, two distinct companion styles, and one ClawFace logo-inspired style.
2. **Given** the user chooses a style, **When** they continue normal chat usage, **Then** no new controls appear in the avatar pane itself and the chat workflow remains unchanged.
3. **Given** a style choice is unavailable due to asset failure, **When** the avatar pane renders, **Then** ClawFace falls back gracefully without blocking Settings or chat.

---

### User Story 4 - Keep Future Style Expansion Maintainable (Priority: P3)

As a future ClawFace maintainer, I want avatar profiles to be represented as a small data-driven set so future agent-specific skins or richer style metadata can be added without duplicating state logic or adding weight to `ChatView.tsx` or `src/app.tsx`.

**Why this priority**: This is a follow-up to an existing avatar feature. The implementation should extend the profile boundary rather than reintroduce presentation logic into known architectural hotspots.

**Independent Test**: Review the implementation boundary and verify that adding a future fifth bundled style would require registering a profile and asset mapping, not changing avatar state derivation or chat/session runtime logic.

**Acceptance Scenarios**:

1. **Given** the app supports four avatar styles, **When** a maintainer reviews state derivation, **Then** all styles share the same avatar state resolver and status labels.
2. **Given** a future style is considered, **When** it follows the documented profile structure, **Then** it can reuse the same pane placement, animation setting, reduced-motion behavior, and state priority.

### Edge Cases

- If a previously saved avatar style id no longer exists, ClawFace falls back to the default avatar and repairs or ignores the invalid preference without crashing.
- If one sprite sheet fails to load, only that visual profile is affected; the avatar pane still exposes accessible state text and may fall back to the default profile.
- If Settings is open while the active session state changes, the preview/selection state must not desynchronize from the live avatar pane.
- If the user toggles animation settings after selecting a style, the selected style must switch between animated and static rendering without losing the selected preference.
- If reduced-motion is active at the OS/browser level, all styles must use static frames regardless of the selected style.
- If the lower-left sidebar is collapsed or constrained, all styles must use the same compact dimensions and must not distort or crop differently.
- If the app is packaged in Electron, all bundled avatar assets must resolve correctly from the packaged app, matching the existing file-url-safe default avatar behavior.
- If two avatar styles use different silhouettes or palettes, state legibility still matters: every state must remain recognizable at the existing pane size.
- If users switch styles rapidly, the UI should update deterministically without accumulating timers, restarting app state, or causing layout jumps.
- If future OpenClaw-provided avatar metadata exists, this feature must not depend on it and must keep local user selection authoritative for MVP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide exactly four bundled avatar style choices for this feature version: the existing default avatar, two distinct animated avatar styles, and one ClawFace logo-inspired animated avatar style.
- **FR-002**: The three additional avatar styles MUST be visually distinct from the default and from each other at the existing avatar pane size, using clearly different silhouettes, palettes, or visual motifs.
- **FR-003**: All avatar styles MUST use the same lower-left pane placement below the Sessions pane.
- **FR-004**: All avatar styles MUST use the same rendered dimensions, responsive collapse behavior, and layout footprint as the existing avatar.
- **FR-005**: All avatar styles MUST support the same avatar state set as the existing avatar: idle, thinking, streaming/responding, tool-running, excited/successful response, serious response, cautionary response, warning/blocked/guardrail-style response, approval needed, and disconnected or pairing required.
- **FR-006**: All avatar styles MUST use the same deterministic state selection and priority behavior as the existing avatar; style selection MUST NOT alter status semantics.
- **FR-007**: Users MUST be able to select avatar style from the existing Settings experience using thumbnail previews.
- **FR-008**: The selected avatar style MUST persist across app restarts using existing local settings/persistence patterns.
- **FR-009**: Changing avatar style MUST update the existing avatar pane without requiring an app restart, session reload, or OpenClaw reconnect.
- **FR-010**: Avatar style selection MUST respect existing "Enable UI animations" behavior and `prefers-reduced-motion` handling for every style.
- **FR-011**: When animations are disabled, every style MUST show a static frame that still reflects the current avatar state.
- **FR-012**: The Settings UI MUST present avatar style selection as a compact thumbnail-based preference, not an avatar editor, marketplace, upload flow, account feature, or downloadable skin system.
- **FR-013**: The feature MUST NOT introduce new OpenClaw backend APIs, gateway protocol changes, Electron IPC contracts, or remote asset dependencies.
- **FR-014**: The feature MUST NOT add an AI mood classifier or style-specific state inference.
- **FR-015**: The feature MUST preserve existing explicit gateway status, approval, connection recovery, tool activity, and chat UI; avatar style selection only changes avatar artwork.
- **FR-016**: The avatar profile data MUST be structured so state resolution, profile registration, asset references, and Settings selection remain separable concerns.
- **FR-017**: The system SHOULD expose accessible labels or names for each avatar style in Settings and maintain existing accessible state text for the live avatar pane.
- **FR-018**: The system SHOULD include a graceful fallback to the default avatar if a selected profile is invalid or its asset cannot be used.
- **FR-019**: The feature MUST be testable with focused coverage for profile selection/persistence normalization and state behavior shared across profiles.
- **FR-020**: The feature MUST keep runtime animation dependency-free for v1 and reuse the existing CSS sprite-sheet animation approach unless implementation discovers a blocker documented in the plan.

### Key Entities *(include if feature involves data)*

- **Avatar Profile**: A bundled selectable visual style for the avatar. Key attributes include stable id, display name, thumbnail/preview asset or frame, sprite asset reference, frame/state mapping compatibility, and optional descriptive metadata for Settings.
- **Selected Avatar Style Preference**: The locally persisted global user choice identifying the active Avatar Profile. It must normalize invalid or missing values to the default profile.
- **Avatar State**: The existing normalized runtime state rendered by whichever Avatar Profile is selected. This feature must not change its values or precedence.
- **Avatar Sprite Asset**: A packaged image asset containing frames for all supported Avatar States. All profiles must provide equivalent frame coverage and geometry for consistent rendering.
- **Settings Avatar Control**: The Settings panel UI that lets the user inspect and select one of the bundled Avatar Profiles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A manual regression pass can select each of the four avatar styles from thumbnail previews in Settings and see the lower-left avatar pane update within one second without restarting the app.
- **SC-002**: For each of the four styles, all ten avatar states are visually distinguishable from idle at the existing pane size in animation-enabled mode.
- **SC-003**: For each of the four styles, all ten avatar states render as static representative frames when animations are disabled or reduced motion is active.
- **SC-004**: A persisted style choice survives an app restart and is restored before or with the first render of the avatar pane.
- **SC-005**: Invalid saved style ids normalize to the default avatar without an uncaught error or broken Settings UI.
- **SC-006**: Implementation validation passes `make typecheck` and `make build`; because the feature touches avatar helper/settings behavior and packaged image assets, `make test-unit` also passes.
- **SC-007**: Focused tests cover profile normalization or selection behavior and prove existing avatar state derivation remains independent of selected style.
- **SC-008**: The feature adds no required OpenClaw backend change and can be demonstrated entirely with bundled frontend assets and existing ClawFace settings.
- **SC-009**: In supported desktop window sizes and collapsed-sidebar states, all four avatar styles keep the same layout footprint and do not overlap session, gateway, approval, tool, chat, or composer controls.

## Assumptions

- The existing single default avatar feature from `005-pixel-avatar` is available as the base behavior and placement for this follow-up.
- "Totally different styles" means visually distinct bundled art directions that support the same states as the existing avatar, not different sizes, behaviors, placements, state semantics, or product modes.
- The exact visual concepts for non-logo additional avatars may be chosen during implementation as long as they are tasteful, clearly distinct, desktop-native, legible at the existing pane size, and support the same state set.
- The MVP includes four bundled local profiles only: no user-uploaded art, generated-at-runtime art, marketplace, downloadable skins, account sync, or agent-specific automatic selection.
- The selected avatar style is a global local UI preference, not an OpenClaw session property, per-agent setting, or backend-managed setting.
- Existing ClawFace settings persistence is sufficient for storing one selected avatar profile id.
- Existing CSS sprite-sheet animation infrastructure remains the preferred implementation approach for all profiles.
- Existing explicit status, approval, gateway, and tool UI remains authoritative; avatar art is supportive presentation.

## Constitution Alignment

- **Maintainable Boundaries Over Gravity Wells**: The feature must extend avatar profile/presentation seams and settings section boundaries rather than adding style logic into `ChatView.tsx` or broad inline logic in `src/app.tsx`.
- **Validation Is a Merge Gate**: Implementation is not complete until `make typecheck`, `make build`, and `make test-unit` pass, with manual visual regression for all styles and motion modes.
- **UX Consistency Beats Novelty**: Style choice adds personality while preserving the existing lower-left status pane, Settings patterns, and explicit OpenClaw status surfaces.
- **Performance And Responsiveness Are Product Features**: Switching styles must be lightweight, local, and free of runtime animation dependencies or repeated hot-path recomputation.
- **Testable Behavior Over Cleverness**: Profile normalization, selected-style persistence, and shared state behavior must be testable at narrow helper or settings seams.
- **Current OpenClaw Surface Is The Integration Boundary**: The feature uses only bundled frontend assets and existing local ClawFace settings; it assumes no new OpenClaw backend metadata or protocol support.
