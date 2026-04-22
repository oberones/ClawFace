# Feature Specification: Media Browser

**Feature Branch**: `001-media-browser`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Create a Media Browser for ClawFace that follows the existing FileManager interaction model but specializes it for OpenClaw media artifacts and chat/media workflows. Keep v1 read-heavy and selection-focused: browse, filter, preview, and reuse media in chat. Treat remote/self-hosted media portability as a first-class requirement, but avoid expanding the first version into a full media-management product."

## Clarifications

### Session 2026-04-20

- Q: What should the top-level browsing model be for v1? → A: Sources first
- Q: What should reuse in chat do by default? → A: Insert as a reference/link
- Q: Which media types are in scope for v1 preview/reuse? → A: Images first

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and preview media artifacts (Priority: P1)

As a ClawFace user, I want a dedicated media browser that feels like the existing file browser so I can comfortably browse and inspect OpenClaw media artifacts without leaving the desktop app or digging through backend paths.

**Why this priority**: This is the core value of the feature. If the browser cannot reliably show and preview media, nothing else matters.

**Independent Test**: Can be fully tested by opening the media browser, navigating available media sources using the same interaction model as the existing FileManager surface, and previewing supported media successfully in local, shared-volume, and remote/self-hosted setups.

**Acceptance Scenarios**:

1. **Given** the user opens the media browser, **When** media artifacts are available, **Then** the browser shows them using a FileManager-like structure with source-first roots, a navigable browsing pane, and a preview-first main pane.
2. **Given** the user selects a supported image or media artifact, **When** preview data is available, **Then** the main pane shows a comfortable preview with enough context to understand what was selected.
3. **Given** the user is connected to a remote or self-hosted OpenClaw instance whose media is not directly on the local filesystem, **When** the media browser loads, **Then** it still presents portable, usable media entries without requiring the user to know backend paths.
4. **Given** the selected artifact cannot be previewed, **When** the user opens it, **Then** the browser shows a clear unsupported, loading, or error state instead of a broken or blank surface.

---

### User Story 2 - Reuse media in chat workflows (Priority: P2)

As a ClawFace user, I want to select an artifact from the media browser and reuse it in my current chat workflow so that past screenshots, generated images, and uploaded media become part of the same conversational work surface.

**Why this priority**: Reuse in chat is the feature’s product payoff. Without it, the browser becomes a passive gallery instead of an OpenClaw workstation surface.

**Independent Test**: Can be fully tested by opening the media browser from an active chat context, selecting a media artifact, and confirming that it becomes inserted into the conversation as a reusable reference/link without manual path copying.

**Acceptance Scenarios**:

1. **Given** the user has an active chat session, **When** they choose a reuse/select action on a media artifact, **Then** the artifact is inserted into the current chat flow as a reference/link in a way that matches ClawFace’s existing message/media language.
2. **Given** the user selected media from the browser, **When** they return to chat, **Then** the chosen artifact is clearly visible in the composer as a removable media reference/link and ready for normal send behavior.
3. **Given** the browser is opened outside an active reusable chat context, **When** the user attempts a chat reuse action, **Then** the app explains what context is required instead of silently failing.

---

### User Story 3 - Find the right media quickly (Priority: P3)

As a ClawFace user, I want lightweight filtering and grouping that help me find the right artifact without turning the feature into a full digital asset manager.

**Why this priority**: The browser needs enough structure to be useful once artifact volume grows, but this is less critical than basic browse/preview/reuse.

**Independent Test**: Can be fully tested by opening the browser with a mixed media set, applying the available lightweight filters or grouping controls, and confirming that the visible results narrow in a predictable way without breaking preview or reuse.

**Acceptance Scenarios**:

1. **Given** a mixed set of generated, uploaded, and session-linked artifacts, **When** the user applies a lightweight filter or grouping mode, **Then** the visible list narrows or reorganizes in a predictable way within the chosen source-first browsing structure.
2. **Given** the user clears the active filter state, **When** the full media view returns, **Then** preview and reuse continue to work without needing to reopen the browser.

---

### Edge Cases

- What happens when the browser can list media metadata but the underlying preview bytes are temporarily unavailable?
- How does the browser behave when a remote/self-hosted OpenClaw instance exposes portable media reads but not local file paths?
- What happens when the same artifact is reachable from multiple media sources or sessions?
- How does the browser behave when a session or generated artifact label is missing, stale, or sanitized?
- What happens when the user opens the media browser with no media available yet?
- How does reuse behave when the current chat already has staged attachments?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated Media Browser surface in ClawFace.
- **FR-002**: The Media Browser MUST follow the same core interaction model as the existing FileManager surface, including a browse-oriented navigation pane and a preview-first main pane.
- **FR-003**: The system MUST present OpenClaw media artifacts as first-class browser entries rather than requiring the user to navigate raw backend filesystem paths.
- **FR-004**: The system MUST support browsing across the in-scope media sources for v1 using media artifacts that ClawFace can derive from normalized session/session-preview data and any session history the app has explicitly loaded or preloaded; v1 does not guarantee an exhaustive crawl of all backend media artifacts.
- **FR-005**: The system MUST treat OpenClaw-managed media and media already renderable in chat as the default in-scope sources for v1.
- **FR-006**: The system MUST use a sources-first top-level browsing model for v1, with source roots such as generated, uploaded, session-linked, or equivalent logical groupings.
- **FR-007**: The system MUST allow the user to preview supported media artifacts inside the browser.
- **FR-008**: Images MUST be the only fully supported first-class preview and reuse target in v1.
- **FR-009**: Non-image media MAY appear in the browser if they are already reachable through the same source model, but unsupported or limited behavior MUST be communicated clearly rather than implied as complete support.
- **FR-010**: The system MUST provide clear loading, empty, unsupported, and error states for the browser and the preview pane.
- **FR-011**: The system MUST allow the user to select or reuse a media artifact in the current chat workflow without copying raw paths manually.
- **FR-012**: The default reuse behavior for v1 MUST insert the selected artifact into the composer as a structured media reference/link, distinct from staged attachments and distinct from raw backend path text.
- **FR-013**: The inserted media reference MUST preserve artifact identity and portable render metadata in draft state; any conversion to the concrete outbound `chat.send` payload MUST happen at send time and remain invisible to the user.
- **FR-014**: The browser MUST support lightweight finding aids for v1, such as filtering, grouping, or sorting, sufficient to narrow a practical media list.
- **FR-015**: The browser MUST surface enough artifact context for the user to understand what they are looking at, such as file name, source, session/tool provenance, or creation timing where available.
- **FR-016**: The system MUST support remote/self-hosted media portability as a first-class behavior, meaning the browser contract cannot depend solely on direct local filesystem access.
- **FR-017**: The browser MUST reuse existing ClawFace media/path/runtime resolution seams where possible instead of creating a second parallel media resolution stack.
- **FR-018**: The v1 browser MUST remain read-heavy and selection-focused; destructive bulk management actions such as delete, move, rename, or library-wide organization are out of scope unless later justified.
- **FR-019**: The v1 browser MUST NOT require a full metadata indexing subsystem if a lighter source-driven browsing model satisfies the user stories.
- **FR-020**: The browser MUST fit the existing ClawFace product direction: desktop-first, OpenClaw-native, and oriented toward personal workstation workflows rather than backend administration.

### Key Entities *(include if feature involves data)*

- **Media Artifact**: A browser-visible media item that can be previewed or reused, with attributes such as identity, type, renderable source, display label, preview availability, and optional provenance.
- **Media Source**: A logical top-level origin of media artifacts in the browser, such as OpenClaw-managed media, generated artifacts, uploaded artifacts, or session-linked artifacts.
- **Media Preview State**: The current readiness state for a selected artifact, such as loading, ready, unsupported, or failed.
- **Media Reuse Action**: A user-triggered action that takes a selected artifact from the browser and places it into the current chat/media workflow as a reference/link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the Media Browser, locate a target artifact, and view its preview without leaving ClawFace.
- **SC-002**: A user can reuse a selected artifact in the current chat workflow as a reference/link without manually copying a path or dropping to another surface.
- **SC-003**: In manual testing, the primary browse/preview/reuse flow works for both local/shared-volume setups and remote/self-hosted setups that already support ClawFace’s portable media resolution contract.
- **SC-004**: The browser interaction model is recognizable as a sibling of the existing FileManager surface rather than a disconnected new mini-application.
- **SC-005**: The v1 feature does not introduce destructive media-management requirements, admin-heavy controls, or a full DAM-style library model.

## Assumptions

- v1 should feel like a specialized sibling of the existing FileManager, not a replacement for it.
- OpenClaw-managed media and already-renderable chat media are enough to define the initial source model for v1.
- The v1 root model is source-first rather than session-first.
- Reuse into chat should insert a media reference/link by default rather than creating a staged attachment.
- Images are the only fully supported first-class preview and reuse target in v1.
- Remote/self-hosted portability will rely on the renderer’s current portable media resolution strategy and any supported gateway-served media/artifact reads already available to ClawFace.
- V1 media completeness is cache-backed and load-driven: artifacts appear when they are exposed by normalized shell data or by session history the app has explicitly loaded or preloaded, not through a background global crawl of every backend session.
- Rich destructive media management, deep taxonomy, tagging, albuming, and full-library curation are out of scope for v1.
