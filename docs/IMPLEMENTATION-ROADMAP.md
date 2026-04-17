# ClawFace Implementation Roadmap

This roadmap translates the product brief and milestone plan into an implementation sequence.

It is organized around:
- **phases** for ordering work
- **vertical slices** for delivering end-to-end value

The intent is to avoid both of these failure modes:
- doing endless architecture cleanup without shipping a better product
- shipping more feature surface into unstable architecture

Each vertical slice should ideally cut across:
- renderer UI
- app state
- gateway/domain integration
- desktop/platform behavior
- UX quality and polish

---

# Guiding principle

ClawFace should be built by delivering useful product slices while steadily improving the architecture underneath.

That means:
- no giant rewrite before value appears
- no major feature expansion on top of overloaded core files
- every phase should make the app both **better to use** and **safer to extend**

---

# Phase 0 — Alignment and inventory

## Goal
Establish product and architecture direction before implementation work starts in earnest.

## Outcomes
- a shared understanding of what ClawFace is trying to become
- a map of current architectural problem areas
- agreement on Milestone 1 scope
- identification of the first concrete refactor targets

## Deliverables
- `ARCHITECTURE.md`
- `PRODUCT-BRIEF.md`
- `MILESTONE-1.md`
- this roadmap

## Status
This phase is effectively underway / mostly complete.

---

# Phase 1 — Core chat shell stabilization

## Status
Effectively complete.
The shell-reliability, thread, streaming, and composer stabilization work planned for Phase 1 has been materially delivered and validated.

## Goal
Make the app’s core chat/session shell reliable enough to serve as a serious daily-use base.

This phase should focus on the surfaces that the user touches constantly:
- connection state
- session switching
- thread rendering
- basic chat interactions

## Why first
Because everything else depends on the user trusting the core shell.

## Vertical slices

### Slice 1.1 — Connection and session shell reliability
#### User value
The app reliably connects to OpenClaw, shows the user what state it is in, and handles session navigation without feeling fragile.

#### Scope
- make connection state explicit and understandable
- improve reconnect handling and disconnected states
- stabilize selected-session behavior
- reduce session-switch weirdness
- define clearer app-state ownership for connection + selected session

#### Architecture work tied to the slice
- introduce or formalize `connectionStore`
- introduce or formalize `sessionStore`
- reduce ad hoc state spread between top-level shell and deep UI

#### Done when
- switching sessions is predictable
- reconnect states are understandable
- top-level shell behavior is less brittle than today

---

### Slice 1.2 — Thread rendering and streaming cleanup
#### User value
Messages stream clearly and the main thread feels responsive, readable, and stable.

#### Scope
- improve thread rendering behavior
- stabilize streaming updates
- clean up message transition handling
- reduce visual glitches in thread updates
- preserve or improve auto-scroll behavior

#### Architecture work tied to the slice
- begin splitting `ChatView.tsx`
- extract `ChatThread` / `MessageList` / `MessageRow`
- isolate `useAutoScroll` and similar thread-specific hooks

#### Done when
- thread updates feel less fragile
- streaming UX is reliable
- the core message-rendering logic is no longer buried in one giant file

---

### Slice 1.3 — Composer baseline cleanup
#### User value
Sending messages feels immediate and dependable.

#### Scope
- stabilize composer behavior
- clean up slash-command handling boundaries
- improve input state transitions
- ensure the composer behaves consistently across session switches and reconnects

#### Architecture work tied to the slice
- extract `Composer`
- isolate `useSlashCommands`
- reduce composer logic embedded in the giant chat surface

#### Done when
- input behavior is predictable
- send/stream interactions feel solid
- composer logic is more isolated and testable

---

# Phase 2 — Desktop-native media and attachment workflows

## Status
In progress.
Major attachment/media foundations have already landed, including drag/drop, staged attachment lifecycle cleanup, attachment preview/rendering boundaries, and the first clipboard-focused workflow pass.

## Goal
Make ClawFace obviously better than a web tab for media-heavy interaction.

This phase should establish one of the app’s strongest differentiators:
- drag and drop
- paste image
- local file handling
- attachment preview
- clean routing of local media into OpenClaw workflows

## Why now
This is a key signature strength for the product, and it also forces the platform layer to become real.

## Vertical slices

### Slice 2.1 — Drag and drop attachments
#### Status
Substantially complete.
Drag/drop ingestion, visible drop affordance, and staged attachment lifecycle ownership are now materially cleaner and validated.
#### User value
The user can drag screenshots, images, and files into the chat naturally.

#### Scope
- drag-over/drop target behavior
- visual drop affordances
- attachment ingestion path
- consistent behavior for dropped files across desktop contexts

#### Architecture work tied to the slice
- define renderer-side `platform/files` abstraction
- isolate drag/drop handling from the main chat component
- establish attachment lifecycle state ownership

#### Done when
- drag/drop works reliably
- the user can see what they dropped before sending
- the chat UI is not doing raw file wrangling inline

---

### Slice 2.2 — Paste image and clipboard workflow
#### Status
First slice complete.
Clipboard image staging now has explicit feedback and mixed clipboard handling no longer clobbers normal text paste in the common case.
#### User value
Pasting screenshots and images into the conversation is effortless.

#### Scope
- clipboard image ingestion
- image preview before send
- clean handling of image attachments in the compose flow

#### Architecture work tied to the slice
- define desktop/media adapter surface
- centralize image normalization and metadata extraction logic

#### Done when
- paste-image is smooth
- local image handling is cleaner and more maintainable

---

### Slice 2.3 — Attachment preview and rendering pipeline
#### Status
First slice complete.
Composer-side and message-side attachment rendering now have explicit component boundaries, and shared image-source logic has been moved out of component-level coupling.
#### User value
Attachments feel like first-class objects, not raw blobs.

#### Scope
- attachment preview UI
- image/file metadata display where useful
- better rendering of sent/received attachments in thread
- improved media click/open/lightbox behavior

#### Architecture work tied to the slice
- extract `AttachmentTray` and/or media preview components
- move desktop image resolution logic out of generic thread rendering
- establish `platform/images` abstraction

#### Done when
- attachment UX feels polished
- image rendering is less tangled with chat rendering logic

#### Queued follow-up slice — Remote media/artifact portability
Remote/self-hosted OpenClaw installs still need a gateway-served media/artifact path when backend files are not locally shared.

##### User value
Users running OpenClaw on another machine can still see generated images and other media outputs without needing shared local filesystem access.

##### Scope
- gateway-served media/artifact reads for generated images and media attachments
- frontend fallback from local path mapping/file reads to gateway-served media resolution
- preserving host-local and shared-volume container behavior while adding truly remote portability

##### Architecture work tied to the slice
- formalize the remote side of the `platform/images` contract
- prefer structured media/artifact reads over leaking backend filesystem paths into renderer concerns
- narrow the assumption that attachment rendering can always resolve through local desktop paths

##### Done when
- generated images render for remote OpenClaw installs without shared local volumes
- path-prefix mapping is no longer the only viable media strategy
- local/shared-volume installs still work without regression

##### Progress note
The ClawFace-side contract is now in place:
- remote image resolution has been extracted into a dedicated resolver layer
- the frontend can now consume broader RPC and HTTP media/artifact response shapes
- remote source references no longer have to masquerade as local desktop file paths to enter the resolution flow

The remaining gap is backend-side:
- OpenClaw still needs to expose a first-class gateway media/artifact read method or HTTP endpoint for truly remote installs without shared volumes

---

# Phase 3 — Tool visibility and OpenClaw actionfulness

## Status
Starting early via a Phase 2/3 bridge slice.
A first tool-activity render boundary and readability pass has already begun because it directly supports the Milestone 1 promise of visible OpenClaw actionfulness.

## Goal
Make OpenClaw’s use of tools visible and understandable in the product.

This is where ClawFace starts feeling distinctly OpenClaw-native rather than like a generic assistant shell.

## Why here
Once chat/session/media basics are stable, the next biggest differentiation is that the assistant actually does things.

## Vertical slices

### Slice 3.1 — Basic tool activity timeline
#### Status
First slice complete via Ticket 2.4 bridge work.
Tool activity now has a dedicated thread render boundary and a more legible first-pass runtime presentation.
#### User value
The user can tell when tools are running and what kind of work is happening.

#### Scope
- basic tool event surfacing near the active thread
- distinct visual treatment for tool activity vs plain text
- support for running/completed/failed states

#### Architecture work tied to the slice
- introduce normalized tool event/domain model
- define `toolStore` or equivalent state domain
- extract `ToolTimeline` / `ToolActivityPanel`

#### Done when
- tool usage is visible and legible
- the user is not forced to infer all action from final responses

---

### Slice 3.2 — Tool output and failure clarity
#### User value
The user can understand what happened when a tool succeeds or fails.

#### Scope
- improved rendering for tool output summaries
- visible failure state and error presentation
- clearer distinction between tool progress and tool result

#### Architecture work tied to the slice
- improve tool state normalization
- reduce raw tool payload leakage into renderer components

#### Done when
- tool-heavy threads are understandable
- failures are visible rather than buried

---

### Slice 3.3 — Tool-aware thread UX polish
#### User value
Threads feel coherent even when tool activity is substantial.

#### Scope
- improve spacing, grouping, and visual hierarchy for mixed tool/text conversations
- reduce clutter in tool-heavy threads
- improve scanability

#### Architecture work tied to the slice
- separate message rendering from tool rendering more clearly
- refine component boundaries around thread display

#### Done when
- the app still feels calm when the assistant is doing real work

---

# Phase 4 — Runtime controls and shell polish

## Goal
Polish the product into a serious daily driver and clean up the operational edges of the desktop shell.

This phase is about making the app feel cohesive rather than merely feature-complete.

## Vertical slices

### Slice 4.1 — Model/runtime control cleanup
#### User value
The user can control the interaction context without falling into settings hell.

#### Scope
- clarify model visibility/selection patterns
- improve thinking-level controls
- reduce awkward UI around runtime controls
- keep controls close to the work, not buried

#### Architecture work tied to the slice
- separate local runtime control state from generic UI state
- reduce prop sprawl around controls

#### Done when
- model/thinking controls feel intentional, not bolted on

#### First cut
- audit the current runtime-control surface before moving controls around:
  - active-session model selection
  - active-session thinking selection
  - new-session model defaults
  - slash-command overlap
- use that audit to choose the first implementation cut instead of guessing at control placement

#### First implementation cut
- centralize session model/thinking patch behavior behind one app-level seam
- move remembered new-session model defaults out of shortcut editing and into an explicit defaults surface
- align runtime-control vocabulary between the visible UI and slash-command help before making a larger layout change
- helper-level regression coverage now exists for the runtime patch decision seam and shared thinking vocabulary

#### Next product-facing cut
- present the active session's model and thinking controls as one coherent in-thread runtime cluster
- remove the duplicated composer-footer thinking picker once that cluster exists

#### Follow-through cleanup
- after the clustered control surface proves itself in use, extract it into its own component boundary instead of leaving it inline in `ChatView`

---

### Slice 4.2 — Error, reconnect, and recovery polish
#### User value
The app feels resilient instead of brittle.

#### Scope
- improve error states
- improve reconnect messaging
- improve session continuity after backend hiccups
- reduce cases where the user feels lost after failure

#### Architecture work tied to the slice
- formalize app-level failure/recovery state
- reduce imperative recovery hacks where possible

#### Done when
- backend interruptions no longer make the app feel sketchy

#### First cut
- centralize connection/recovery copy instead of scattering it across `app.tsx` and `ChatView.tsx`
- turn the composer's connection warning into a small recovery surface with an explicit action when settings are the right next step
- add focused helper-level coverage for connection/recovery messaging so reconnect copy and actions do not drift

#### Next continuity cut
- make the active session surface explicitly show reconnect/disconnected state instead of falling back to a generic idle-looking runtime pill
- add a visible continuity banner for selected-session recovery states so the user does not have to infer everything from the composer alone
- keep the thread visible while being explicit about what is paused and what will resume automatically

#### Recovery follow-through
- add a short-lived shell-level “Gateway reconnected” signal for real post-disconnect recoveries, not initial startup
- add a short-lived “Session refreshed” signal once the selected session history reload completes after reconnect
- keep the new recovery copy behind a small shared helper so reconnect messaging does not drift across the shell

#### Interrupted-run follow-through
- capture active runs that were in flight when the gateway disconnected
- reconcile those runs after reconnect and selected-session refresh instead of assuming refresh success means run success
- show a session-level interrupted-run warning with an explicit refresh action when the run did not automatically resume
- keep the interrupted-run decision logic behind focused helpers with unit coverage

---

### Slice 4.3 — Settings decomposition and cleanup
#### User value
Settings are easier to understand without dominating the product.

#### Scope
- split `SettingsModal.tsx` into meaningful sections
- focus settings on frontend/product concerns
- avoid turning the app into a duplicate backend admin UI

#### Architecture work tied to the slice
- componentize settings sections
- isolate settings state by domain

#### Done when
- settings are more maintainable
- the app feels less like a giant preferences surface

#### First safe cut
- extract the lowest-risk standalone sections first:
  - UI schemes
  - gateway / connection settings
  - path-prefix mapping settings
- leave denser shortcut and notification-audio clusters for later passes once section boundaries are established

#### Next safe cut
- extract the appearance-oriented sections next:
  - typography / layout
  - color system
  - markdown readability
- centralize reusable field controls so later settings-section extraction does not duplicate form primitives

#### Next heavier cut
- extract the chat-controls cluster once section boundaries are stable:
  - in-thread behavior toggles
  - sizing/display controls
  - reply-done sound settings
- leave shortcut groups as the final heavier settings cleanup pass

#### Final major settings cut
- extract the remaining shortcut clusters:
  - app action shortcuts
  - model shortcut schemes
  - agent session shortcuts
- centralize shared shortcut editor controls so the modal stops carrying repeated keyboard-combo UI logic

#### Validation follow-through
- helper-level regression coverage now exists for the settings behaviors most likely to drift during future cleanup:
  - shortcut key normalization and thinking-label formatting
  - reply-done audio file validation and audio data URL normalization
- run `make test-unit` alongside `make typecheck` and `make build` when touching those seams

---

# Phase 5 — OpenClaw-native expansion surfaces

## Goal
Begin exposing the richer OpenClaw ecosystem beyond the core chat shell.

This phase should happen only after the Milestone 1 foundation is credible.

## Why later
These features are valuable, but dangerous to add too early because they amplify architectural weaknesses.

## Vertical slices

### Slice 5.1 — Approval surface
#### User value
The user can clearly see and act on approval-requiring operations.

#### Scope
- approval requests
- actionable approval UI
- contextual visibility of blocked actions

#### First cut
- audit the current approval-related seams before designing UI:
  - pairing-required connection state
  - advertised gateway methods/events/capabilities related to approvals
  - existing slash-command affordances
  - blocked-action copy already shown in connection/recovery surfaces

#### Audit findings
- the app already requests `operator.approvals` and `operator.pairing` scopes and records advertised gateway methods on hello
- pairing-required is the only approval-adjacent state currently surfaced as product UI; generic approval requests are not yet modeled as app state
- `/approve` is currently advertised in slash-command help but not implemented in the local slash-command handler
- the first approval UI cut should stay narrow and visible rather than jumping to a full approvals center

#### First implementation cut
- either remove or wire the nonfunctional `/approve` affordance
- normalize one approval-needed state behind a small shared app-facing seam
- introduce one shell- or thread-level approval-needed surface for pairing or blocked actions before building richer approval workflows

#### First implementation cut follow-through
- `/approve` is no longer advertised in slash-command help until a real local approval action path exists
- pairing-required now maps to a dedicated approval-needed shell surface instead of relying only on disabled composer copy
- the first actionable approval path is intentionally narrow and honest: copy the external `openclaw devices approve` command rather than implying in-app approval handling that does not yet exist
- helper-level regression coverage now locks in pairing-required approval banner behavior and the split between approval-needed vs session-continuity banners

#### Second implementation cut follow-through
- approval request and resolution events are now normalized behind `src/lib/approval-events.ts`
- pending approvals are tracked by session in app state and surfaced in the selected session shell
- the first in-app approval actions now submit through the advertised `exec.approval.resolve` / `plugin.approval.resolve` gateway methods
- helper-level regression coverage now locks in approval event parsing, state upsert/removal, and resolve-method selection

#### Third implementation cut follow-through
- pending approvals now stay visible for non-selected sessions through the existing sidebar activity surface
- approval-needed session visibility still stays narrow: the selected session owns the full approval banner, while background sessions get a compact approval badge
- helper-level regression coverage now locks in the sidebar activity-priority rules so approval visibility does not get buried behind generic unread/working states

---

### Slice 5.2 — Background tasks and subagents
#### User value
The user can understand that OpenClaw is doing work beyond the currently visible reply.

#### Scope
- task state overview
- subagent visibility
- long-running work surfaces

#### First cut
- reuse OpenClaw's existing status/task command surfaces before building any dashboard:
  - make `/tasks` discoverable in the slash-command menu
  - surface `subagentsLine` / `taskLine` when the user runs `/status`
  - keep task/subagent visibility text-first until real usage proves a richer surface is needed

#### First implementation cut follow-through
- `/tasks` is now discoverable from the slash-command suggestions instead of being hidden behind backend-only knowledge
- the local `/status` card now surfaces OpenClaw's existing background-task and subagent summary lines when the gateway provides them
- helper-level regression coverage now locks in the background-status extraction seam so later status-card cleanup does not lose those lines

#### Second implementation cut follow-through
- the main chat shell now shows a lightweight info banner when other sessions are still marked `working`
- this reuses existing per-session activity state instead of introducing a separate task model too early
- helper-level regression coverage now locks in the background-session summary seam so later shell cleanup does not hide active background work again

#### Third implementation cut follow-through
- the composer slash menu now suggests real `/subagents` actions like `list`, `kill`, `log`, `info`, `send`, `steer`, and `spawn`
- ClawFace’s `/subagents` usage text now matches OpenClaw’s current action set instead of drifting behind the backend
- helper-level regression coverage now locks in the slash suggestion mapping so future slash-menu cleanup does not quietly regress subagent discoverability

---

### Slice 5.3 — Node/device visibility
#### User value
The user can see and eventually interact with OpenClaw’s paired nodes/devices from the desktop client.

#### Scope
- paired device visibility
- capability summaries
- groundwork for later device-action UX

#### First cut
- start with a read-only surface before building device actions:
  - show the local device identity ClawFace uses for gateway pairing
  - show whether that device is paired, pending approval, or not listed
  - show the current gateway's pending and paired device summaries in Settings
  - refresh the list from real `device.pair.requested` / `device.pair.resolved` events when the Settings surface is visible

#### First implementation cut follow-through
- Settings now includes a read-only `Devices & Pairing` section driven by OpenClaw's existing `device.pair.list` method
- ClawFace now loads the local device identity, fetches the pairing index when supported, and refreshes it when pairing events arrive while Settings is open
- helper-level regression coverage now locks in the device-pairing normalization seam so later device-surface cleanup does not quietly regress current-device status or list ordering

#### Second implementation cut follow-through
- the device surface now derives human-friendly capability summaries from the existing roles/scopes payload instead of relying only on raw scope strings
- current, pending, and paired device rows now surface readable capability headlines and chips like `Full operator control` and `Read-only visibility`
- helper-level regression coverage now locks in the capability-summary seam so later device-surface cleanup does not regress scope implication or custom-scope handling

#### Third implementation cut follow-through
- the existing `Devices & Pairing` Settings card now exposes the first safe in-app device action by approving or rejecting pending pairing requests when the gateway advertises those methods
- pending request rows are now fully actionable instead of preview-only, while paired-device management still stays intentionally out of scope for Milestone 1
- helper-level regression coverage now locks in the pairing-action method-selection seam so later device-surface cleanup does not quietly regress gateway capability gating

#### Fourth implementation cut follow-through
- the device pairing subsystem now lives behind a dedicated controller hook instead of sitting inline in `app.tsx`
- gateway `hello` / `close` / event reactions, pairing refresh, pending resolution state, and approve/reject actions now share one device-specific ownership boundary
- the Settings surface now receives a grouped device-pairing model instead of a long device-specific prop chain, which keeps the app root closer to shell composition as Milestone 1 expands

---

### Slice 5.4 — Browser/canvas/actionful specialist surfaces
#### User value
The user gets richer experiences for especially visual/actionful OpenClaw workflows.

#### Scope
- browser-oriented surfaces
- canvas-oriented surfaces
- action timeline integrations

---

# Cross-cutting architecture tracks

These should progress alongside the vertical slices.

## Track A — Chat surface decomposition
Primary target:
- `ChatView.tsx`

Goal:
- split responsibility without pausing product progress

## Track B — Platform/media abstraction
Primary goal:
- isolate Electron/desktop file and image logic from presentation components

#### First implementation cut follow-through
- `MessageImageAttachment` no longer carries its image load/retry/desktop-bridge state machine inline
- desktop local decode, scheme fallback, remote media fallback, generated-image retry timing, and preview decode recovery now live behind `useMessageImageAttachmentController`
- the image attachment surface is now closer to a pure view component, which gives future media work a clearer seam than editing JSX-heavy runtime logic directly

#### Second implementation cut follow-through
- the shell-level remote image resolver no longer lives inline in `app.tsx`
- gateway RPC probing, HTTP fallback probing, remote image response decoding, and remote image result caching now live behind `useRemoteImageResolver`
- the app root is closer to shell composition for media concerns, and future remote-image work has a dedicated seam instead of reopening the root component

#### Third implementation cut follow-through
- runtime-specific attachment image-source normalization no longer lives in two places
- `src/lib/message-image-source.ts` now owns the shared desktop/web image-source translation seam used by both image rendering and attachment construction
- `src/app.tsx` no longer carries the overlapping desktop local-image URL, web local-proxy, and file-url mapping helpers inline when turning gateway payloads into attachments

#### Fourth implementation cut follow-through
- the image lightbox runtime behavior no longer lives inline in `ChatView.tsx`
- modal open/close state, escape-key dismissal, body scroll locking, desktop lightbox recovery, and web local-file blocking now live behind `useImageLightboxController`
- `ChatView` is closer to a rendering/composition surface for image modal behavior instead of another home for media/runtime state

#### Fifth implementation cut follow-through
- the app-side media directive and attachment extraction path no longer lives inline in `src/app.tsx`
- `src/lib/chat-message-attachments.ts` now owns `MEDIA:` parsing, attachment signature/dedupe logic, and runtime-aware payload-to-attachment chat-message shaping
- the app root now consumes a shared attachment parsing boundary for history messages, tool-result attachment rows, and assistant attachment projections instead of carrying a parallel media parsing subsystem

## Track C — App-state formalization
Primary goal:
- define and enforce state ownership for connection, session, thread, tool, and UI domains

#### First implementation cut follow-through
- the repo now has an explicit Phase 1 state-domain note in `docs/APP-STATE-DOMAINS.md`
- connection, session, thread, composer/input, tool, UI, and settings ownership are now mapped to current app-shell state and existing controller seams
- future Track C work can target named domains instead of re-auditing `src/app.tsx` every time a store/controller extraction is proposed

## Track D — Gateway/domain normalization
Primary goal:
- normalize raw gateway events into app/domain events the renderer can consume cleanly

## Track E — Electron main-process cleanup
Primary goal:
- gradually decompose `electron/main.cjs` as the product expands beyond basic shell behavior

---

# Suggested execution order inside Milestone 1

Milestone 1 should mostly include:
- Phase 1
- Phase 2
- enough of Phase 3 to make tool visibility real
- selected Phase 4 polish work

That means the likely Milestone 1 execution order is:

## M1 Step 1
- Slice 1.1 — Connection and session shell reliability
- Slice 1.2 — Thread rendering and streaming cleanup

## M1 Step 2
- Slice 1.3 — Composer baseline cleanup
- Slice 2.1 — Drag and drop attachments

## M1 Step 3
- Slice 2.2 — Paste image and clipboard workflow
- Slice 2.3 — Attachment preview and rendering pipeline

## M1 Step 4
- Slice 3.1 — Basic tool activity timeline
- Slice 3.2 — Tool output and failure clarity

## M1 Step 5
- Slice 4.1 — Model/runtime control cleanup
- Slice 4.2 — Error, reconnect, and recovery polish
- Slice 4.3 — Settings decomposition and cleanup (only as much as M1 needs)

---

# How to use this roadmap

## For planning
Use the phases to decide sequence.

## For execution
Use the vertical slices to define actual implementation tickets.

## For scope control
If a task does not clearly fit one of the current phase goals or slices, it is probably not the next thing to do.

---

# Final roadmap summary

The right way to build ClawFace is:
- stabilize the core shell
- make desktop media workflows excellent
- surface OpenClaw’s actionfulness clearly
- polish runtime interactions
- then expand into richer OpenClaw-native surfaces

That preserves product momentum while steadily replacing the current prototype-style architecture with something that can actually last.
