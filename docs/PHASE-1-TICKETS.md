# ClawFace Phase 1 Tickets

This document turns **Phase 1 — Core chat shell stabilization** from the implementation roadmap into concrete work items.

Phase 1 is about making the core shell reliable enough to serve as the base for the rest of the product.

It focuses on three vertical slices:
- Slice 1.1 — Connection and session shell reliability
- Slice 1.2 — Thread rendering and streaming cleanup
- Slice 1.3 — Composer baseline cleanup

The intent is to keep these tickets:
- concrete
- implementation-oriented
- tied to user value
- tied to architecture improvement

---

# Phase 1 goals

At the end of Phase 1, ClawFace should have:
- clearer connection state behavior
- more reliable session switching
- improved thread rendering and streaming stability
- a cleaner composer/input flow
- less centralization in the current giant chat surface
- better-defined state ownership for core shell behavior

---

# Slice 1.1 — Connection and session shell reliability

## Ticket 1.1.1 — Audit current connection-state ownership
### Goal
Identify exactly where connection state is currently owned, transformed, and consumed.

### Why
Connection behavior currently feels too distributed and likely too implicit.
We need a real map before we clean it up.

### Tasks
- identify all connection-related state in renderer
- identify gateway connection lifecycle touchpoints
- identify all UI surfaces reacting to connection state
- note duplicated or conflicting connection-derived state
- record findings in a small implementation note or comments in this file

### Deliverable
A short map of current connection-state ownership and pain points.

### Done when
- we know where connection status actually lives
- we know which UI surfaces depend on it
- we know where reconnect/error logic is currently split

### Audit findings (2026-04-07)

#### Primary ownership before 1.1.2 (pre-implementation baseline)
Connection state was owned at the top of `src/app.tsx` using a loose set of individual state variables.

> **Note:** The following reflects the state of the codebase *before* ticket 1.1.2 was implemented.
> See the 1.1.2 implementation notes below for the model that replaced this.

Observed primary state at audit time:
- `gatewayUrl` — `useState(...)` in `src/app.tsx`
- `token` — `useState(...)` in `src/app.tsx`
- `password` — `useState(...)` in `src/app.tsx`
- `connected` — `useState(false)` in `src/app.tsx`
- `connectionNote` — `useState<string | null>(null)` in `src/app.tsx`
- `clientRef` — `useRef<GatewayClient | null>(null)` in `src/app.tsx`

This made `app.tsx` the connection-state source of truth, but only in a coarse and fairly UI-coupled way.

#### Gateway lifecycle touchpoints (pre-1.1.2 baseline)
The main gateway lifecycle was created in `src/app.tsx` via:
- `new GatewayClient({ url: gatewayUrl, token, password, ... })`

Within that lifecycle:
- successful connect path set `connected = true`
- disconnect/error path set `connected = false`
- disconnect/error path also set `connectionNote`
- special pairing-required handling also set `connectionNote`

The actual transport behavior lives in `src/lib/gateway.ts`, but the app-level interpretation of connection state lived in `app.tsx`.

#### Transport/domain boundary (pre-1.1.2 baseline)
`src/lib/gateway.ts` exposes:
- `GatewayClient`
- internal websocket lifecycle
- `connected` getter
- auth mutation/update behavior
- request/event transport behavior

But the renderer did **not** consume a normalized connection domain model.
Instead, `app.tsx` translated transport events directly into a small UI-facing state pair:
- `connected`
- `connectionNote`

This was usable, but thin.
It did not model richer app-level connection states such as:
- connecting
- reconnecting
- disconnected
- auth/pairing required
- failed configuration

#### Renderer/UI consumers of connection state
Observed consumers include:

##### `src/components/ChatView.tsx`
Consumes `connected` via props and uses it for:
- topbar status indicator (`Gateway connected` / `Gateway disconnected`)
- disabled-state messaging in the composer area
- send behavior gating
- some interaction gating around message sending

This means the main chat surface is directly coupled to the coarse boolean connection model.

##### `src/components/SettingsModal.tsx`
Does not appear to consume `connected` directly, but owns/edit-controls for:
- `gatewayUrl`
- `token`
- `password`
- `fsServerUrl`

So settings mutate the underlying connection inputs, while `app.tsx` interprets their runtime effect.

##### `src/app.tsx` internal async flows
Many async operations are guarded by `if (!connected) return` or equivalent patterns, including logic around:
- history loading
- usage loading
- verbose tool-event loading
- image/http proxy fallback behavior
- status-like commands and model/agent loading paths

This indicates that `connected` is acting as a broad gate across many unrelated app behaviors.

#### Derived/presentational connection state
There is also additional presentational logic in `app.tsx` combining:
- protocol warnings (for `ws://` vs expected secure use)
- `connectionNote`

into a user-facing disabled/status message.

That means user-visible connection state is currently composed from multiple concepts:
- raw connectivity boolean
- disconnect/pairing note
- protocol warning

These concepts are related, but not the same thing. Right now they are only loosely modeled.

#### Current pain points / smells

##### 1. Connection state is too coarse
The main app-level model is basically:
- `connected: boolean`
- `connectionNote: string | null`

That is not enough to cleanly represent the actual lifecycle.

##### 2. Connection state is UI-coupled in `app.tsx`
Transport events are translated directly into UI-facing state in the top-level renderer component, rather than through a dedicated app/domain boundary.

##### 3. Many unrelated features gate on the same boolean
A single `connected` boolean is used to short-circuit multiple flows, which increases the chance of hidden coupling and awkward partial-failure behavior.

##### 4. Credentials/config and runtime status are adjacent but not well separated
`gatewayUrl`, `token`, and `password` are configuration inputs, while `connected` / `connectionNote` are runtime state, but today they all live together in the same top-level surface without a more explicit boundary.

##### 5. Pairing/auth-required is modeled as a note, not a state
Special cases like pairing-required currently collapse into `connectionNote` text instead of a structured connection state.

#### Recommended next step from this audit
Ticket `1.1.2` should introduce an explicit connection-state boundary that at minimum distinguishes:
- config/input state
- connection lifecycle state
- human-readable status/reason

A likely first-pass model would separate:
- `gatewayConfig`
- `connectionStatus`
- `connectionReason` / `connectionHint`

rather than continuing to overload a simple boolean plus note string.

---

## Ticket 1.1.2 — Introduce explicit `connectionStore` or equivalent state boundary
### Goal
Create a dedicated boundary for connection status instead of letting it remain scattered through UI components.

### Scope
- connection status enum/state
- gateway availability state
- reconnecting/disconnected/error state
- current backend/gateway endpoint metadata if relevant

### Tasks
- choose the initial state management pattern
- define the connection-state model
- move existing connection state ownership into the new boundary
- update consumers to read from that boundary instead of ad hoc local state

### Deliverable
A single clear source of truth for connection state.

### Done when
- connection state is not duplicated across major surfaces unnecessarily
- top-level UI can render connection status without fragile prop chains

### Implementation notes (2026-04-07)

A first-pass explicit connection boundary has now been introduced in `src/app.tsx` and `src/lib/types.ts`.

#### Added types
In `src/lib/types.ts`:
- `GatewayConfig`
- `ConnectionStatus`
- `ConnectionState`

Current first-pass model:
- `GatewayConfig`
  - `gatewayUrl`
  - `token`
  - `password`
- `ConnectionState`
  - `status`
  - `reason`
  - `note`

#### Structural change made
Previous top-level state:
- `gatewayUrl`
- `token`
- `password`
- `connected`
- `connectionNote`
- `pairingRequired`

New top-level boundary:
- `gatewayConfig`
- `connectionState`

With derived values:
- `gatewayUrl`, `token`, `password` destructured from `gatewayConfig`
- `connected` derived from `connectionState.status === "connected"`

#### Current `ConnectionStatus` values
- `connecting`
- `connected`
- `disconnected`
- `pairing-required`
- `error`

#### Current behavior after this ticket
- successful gateway hello sets:
  - `status: "connected"`
  - `reason: null`
  - `note: null`
- pairing-related close sets:
  - `status: "pairing-required"`
  - `reason` from close payload
  - pairing note text
- non-pairing close sets either:
  - `status: "error"` when a reason string exists
  - `status: "disconnected"` when there is no explicit reason
- several previous `setConnectionNote(...)` error paths now update `connectionState.note`

#### What this ticket accomplished
- separated gateway config inputs from runtime connection lifecycle state
- removed the old `pairingRequired` boolean
- removed the old standalone `connectionNote` state
- removed the old standalone `connected` state as primary ownership
- established a first explicit app-level connection model without introducing a full store yet

#### Why this is intentionally a first pass
This ticket does **not** yet create a dedicated external store module.
Instead, it introduces a cleaner boundary in-place so the app can evolve without a huge state-management rewrite all at once.

That is acceptable for this phase because the goal was to stop treating connection state as only:
- boolean + note string

and instead begin modeling lifecycle state explicitly.

#### Remaining gaps / follow-up opportunities
This first pass still leaves room for later improvement:

##### 1. `connecting` is currently defined but not fully surfaced
The type now supports it, but the renderer lifecycle does not yet model all transitions explicitly.

##### 2. `connectionState` still lives in `app.tsx`
The boundary is cleaner, but it is not yet extracted into a dedicated store module.

##### 3. Some non-transport request failures still write into `connectionState.note`
This is better than the old loose note state, but later work should decide which errors are:
- true connection-state issues
- thread/session-level operation errors
- generic operation failures

#### Recommended next step
Ticket `1.1.3` should now build on this by improving reconnect/disconnected UX using the new `connectionState` model.

---

## Ticket 1.1.3 — Stabilize reconnect behavior and disconnected-state UX
### Goal
Make backend disconnects understandable and less chaotic.

### Scope
- visible reconnecting state
- visible disconnected state
- clear failed-connection state
- less confusing transient behavior during reconnects

### Tasks
- review current reconnect flow
- define the desired UI states for:
  - connected
  - reconnecting
  - disconnected
  - failed/auth/config error
- update shell UI accordingly
- ensure session/thread UI does not collapse into nonsense during connection transitions

### Deliverable
A clearer connection-state UX flow.

### Done when
- the user can tell what the app is doing during backend interruptions
- reconnects do not feel like silent breakage

### Implementation notes (2026-04-07)

This ticket has now been completed as a first-pass UX improvement on top of the `connectionState` model introduced in 1.1.2.

#### Desired user-facing states defined
For the current shell, the useful first-pass states are:
- `connected`
- `connecting`
- `pairing-required`
- `error`
- `disconnected`

These now map more clearly to user-facing shell status than the previous binary connected/disconnected treatment.

#### Key implementation changes

##### 1. `ChatView` now accepts `connectionStatus`
A new prop was added to `ChatView`:
- `connectionStatus?: ConnectionStatus`

This allows the chat shell to render richer connection UX than just `connected: boolean`.

##### 2. Topbar status is now lifecycle-aware
Previously the topbar only showed:
- `Gateway connected`
- `Gateway disconnected`

It now renders more specific states:
- `Gateway connected`
- `Connecting to gateway…`
- `Gateway pairing required`
- `Gateway connection error`
- `Gateway disconnected`

##### 3. Composer warning messaging is now lifecycle-aware
Previously the composer warning only appeared when not connected and mostly rendered a generic disconnected message.

It now renders different warning text based on `connectionStatus`:
- connecting → `Connecting to the gateway…`
- pairing-required → pairing guidance
- error → explicit connection error guidance
- disconnected → disconnected guidance

##### 4. Reconnect state is now surfaced during retry behavior
`GatewayClient` already had automatic reconnect behavior internally.
What was missing was a user-facing reconnect state.

The app now sets `connectionState.status = "connecting"` in reconnect-oriented close cases instead of collapsing immediately to a generic disconnected state.

Current first-pass rule:
- if the client is not intentionally closed and the close is not a normal 1000 close, the app surfaces `connecting`
- pairing-required still becomes `pairing-required`
- explicit reason-bearing failures can still surface as `error`
- normal/no-retry-style cases can still surface as `disconnected`

##### 5. `app.tsx` passes the new lifecycle state into `ChatView`
`ChatView` now receives:
- `connected`
- `connectionStatus`
- `disabledReason`

This is an incremental improvement that keeps compatibility while making the UX less coarse.

#### What this ticket improved for the user
- backend interruptions are less likely to feel like silent breakage
- reconnecting now looks like an active state rather than a dead one
- pairing-required is more clearly distinguished from generic failure
- the shell now communicates more of the connection lifecycle honestly

#### Remaining limitations

##### 1. Reconnect state is still inferred at the app/UI boundary
This is good enough for now, but a future store/domain layer could make reconnect intent more explicit.

##### 2. `connected` is still passed alongside `connectionStatus`
This is acceptable for the transition, but eventually the UI could rely more directly on the richer state model.

##### 3. There is still room for a more visible shell-level reconnect banner or status surface
For now the improvement lives mainly in:
- topbar status
- composer warning text

That is a good first pass, not the final word.

#### Recommended next step
Move on to ticket `1.1.4` or `1.2.1` depending on whether the next priority is session-state mapping or ChatView decomposition.

---

## Ticket 1.1.4 — Audit current session-selection ownership and flow
### Goal
Understand how session selection currently works and where it becomes fragile.

### Why
Session switching is one of the highest-frequency actions in the app.

### Tasks
- identify where selected session state lives
- identify how session changes propagate to thread rendering
- identify race conditions or awkward transitions during switching
- note places where session state is coupled too tightly to view behavior

### Deliverable
A short map of selected-session flow and problem points.

### Done when
- we understand the state flow from sidebar selection to thread view update

### Audit findings (2026-04-07)

#### Primary ownership today
Selected-session ownership currently lives in `src/app.tsx`.

Observed primary state:
- `selectedSessionKey` — `useState<string | null>(...)`
- `selectedSessionRef` — `useRef<string | null>(selectedSessionKey)`

The state and ref are kept in sync with an effect:
- `selectedSessionRef.current = selectedSessionKey`

This means the current app uses both:
- React state for rendering and effects
- an imperative ref for async/event-driven code paths

That pattern is understandable, but it is also one of the main sources of complexity.

#### Where session selection is consumed
The selected session affects many surfaces in `app.tsx`, including:
- history loading
- current session lookup via `useMemo`
- usage/token stats loading
- verbose tool-event loading
- model/thinking overrides
- message send and run operations
- session deletion fallback behavior
- newly created/resolved session selection behavior
- routing of tool/message/task-style event updates back into the active thread

This means selected-session state is doing a lot more than simply picking which sidebar row is highlighted.

#### Sidebar → shell → thread flow
The basic interaction flow is:
1. `SessionSidebar` receives:
   - `selectedKey={selectedSessionKey}`
   - `onSelect={handleSelectSession}`
2. user clicks a session card in `SessionSidebar`
3. `handleSelectSession` in `app.tsx` updates:
   - `selectedSessionRef.current`
   - `setSelectedSessionKey(...)`
4. `selectedSessionKey` then propagates to:
   - session-derived memos
   - history-loading effect(s)
   - `ChatView` via `sessionKey={selectedSessionKey}`

So the sidebar itself is thin. The complexity is concentrated in `app.tsx` and then amplified by `ChatView`’s session-transition behavior.

#### `ChatView` also owns session-transition behavior
`ChatView.tsx` receives `props.sessionKey`, but it does not merely render the currently selected thread.
It also appears to maintain its own transition/snapshot logic around session changes, including refs such as:
- `prevSessionKeyRef`
- `prevSessionKeyForLayoutRef`
- `snapshotSessionKeyRef`

This suggests the app currently has **two layers** of session-switch logic:
- app-level selected-session ownership in `app.tsx`
- view-level session transition/snapshot behavior in `ChatView.tsx`

That is not necessarily wrong, but it means session switching is split across layers and will remain fragile until those boundaries are clarified.

#### Imperative ref usage is central to async correctness
`selectedSessionRef.current` is used widely in async/event-driven code paths, especially where closures would otherwise capture stale selected-session state.

Examples include logic around:
- patching/merging session updates
- filtering inbound events to active vs non-active sessions
- determining whether to mark another session as unread
- history loading guards
- new-session creation/resolution flows
- session delete fallback behavior

This means the ref is currently acting as a practical workaround for closure staleness across a large number of flows.

#### Current flow is resilient but highly coupled
The good news:
- there is a consistent notion of a selected session
- the app does make serious attempts to avoid stale-closure bugs
- active-vs-background session behavior is already modeled in several places

The bad news:
- session ownership is spread across state, ref, effects, callbacks, and view transitions
- many behaviors assume direct access to the current selected key
- `app.tsx` has become the orchestration center for too many session-coupled concerns

#### Fragility points / smells

##### 1. Dual ownership pattern (`selectedSessionKey` + `selectedSessionRef`)
This is useful, but it is still a smell because it means the app needs both a declarative and imperative selected-session model just to stay coherent.

##### 2. Session selection is entangled with many unrelated behaviors
Selection currently drives:
- history loading
- usage stats
- verbose tool events
- send path behavior
- session resolution after create/send
- delete fallback behavior
- override state lookup

This makes it harder to reason about what should happen on session switch.

##### 3. `ChatView` adds a second layer of session switching complexity
The view is not just a pure consumer of the selected session; it has its own transition model. That makes the app more likely to accumulate hidden coupling between shell logic and UI transition logic.

##### 4. There are several fallback/repair paths that can change selection indirectly
Examples include:
- resolving newly created session keys
- deletion choosing a next selected key
- startup fallback choosing a session when none is selected

These are all valid behaviors, but they make selection flow more branchy and less explicit.

##### 5. Active-session determination is repeatedly re-derived in async handlers
Many code paths compute "is this for the currently selected session?" using `selectedSessionRef.current`. This works, but suggests the need for a clearer session-domain boundary.

#### Recommended next step from this audit
Ticket `1.1.5` should introduce a clearer selected-session/session-domain boundary that explicitly owns at least:
- selected session key
- session list
- current-session lookup
- current-session loading state
- session switch intent/transition state (at least coarse-grained)

It should not try to solve every session-related concern at once, but it should reduce the need for `app.tsx` to be the only place where session meaning exists.

---

## Ticket 1.1.5 — Introduce explicit `sessionStore` or equivalent selected-session boundary
### Goal
Create a clearer ownership model for selected session and session-list state.

### Scope
- selected session id/key
- session list data
- current session loading state
- session switching transition state (at least coarse-grained)

### Tasks
- define session-related state model
- move selected session ownership into explicit store/boundary
- reduce local duplication of selected-session state
- update shell/sidebar/thread consumers

### Deliverable
A cleaner session-state boundary.

### Done when
- session switching logic is less implicit
- selected session is not being re-derived in multiple fragile ways

### Implementation notes (2026-04-07)

This ticket has now been completed as a first-pass session-domain boundary introduction in `src/app.tsx` and `src/lib/types.ts`.

#### Added types
In `src/lib/types.ts`:
- `SessionTransitionState`
- `SessionState`

Current first-pass session model:
- `selectedSessionKey`
- `sessions`
- `isCurrentSessionLoading`
- `transitionState`

#### Structural change made
Previous top-level ownership was spread across independent state values such as:
- `sessions`
- `selectedSessionKey`
- assorted logic using `selectedSessionRef`
- implicit loading/transition behavior

A first explicit boundary now exists via:
- `sessionState`

with scoped update helpers for:
- `setSessions(...)`
- `setSelectedSessionKey(...)`
- `setIsCurrentSessionLoading(...)`
- `setSessionTransitionState(...)`

#### What this boundary now owns explicitly
The new `sessionState` object owns:
- selected session key
- session list data
- current-session loading state
- coarse transition state (`idle` / `switching`)

This is not yet a separate external store module, but it is a real ownership improvement over the previous loose arrangement.

#### Additional behavior improvements landed as part of the ticket

##### 1. History loading now updates `isCurrentSessionLoading`
When `loadHistory(...)` is invoked for the currently selected session, the app now:
- sets `isCurrentSessionLoading = true` before work starts
- sets `isCurrentSessionLoading = false` in the matching completion path

This gives the session boundary a real loading signal instead of leaving session-loading state entirely implicit.

##### 2. Session switch intent now updates `transitionState`
`handleSelectSession(...)` now sets:
- `transitionState = "switching"` when moving from one session to another
- `transitionState = "idle"` when no real switch occurred

And successful active-session history application resets:
- `transitionState = "idle"`

This is intentionally coarse, but it makes session switching more explicit than before.

#### What this ticket accomplished
- introduced a first explicit session-domain object
- made selected-session/session-list ownership less scattered
- gave the shell explicit current-session loading state
- gave the shell an explicit coarse transition-state model
- created a better base for the next ticket (`1.1.6`) without forcing a full state-management rewrite

#### What this ticket does *not* solve yet

##### 1. `selectedSessionRef` still exists and is still important
This is expected for now.
Async/event-driven code still depends on imperative current-session access.
The point of this ticket was not to remove every ref immediately, but to reduce loose ownership.

##### 2. `currentSession` is still derived in `app.tsx`
The ticket did not yet extract a dedicated selector/store module.
That can come later if the session domain grows further.

##### 3. `ChatView` still owns its own session-transition internals
This ticket only introduced a coarse shell-level transition signal.
A deeper cleanup still belongs to later thread/session work.

#### Recommended next step
Ticket `1.1.6` should now use the new `isCurrentSessionLoading` and `transitionState` signals to make session-switch behavior in the shell and thread feel more intentional and less fragile.

---

## Ticket 1.1.6 — Improve session-switch consistency in the UI shell
### Goal
Make switching sessions feel predictable and visually coherent.

### Scope
- session selection transitions
- active-session highlighting
- loading/transition states for thread view
- preserving or intentionally resetting scroll/input state

### Tasks
- identify awkward session-switch behaviors
- define desired behavior for:
  - switching to loaded session
  - switching to not-yet-loaded session
  - switching while streaming
- update shell/thread behavior to follow explicit rules

### Deliverable
A more consistent session-switching experience.

### Done when
- switching sessions no longer produces confusing or obviously fragile UI behavior

### Implementation notes (2026-04-07)

This ticket has now been completed as a first-pass shell/session-switch UX improvement on top of the `SessionState` boundary introduced in 1.1.5.

#### Desired behavior clarified
For the current phase, the desired shell behavior is:

##### Switching to another session
- shell should explicitly enter a switching state
- thread should not pretend the user is simply in a blank new conversation while the new session is being restored

##### Loading the current selected session
- shell should expose a loading state while history/thread context is being fetched

##### Returning to idle
- once the active session history has been applied, the shell should return to an idle transition state

This is intentionally simple, but much clearer than silently reusing whatever thread state happened to be visible.

#### Key implementation changes

##### 1. `ChatView` now accepts session loading/transition props
New props added:
- `isCurrentSessionLoading?: boolean`
- `sessionTransitionState?: SessionTransitionState`

This allows the shell/view boundary to communicate session-switch state directly instead of relying only on message presence.

##### 2. `app.tsx` now passes shell-level session signals into `ChatView`
`ChatView` now receives:
- `isCurrentSessionLoading={isCurrentSessionLoading}`
- `sessionTransitionState={transitionState}`

That means session-switch UX can now be driven by explicit shell state rather than hidden assumptions.

##### 3. `ChatView` now distinguishes loading/switching empty states from a true new conversation
Previously, when there were no visible messages, the thread primarily fell back to the generic:
- `New Conversation`

That made session switches or active-session loads feel more ambiguous than they should.

Now, when:
- `sessionTransitionState === "switching"`
- or `isCurrentSessionLoading === true`

and there are no visible messages yet, `ChatView` renders a more intentional state:
- `Switching Sessions`
- or `Loading Session`

with explanatory copy instead of the generic new-conversation prompt.

#### What this ticket improved for the user
- switching sessions is less likely to look like an accidental empty thread
- current-session loading is more legible
- the shell is more honest about what state it is in during session changes
- there is now a clearer distinction between:
  - a genuinely new/empty conversation
  - a session currently being loaded/restored

#### What this ticket does *not* solve yet

##### 1. `ChatView` still owns deeper transition/snapshot behavior
This ticket did not remove the internal session-transition machinery in `ChatView`. It only gave the shell a clearer top-level state model to communicate with it.

##### 2. Switching while streaming still needs deeper handling later
This ticket improves the visible state model, but does not yet fully redesign how all in-flight stream/UI transition edge cases should behave.

##### 3. Scroll/input preservation rules remain only partially explicit
The shell is more coherent now, but future tickets around thread and composer cleanup should make those behaviors even more intentional.

#### Recommended next step
With Slice 1.1 now materially advanced, the best next move is likely `1.2.1` — the `ChatView.tsx` responsibility map — because the remaining fragility is now increasingly concentrated in the overloaded chat surface itself.

---

# Slice 1.2 — Thread rendering and streaming cleanup

## Ticket 1.2.1 — Map current responsibilities inside `ChatView.tsx`
### Goal
Identify which responsibilities need to move out first.

### Why
We should not refactor the component blindly.

### Tasks
- list major responsibility clusters inside `ChatView.tsx`
- identify low-risk extractions
- identify high-risk logic clusters that should remain temporarily but be isolated later
- identify dependencies between rendering, streaming, media, and composer logic

### Deliverable
A decomposition plan for `ChatView.tsx`.

### Done when
- the first extraction targets are explicit and ordered

### Responsibility map (2026-04-07)

`src/components/ChatView.tsx` is currently acting as a large multi-system surface rather than a narrowly scoped view component.

The file contains at least the following major responsibility clusters.

#### 1. Thread/message rendering system
Responsibilities include:
- rendering the main thread
- rendering snapshot/outgoing thread overlays during session transitions
- rendering message rows and markdown content
- rendering history hints / empty states / thinking state / stream state
- rendering tool panels before/after messages

Key signals of this cluster:
- `displayedMessages`
- `toolTimeline`
- `MessageRow`
- main-thread and outgoing-thread JSX blocks

#### 2. Attachment/media rendering and local-image resolution
Responsibilities include:
- path normalization helpers
- data URL normalization
- image-source candidate extraction
- desktop-local image URL mapping
- remote/local image fallback logic
- attachment opening behavior
- lightbox image failure recovery

Key signals of this cluster:
- `MessageImageAttachment`
- many file/url/path helper functions near the top of the file
- `onResolveRemoteImage`
- desktop runtime checks and local-image scheme handling

This is a major smell because it mixes platform/media concerns directly into the chat surface.

#### 3. Composer/input interaction system
Responsibilities include:
- draft editing
- command suggestion state
- active command selection
- send behavior
- auto-resize behavior
- compose-state refs
- disabled/warning messaging
- model/thinking menus colocated with composition

Key signals:
- `activeCommand`
- `composerTextareaRef`
- `autoResizeComposer`
- `sendWithPhysics`
- command suggestion memo/state

This is one of the clearest extraction candidates.

#### 4. Streaming and tool-activity presentation
Responsibilities include:
- stream markdown rendering
- stream bubble animation state
- tool activity panel rendering
- tool expand/collapse state
- tool panel fly-in/popping behavior

Key signals:
- `streamMarkdownHtml`
- `streamPopActive`
- `toolExpanded`
- `renderToolPanel(...)`
- `poppingToolIds`
- `sessionFlyInToolIds`

This is product-critical because OpenClaw-native UX depends on tool visibility, but it should not remain fused to the entire chat shell.

#### 5. Session-switch choreography / animation system
Responsibilities include:
- session transition phases (`idle`, `out`, `preparing`, `in`)
- outgoing thread snapshots
- session switch timers/refs
- session fly-in marks for messages/tools/stream
- layout timing and pre-paint transition handling

Key signals:
- `sessionTransitionPhase`
- `outgoingThreadSnapshot`
- `prevSessionKeyRef`
- `prevSessionKeyForLayoutRef`
- `snapshotSessionKeyRef`
- `useLayoutEffect(...)` for session switch prep
- multiple timer refs and RAF refs

This is one of the riskiest clusters in the file. It is too intertwined to extract first without care.

#### 6. Scroll and viewport behavior
Responsibilities include:
- auto-scroll enable/disable
- scroll restoration while loading history
- older-history loading trigger behavior
- message jump behavior

Key signals:
- `autoScrollEnabled`
- `scrollRef`
- `restoreScrollRef`
- `olderLoadRequestedRef`
- `scrollToMessage(...)`

This is a good candidate for dedicated hook extraction after thread boundaries are clarified.

#### 7. Overlay / lightbox / portal behavior
Responsibilities include:
- image lightbox state
- portal rendering
- local image retry/failure handling in overlay
- click-close and interaction management

Key signals:
- `imageLightbox`
- `createPortal`
- `onLightboxImageError`

This can likely become a separable component once media logic is better isolated.

#### 8. Shell/status/control presentation
Responsibilities include:
- topbar connection status
- session info strip
- model menu / thinking menu
- shell controls like settings/files/new-session/compact
- composer warning banners

This is currently mixed into the same giant rendering surface instead of being clearly separated as shell/header controls.

---

### Low-risk extraction targets
These are the best first candidates because they provide meaningful cleanup without forcing a redesign of the hardest transition logic immediately.

#### A. `Composer`
Why low risk:
- already conceptually separate
- strong user-facing value
- large amount of isolated input/command/menu logic lives here

Suggested extraction scope:
- textarea/input surface
- send button / abort button
- slash-command suggestion UI
- model/thinking controls adjacent to composer if desired for now
- attachment staging area if tightly coupled

#### B. `ChatThread` / `MessageList`
Why low risk:
- the file already has a clear thread-rendering block
- this would shrink `ChatView` substantially

Suggested extraction scope:
- history hint
- empty state
- message list iteration
- stream/thinking placeholders
- tool panels around messages

#### C. `AttachmentTray` / attachment staging UI
Why low risk:
- a conceptually distinct sub-surface
- likely can be isolated from the main shell with limited disruption

#### D. `useAutoScroll` / scroll-state hook
Why medium-low risk:
- behavior is important, but it is already one coherent concern
- extracting it behind a hook would simplify the main component substantially

---

### Medium-risk extraction targets
These are good follow-ups after the low-risk extractions establish better boundaries.

#### A. `ToolTimeline` / `ToolActivityPanel`
Why medium risk:
- important product differentiator
- coupled to message/thread rendering and animations
- should be split, but carefully

#### B. `SessionHeader` / shell controls block
Why medium risk:
- not conceptually hard
- but currently mixed with runtime controls and topbar state

#### C. `ImageLightbox`
Why medium risk:
- conceptually self-contained
- but current local-image fallback behavior may keep it tied to media-resolution logic until that is cleaned up

---

### High-risk / defer-for-now clusters
These should probably not be the first extractions.

#### A. Session-transition choreography
This includes:
- outgoing snapshots
- transition phases
- session fly-in logic
- timer/RAF coordination
- pre-paint layout work

Why high risk:
- lots of hidden coupling
- likely to regress UX if extracted blindly

Recommended approach:
- isolate responsibilities conceptually first
- extract easier adjacent pieces before attempting deeper session-transition surgery

#### B. Desktop media resolution inside `MessageImageAttachment`
Why high risk:
- tied to local files, custom schemes, desktop bridge behavior, and remote fallback behavior
- worth extracting to a platform/media layer, but not casually

Recommended approach:
- first define a renderer-side `platform/images` abstraction
- then move the logic behind that boundary

---

### Dependency map between clusters

#### Thread rendering depends on:
- tool activity rendering
- stream state
- scroll behavior
- session-transition state

#### Composer depends on:
- connection status / disabled reason
- attachment staging state
- slash-command logic
- model/thinking selection hooks

#### Media rendering depends on:
- runtime/platform detection
- local/remote image resolution
- attachment model shape
- lightbox behavior

#### Session-transition choreography depends on:
- thread snapshots
- message/tool lists
- animation timing
- selected session changes from the shell

This is why `ChatView` is difficult to refactor all at once: its concerns are not only numerous, they are interdependent.

---

### Recommended extraction order

#### First wave
1. `Composer`
2. `ChatThread` / `MessageList`
3. `useAutoScroll`

#### Second wave
4. `AttachmentTray`
5. `ToolTimeline` / `ToolActivityPanel`
6. `SessionHeader` / topbar shell controls

#### Later wave
7. `ImageLightbox`
8. media/platform abstraction for local image handling
9. session-transition choreography cleanup

---

### Conclusion
The main lesson from this ticket is:

> `ChatView.tsx` is not one component with a few helper concerns — it is the current convergence point for multiple subsystems.

That means the next refactors should prioritize:
- low-risk extractions with clear conceptual boundaries
- reducing cross-concern density
- avoiding a first move that tries to untangle the hardest animation/transition logic immediately

### Recommended next step
Ticket `1.2.2` should start with the low-risk thread rendering extraction (`ChatThread` / `MessageList`) or `1.3.1` can begin with composer extraction if we want a more interaction-centric first split.

---

## Ticket 1.2.2 — Extract `ChatThread` / `MessageList` rendering surface
### Goal
Move core thread rendering into its own component boundary.

### Scope
- thread container
- message list iteration
- message grouping/render dispatch
- top-level thread layout concerns

### Tasks
- define new component boundary
- move render-only or mostly-render concerns first
- keep behavior stable while shrinking `ChatView.tsx`
- preserve existing message rendering correctness

### Deliverable
A dedicated thread-rendering component or set of components.

### Done when
- `ChatView.tsx` no longer directly owns all thread rendering logic
- thread rendering is easier to reason about in isolation

### Implementation notes (2026-04-07)

This ticket has now been completed as a **first-pass presentational extraction**.

#### New component added
- `src/components/ChatThread.tsx`

#### What moved into `ChatThread`
The extracted component now owns the main thread rendering block for the active session, including:
- history hint rendering
- loading/switching empty state
- generic new-conversation empty state
- message iteration for displayed messages
- tool-panel placement before first message and after messages
- stream bubble rendering
- thinking placeholder rendering
- top-level thread container structure and thread-level CSS classes

#### What `ChatView` still owns
`ChatView.tsx` still owns the preparation and orchestration of thread inputs, including:
- computing `displayedMessages`
- computing `toolTimeline`
- stream markdown preparation
- session-transition state
- media/lightbox state
- render callbacks such as `renderToolPanel(...)`
- message row implementation details via `MessageRow`

That means this ticket reduced the main render density without trying to uproot all the intelligence at once.

#### Why this extraction is intentionally conservative
The goal of 1.2.2 was to create a real thread-rendering boundary without detonating the highest-risk systems in the file.

So the extracted `ChatThread` currently works as a **presentational boundary fed by prepared props and callbacks**.
This is the right first move because it:
- shrinks `ChatView.tsx`
- clarifies the thread-rendering seam
- gives future refactors a more stable place to start

#### Important caveat
`ChatThread.tsx` currently imports `MessageRow` from `ChatView.tsx`.

This is a transitional compromise, not the final design.
It means the extraction is real but not yet fully clean.

##### Implication
The next ticket (`1.2.3`) should split `MessageRow` and message-type rendering out so the new thread component no longer depends back on `ChatView.tsx`.

#### What this ticket accomplished
- established a real `ChatThread` component boundary
- removed a large thread-rendering block from the center of `ChatView.tsx`
- made the remaining `ChatView` responsibilities easier to see
- set up the next extraction step more cleanly

#### Recommended next step
Proceed to `1.2.3` — extract `MessageRow` and message-type rendering boundaries — so the new thread component can stop depending on internals from `ChatView.tsx`.

---

## Ticket 1.2.3 — Extract `MessageRow` and message-type rendering boundaries
### Goal
Separate message-level rendering from thread-level orchestration.

### Scope
- user/assistant/tool message row structure
- message-level controls and layout
- message-type dispatch where needed

### Tasks
- define `MessageRow` or equivalent
- isolate rendering differences between message types
- reduce condition-heavy rendering branches in the parent component

### Deliverable
A clearer per-message rendering layer.

### Done when
- message rendering logic is no longer mostly embedded in one giant parent

### Implementation notes (2026-04-07)

This ticket has now been completed as a dedicated message-rendering extraction.

#### New module added
- `src/components/MessageRow.tsx`

#### What moved into `MessageRow.tsx`
The extracted module now owns:
- `MessageRow`
- `MessageRowProps`
- `CopyButton`
- message timestamp formatting helpers used by the row
- render-time attachment helpers
- `MessageImageAttachment`
- markdown click/copy behavior used by message content
- local/desktop image resolution helper cluster needed by image attachments

This means the message-level rendering system is no longer primarily embedded in `ChatView.tsx`.

#### What changed structurally
Before this ticket:
- `ChatThread.tsx` had to import `MessageRow` back from `ChatView.tsx`
- `ChatView.tsx` still owned both thread-level and message-level rendering logic

After this ticket:
- `ChatThread.tsx` imports `MessageRow` from `./MessageRow.tsx`
- `ChatView.tsx` imports `MessageRow` from the same dedicated module when needed
- the thread layer and message row layer now have a cleaner separation

#### Why the extraction included more than just `MessageRow`
A shallow move would not have been honest or clean because `MessageRow` depended on a meaningful cluster of rendering helpers and subcomponents already embedded in `ChatView.tsx`.

Instead of pretending this was a tiny extraction, the ticket moved the render-time dependency cluster that actually belonged with the row-level rendering system.

That was the right move because it:
- avoids a fake extraction with back-references to `ChatView.tsx`
- creates a real render-layer seam
- makes subsequent thread/component cleanup easier

#### What this ticket accomplished
- established a dedicated message-rendering module
- removed the `ChatThread -> ChatView` dependency introduced during the previous ticket
- reduced `ChatView.tsx` responsibility density further
- clarified the boundary between:
  - thread orchestration/rendering
  - per-message rendering

#### Remaining caveat
The extracted message-rendering module still includes a substantial amount of media/local-image handling logic.
That is acceptable for now because this ticket’s purpose was to separate message-level rendering from the giant parent component.

A later platform/media extraction should further improve that boundary.

#### Recommended next step
Proceed to `1.2.4` (`useAutoScroll`) or begin the composer-focused cleanup in `1.3.1`, depending on whether the next priority is further thread simplification or input-surface cleanup.

---

## Ticket 1.2.4 — Extract and stabilize `useAutoScroll`
### Goal
Make auto-scroll behavior understandable and maintainable.

### Scope
- auto-scroll conditions
- user-scrolled-away detection
- streaming scroll behavior
- session-switch scroll rules where relevant

### Tasks
- move scroll logic into a dedicated hook/service boundary
- define expected behavior explicitly
- preserve existing desirable thread behavior while reducing chaos

### Deliverable
A dedicated auto-scroll hook or equivalent abstraction.

### Done when
- scroll behavior is easier to reason about than it is now
- future thread changes do not require spelunking through giant component code
- `make typecheck` and `make build` pass for the extraction

### Implementation notes (2026-04-08)

This ticket has now been completed as a dedicated auto-scroll state extraction.

#### New module added
- `src/hooks/useAutoScroll.ts`

#### What moved into `useAutoScroll`
The new hook now owns the steady-state scroll behavior for the thread surface, including:
- `scrollRef`
- visible message count state for incremental history reveal
- auto-scroll enable/disable state
- near-bottom detection
- scroll restoration bookkeeping when revealing older messages
- load-older trigger gating near the top of the thread
- auto-scroll-to-bottom behavior for message/tool/stream updates
- auto-scroll state reset used during session switches

#### What stays in `ChatView`
`ChatView.tsx` still owns the scroll behavior that is tightly coupled to session-transition choreography and explicit message navigation, including:
- transition-driven forced scroll positioning during animated session changes
- `scrollToMessage(...)` navigation buttons
- transition snapshot/render timing that happens to interact with scroll position

That is intentional.
This ticket extracts the **core auto-scroll state machine**, not every scroll-adjacent behavior in the file.

#### What this ticket accomplished
- removed a coherent scroll/viewport concern from the main `ChatView.tsx` body
- made incremental history reveal and near-top load-more behavior easier to reason about in isolation
- clarified the boundary between:
  - steady-state thread auto-scroll behavior
  - transition-specific scroll choreography

#### Review follow-up applied during validation
This ticket also incorporated PR review follow-up before closure:
- `useAutoScroll` callback dependencies were tightened so callbacks do not depend on the entire options object
- related review cleanup elsewhere in the branch was also applied before final validation, including:
  - hard-failing device identity generation when no CSPRNG is available
  - tightening `useSlashCommands` callback dependencies
  - replacing repeated markdown token casts with a single local token-text reader helper

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Later follow-up (2026-04-11)
Subsequent generated-image stabilization work kept this ticket's boundary intact while extracting one more narrow scroll seam:
- delayed-attachment bottom pinning now goes through `src/lib/scroll-anchoring.ts`
- the resize-to-bottom scheduling path has focused unit coverage via `tests/scroll-anchoring.test.mjs`

This follow-up did **not** move core steady-state auto-scroll ownership back out of `useAutoScroll`.
It only isolated the resize-driven bottom-pin behavior that became important once image attachments could appear after initial message render.

#### Recommended next step
Proceed to `1.2.5` — clean up streaming message update flow — now that the thread surface has a cleaner scroll-state boundary.

---

## Ticket 1.2.5 — Clean up streaming message update flow
### Goal
Make streaming updates more reliable and less visually glitchy.

### Scope
- partial/delta updates
- finalization behavior
- transition from streaming to completed message state
- reduction of flicker and strange transition phases

### Tasks
- identify current streaming update path
- clarify where streaming state lives
- reduce renderer coupling to raw stream update behavior if possible
- tighten the rendering path for in-progress vs finalized messages

### Deliverable
A more stable streaming UX.

### Done when
- streamed replies render smoothly
- finalization behavior is clear and consistent
- the renderer has fewer hacky transitions around streaming state
- `make typecheck` and `make build` pass for the cleanup

### Implementation notes (2026-04-08)

This ticket has now been completed as a first-pass streaming/finalization cleanup.

#### What changed
The streaming message update path in `src/app.tsx` was cleaned up by extracting shared helper behavior from duplicated active-session and non-active-session finalization branches.

#### Shared helpers introduced
The refactor introduced shared helpers for the core streaming/finalization rules, including:
- `buildFinalAssistantMessage(...)`
- `buildStreamCommittedAssistantMessage(...)`
- `clearActiveStreamingState()`
- `clearCachedStreamingState(key)`
- `refreshSessionListsSoon()`
- `reloadActiveSessionHistory()`

#### What this accomplished
These helpers reduced duplicated logic around:
- materializing a final assistant message from `parsed.message` plus accumulated streamed text
- preserving streamed text before tool-use final events clear it
- clearing active streaming state (`streamText`, `chatRunId`, `thinking`)
- clearing cached per-session streaming state for non-active sessions
- refreshing sidebar/session-preview state after finalization
- reloading active session history when run-mismatch or fallback finalization paths no longer trust the in-memory streaming state

#### Why this matters
Before this ticket, active-session finalization, non-active-session finalization, and fallback lifecycle handling each contained slightly different inline logic for the same semantic behaviors.
That made the streaming path harder to reason about and more likely to drift into inconsistent behavior over time.

After this ticket, the code is still not tiny, but the major streaming/finalization rules are less copy-pasted and more explicit.

#### What this ticket intentionally does *not* solve yet
- it does not fully redesign the event model for chat vs agent events
- it does not completely unify every side effect between active and non-active finalization paths
- it does not yet solve every possible interrupted-run or mid-transition edge case

That is acceptable for Phase 1.
The goal here was to make the current streaming path materially clearer and less fragile, not to replace the whole runtime event architecture.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to `1.2.6` — define explicit thread loading/empty/error states — now that thread rendering, scroll behavior, and streaming/finalization behavior are all materially cleaner.

---

## Ticket 1.2.6 — Define thread-level loading/empty/error states
### Goal
Give the thread surface a cleaner state model.

### Scope
- loading thread state
- empty session state
- error/loading-failure state
- session-with-no-history state

### Tasks
- identify current implicit thread states
- define explicit state cases
- render them intentionally
- reduce ambiguous blank or confusing states in the thread pane

### Deliverable
A cleaner thread state UX.

### Done when
- the thread never feels visually undefined or under-specified in core state transitions
- `make typecheck` and `make build` pass for the cleanup

### Implementation notes (2026-04-08)

This ticket has now been completed as a first-pass explicit thread-state cleanup.

#### What changed
The thread surface no longer relies on a couple of loosely-interpreted boolean checks to decide whether it is "loading" or "empty".
Instead, it now uses an explicit thread-state model.

#### New thread-state model
`src/components/ChatThread.tsx` now exposes an explicit `ThreadState` union and a shared `renderThreadStateCard(...)` helper.

Current first-pass states:
- `ready`
- `loading`
- `empty`

#### What `ChatView` now does explicitly
`ChatView.tsx` now computes thread state in one place before rendering:
- `ready` when the thread has visible messages, streaming content, or thinking activity
- `loading` when the session is switching or current-session history is loading
- `empty` when there is no renderable thread content

Within `empty`, the UI now distinguishes between:
- **selected but empty session** → `No Messages Yet`
- **new conversation / no active thread context** → `New Conversation`

#### Snapshot/overlay consistency improvement
The outgoing thread snapshot overlay now reuses the same shared thread-state card renderer for its empty state instead of hardcoding a separate special-case empty card.

That reduces one more inconsistency between the main thread and transition overlay rendering paths.

#### Why this matters
Before this ticket, thread state was mostly inferred from combinations like:
- `messages.length === 0 && isThreadBusy`
- `messages.length === 0 && !isThreadBusy`

That was too implicit for a UI that already has meaningful distinctions between:
- loading a session
- switching a session
- empty-but-ready session state
- actively rendered thread content

This ticket makes those states more explicit without inventing fake error-state behavior that the current app does not yet model cleanly.

#### What this ticket intentionally does *not* solve yet
- it does not introduce a fully-modeled thread load error state because the current app does not yet expose a clean source of truth for that state
- it does not redesign session-transition choreography
- it does not yet move the entire thread-state model into a dedicated thread-view model layer

That is acceptable for Phase 1.
The goal here was to replace ambiguous state handling with a cleaner explicit model in the common cases.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Reassess remaining Phase 1 work now that the thread and composer slices have both been materially cleaned up. The next target should be chosen based on the highest remaining leverage rather than continuing in strict numeric order.

---

# Slice 1.3 — Composer baseline cleanup

## Ticket 1.3.1 — Extract composer UI into a dedicated `Composer` component
### Goal
Stop the main chat surface from owning all composer rendering and interaction logic.

### Scope
- input field / textarea
- send button
- basic action area
- attachment staging UI if already tightly coupled

### Tasks
- define component boundary
- move core input rendering and controls
- preserve current behavior while reducing centralization

### Deliverable
A dedicated `Composer` component.

### Done when
- the composer is not structurally embedded as an inseparable part of `ChatView.tsx`
- `make typecheck` and `make build` pass for the refactor

### Implementation notes (2026-04-07)

This ticket is now **structurally implemented but not yet validated complete**.

#### New component added
- `src/components/Composer.tsx`

#### What moved into `Composer`
The extracted component now owns the main composer/footer rendering surface, including:
- composer shell/footer layout
- textarea/input rendering
- paste image ingestion
- drag-and-drop file ingestion
- file-picker attachment ingestion
- slash-command suggestion menu rendering
- attachment preview/staging UI
- send button and action row
- compact action button in the footer stats row
- token/context footer stats display
- thinking menu rendering and selection UI

#### What `ChatView` still owns
For this ticket, `ChatView.tsx` still owns the prepared state and orchestration logic that feeds the new component, including:
- draft state ownership via props
- slash-command state and suggestion preparation
- send behavior (`sendWithPhysics`)
- textarea sizing behavior and refs
- composer launch animation state
- composition-state refs
- shell-level thinking state values and callbacks

This is intentional.
Ticket `1.3.1` establishes the **component boundary** first without trying to also complete the deeper command/input-state cleanup that belongs in `1.3.2+`.

#### What this ticket accomplished
- established a real `Composer` component boundary
- removed the full composer/footer rendering block from `ChatView.tsx`
- made `ChatView.tsx` more obviously an orchestration shell instead of the sole owner of every render surface
- created a better seam for later extraction of slash-command and composer-state logic

#### Validation status
This ticket is now **validated complete in the intended development environment**.

Validation outcome after follow-up fixes:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

Important nuance:
- intermediate validation work in the OpenClaw/Linux container exposed useful environment/tooling issues, but its Rollup native-package behavior was not the authoritative build result for the actual local development target
- the meaningful completion gate for this ticket was the real dev machine, where the build now passes

#### Follow-up lessons captured during validation
The validation pass also surfaced repo/tooling cleanup needs that should remain explicit:
- the repo needed a real `.nvmrc`
- `make typecheck` needed to use the local TypeScript binary rather than relying on brittle `npx tsc` behavior
- current docs/tooling assumptions around Linux-specific validation were too rigid for the actual macOS development workflow and should be kept honest

#### Recommended next step
Proceed to `1.3.2` (`useSlashCommands`) now that the composer boundary has been extracted and validated.

---

## Ticket 1.3.2 — Isolate slash-command behavior into `useSlashCommands`
### Goal
Separate command parsing/suggestion behavior from generic input rendering.

### Scope
- slash command detection
- suggestion popup logic
- command selection behavior
- command insertion/execution boundary

### Tasks
- extract slash-command state and logic into a dedicated hook/module
- define explicit interface between composer and slash-command behavior
- reduce inline condition complexity in composer code

### Deliverable
A dedicated slash-command hook/module.

### Done when
- slash-command behavior is no longer smeared through generic composer logic
- `make typecheck` and `make build` pass for the extraction

### Implementation notes (2026-04-07)

This ticket has now been completed as a dedicated slash-command behavior extraction.

#### New module added
- `src/hooks/useSlashCommands.ts`

#### What moved into `useSlashCommands`
The new hook now owns the slash-command interpretation layer, including:
- slash-menu visibility detection from the draft
- command tokenization/parsing
- `commandName` / `commandArgs` derivation
- suggestion generation for base commands
- suggestion generation for model-specific completions
- suggestion generation for thinking-level completions
- required-args detection
- exact-command lookup
- active suggestion state helpers
- suggestion application back into the draft

#### What `ChatView` still owns
`ChatView.tsx` still owns the outer keyboard event handler and the final send decision points, including:
- deciding when Enter should send vs apply a suggestion
- calling `sendWithPhysics`
- composition-state handling tied to the textarea/input event lifecycle

That is intentional for this ticket.
The goal of `1.3.2` was to extract slash-command behavior into a dedicated hook boundary, not to redesign all composer send semantics at the same time.

#### What this ticket accomplished
- established a real `useSlashCommands` hook boundary
- removed inline slash-command parsing and suggestion derivation from `ChatView.tsx`
- clarified the boundary between:
  - generic composer/input event handling
  - slash-command interpretation/state
- created a cleaner seam for later composer behavior cleanup in `1.3.3`

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to `1.3.3` — clarify composer behavior during send/stream/switch/reconnect — now that both the component boundary and slash-command hook boundary are in place.

---

## Ticket 1.3.3 — Clarify input state model during send/stream/switch/reconnect
### Goal
Make the composer behave consistently during common shell transitions.

### Scope
- sending a message
- while assistant is streaming
- switching sessions
- reconnecting/disconnected states
- preserving or clearing draft content intentionally

### Tasks
- define expected behavior for each state transition
- implement rules consistently
- reduce accidental state loss or confusing stale input behavior

### Deliverable
A clearer composer behavior model.

### Done when
- composer behavior feels predictable in the most common edge conditions
- `make typecheck` and `make build` pass for the behavior changes

### Implementation notes (2026-04-08)

This ticket has now been completed as a first-pass explicit composer behavior model cleanup.

#### Key behavior changes landed

##### 1. Composer state is now session-scoped
The existing per-session `SessionViewState` cache in `src/app.tsx` now explicitly includes:
- `draft`
- `attachments`

This means composer state is no longer treated as an accidental global surface while the rest of the thread/runtime state is session-specific.

##### 2. Session switching now preserves composer work intentionally
When switching sessions:
- the current session's draft and staged attachments are saved into the session view cache
- the target session's cached draft and attachments are restored

This makes session switching much less destructive and much more predictable for in-progress work.

##### 3. New sessions explicitly clear composer state
When creating a new session, the app now intentionally initializes a fresh composer state:
- empty draft
- no staged attachments

That is clearer than inheriting whatever happened to be on screen previously.

##### 4. History reloads preserve composer state
When session history is reloaded/refreshed, the per-session draft and attachment state is preserved instead of being implicitly blown away by a cache rewrite.

##### 5. Busy vs offline vs ready composer runtime state is now explicit
`ChatView.tsx` now computes a first-pass composer runtime model:
- `ready`
- `busy`
- `offline`

Current first-pass rules:
- `ready` → connected and no active run; send enabled
- `busy` → active run/thinking state present; typing still allowed, but a second send is disabled
- `offline` → disconnected/error-style state; send disabled

##### 6. Busy-state send behavior is clearer
When a run is already in progress:
- the user can continue editing the draft
- the user cannot send again until the run completes or is stopped
- the composer warning explains that a run is already active

This is a more explicit and less accidental behavior model than simply relying on a mix of `connected`, `thinking`, and `canAbort` state in different places.

#### What this ticket intentionally does *not* solve yet
- It does not introduce per-session draft persistence to disk; this is session-runtime state only
- It does not redesign all slash-command execution semantics
- It does not yet fully model every edge case around reconnecting mid-stream across all backend event paths

That is acceptable for this phase because the ticket goal was to make the composer behavior **predictable in the common cases**, not to complete the entire future composer architecture in one pass.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to `1.3.4` — reduce prop and state sprawl between shell and composer — now that:
- the composer component boundary exists
- slash-command behavior has been extracted
- first-pass composer runtime behavior rules have been made explicit

---

## Ticket 1.3.4 — Reduce prop and state sprawl between shell and composer
### Goal
Prevent the composer from becoming another over-coupled surface.

### Scope
- minimize giant prop bundles
- move logic behind hooks/store selectors where appropriate
- isolate UI-local state from shell-global state

### Tasks
- audit composer prop interface after extraction
- reduce coupling where easy wins exist
- align with any early store boundaries from Slice 1.1

### Deliverable
A cleaner shell/composer boundary.

### Done when
- the composer interface is easier to understand than a bag of unrelated values and callbacks
- `make typecheck` and `make build` pass for the refactor

### Implementation notes (2026-04-08)

This ticket has now been completed as a shell/composer interface cleanup pass.

#### What changed
`src/components/Composer.tsx` no longer accepts one large flat prop bag mixing unrelated responsibilities.

Instead, the component now accepts a smaller set of coherent prop groups:
- `uiSettings`
- `input`
- `slash`
- `runtime`
- `footer`

#### Why this is better
Before this ticket, the `Composer` boundary existed, but the interface still leaked too many unrelated concerns in one undifferentiated prop list.
That made the extraction structurally real but still harder to reason about than it should have been.

After this ticket:
- input-state concerns are grouped together
- slash-command concerns are grouped together
- runtime/send-state concerns are grouped together
- footer/thinking/session-stats concerns are grouped together

That makes the shell/composer seam more legible without pushing orchestration logic back into `ChatView.tsx`.

#### What this ticket accomplished
- reduced prop-surface sprawl between `ChatView` and `Composer`
- made the `Composer` interface easier to understand and evolve
- clarified which concerns belong to which part of the composer surface
- created a better base for any future composer-internal subcomponents or hooks

#### What this ticket intentionally does *not* solve yet
- it does not extract all remaining composer orchestration out of `ChatView`
- it does not introduce a dedicated composer store/domain module
- it does not yet split the footer or attachment staging into further subcomponents

That is fine for this phase. The goal here was to make the boundary less messy, not to fully complete the eventual composer architecture in one more ticket.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to `1.2.4` — extract and stabilize `useAutoScroll` — now that the Phase 1 composer slice has been materially cleaned up.

---

# Phase 1 cross-cutting tickets

## Ticket P1-X1 — Define initial app-state domains for Phase 1
### Goal
Make state ownership explicit enough to support the first refactors.

### Scope
At minimum, define boundaries for:
- connection state
- session state
- thread state
- composer/input state
- tool state (at least placeholder/early structure)

### Deliverable
A small state-domain note and/or initial store modules.

### Done when
- there is an explicit answer to “where does this state live?” for core Phase 1 flows

### Implementation notes (2026-04-16)

This ticket is now complete.

#### What changed
- added `docs/APP-STATE-DOMAINS.md` as the first explicit Phase 1 app-state ownership map
- defined current ownership for:
  - connection state
  - session state
  - thread state
  - composer/input state
  - tool state
  - UI/settings state
- called out the existing specialized controller seams that already sit outside the app root:
  - `useStagedAttachments`
  - `useRemoteImageResolver`
  - `useDevicePairingController`
  - image/media controllers from Track B

#### Why this is enough for the ticket
- the repo now has a concrete answer to “where does this state live?” for the core Phase 1 shell flows
- future Track C work can target named domains instead of re-auditing `src/app.tsx` from scratch
- this keeps the next state extraction from being a blind rewrite

#### Recommended next step
If Track C continues immediately, the strongest next slice is to formalize the thread/tool boundary, since that is now the densest unformalized state ownership still living in `src/app.tsx`.

## Ticket C.1 — Introduce the first thread/tool controller boundary
### Goal
Move the active thread/tool runtime state behind an explicit controller seam instead of leaving the entire state cluster inline in `src/app.tsx`.

### Scope
- extract the active thread/tool runtime state into a dedicated hook/controller
- move the state/ref synchronization and active streaming helpers behind that boundary
- keep session cache ownership and higher-level event orchestration in `src/app.tsx` for now
- add at least one focused regression seam for the new snapshot/controller layer

### Deliverable
A first concrete thread/tool boundary that answers:
- “Where does the active thread/tool runtime state live?”
- “Can `app.tsx` orchestrate chat and tool events without also owning all the low-level state syncing?”

### Done when
- the active thread/tool runtime state cluster lives behind a dedicated controller hook
- `src/app.tsx` no longer inlines the corresponding state/ref synchronization helpers
- focused regression coverage exists for the new snapshot/controller seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-16)

This ticket is now complete.

#### What changed
- added `src/hooks/useThreadToolController.ts` to own:
  - active thread/tool state
  - state/ref synchronization for messages, stream text, run id, thinking, tool items, and thinking level
  - active streaming helpers
  - snapshot/apply/clear helpers for the active thread/tool state cluster
- added `src/lib/thread-tool-state.ts` as a small shared snapshot seam
- rewired `src/app.tsx` to consume that controller instead of owning the full active thread/tool sync layer inline

#### Architectural improvements landed
- `app.tsx` is closer to event/shell orchestration for thread and tool behavior instead of also being the low-level state-sync implementation
- Track C now has a real code boundary, not just a documentation note
- the next thread/tool extraction can build on an explicit controller seam instead of starting from raw `useState` and `useRef` sprawl again

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track C continues from here, the strongest next slice is to narrow the higher-level thread/tool event orchestration that still lives in `src/app.tsx`, now that the active runtime state itself has a dedicated controller.

## Ticket C.2 — Extract the first thread/tool event-routing seam
### Goal
Move the active-vs-cached chat/agent event dispatch decision behind an explicit seam instead of recomputing that routing inline inside `src/app.tsx`.

### Scope
- extract the shared routing decision for chat and agent events into a dedicated helper/module
- keep the actual cached/active branch handlers in `src/app.tsx` for now
- preserve the current same-run fallback behavior that keeps active runs from being misrouted
- add focused regression coverage for the new routing seam

### Deliverable
A first event-level boundary that answers:
- “How does the app decide whether an incoming event belongs to the active thread or a cached background session?”
- “Can the app root dispatch chat and agent events without inlining the full routing decision each time?”

### Done when
- `src/app.tsx` no longer duplicates the active-vs-cached event routing rules across chat and agent handlers
- the routing decision lives behind a dedicated helper/module
- focused regression coverage exists for the routing seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-17)

This ticket is now complete.

#### What changed
- added `src/lib/thread-tool-event-routing.ts` to own the active-vs-cached event dispatch decision for:
  - normalized chat events
  - agent stream events
- rewired `src/app.tsx` to consume that routing seam instead of recomputing the same session/run dispatch logic inline in both top-level event handlers
- added focused coverage in `tests/thread-tool-event-routing.test.mjs`

#### Architectural improvements landed
- Track C now has an event-level thread/tool boundary in addition to the earlier runtime-state controller seam
- the chat and agent handlers in `src/app.tsx` are flatter and easier to reason about because the active-vs-cached dispatch rule now has one source of truth
- future Track C work can target the remaining branch-level orchestration directly instead of re-extracting the same routing decision again

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track C continues from here, the strongest next slice is to move one more level of branch orchestration out of `src/app.tsx`, especially the cached vs active chat/tool update paths and their finalization follow-through.

## Ticket C.3 — Extract cached/active thread-tool branch orchestration
### Goal
Move the cached-vs-active chat/tool branch behavior behind an explicit controller seam instead of keeping the full branch orchestration inline in `src/app.tsx`.

### Scope
- extract the cached/active chat and agent branch handlers into a dedicated controller hook/module
- keep raw payload parsing and top-level event receipt in `src/app.tsx` for now
- preserve the current finalization, lifecycle, streaming, and interrupted-run follow-through behavior
- add a focused regression seam for the newly shared delta/final/lifecycle outcome rules

### Deliverable
A branch-level thread/tool boundary that answers:
- “Where does the cached-vs-active chat/tool update orchestration live?”
- “Can `app.tsx` receive normalized events without also owning every branch-specific update rule?”

### Done when
- `src/app.tsx` no longer inlines the cached-vs-active chat/tool branch handler stack
- a dedicated controller seam owns the branch orchestration
- focused regression coverage exists for the extracted delta/final/lifecycle outcomes
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-18)

This ticket is now complete.

#### What changed
- added `src/hooks/useThreadToolEventController.ts` to own:
  - cached vs active chat event orchestration
  - cached vs active agent event orchestration
  - branch-level finalization, lifecycle, streaming, and assistant-attachment follow-through
- added `src/lib/thread-tool-event-outcomes.ts` as a small pure outcome seam for:
  - active run synchronization
  - delta handling
  - final-message/tool-final branching
  - lifecycle terminal handling
- rewired `src/app.tsx` so it now:
  - normalizes raw chat payloads
  - extracts agent event hints
  - delegates the cached/active branch behavior into the new controller hook
- added focused coverage in `tests/thread-tool-event-outcomes.test.mjs`

#### Architectural improvements landed
- Track C now has a branch-level thread/tool event seam in addition to the earlier runtime-state and routing seams
- `src/app.tsx` is closer to being a shell-level event receiver/dispatcher instead of the full home for thread/tool branch behavior
- the extracted controller makes it easier to reason about cached vs active follow-through without re-reading the entire app root

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
The strongest next move is probably no longer another blind Track C extraction. The remaining density is now closer to raw gateway payload normalization, so the next clean seam is likely the first Track D cut: move chat/agent payload shaping toward an explicit domain-event boundary.

---

## Ticket D.1 — Introduce the first thread/tool domain-event boundary
### Goal
Move raw chat/agent payload shaping out of `src/app.tsx` and into a shared domain seam the shell and controller can consume cleanly.

### Scope
- centralize thread/tool chat-event normalization in a shared library module
- centralize thread/tool agent-event normalization in that same module
- move tool update extraction, assistant reply coercion, and lifecycle error attachment helpers out of `src/app.tsx`
- rewire `src/app.tsx` and `useThreadToolEventController` to consume normalized thread/tool domain events instead of a bag of parser callbacks
- add focused helper-level coverage for the new domain-event seam

### Deliverable
A dedicated thread/tool domain-event module that owns raw gateway payload shaping, plus slimmer app/controller wiring that delegates through it.

### Done when
- `src/lib/thread-tool-domain-events.ts` is the authoritative home for raw thread/tool payload shaping
- `src/app.tsx` mainly normalizes chat/agent payloads and delegates them to the existing thread/tool controller boundary
- `useThreadToolEventController` no longer depends on parser callbacks for tool extraction, assistant reply merging, or lifecycle parsing
- helper-level regression coverage exists for the new domain-event seam

### Status update
This slice is now complete.

#### What landed
- `src/lib/thread-tool-domain-events.ts` now serves as the authoritative thread/tool payload-shaping seam for:
  - chat-event normalization
  - agent-event normalization
  - tool update extraction from gateway messages and agent payloads
  - assistant reply/media coercion
  - lifecycle error attachment follow-through
- `src/app.tsx` now imports that seam instead of owning a parallel copy of the parsing helpers inline
- `src/hooks/useThreadToolEventController.ts` now consumes normalized agent events and shared extraction helpers directly instead of receiving a wide parser callback surface from the app root
- focused regression coverage now lives in `tests/thread-tool-domain-events.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues immediately, the next clean move is probably to widen the same normalization approach beyond the thread/tool path, especially around other gateway event families that still arrive at the shell as raw payloads.

---

## Ticket D.2 — Normalize approval and device-pairing gateway events
### Goal
Move approval and device-pairing gateway event shaping behind a shared shell-level domain seam so `src/app.tsx` does not keep parsing those payload families inline.

### Scope
- normalize approval request and resolution events into discriminated shell-domain events
- normalize device pairing request and resolution events into that same shell-domain layer
- rewire `src/app.tsx` to switch on normalized shell events instead of raw event names/payloads for approval/device flows
- update `useDevicePairingController` to consume normalized device-pairing events instead of raw event names
- add focused helper-level coverage for the new shell gateway-event seam

### Deliverable
A small shell gateway-event normalization module that owns approval/device-pair payload shaping, plus slimmer app/controller wiring that consumes those normalized events.

### Done when
- `src/lib/shell-gateway-events.ts` is the authoritative home for approval/device-pair event shaping
- `src/app.tsx` no longer calls approval extractors directly from the raw gateway event handler
- `useDevicePairingController` no longer parses raw `device.pair.*` event names or payloads itself
- helper-level regression coverage exists for approval/device-pair gateway event normalization

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-events.ts` as the shared shell-domain event seam for:
  - approval request events
  - approval resolution events
  - device pairing requested/resolved events
- rewired `src/app.tsx` so the raw gateway event handler now switches on normalized shell event kinds for approval/device flows instead of parsing those payloads inline
- updated `src/hooks/useDevicePairingController.ts` to consume normalized device-pairing events rather than raw event names/payloads
- added focused helper coverage in `tests/shell-gateway-events.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to widen the same normalization approach to the remaining shell-facing gateway families such as connection/recovery and status/background payload shaping, instead of starting another app-root extraction blind.

---

## Ticket D.3 — Normalize gateway hello/close and status payload shaping
### Goal
Move the remaining shell-facing gateway hello/close/status payload shaping behind a shared domain seam so `src/app.tsx` does not keep normalizing those raw families inline.

### Scope
- normalize gateway hello payloads into a shared shell-state shape for:
  - advertised methods
  - server version/commit
  - payload budget
- normalize gateway close payloads into a shared connection-state shape for:
  - pairing-required closes
  - reconnecting closes
  - disconnected/error closes
- centralize status payload unwrapping for shell-facing consumers such as the status card and background visibility extraction
- rewire `src/app.tsx` and `src/lib/status-background-visibility.ts` to consume those shared shell-state helpers
- add focused helper-level coverage for hello/close/status normalization

### Deliverable
A shared shell gateway-state module that owns hello/close/status payload shaping, plus slimmer app/status wiring that consumes it.

### Done when
- `src/lib/shell-gateway-state.ts` is the authoritative home for hello/close/status payload shaping
- `src/app.tsx` no longer parses hello methods/maxPayload/version/commit inline
- `src/app.tsx` no longer derives pairing/reconnecting/disconnected close-state copy inline from raw close payloads
- the status card and background visibility helpers reuse the shared status snapshot extraction seam
- helper-level regression coverage exists for the new shell gateway-state boundary

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-state.ts` as the shared shell-state seam for:
  - gateway hello normalization
  - gateway close normalization
  - gateway status snapshot extraction
- rewired `src/app.tsx` to consume normalized hello and close state instead of parsing those payloads inline
- updated `src/lib/status-background-visibility.ts` to reuse the shared status snapshot extraction seam
- added focused helper coverage in `tests/shell-gateway-state.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to normalize the remaining shell-facing gateway response families that still surface as ad hoc payload parsing, rather than introducing another app-root extraction first.

---

## Ticket D.4 — Normalize shell-facing catalog and session response payloads
### Goal
Move the remaining shell-facing catalog/list response shaping out of `src/app.tsx` so the shell no longer trusts optimistic casts for agents, models, sessions, and session preview payloads.

### Scope
- normalize `agents.list` payloads into a shared shell-response seam
- normalize `models.list` payloads into that same seam
- normalize `sessions.list` payloads there, including session defaults and row coercion
- normalize `sessions.preview` payloads there, including preview item filtering
- rewire the app’s catalog/session loaders to consume those normalized response helpers
- add focused helper-level coverage for the new response-family seam

### Deliverable
A shared shell gateway-response module that owns shell-facing catalog/session response normalization, plus slimmer app loaders that consume it.

### Done when
- `src/lib/shell-gateway-responses.ts` is the authoritative home for shell-facing catalog/session response shaping
- `src/app.tsx` no longer uses direct optimistic casts for `agents.list`, `models.list`, `sessions.list`, or `sessions.preview`
- session preview and session list filtering rules are locked into helper-level tests
- helper-level regression coverage exists for the new shell response seam

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-responses.ts` as the shared shell-response seam for:
  - `agents.list`
  - `models.list`
  - `sessions.list`
  - `sessions.preview`
- rewired `src/app.tsx` to consume those normalized helpers instead of trusting raw cast payloads in the shell loaders
- added focused helper coverage in `tests/shell-gateway-responses.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to normalize the remaining shell-facing response families such as history/config-derived response shaping before introducing another app-root extraction.

---

## Ticket D.5 — Normalize shell-facing config-derived response shaping
### Goal
Move the remaining `config.get`-driven shell parsing out of `src/app.tsx` so model filtering, runtime path hints, queue mode, provider auth labels, and primary-session overrides all come from one shared config seam.

### Scope
- normalize the shell-facing `config.get` payload into a shared Track D config module
- move configured-model key extraction there
- move runtime path hint extraction there
- move provider auth label resolution there
- move queue-mode resolution there
- move heartbeat-session override / primary-session resolution there
- rewire model loading, session ordering, and status-card rendering to consume the normalized config seam
- add focused helper-level coverage for the new config module

### Deliverable
A shared shell gateway-config module that owns shell-facing config-derived response shaping, plus slimmer app-side consumers.

### Done when
- `src/lib/shell-gateway-config.ts` is the authoritative home for shell-facing `config.get` parsing
- `src/app.tsx` no longer keeps its own parallel config-root scanners for model filtering, runtime path hints, provider auth labels, queue mode, or primary-session overrides
- helper-level regression coverage exists for the new config seam

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-config.ts` as the shared shell config seam for:
  - configured model keys
  - runtime path hints
  - provider auth labels
  - queue mode
  - heartbeat-session overrides / primary-session resolution
- rewired `src/app.tsx` to consume normalized config state in model loading, session ordering, and `/status`
- added focused helper coverage in `tests/shell-gateway-config.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to normalize the remaining shell-facing history response shaping before introducing another app-root extraction.

---

## Ticket D.6 — Normalize shell-facing history response shaping
### Goal
Move the shell-facing `chat.history` payload shaping out of `src/app.tsx` so history timestamp inference, tool-update extraction, and attachment/message dedupe all come from one shared response seam.

### Scope
- normalize `chat.history` payloads into a shared Track D history module
- move history timestamp inference there
- move history tool-update extraction there
- move history tool-attachment/message dedupe there
- rewire `loadHistory(...)` to consume that normalized history seam while leaving active-stream/cache policy in the app
- add focused helper-level coverage for the new history module

### Deliverable
A shared shell gateway-history module that owns shell-facing history response shaping, plus a slimmer `loadHistory(...)` path in `src/app.tsx`.

### Done when
- `src/lib/shell-gateway-history.ts` is the authoritative home for shell-facing `chat.history` payload shaping
- `src/app.tsx` no longer parses raw history rows inline to infer timestamps, extract tool updates, or dedupe attachment messages
- helper-level regression coverage exists for the new history seam

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-history.ts` as the shared shell history seam for:
  - history message timestamp inference
  - tool-update extraction from history payloads
  - attachment/message dedupe across history rows
- rewired `src/app.tsx` to consume the normalized history helper in `loadHistory(...)`
- added focused helper coverage in `tests/shell-gateway-history.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to normalize any remaining shell-facing response families that still rely on ad hoc payload shaping before introducing another app-root extraction.

---

## Ticket D.7 — Normalize shell-facing mutation response acknowledgements
### Goal
Move the remaining shell-facing command/mutation response shaping out of `src/app.tsx` so send/reset acknowledgement parsing no longer relies on inline optimistic casts.

### Scope
- normalize `chat.send` acknowledgement payloads into a shared Track D mutation module
- normalize `sessions.reset` acknowledgement payloads there too
- rewire the send, `/compact`, and `/reset` paths to consume the normalized mutation helpers
- add focused helper-level coverage for the new mutation seam

### Deliverable
A shared shell gateway-mutation module that owns shell-facing acknowledgement parsing, plus slimmer send/reset consumers in `src/app.tsx`.

### Done when
- `src/lib/shell-gateway-mutations.ts` is the authoritative home for shell-facing `chat.send` and `sessions.reset` acknowledgement parsing
- `src/app.tsx` no longer uses direct optimistic casts for those mutation responses
- helper-level regression coverage exists for the new mutation seam

### Status update
This slice is now complete.

#### What landed
- added `src/lib/shell-gateway-mutations.ts` as the shared shell mutation seam for:
  - `chat.send`
  - `sessions.reset`
- rewired `src/app.tsx` to consume those normalized acknowledgement helpers in send, `/compact`, and `/reset`
- added focused helper coverage in `tests/shell-gateway-mutations.test.mjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track D continues from here, the next clean move is probably to pause and reassess whether there are any remaining shell-facing response families with enough density to justify another normalization seam before starting a new track.

---

## Ticket P1-X2 — Add implementation notes to `ARCHITECTURE.md` if boundaries change materially
### Goal
Keep the architecture doc honest as refactors land.

### Scope
- note any major boundary changes made during Phase 1
- update recommendations if implementation reveals better structure

### Deliverable
Updated architecture notes where necessary.

### Done when
- the docs are not lying about the current structure after key Phase 1 work lands

---

## Ticket P1-X3 — Define a lightweight regression checklist for Phase 1 flows
### Goal
Avoid breaking core shell behavior while refactoring.

### Suggested checklist areas
- connect/disconnect/reconnect
- session switch
- send message
- stream message
- slash command entry
- scroll behavior
- empty thread state
- switching sessions during or after streaming

### Deliverable
A small checklist the project can use during Phase 1 iteration.

### Done when
- there is at least a manual verification checklist for the key shell flows

### Status update
This ticket is now complete.

#### What landed
- added `docs/PHASE-1-REGRESSION-CHECKLIST.md` as the lightweight manual verification checklist for:
  - connection and reconnect behavior
  - session switching
  - send and streaming flows
  - slash command entry
  - thread and scroll behavior
  - media and tool visibility
  - desktop shell behavior

#### Validation status
- docs-only slice

#### Recommended next step
Use the checklist during ongoing Phase 1 refactors, especially when a slice touches `src/app.tsx`, thread/session controllers, or Electron shell behavior.

---

# Suggested implementation order

If executing Phase 1 immediately, the recommended order is:

## Step 1
- Ticket 1.1.1
- Ticket 1.1.4
- Ticket 1.2.1

## Step 2
- Ticket P1-X1
- Ticket 1.1.2
- Ticket 1.1.5

## Step 3
- Ticket 1.2.2
- Ticket 1.2.3
- Ticket 1.2.4

## Step 4
- Ticket 1.3.1
- Ticket 1.3.2
- Ticket 1.3.3

## Step 5
- Ticket 1.2.5
- Ticket 1.2.6
- Ticket 1.3.4
- Ticket P1-X4

## Step 6
- Ticket P1-X2
- Ticket P1-X3

This keeps discovery first, then state boundaries, then component extraction, then behavior hardening.

---

## Ticket P1-X4 — Harden reconnect and active-session shell policy
### Goal
Make reconnect/disconnect/session-switch behavior feel intentionally governed rather than incidentally correct.

### Scope
- reconnect and disconnected shell behavior
- how the selected session behaves while transport is reconnecting
- activity/working-state semantics during reconnect and aborted streams
- user-visible shell guidance during unstable connection periods

### Tasks
- audit current reconnect/disconnect behavior against the new thread/composer/session boundaries
- identify where shell policy is still implicit or branchy
- define a small explicit rule set for reconnect + active-session behavior
- implement the smallest coherent hardening pass without reopening the entire event architecture

### Deliverable
A more intentional shell reliability policy around reconnect and active-session behavior.

### Done when
- reconnect/disconnect behavior is easier to reason about than it is now
- active session behavior during reconnects/interruptions feels less fragile
- `make typecheck` and `make build` pass for the hardening pass

### Implementation notes (2026-04-08)

This ticket has now been completed as a focused shell-reliability hardening pass.

#### Why this ticket was added
The earlier Slice 1.1 tickets around connection/session shell behavior had already been partially absorbed by the subsequent thread/composer refactor work.
Rather than pretending the old ticket numbers still mapped cleanly to the remaining risk, this follow-up ticket was added to target the highest remaining Phase 1 reliability concern directly: reconnect and active-session shell behavior.

#### What changed
##### 1. Disconnect/close behavior is now more explicit
When the gateway connection closes, the shell now:
- clears active streaming state
- clears active run/thinking state for the current session
- marks the selected session as no longer working

Importantly, this cleanup now happens synchronously enough to prevent subsequent logic from reading stale run/thinking refs.

##### 2. Active streaming cleanup now clears refs, not just React state
`clearActiveStreamingState()` now:
- clears pending streamed-text buffers
- cancels any pending stream flush RAF
- clears `streamTextRef.current`
- clears `chatRunRef.current`
- clears `thinkingRef.current`
- updates the corresponding React state

This prevents reconnect/history-load logic from accidentally treating the session as still actively streaming during the gap between state updates and ref-sync effects.

##### 3. Reconnect success now actively resyncs the selected session
On reconnect (`onHello`), if there is a selected session, the app now proactively reloads its history instead of only refreshing the session list.

That makes reconnect behavior less passive and reduces the chance of the thread surface continuing to show stale in-memory state after transport recovery.

##### 4. Reconnect history reload is now sequenced and deduped more carefully
The reconnect reload path now:
- refreshes sessions first
- re-resolves the active selected session key after session reconciliation
- skips history load if the resolved session already has an in-flight history request
- only then reloads history for the selected session

This avoids firing `chat.history` against a stale selected key during reconnect and reduces redundant parallel history loads.

#### Why this matters
Before this ticket, the shell could end up in awkward states like:
- transport disconnected, but the active session still looked like it had a live run
- reconnect succeeded, but the selected thread still relied on stale in-memory state until some later event happened to refresh it
- cleanup logic updated React state but left refs stale long enough for history reload logic to mis-detect active streaming

This ticket made those rules more explicit and less fragile without reopening the entire event architecture.

#### What this ticket intentionally does *not* solve yet
- it does not fully redesign reconnect semantics for every possible backend/runtime edge case
- it does not guarantee perfect recovery semantics across every interrupted tool run
- it does not eliminate the need for future shell/runtime policy refinement in later milestones

That is fine.
For Phase 1, the goal was to make reconnect and active-session behavior materially more intentional and less obviously brittle.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Reassess whether Phase 1 still has any remaining high-leverage work. At this point, the likely best move is to either:
- declare Phase 1 complete,
- or identify one final sharply-scoped Phase 1 ticket only if it clearly improves the core shell reliability/product direction.

---

## Ticket E.1 — Extract Electron window creation from main-process bootstrap
### Goal
Start Track E with the safest concrete cut: move BrowserWindow construction and window-specific resilience behavior out of `electron/main.cjs` so the main process starts acting more like bootstrap and coordination code.

### Scope
- extract BrowserWindow creation into `electron/window/create-window.cjs`
- move blank-screen recovery, external-link handling, and window close/closed behavior into that seam
- keep protocol registration, IPC handlers, and runtime configuration in `electron/main.cjs`
- preserve current desktop behavior

### Deliverable
A shared Electron window-creation seam that owns the main window lifecycle details while `electron/main.cjs` delegates to it.

### Done when
- `electron/window/create-window.cjs` exists and owns the BrowserWindow construction flow
- `electron/main.cjs` no longer inlines the main window creation and blank-screen recovery stack
- the desktop app behavior is preserved

### Status update
This slice is now complete.

#### What landed
- added `electron/window/create-window.cjs` as the first Track E seam
- rewired `electron/main.cjs` to delegate BrowserWindow creation and window lifecycle wiring there
- kept protocol registration, IPC handlers, and app bootstrap in `electron/main.cjs`

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track E continues from here, the next safest move is probably to extract one of the remaining main-process concern families, most likely protocol registration/handlers or IPC runtime-config wiring.

---

# Phase 2 working tickets

## Ticket 2.1 — Drag and drop attachments
### Goal
Make attachment ingestion feel like a first-class desktop-native workflow instead of incidental file handling.

### Scope
- drag/drop attachment ingestion
- visual drop affordance
- paste/upload/drop consistency
- first-pass attachment ingestion boundary extraction

### Tasks
- extract attachment ingestion logic out of inline composer rendering
- introduce explicit drag-active/drop-affordance UI
- handle common ingestion edge cases (same-file reselect, file-only drag state, async failures)
- validate that attachment staging still behaves correctly after the refactor

### Deliverable
A more intentional drag/drop attachment workflow.

### Done when
- drag/drop visibly behaves like a supported workflow
- attachment ingestion is no longer raw file wrangling inline in `Composer`
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-08)

This ticket has now been completed as the first user-facing Phase 2 slice.

#### New module added
- `src/hooks/useAttachmentIngestion.ts`

#### What moved out of `Composer`
Attachment ingestion behavior is no longer hand-written inline in the composer render body for:
- drag/drop file ingestion
- paste-image ingestion
- file-input upload ingestion
- staged attachment removal

That behavior now lives behind a dedicated `useAttachmentIngestion(...)` hook.

#### User-facing improvement added
The composer now exposes an explicit drag-active/drop-affordance state:
- the compose surface reacts visually when files are dragged over it
- a visible drop overlay explains that files will be staged in the composer

This turns drag/drop from a hidden capability into an intentional workflow.

#### Review follow-up applied before closure
This ticket also incorporated PR review follow-up before closure:
- async ingestion errors are now caught instead of risking unhandled promise rejections
- ingestion now appends against the latest attachment state rather than a stale render-time array capture
- drag-active UI is gated to actual file drags only
- file input is cleared after use so selecting the same file twice still triggers ingestion
- composer now surfaces attachment-ingestion errors to the user via warning UI instead of silently failing

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Continue Phase 2 by formalizing staged attachment lifecycle/state ownership before moving on to richer attachment preview/rendering work.

## Ticket 2.1.X — Formalize staged attachment lifecycle/state ownership
### Goal
Make staged attachments a clearer UI/domain surface instead of a raw array passed around by convention.

### Scope
- staged attachment state ownership
- attachment operations (append/remove/clear/replace)
- reducing raw attachment-array surgery in UI boundaries
- aligning ingestion logic to the staged attachment lifecycle boundary

### Tasks
- introduce a staged attachment state hook/domain surface
- route attachment ingestion through explicit staged attachment operations
- remove raw setter leakage that bypasses the intended lifecycle boundary
- tighten the attachment interface between app/chat/composer

### Deliverable
A clearer staged attachment lifecycle boundary.

### Done when
- staged attachments have a named lifecycle surface
- UI boundaries rely less on raw array replacement semantics
- `make typecheck` and `make build` pass for the cleanup

### Implementation notes (2026-04-09)

This follow-up has now been completed as the second attachment-focused Phase 2 cleanup pass.

#### New modules/types added
- `src/hooks/useStagedAttachments.ts`
- `src/lib/staged-attachments.ts`

#### What changed
Attachment state is no longer treated only as a plain array with ad hoc replacement callbacks.
Instead, the app now has a small explicit staged-attachment lifecycle surface with named operations:
- `replaceAttachments(...)`
- `appendAttachments(...)`
- `removeAttachment(...)`
- `clearAttachments()`

#### App-level ownership improvement
`app.tsx` now owns staged attachments through `useStagedAttachments()` rather than directly exposing a raw attachment-state setter as the primary interface.
Key lifecycle sites (restore, rollback, clear-on-send/new-session flows) now use named operations instead of generic array mutation semantics.

#### Boundary improvement between app/chat/composer
The `ChatView` / `Composer` boundary now passes a grouped staged-attachments interface instead of raw:
- `attachments`
- `onAttachmentsChange(next)`

This makes the attachment boundary more explicit and prepares the app for richer preview/rendering work.

#### Ingestion alignment
`useAttachmentIngestion()` now works against the staged-attachment lifecycle operations rather than reintroducing its own raw array ownership assumptions.
It also now uses the shared staged-attachment type surface instead of redefining a parallel local ops type.

#### Review follow-up applied before closure
This follow-up also incorporated PR review follow-up before closure:
- removed raw `setAttachments` from the public staged-attachment hook surface
- switched rollback/replacement paths to `replaceAttachments(...)`
- typed ingestion operations against the shared staged-attachment contract
- tightened ingestion hook dependencies to specific operation references instead of depending on the entire ops object

#### Validation status
This follow-up is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to `2.3` — attachment preview and rendering pipeline — now that ingestion and staged attachment ownership are both materially cleaner.

## Ticket 2.3 — Attachment preview and rendering pipeline
### Goal
Make attachments a first-class rendering concern instead of scattered inline logic in composer and message surfaces.

### Scope
- staged attachment preview rendering
- message-side attachment list rendering
- file/image attachment render boundary extraction
- shared image-source utility normalization where needed

### Tasks
- extract staged preview rendering from the composer body
- extract message-side attachment rendering boundaries from `MessageRow`
- separate file/image attachment render concerns where practical
- remove circular/shared-helper coupling by introducing a dedicated image-source utility module

### Deliverable
A clearer attachment preview/rendering pipeline.

### Done when
- composer and message attachment previews are no longer mostly inline render blocks
- shared image-source logic has a real utility home instead of component-level coupling
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket has now been completed as the first dedicated attachment preview/rendering slice.

#### New components/modules added
- `src/components/StagedAttachmentTray.tsx`
- `src/components/MessageAttachmentList.tsx`
- `src/components/MessageFileAttachment.tsx`
- `src/components/MessageImageAttachment.tsx`
- `src/lib/message-image-source.ts`

#### What changed
##### Composer / staged side
The staged attachment preview block was extracted from `Composer.tsx` into `StagedAttachmentTray`, making staged attachments a first-class render surface instead of inline composer clutter.

##### Message / thread side
Message attachment rendering was split into explicit boundaries:
- `MessageAttachmentList`
- `MessageFileAttachment`
- `MessageImageAttachment`

This removed a meaningful amount of attachment-specific rendering logic from `MessageRow.tsx`.

##### Shared image-source utility layer
Image/path/source normalization helpers were moved into `src/lib/message-image-source.ts`.
This broke the accidental circular dependency between `MessageRow` and `MessageImageAttachment` and gave the attachment rendering path a cleaner utility layer.

#### Why this matters
Before this ticket:
- staged attachment preview rendering lived inline in `Composer`
- message-side file/image rendering lived inline or semi-inline in `MessageRow`
- shared image-source helper logic was coupled badly enough to create a circular module dependency

After this ticket, attachment preview/rendering is much closer to a deliberate pipeline than a collection of scattered inline conditions.

#### What this ticket intentionally does *not* solve yet
- it does not fully unify staged-preview and message-rendering visuals into a single design system
- it does not yet add richer file metadata or media-specific polish
- it does not yet define the clipboard workflow as a first-class product behavior

That is acceptable.
This slice was about establishing explicit rendering boundaries first.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Later follow-up (2026-04-11)
The generated-image follow-through after this ticket materially expanded the media/rendering side of the attachment boundary without changing the fact that this ticket itself is complete.

##### Generated-image rendering stabilization landed
- local/shared-volume generated image paths now resolve more intentionally, including configurable path-prefix mappings for container-to-host setups
- generated image attachments preserve the original backend/source path more reliably instead of collapsing too early to pretty filenames
- live image attachments and post-reload history now go through more consistent source normalization

##### Live render + recovery behavior was tightened
- assistant image attachments are now reconciled by `runId` instead of behaving like unrelated duplicate rows
- delayed history hydration remains available when a live final event is text-only or otherwise incomplete
- generated images now render in chat without requiring a manual reload in the common local and shared-volume-container cases

##### Validation coverage is now much stronger
Focused regression coverage now exists for:
- path-prefix mappings
- image source resolution
- media path normalization
- final assistant commit/hydration decisions
- live active-final delayed-hydration behavior
- delayed-attachment scroll anchoring

The media-focused validation pass for this work is now:
- `make test-unit`
- `make typecheck`
- `make build`

##### Known remaining boundary
Truly remote setups without shared media still ultimately want a gateway-served media/artifact read path.
The current path-mapping approach is aimed at host-local and shared-volume container workflows.

#### Recommended next step
Proceed to `2.2` — paste image / clipboard workflow — for the next product-facing attachment slice.
Queue `2.3.1` as the portability follow-up for truly remote OpenClaw installs.

## Ticket 2.3.1 — Add gateway-served remote media/artifact resolution
### Goal
Make generated images and other media outputs render correctly when OpenClaw is running remotely and its filesystem is not shared with the local desktop.

### Scope
- gateway-served media/artifact reads for generated images and media attachments
- frontend fallback from local path mapping / local file reads to gateway-served resolution
- preserving existing host-local and shared-volume container behavior

### Tasks
- audit the current remote image resolution seams in `src/app.tsx`, `src/lib/message-image-source.ts`, and `electron/main.cjs`
- define the preferred remote media contract for ClawFace to consume:
  - structured `media.read` / artifact-read style response, or
  - a stable gateway-served media endpoint
- route image attachment resolution through that contract when local path resolution is unavailable or fails
- ensure generated-image attachments preserve enough source identity to resolve via gateway-served reads
- keep path-prefix mappings as a compatibility layer for shared-volume installs rather than the only media strategy
- add focused validation coverage for the remote-resolution decision path

### Deliverable
A portable media-resolution path that works for truly remote OpenClaw installs instead of assuming local/shared filesystem access.

### Done when
- generated images render for remote OpenClaw installs without shared local volumes
- ClawFace does not depend on backend filesystem path mapping as the only viable media-rendering strategy
- local host and shared-volume container installs continue to work
- `make test-unit`, `make typecheck`, and `make build` pass for the slice

### Implementation notes
In progress.

ClawFace now has a dedicated remote-media resolution layer that:
- preserves remote source identity instead of requiring every image source to parse as a local desktop path first
- broadens the consumable RPC contract to path-like and artifact-like read shapes
- broadens the consumable HTTP contract beyond the legacy `__claw/local-image` path
- adds focused regression coverage for remote method selection, payload extraction, reference preservation, and gateway endpoint candidate building

That means the frontend is now ready to consume:
- a future OpenClaw `media.read` / `artifact.read` style gateway method, or
- a future gateway-served media/artifact HTTP endpoint returning image bytes, base64/data URLs, or redirect-style image URLs

What is still missing for full completion is the authoritative backend contract itself.
The OpenClaw source currently does not expose a first-class remote media/artifact read gateway method in the server-method set, so end-to-end remote image rendering without shared volumes still depends on backend follow-through.

#### Why this ticket exists
The recent generated-image fixes solved the common local and shared-volume-container cases, but they intentionally stopped short of defining a portable remote media contract.

That leaves one remaining deployment gap:
- OpenClaw on another machine
- generated media stored remotely
- no shared host filesystem path for ClawFace to open directly

#### Existing seams this should build on
The app already has useful partial hooks that this ticket should formalize rather than replace:
- `src/app.tsx` already tries remote-style media/file read methods such as `media.read`
- the desktop image path already attempts remote gateway reads before local file reads in `electron/main.cjs`
- `message-image-source.ts` already acts as the renderer-side normalization layer for attachment image sources

#### First-pass product preference
Prefer a gateway-served media/artifact contract over adding more hardcoded backend-path assumptions into the renderer.

Path-prefix mappings should remain:
- a strong compatibility layer for host-local and shared-volume container installs
- not the only story for community-facing portability

## Ticket 2.2 — Paste image / clipboard workflow
### Goal
Make clipboard image/file ingestion feel like an intentional desktop-native workflow instead of a side effect of generic attachment handling.

### Scope
- pasted image ingestion behavior
- composer behavior when clipboard contains image/file content
- coexistence of pasted media and text draft content
- user feedback for clipboard-driven attachment staging

### Tasks
- audit the current paste path in the attachment ingestion flow
- define explicit clipboard behavior rules
- add lightweight UX feedback where paste stages attachments
- keep typed text + pasted media behavior coherent

### Deliverable
A more intentional clipboard workflow for staged attachments.

### Done when
- clipboard image/file ingestion feels deliberate rather than accidental
- the composer gives clearer feedback when paste stages attachments
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket has now been completed as the first clipboard-focused Phase 2 slice.

#### What changed
Clipboard image ingestion is now treated as a more intentional workflow instead of being purely a side effect of the generic attachment path.

#### User-facing improvements landed
- the composer now shows explicit feedback when pasted image content is staged as attachments
- mixed clipboard handling is now more intentional:
  - if clipboard contains text plus image content, text paste is preserved in the draft
  - pasted image content is still staged as attachment(s)
- clipboard-driven staging now feels more deliberate instead of silently mutating composer state

#### Hook/runtime cleanup landed
This ticket also tightened clipboard workflow internals by:
- cleaning up paste feedback timers on unmount
- making mixed clipboard behavior explicit in the ingestion hook
- tightening Composer-side memoization around attachment operation wiring

#### Why this matters
Before this ticket, clipboard image handling mostly "worked," but behaved more like an incidental branch of generic attachment ingestion than a product-defined workflow.

After this ticket, the app does a better job of telling the user what happened and avoids the most obvious mixed-clipboard failure mode where image staging could clobber normal text paste behavior.

#### What this ticket intentionally does *not* solve yet
- it does not model every possible clipboard payload combination
- it does not yet provide a richer dedicated clipboard affordance beyond inline composer feedback
- it does not yet add attachment-type-specific clipboard previews beyond staged attachment rendering

That is fine for this slice.
The goal was to make clipboard attachment staging intentional in the common cases.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Recommended next step
Proceed to the next Phase 2 product-facing slice: make tool activity and media outputs feel more first-class in the thread.

## Ticket 2.4 — Make tool activity and media outputs more first-class in the thread
### Goal
Make non-text runtime output feel like a core part of ClawFace rather than secondary clutter around chat bubbles.

### Scope
- tool activity rendering boundaries
- thread placement and readability of tool activity
- clearer UI ownership for non-message runtime output
- preparing for richer media/tool result surfaces later

### Tasks
- identify the current tool/media rendering cluster in `ChatView`
- extract a dedicated tool-activity render boundary
- preserve current behavior while reducing inline panel/render boilerplate
- create a cleaner seam for richer OpenClaw-native result surfaces later

### Deliverable
A cleaner first-class thread surface for tool activity/media-adjacent output.

### Done when
- tool activity rendering is less smeared through `ChatView`
- the thread surface is easier to evolve toward richer non-text outputs
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket has now been completed as the first tool-activity/thread-surface slice.

#### New component added
- `src/components/ToolActivityPanel.tsx`

#### What changed
The large inline tool panel renderer in `ChatView.tsx` was extracted into a dedicated `ToolActivityPanel` component.
That created a real thread-surface boundary for tool activity instead of leaving it as one more cluster of inline rendering logic inside the main chat view.

#### User-facing improvements landed
- tool activity now reads more like runtime activity and less like raw debug clutter
- tool entries use clearer running/completed/needs-attention phrasing
- collapsed entries now surface more readable summaries (`Output: ...`, `Args: ...`, `Issue: ...`)
- expanded entries include clearer metadata and more honest empty-state copy for args/output

#### Why this matters
Before this ticket, tool activity existed, but it still felt too much like an implementation detail bolted onto the thread.

After this ticket, tool activity has a clearer dedicated surface and does a better job answering the user’s practical question:
> what is OpenClaw doing, and what happened?

That is a meaningful product move toward ClawFace feeling OpenClaw-native rather than like a generic chat shell with some extra boxes.

#### What this ticket intentionally does *not* solve yet
- it does not yet introduce a normalized tool failure/result domain model
- it does not yet cover richer task/runtime surfaces outside the immediate thread
- it does not fully solve broader runtime/session visibility outside tool entries themselves

That is fine.
This slice was about making tool activity first-class in the thread first.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` passes on the active macOS development machine

#### Later follow-up (2026-04-11)
Subsequent generated-image cleanup refined how media outputs relate to this tool surface:
- temporary inline generated-image previewing inside `ToolActivityPanel` was removed once chat-side image attachments were working reliably
- generated images now read as message attachments first, while tool activity remains focused on runtime visibility and result context

That keeps this ticket aligned with its original goal:
tool activity should be first-class and legible, but it does not need to duplicate the primary media-rendering surface once chat attachments are trustworthy.

#### Recommended next step
Proceed to a runtime/session visibility slice so ClawFace continues evolving from a polished chat client into a more distinctly OpenClaw-native desktop frontend.

## Ticket 3.1.1 — Audit runtime/session visibility outside tool entries
### Goal
Identify the most important runtime and session-state signals that are currently invisible, under-explained, or too buried in the thread.

### Why
Ticket 2.4 made tool activity more first-class inside the thread, but ClawFace still lacks a clearer shell-level picture of what OpenClaw is actively doing across the current session.

If the app is going to feel like an OpenClaw-native workstation instead of just a chat shell, users need better visibility into runtime state such as:
- whether the current session is actively running
- whether work is queued, streaming, or waiting
- whether recent runtime activity belongs to the current session or another one
- whether important non-message activity is happening outside the immediate text thread

### Scope
- audit current runtime/session visibility in the shell
- identify existing signals already available in app state and events
- identify which signals belong in the thread vs shell vs sidebar
- identify the lowest-risk first UI slice for improving runtime/session visibility

### Tasks
- review current runtime-related state in `src/app.tsx` and adjacent components
- identify all current user-visible runtime/session status surfaces
- note hidden or weakly surfaced signals already present in gateway events/state
- identify candidate ownership boundaries for a future runtime/session visibility model
- record findings and recommend the first implementation slice

### Deliverable
A short audit and decomposition note for runtime/session visibility work.

### Done when
- we know which runtime/session signals matter most to users
- we know where those signals should live in the UI
- we know the best first implementation slice for the next ticket

### Implementation notes
Pending.

### Audit findings (2026-04-09)

#### Current runtime/session signals already present in app state
The app already tracks more runtime/session state than it currently communicates clearly.

Observed signals in `src/app.tsx` include:
- `sessionActivity[key] = { working, unread }`
- active-session `chatRunId`
- active-session `thinking`
- active-session `streamText`
- active-session `thinkingLevel`
- `sessionState.isCurrentSessionLoading`
- `sessionState.transitionState`
- per-session cached view state via `sessionCacheRef`

This means the product already knows important things such as:
- whether the current session is actively running
- whether another session is working in the background
- whether another session has unread changes
- whether the current session is loading or switching
- whether the current session is streaming vs only "thinking"

The main problem is no longer missing raw state. The problem is weak presentation and weak ownership boundaries for runtime visibility.

#### Current user-visible runtime/session surfaces

##### 1. Session sidebar activity dots
`SessionSidebar.tsx` currently surfaces only two coarse per-session background signals:
- `working`
- `unread`

Those signals affect:
- card styling
- sidebar dot styling

This is useful, but minimal.
The sidebar does not explain:
- what "working" means
- whether work is streaming, waiting on tools, or only marked busy
- whether unread changes are assistant output, tool output, or both

##### 2. Active thread runtime surface
Inside `ChatThread.tsx` and `ChatView.tsx`, the active session currently exposes runtime state mainly as:
- streamed assistant text
- a thinking indicator
- tool activity panels inside the thread
- loading/switching empty-state cards

This is a meaningful improvement over the old baseline, but it still keeps runtime visibility tightly bound to message rendering.

##### 3. Header connection status
`ChatView.tsx` has a shell-level status label for gateway connectivity:
- connected
- connecting
- pairing-required
- error
- disconnected

That is connection visibility, not runtime/session visibility.
It helps with transport state, but it does not tell the user what the current session is doing.

##### 4. Composer busy/offline messaging
The composer currently distinguishes:
- offline
- busy
- ready

This helps prevent invalid send behavior, but it is still a control-state message, not a broader runtime/session visibility model.

#### Gaps in the current UX

##### 1. No shell-level "current session runtime" summary
There is no clear shell-level summary for the active session such as:
- Running
- Streaming reply
- Waiting on tool activity
- Thinking
- Idle

Users can infer some of this from the thread, but they have to read the thread instead of being shown a coherent current-session state.

##### 2. Sidebar background activity is under-explained
The sidebar knows when sessions are `working` or `unread`, but those states are represented only as subtle visual styling.
There is no stronger explanation or grouping for:
- background sessions currently active
- sessions with fresh results
- sessions that need attention

##### 3. Runtime activity is still thread-first instead of session-first
Tool panels improved thread readability, but broader runtime visibility is still anchored to individual tool entries and stream bubbles.
ClawFace still lacks a more session-oriented answer to:
> what is my assistant doing right now, and where?

##### 4. The app lacks a normalized runtime/session visibility model
Relevant state is split across:
- `sessionActivity`
- active thread state (`thinking`, `streamText`, `chatRunId`)
- session loading/transition state
- thread-local tool rendering

That is enough to implement UI, but not yet a good enough boundary for runtime/session visibility as a product feature.

#### Recommended first implementation slice
The lowest-risk, highest-leverage next slice is:

### Ticket 3.1.2 — Introduce a shell-level current-session runtime status surface

Suggested first-pass scope:
- define a small derived runtime/session status model for the active session
- surface it near the chat header/session info strip
- distinguish at least:
  - idle
  - loading session
  - switching session
  - thinking
  - streaming
  - tool-active / working
- keep detailed tool output in the thread, but make the current session's overall runtime state legible without reading the whole thread

#### Why this should come first
- it builds directly on state the app already has
- it avoids a risky full `toolStore` or global runtime-store rewrite as the first move
- it improves product clarity quickly
- it creates a cleaner seam for later work on background-session visibility in the sidebar

## Ticket 3.1.2 — Introduce a shell-level current-session runtime status surface
### Goal
Make the active session's runtime state legible from the shell without requiring the user to parse the thread first.

### Scope
- derive a small current-session runtime status model from existing app state
- surface current-session runtime state near the chat header/session info strip
- distinguish coarse states such as idle/loading/switching/thinking/streaming/working
- improve background-session visibility in the sidebar using existing `working` / `unread` signals

### Tasks
- define a first-pass current-session runtime status model
- surface that status in `ChatView` near the shell header
- improve the sidebar's background-session activity presentation so it is not only encoded as subtle color treatment
- preserve compatibility with existing connection/tool/thread logic

### Deliverable
A clearer shell-level runtime/session visibility layer for both the active session and background sessions.

### Done when
- the current session exposes an explicit runtime state in the shell
- background-session activity is more legible in the sidebar
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket has now been completed as the first runtime/session visibility slice after the tool-activity bridge work.

#### What changed
- `ChatView.tsx` now derives a small current-session runtime status model for the active session.
- The shell header now includes a dedicated runtime-status pill separate from gateway connection state.
- The runtime-status surface distinguishes first-pass session states including:
  - `Idle`
  - `Loading session`
  - `Switching session`
  - `Thinking`
  - `Streaming reply`
  - `Working`
- `SessionSidebar.tsx` now exposes clearer background-session activity labels instead of relying only on card tint and dot color.

#### User-facing improvements landed
- the header now answers a practical question the old UI did not answer clearly:
  > what is this session doing right now?
- the sidebar now makes background activity more explicit with readable badges such as:
  - `Current`
  - `New activity`
  - `Working`

#### Why this matters
This is the first slice where ClawFace starts exposing session runtime as a product concept instead of only exposing low-level thread symptoms.

That matters because an OpenClaw-native desktop frontend should help the user understand active work at a glance, not only after reading through streaming text and tool entries.

#### What this ticket intentionally does *not* solve yet
- it does not yet introduce a normalized `toolStore` or broader runtime-store boundary
- it does not yet distinguish richer tool-result classes beyond the current thread/tool presentation
- it does not yet fully solve tool failure/result clarity, especially for dense or noisy tool-heavy threads

That is fine.
This slice was about creating the first clear shell/session visibility layer before deepening tool-result semantics.

#### Validation status
This ticket is validated complete.

Validation outcome:
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
Proceed to **Slice 3.2 — Tool output and failure clarity**.

## Ticket 3.2.1 — Audit current tool result and failure presentation
### Goal
Identify where current tool results and failures are understandable, where they are still too raw, and which rendering improvements should land first.

### Why
ClawFace now exposes runtime/session activity more clearly, but tool-heavy threads can still be noisy or ambiguous once tools finish, fail, or produce partial output.

The next step is to improve the user's answer to:
> what happened, did it work, and what should I pay attention to?

### Scope
- current tool result rendering
- current failure/error rendering
- distinction between in-progress tool activity and final tool result
- identifying where raw payloads still leak into renderer-oriented presentation

### Tasks
- review `ToolActivityPanel` result/failure presentation
- inspect representative tool result states in `ChatView` / thread rendering
- identify where result summaries are clear vs noisy
- identify where failures are visible vs buried
- recommend the first implementation slice for tool result/failure clarity

### Deliverable
A short audit and decomposition note for Slice 3.2.

### Done when
- we know the highest-leverage clarity problems in current tool result rendering
- we know the first concrete implementation slice for tool output/failure clarity

### Implementation notes

### Audit findings (2026-04-09)

#### Current tool-result state already present in the app
The app already has a coherent first-pass notion of tool activity, but not yet a trustworthy notion of tool outcome.

Observed current modeling:
- `ToolItem` currently stores:
  - `id`
  - `name`
  - `status: "start" | "update" | "result"`
  - `args`
  - `output`
  - `startedAt`
  - `updatedAt`
- tool updates are merged over time via `mergeToolItems(...)`
- `normalizeToolStatus(...)` intentionally collapses many raw upstream states into the coarse buckets above

This means the UI can already answer:
- did a tool appear?
- is it still in-flight vs no longer in-flight?
- what raw args/output do we currently have?

But it still cannot answer reliably:
- did the tool succeed?
- did it fail?
- what is the most important result?
- is the visible failure about the tool, the run lifecycle, or both?

#### Current user-visible tool-result surfaces

##### 1. Thread-embedded tool panels
`ToolActivityPanel.tsx` renders tool activity grouped into the thread.

Current strengths:
- tool activity is visible inside the conversation instead of being hidden
- the user can expand a tool entry to inspect args/output
- the user can distinguish running vs non-running at a glance

##### 2. Collapsed summary lines
Collapsed tool cards currently show:
- a status dot
- a text label such as `Running`, `Completed`, or `Needs attention`
- a one-line summary derived from either:
  - output preview, or
  - args preview

This is directionally useful, but still fragile.

##### 3. Expanded raw payload view
Expanded tool cards expose:
- `Args`
- `Output`
- a small status chip
- start time

This is useful for debugging, but it is still renderer-facing exposure of mostly raw normalized payload rather than a product-oriented explanation of outcome.

#### What is currently working well enough

##### 1. Presence and chronology of tool activity
The current thread rendering does a decent job of showing that tool activity happened and roughly where it belongs in the conversation.

That is already much better than burying all tool work behind final assistant prose.

##### 2. Coarse running vs finished distinction
The current panel distinguishes:
- in-flight tool activity
- completed/finalized tool activity

That distinction is important and should be preserved.

##### 3. Expand-for-debug behavior
For local debugging and early product development, expandable raw args/output is still useful.
This should not be thrown away.

#### Highest-leverage clarity gaps

##### 1. Failure detection is currently heuristic, not modeled
This is the biggest issue.

`ToolActivityPanel.tsx` currently infers failure by regex-matching the rendered output text for words such as:
- `error`
- `failed`
- `exception`
- `denied`
- `not found`
- `timeout`

That creates both false positives and false negatives.

Examples of failure modes:
- a successful tool output that quotes an error string may look failed
- a failed tool result without those exact words may look completed
- a run-level error may appear as a separate system message while the tool card still looks successful or merely complete

This means the current `Needs attention` label is not yet dependable enough to be treated as strong product language.

##### 2. `result` currently conflates success and failure
At the data-model level, the app currently knows only:
- `start`
- `update`
- `result`

That means both of these collapse into the same terminal bucket:
- successful completion
- failed completion

The renderer is then forced to guess outcome from output text.

That is backwards.
Outcome should be modeled first, then rendered.

##### 3. Tool failures and run/lifecycle failures are not clearly joined
`app.tsx` can surface lifecycle errors via system messages like `Error: ...`, but that error state is not strongly attached to the relevant tool entry.

So the user may get:
- a tool card in one place
- an error message in another place
- no clear explanation of whether the tool itself failed, the assistant run failed after the tool, or the run was interrupted for another reason

##### 4. Summary text is too raw and not reliably outcome-oriented
Collapsed tool summaries currently prefer the first available preview from raw output or args.

That means the user often gets:
- noisy JSON-ish previews
- partial raw output with weak semantic value
- no stable distinction between:
  - what the tool was doing
  - what it produced
  - whether it succeeded
  - what matters now

##### 5. `update` is visually treated as generic running state
This is acceptable for now, but worth noting.

The current UI effectively treats:
- `start`
- `update`

as one broad `Running` bucket.

That is fine for an early slice, but it means the UI still does not distinguish:
- starting
- actively producing partial output
- waiting on completion

That is a secondary concern, not the first thing to fix.

#### Ownership boundaries suggested by the audit

The next slice should not jump straight to a giant store rewrite.

The first improvement should happen at the seam between:
- normalization in `app.tsx`
- rendering in `ToolActivityPanel.tsx`

Recommended ownership direction:
- `app.tsx` / normalization layer should produce a more trustworthy normalized tool outcome
- renderer components should consume that normalized outcome instead of inferring failure from display text

This follows the same principle that helped in 3.1.x:
move product meaning closer to state ownership, not into ad hoc renderer heuristics.

#### Recommended first implementation slice

### Recommended slice: explicit tool outcome and clearer result/failure summaries

##### Goal
Make tool results and failures legible without requiring the user to parse raw output blobs or infer failure from stray words.

##### Scope
- extend normalized tool state so terminal tool outcomes are more explicit
- stop relying primarily on output-text regexes for failure presentation
- improve collapsed tool summaries so they describe outcome more clearly
- keep expanded raw args/output for debugging, but make the default collapsed state more product-oriented

##### Recommended first-pass behavior
- distinguish at least:
  - `running`
  - `succeeded`
  - `failed`
- prefer explicit event/state/error metadata when available
- only fall back to output-text heuristics when upstream data truly gives no better signal
- render clearer collapsed labels such as:
  - `Running`
  - `Succeeded`
  - `Failed`
- surface concise failure copy in the collapsed state when available

##### Why this should come first
- it attacks the highest-risk confusion point directly
- it improves trust in the UI's language around tools
- it reduces renderer guesswork without demanding a full thread UX redesign
- it creates a better foundation for later Slice 3.3 polish work

##### What should wait until later
- deep tool-card visual redesign
- advanced grouping of multiple tool calls into higher-level task summaries
- fully separate treatment of progress updates vs partial results vs final results across all providers

Those may matter later, but the first job is to make success/failure meaning trustworthy.

## Ticket 3.2.2 — Introduce explicit tool outcome and clearer result/failure summaries
### Goal
Make tool results and failures legible from normalized state instead of renderer heuristics.

### Scope
- extend normalized tool state with explicit outcome semantics
- prefer structured error metadata over display-text guessing
- improve collapsed tool summaries so they communicate result vs failure more clearly
- preserve expanded raw args/output for debugging

### Deliverable
A more trustworthy first-pass tool-result model and clearer collapsed tool activity cards.

### Done when
- tool items distinguish `running`, `succeeded`, and `failed`
- renderer components consume normalized tool outcome instead of inferring failure from output text alone
- collapsed tool cards show clearer result/failure labels and summaries
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket is now complete.

#### What changed
- `ToolItem` now carries explicit `outcome` state:
  - `running`
  - `succeeded`
  - `failed`
- normalized tool updates now also preserve structured `errorMessage` data when available
- tool normalization in `app.tsx` now prefers explicit status/error metadata first
- output-text heuristics are retained only as a fallback when terminal tool output has no better structured success/failure signal
- `ToolActivityPanel.tsx` now renders collapsed tool cards from normalized outcome semantics rather than local regex guessing

#### User-facing improvements landed
- collapsed cards now use clearer labels:
  - `Running`
  - `Succeeded`
  - `Failed`
- failed tools now prefer structured error copy in the collapsed summary when available
- expanded failed tools now surface an explicit `Error` section when structured error metadata exists
- raw `Args` and `Output` remain available for debugging

#### Why this is the right first 3.2 slice
This lands the most important semantic improvement without prematurely redesigning the full tool thread UI.

The product now has a better answer to:
- did this tool work?
- if not, what failed?

That is a better base for future thread polish than adding more styling on top of ambiguous state.

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
Move deeper into Slice 3.2 by reviewing whether run-level lifecycle errors should be visually attached more directly to related tool entries, or whether the next highest-leverage move is general tool-heavy thread scanability work in Slice 3.3.

## Ticket 3.2.3 — Attach lifecycle errors more clearly to related tool activity
### Goal
Reduce ambiguity between tool-level failures and run/lifecycle failures by attaching structured lifecycle errors to the most relevant in-flight tool entry when possible.

### Scope
- carry enough normalized tool metadata to associate tool activity with a run
- attach run/lifecycle error messages to related in-flight tool items when the linkage is clear
- preserve existing system error messages for cases that are broader than a single tool failure

### Deliverable
Tool activity cards that more often surface the relevant failure directly, instead of forcing the user to correlate a separate system error message by hand.

### Done when
- tool items can retain run linkage during normalization
- relevant lifecycle errors mark the matching in-flight tool as failed when possible
- background-session failures remain visible in sidebar/session state
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket is now complete.

#### What changed
- normalized `ToolItem` state now retains optional `runId`
- tool extraction paths now preserve `runId` across live agent/chat tool updates when it is available from the event stream
- lifecycle/run errors now attempt to attach structured error text to the most recent matching in-flight tool for the same run
- active-session failures still surface as system messages, but the relevant tool entry now also becomes a failed tool when the association is clear
- non-active session failures now also mark sidebar/session activity unread when the failure is new background activity

#### Why this matters
Before this change, ClawFace could show:
- a running tool entry
- then a separate `Error: ...` system message

without clearly tying those two pieces together.

Now, when the run linkage is clear, the tool card itself becomes a better source of truth for what failed.

#### Implementation boundary
This deliberately links only to the most recent matching in-flight tool for the same run.

That keeps the behavior conservative:
- attach when the association is clear
- avoid aggressively rewriting old completed tool cards when the failure may belong elsewhere in the run

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
Proceed into **Slice 3.3 — Tool-aware thread UX polish**, starting with scanability in tool-heavy threads.

## Ticket 3.3.1 — Reduce repeated tool-panel chrome in tool-heavy threads
### Goal
Improve thread scanability by calming the presentation of common single-tool thread groups.

### Why
After 3.2.x, tool outcome semantics are clearer, but tool-heavy threads can still feel visually busier than they need to.

The most obvious clutter point is repeated single-tool groups rendering as:
- an outer tool panel shell
- a `Tool Activity (1)` style header
- an inner card

That creates unnecessary dashboard-like chrome for the most common case.

### Scope
- reduce repeated header chrome for single-tool groups
- make common single-tool groups feel more like inline work steps than nested dashboard cards
- preserve stronger framing for multi-tool groups

### Deliverable
A calmer first-pass presentation for tool-heavy threads, especially when many single-tool groups are interleaved with messages.

### Done when
- single-tool groups avoid redundant section chrome
- multi-tool groups still retain enough framing to stay understandable
- tool-heavy threads are easier to scan at a glance
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-09)

This ticket is now complete.

#### What changed
- single-tool thread groups now render in a compact mode
- compact single-tool groups no longer render the repeated `Tool Activity (1)` header chrome
- multi-tool groups still retain a dedicated panel header
- tool entries now carry clearer visual left-rail state by outcome (`running`, `succeeded`, `failed`)
- compact tool groups now read more like inline execution steps instead of stacked mini-dashboard cards

#### Why this matters
This is intentionally modest, but it improves the common case.

In real threads, many tool groups are singletons.
Flattening those groups reduces noise without hiding useful information.

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
Continue Slice 3.3 by reviewing whether consecutive tool groups and assistant follow-up text should be grouped more explicitly, or whether tool-entry density/spacing now needs a second pass after live usage.

## Ticket 3.3.2 — Group tool activity and immediate assistant follow-up more explicitly
### Goal
Make the handoff from tool activity to assistant follow-up feel like one coherent thread step instead of adjacent unrelated blocks.

### Why
Even after flattening single-tool chrome, tool-heavy threads can still read as:
- tool panel
- gap
- assistant reply

when the reply is clearly the direct follow-up to that tool activity.

That forces more visual parsing than necessary.

### Scope
- identify assistant replies that directly follow tool activity in the rendered thread
- add a lightweight visual grouping treatment between tool panels and immediate assistant follow-up
- preserve the existing transcript order and avoid a large thread data-model rewrite

### Deliverable
A clearer first-pass grouping treatment for tool activity and the assistant reply that immediately follows it.

### Done when
- assistant replies that immediately follow tool activity read as part of the same thread step
- the implementation stays lightweight and transcript-order preserving
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-10)

This ticket is now complete.

#### What changed
- `ChatThread.tsx` now marks tool-panel rows that are immediately followed by assistant output
- assistant message rows now receive a lightweight `tool follow-up` state when they directly follow tool activity
- streaming and thinking assistant states also participate in the same grouping treatment when they are the immediate continuation after tool work
- the thread keeps the same underlying ordering, but the rendered presentation now makes the handoff clearer

#### User-facing improvements landed
- tool activity followed by assistant output now reads more like one execution step
- the visual gap between tool work and assistant follow-up is reduced
- assistant follow-up bubbles now get a subtle grouped treatment instead of looking fully detached from the tool activity above

#### Why this is the right 3.3 follow-up
This improves scanability without introducing a risky transcript rewrite or trying to over-summarize tool/message boundaries.

It is a presentation-level grouping pass, which is exactly the right ambition for an early 3.3 slice.

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
If live usage still feels dense, the next 3.3 pass should focus on spacing and hierarchy inside multi-tool groups, not on broader state-model changes.

## Ticket 3.3.3 — Improve density and hierarchy inside multi-tool groups
### Goal
Make multi-tool groups easier to scan by surfacing group-level status and reducing unnecessary internal visual weight.

### Why
After the first 3.3 passes, the biggest remaining thread-density issue is usually inside multi-tool groups themselves.

The user should be able to answer quickly:
- is this group still running?
- did something in this group fail?
- do I need to open each row, or is the group broadly done?

### Scope
- add stronger group-level status summary for multi-tool panels
- reduce excess internal chrome/density inside multi-tool groups
- preserve chronology and per-tool detail without trying to over-summarize the entire group

### Deliverable
A calmer multi-tool presentation with clearer group-level hierarchy.

### Done when
- multi-tool groups expose a stronger group-level status summary
- multi-tool groups feel denser and easier to scan
- tool chronology remains intact
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-10)

This ticket is now complete.

#### What changed
- multi-tool panels now derive a group-level summary of:
  - running tools
  - failed tools
  - completed tools
- multi-tool headers now surface those counts as compact status pills
- multi-tool panels now also carry a stronger group-level tone (`running`, `failed`, or `succeeded`)
- multi-tool entries and panel spacing were tightened slightly to reduce internal dashboard-like weight

#### User-facing improvements landed
- the user can now scan a multi-tool panel header and quickly see whether the group is:
  - still active
  - contains failures
  - broadly done
- multi-tool groups now have better hierarchy without changing transcript order

#### Why this is the right next 3.3 slice
This improves the common “several tool calls in one step” case without adding risky grouping logic or hiding detail.

It is a hierarchy pass, not a behavioral rewrite.

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
If we keep going in 3.3, the next pass should come from real usage review, probably around whether collapsed summaries themselves are still too verbose in dense tool bursts.

## Ticket 3.3.4 — Quiet completed summaries during dense tool bursts
### Goal
Reduce visual overload in dense multi-tool groups by making already-completed rows less verbose when the group is large.

### Why
After the earlier 3.3 work, dense multi-tool bursts can still feel noisy because every collapsed row competes for equal attention.

In practice, the user usually needs the most emphasis on:
- running work
- failed work
- anything that still needs attention

Completed rows should remain visible, but they do not need the same summary weight in a dense burst.

### Scope
- identify dense multi-tool groups
- keep failures and running rows richly summarized
- make succeeded rows more compact in dense multi-tool groups
- preserve expand-for-debug behavior and chronology

### Deliverable
A calmer dense-burst presentation where the most actionable tool rows stand out first.

### Done when
- dense multi-tool groups feel less verbose
- succeeded rows become more compact without disappearing
- failed/running rows remain easy to scan
- `make typecheck` and `make build` pass for the slice

### Implementation notes (2026-04-10)

This ticket is now complete.

#### What changed
- multi-tool groups with higher row counts now enter a denser presentation mode
- in dense multi-tool groups, collapsed summaries remain visible for:
  - running rows
  - failed rows
- succeeded rows become more compact in dense groups, reducing repeated low-value summary text
- dense multi-tool groups also get slightly tighter row spacing and lighter succeeded-row emphasis

#### User-facing improvements landed
- dense tool bursts now direct attention more clearly toward what is still active or broken
- completed rows remain visible and expandable, but no longer dominate the scan path with repetitive summary copy

#### Why this is the right next 3.3 slice
This improves burst readability without changing chronology, hiding data, or introducing riskier grouping semantics.

It is a prioritization pass, not a state-model rewrite.

#### Validation status
- `make typecheck` passes
- `make build` should still be treated as authoritative on the active macOS development machine per `docs/DEVELOPMENT_CONSTRAINTS.md`

#### Recommended next step
At this point the next useful 3.3 work should come from hands-on usage review rather than guessing another polish slice in the abstract.

## Ticket 3.3.5 — Run a live usage review on the authoritative macOS environment
### Goal
Validate recent runtime/session/tool UX work from actual usage, then choose the next slice from observed problems instead of abstract speculation.

### Why
The recent 3.1.x, 3.2.x, and 3.3.x work materially improved semantics and presentation, but the next useful polish decision should now come from real usage.

Static code review is no longer enough to answer questions like:
- which remaining rough edge is actually most noticeable?
- where does the UI still feel noisy in practice?
- which surfaces are improved on paper but still weak in live interaction?

### Scope
- perform a live review on the authoritative macOS development machine
- exercise real session-switching, background-session, and tool-heavy flows
- capture concrete findings with screenshots or clips
- turn findings into the next explicit ticket rather than free-floating notes

### Deliverable
A concrete live-usage review packet and checklist for the authoritative environment.

### Done when
- the review scenarios are documented
- the authoritative environment constraints are explicit
- the next ticket can be chosen from actual usage findings

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added the missing `docs/LIVE-USAGE-REVIEW.md` artifact and documented the actual macOS desktop review findings
- converted recent real-world usage problems into concrete findings around:
  - generated-image live rendering
  - shared-volume media path translation
  - delayed hydration scroll anchoring
  - duplicate image visibility inside tool activity
- recorded that the review findings have already been consumed by the resulting stabilization and cleanup work

#### Why this closes the ticket honestly
The original goal of `3.3.5` was not to create a document for its own sake.
It was to use real product behavior on the authoritative environment to drive the next work instead of inventing more polish tickets abstractly.

That has now happened:
- the review was effectively carried out through real macOS usage and iterative validation
- the highest-value findings were turned into concrete fixes and follow-on slices
- there is no remaining evidence that another speculative `3.3` polish pass should be queued before moving on

#### Validation status
Documentation-only closeout.
No additional code-path validation was required for the ticket notes themselves.

#### Review artifact
See: `docs/LIVE-USAGE-REVIEW.md`

#### Recommended next step
Treat the `3.3` live-review loop as complete and continue with the next strongest milestone-aligned ticket outside this review bucket.

# Definition of Phase 1 done

Phase 1 is done when:
- connection state is explicitly modeled and less fragile
- selected session ownership is clearer
- session switching is more predictable
- `ChatView.tsx` has materially reduced responsibilities
- thread rendering has meaningful component boundaries
- composer logic has been extracted and clarified

## Phase 1 assessment (2026-04-08)

Phase 1 should now be treated as effectively complete.

### Why
The core shell stabilization goals have been materially achieved:
- connection/session state is explicit enough to be reasoned about
- reconnect and active-session shell behavior has been hardened
- thread rendering, streaming, auto-scroll, and thread-state handling have all been meaningfully decomposed and clarified
- composer behavior, slash-command handling, and session-scoped input behavior are substantially cleaner than at the start of the phase
- `ChatView.tsx` remains important, but no longer acts as a single undifferentiated gravity well for every core behavior

### What this means
Further Phase 1 work should only be added if a clearly high-leverage reliability issue appears.
Otherwise, the correct next move is to proceed to **Phase 2 — Desktop-native media and attachment workflows**.

That is the bar for leaving Phase 1 and moving confidently into media-heavy and tool-visibility slices.

## Ticket 4.1.1 — Audit current model/runtime control surface
### Goal
Map the current model and thinking control surface before changing it, so the first `4.1` cleanup cut improves real product coherence instead of just moving controls around.

### Why
Runtime controls are now important enough to daily use that they should feel intentional, but the current surface grew incrementally.

Today, model and thinking controls are spread across:
- the chat header
- the composer footer
- slash commands
- the new-session modal
- settings

That makes it too easy to keep adding small tweaks without ever deciding which controls belong:
- inline with the current conversation
- in session creation/defaults
- in settings

### Scope
- audit the current model-selection surface
- audit the current thinking-level surface
- audit where new-session model defaults live
- identify duplicated session-patch logic and state ownership
- propose the smallest next product-facing cleanup cut

### Deliverable
A concrete audit of the current runtime-control surface plus a recommended next `4.1` implementation slice.

### Done when
- the current control surfaces are mapped
- the current state ownership is explained
- the highest-value runtime-control cleanup cut is identified

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- audited the current runtime-control UI surfaces in:
  - `src/components/ChatView.tsx`
  - `src/components/Composer.tsx`
  - `src/components/NewSessionModal.tsx`
  - `src/components/settings-sections/AppActionShortcutsSection.tsx`
  - `src/lib/slash-commands.ts`
- audited the current runtime-control state ownership and patch handlers in `src/app.tsx`

#### Current runtime-control map
- model selection for the active session currently lives in the `ChatView` header
- thinking selection for the active session currently lives in the `Composer` footer
- slash commands also expose both controls through `/model` and `/think`
- new-session model choice exists in `NewSessionModal`
- the remembered preferred model for shortcut-driven new sessions currently lives in `AppActionShortcutsSection`

#### Findings
##### 1. The current-session runtime controls are split across two different in-thread surfaces
- model selection is in the header
- thinking selection is in the composer footer

That means the current interaction context is not expressed as a single coherent cluster.
The user has to look in two different places to answer:
- what model am I using?
- what reasoning level am I using?

##### 2. Session patch logic is duplicated between direct UI handlers and slash commands
The `app.tsx` handlers for header/footer controls and the `/model` and `/think` slash-command branches both:
- patch the session
- update local override state
- refresh session/session-model state

That duplication is manageable now, but it is the wrong foundation for future runtime-control cleanup.

##### 3. The remembered new-session model default is conceptually misplaced
The "Bound model (auto-applied on shortcut create)" control currently lives inside `AppActionShortcutsSection`.

That is understandable historically, but product-wise it is really:
- a runtime/new-session default
- not primarily a shortcut-editing concern

That makes settings harder to scan and blurs the line between:
- shortcut definitions
- runtime defaults

##### 4. Runtime control state is app-owned, but the UI contract is still scattered
`src/app.tsx` currently owns the important runtime-control state:
- `sessionModelOverrides`
- `sessionThinkingOverrides`
- `thinkingLevel`
- `newSessionPreferredModel`
- the derived `sessionInfo` view model

But that state is then exposed through separate prop paths into `ChatView`, `Composer`, `NewSessionModal`, and settings.

That is good enough for the current product, but it means the next `4.1` slice should probably tighten a dedicated runtime-control boundary rather than add more props in parallel.

##### 5. The control vocabulary is already drifting slightly
The in-thread UI exposes:
- `off`
- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`

But the slash-command help text currently advertises only:
- `off`
- `low`
- `medium`
- `high`

That mismatch is small, but it is exactly the kind of drift an audit should catch before the control surface grows further.

#### Why this is the right first 4.1 slice
This gives `4.1` a concrete starting point instead of treating runtime controls as a vague polish bucket.

The main value of the audit is that it turns "runtime controls feel a little scattered" into a specific next move:
- unify the session-runtime control boundary
- separate runtime defaults from shortcut editing
- reduce duplicated patch/update behavior

#### Validation status
Documentation-only audit.
No code-path validation required for this ticket itself.

#### Recommended next step
Proceed to a first implementation slice that:
- introduces a small shared runtime-control patch/update seam for model and thinking changes
- chooses a more coherent ownership story for the remembered new-session model default
- decides whether model and thinking should remain split between header and composer or be presented as one compact current-session control cluster

## Ticket 4.1.2 — Introduce a shared runtime patch seam and separate new-session defaults from shortcuts
### Goal
Take the first real `4.1` implementation cut by tightening the model/thinking update path and moving the remembered new-session model default into a clearer product surface.

### Why
After the audit, the highest-value safe cut was not a major UI relocation.
It was to fix two specific problems first:

- model/thinking updates were being patched through multiple parallel code paths
- the remembered model for new sessions lived inside shortcut editing, where it did not really belong

That makes this a good first implementation slice because it improves both product clarity and architectural footing without forcing the bigger header-vs-composer control-layout decision yet.

### Scope
- introduce a shared app-level helper for patching session model/thinking changes
- reuse that helper from direct UI handlers and slash commands
- reuse that helper from model-shortcut application where practical
- move the remembered new-session preferred model into its own settings section
- align the `/think` help text with the actual thinking choices exposed in the UI

### Deliverable
A first runtime-control cleanup pass that reduces duplication and gives new-session defaults a clearer home.

### Done when
- model/thinking session patches no longer rely on duplicated update logic across the main UI and slash commands
- the preferred model for new sessions is no longer edited inside the shortcut section
- runtime-control vocabulary is more consistent
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added a shared `patchSessionRuntimeSettings(...)` seam in `src/app.tsx` and reused it for:
  - direct model selection
  - direct thinking selection
  - `/model`
  - `/think`
  - model-shortcut application
- added `src/lib/runtime-controls.ts` as a small shared home for thinking-level option vocabulary
- later extracted pure runtime-control decision helpers and added focused unit coverage for:
  - model/thinking patch normalization
  - override-map updates
  - thinking-vocabulary consistency
- moved the remembered new-session preferred model into a dedicated `NewSessionDefaultsSection`
- removed that default-model editor from `AppActionShortcutsSection`

#### User-facing improvements landed
- the settings surface now expresses the new-session preferred model as a runtime default instead of a shortcut-specific option
- the slash-command help for `/think` now matches the actual UI choices more closely

#### Why this is the right first implementation cut
This improves the runtime-control boundary without forcing a bigger layout change than we can justify yet.

It also gives the next `4.1` slice a better base:
- one patch/update seam instead of several
- one explicit place for new-session defaults
- one shared thinking-level vocabulary source

#### Validation status
- `make typecheck` passes
- `make build` passes

#### Recommended next step
Take the next `4.1` product-facing cut around presentation:
- either introduce a more coherent current-session runtime control cluster in-thread
- or explicitly decide that model and thinking should stay split, but with a clearer shared boundary and visual relationship

## Ticket 4.1.3 — Introduce a compact current-session runtime control cluster
### Goal
Make the current interaction context easier to read and change by presenting model and thinking together as one coherent in-thread runtime control surface.

### Why
After `4.1.2`, the update logic was in much better shape, but the visible controls were still split:

- model selection in the chat header
- thinking selection in the composer footer

That made the current session context feel fragmented even though the underlying runtime-control boundary was getting cleaner.

The next product-facing move was to decide where the current session's runtime context should actually live.

### Scope
- introduce a grouped current-session runtime control cluster in-thread
- colocate model and thinking controls in that cluster
- remove the duplicated footer thinking picker
- preserve slash-command parity and the existing patch/update behavior

### Deliverable
A more coherent visible runtime-control surface for the active session.

### Done when
- model and thinking controls are presented together in one current-session cluster
- the composer footer no longer carries a duplicate thinking picker
- the current interaction context is easier to scan
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- moved model and thinking controls into one grouped runtime cluster in the chat header
- kept the existing model and thinking menu behavior, but colocated the controls in one surface
- removed the old composer-footer thinking picker
- preserved the shared patch/update seam introduced in `4.1.2`

#### User-facing improvements landed
- the current session's runtime context is now easier to answer at a glance:
  - which model am I on?
  - which thinking level am I on?
- the composer footer is less overloaded and now focuses more cleanly on:
  - composition
  - attachment staging
  - send/compact/context stats

#### Why this is the right next 4.1 slice
This is the first runtime-control change that is strongly visible to the user, but it still avoids a risky broader redesign.

It resolves the most obvious presentation problem from the audit without yet forcing more speculative decisions about larger runtime-control information architecture.

#### Validation status
- `make typecheck` passes
- `make build` passes

#### Recommended next step
Pause and use the product for a bit before taking another `4.1` layout pass.

If follow-up work is still needed, the next likely cuts are:
- extracting the header runtime cluster into its own component boundary, or
- deciding whether more of the current-session context belongs near that same cluster

## Ticket 4.1.4 — Extract the header runtime cluster into its own component boundary
### Goal
Take the first structural follow-up after `4.1.3` by moving the new header runtime cluster out of `ChatView` without changing the user-facing model/thinking behavior.

### Why
`4.1.3` fixed the product problem, but it still left the newly grouped runtime surface fully inlined inside one of the repo's biggest hotspots.

That meant `ChatView` was still carrying:
- the header runtime cluster markup
- the model/thinking menu state
- the outside-click handling for those menus
- the runtime menu scrim behavior

This is a good next slice because it preserves the improved product surface while giving that surface an actual component boundary of its own.

### Scope
- extract the header runtime cluster into a dedicated component
- move the cluster's local menu state, refs, and outside-click handling into that component
- preserve the existing model/thinking selection behavior and header placement
- keep `ChatView` as the higher-level orchestration surface

### Deliverable
A dedicated runtime-controls component that owns the header runtime cluster interaction details instead of keeping them inline in `ChatView`.

### Done when
- `ChatView` no longer inlines the header runtime cluster
- model/thinking menu state and click-outside handling are owned by the extracted component
- the visible runtime-control behavior is unchanged
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added `src/components/SessionRuntimeControls.tsx` as the dedicated boundary for the header runtime cluster
- moved the cluster's model/thinking menu state, refs, click-outside behavior, and scrim rendering into that component
- simplified `ChatView` so it now treats the runtime cluster as a child surface instead of carrying its inline interaction details

#### User-facing improvements landed
- no intentional UX change; this was a structural cleanup cut meant to keep the new runtime cluster stable

#### Why this is the right follow-up to 4.1.3
It keeps the runtime-control cleanup moving in the same direction as the rest of the repo: smaller, clearer boundaries around product surfaces that have already proved their value in real use.

#### Validation status
- `make typecheck` passes
- `make build` passes

#### Recommended next step
Move on from `4.1` unless real usage shows another concrete runtime-control problem worth solving.

## Ticket 4.2.1 — Centralize connection recovery feedback and add an actionable composer notice
### Goal
Start `4.2` with a user-facing recovery cut that makes connection failures easier to understand and less passive.

### Why
Before this cut, the connection status and recovery copy were still scattered:

- status labels in `ChatView`
- composer warning text in `ChatView`
- protocol / pairing notes in `app.tsx`

That made it easy for reconnect messaging to drift and left the main warning surface as plain text with no direct recovery affordance.

### Scope
- centralize connection/recovery copy in a shared helper
- reuse that helper for header status and composer warning state
- turn connection-related composer warnings into a structured notice with an explicit action where appropriate
- preserve the existing runtime/send gating behavior

### Deliverable
A first recovery-focused UI pass where connection problems feel more guided and the copy lives behind one shared seam.

### Done when
- header status and composer connection/recovery messaging no longer duplicate their core state mapping
- disconnected and error states offer an in-place path to settings
- helper-level validation exists for the new connection-feedback mapping
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added `src/lib/connection-feedback.ts` as the shared source of truth for:
  - gateway status label
  - status-dot tone
  - structured composer recovery notice
- updated `ChatView` to consume that helper instead of carrying separate connection/recovery string branches inline
- updated `Composer` to render a structured notice with an optional action button instead of only plain warning text
- disconnected and connection-error notices now offer `Open Settings` directly from the composer surface

#### User-facing improvements landed
- connection failures now feel less passive because the main warning surface can point directly to settings when that is the next useful step
- reconnect/pairing/connecting copy is more consistent between the header and the composer

#### Why this is the right first 4.2 slice
It improves the recovery story immediately, but it is still a small enough cut that it does not force a broader reconnect-state rewrite yet.

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
Look at the next continuity-focused 4.2 cut:
- clarify what happens to the current session surface when the gateway drops mid-flow
- decide whether the app needs a more explicit reconnect/recovery banner beyond the composer notice

## Ticket 4.2.2 — Make active-session recovery state visible during reconnects and disconnects
### Goal
Clarify what the selected session is doing when the gateway drops mid-flow so the thread stays legible instead of quietly looking idle.

### Why
After `4.2.1`, the composer had better recovery messaging, but the active session surface still had a gap:

- the thread stayed visible, which was good
- but the current-session runtime pill could still fall back toward an idle-looking state
- and the user had to infer most recovery semantics from the composer notice alone

That meant continuity was better than before, but still not explicit enough during reconnects or connection loss.

### Scope
- add a visible selected-session recovery banner for reconnect/disconnect/pairing states
- make the current-session runtime pill reflect reconnect/disconnected recovery instead of a generic idle-looking state
- preserve the existing thread visibility and recovery behavior
- keep the recovery copy behind the shared connection-feedback seam

### Deliverable
A more explicit active-session recovery surface when the gateway drops during real work.

### Done when
- selected sessions show a clear recovery banner during reconnect/disconnect/pairing states
- the current-session runtime pill no longer looks idle when the gateway is unavailable
- helper-level validation covers the new session continuity banner mapping
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extended `src/lib/connection-feedback.ts` to describe active-session recovery banners in addition to header/composer connection state
- updated `ChatView` to render a recovery banner under the header when a selected session loses the gateway
- updated the current-session runtime pill so reconnect/disconnected states are explicit instead of falling back to an idle-looking runtime status
- added focused helper coverage for the new continuity-banner mapping

#### User-facing improvements landed
- when the gateway drops mid-session, the app now says what is happening without hiding the current thread
- reconnecting sessions explicitly communicate that the thread is being kept visible while the gateway recovers
- disconnected/error states make it clearer that sending and history refresh are paused, not lost

#### Why this is the right next 4.2 slice
It improves continuity in the exact place users are likely to feel confusion after a backend hiccup, while still avoiding a broader reconnect-state redesign.

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If more `4.2` work is needed, the next likely cut is a small reconnect policy pass:
- define whether the app should expose a more explicit shell-level “recovered / refreshed” signal after reconnect
- audit whether interrupted active runs need clearer post-reconnect messaging beyond the banner

## Ticket 4.2.3 — Add an explicit recovered/refreshed signal after reconnect
### Goal
Make recovery completion visible after reconnect so the app does not silently jump from “disconnected” back to “fine” with no acknowledgment.

### Why
After `4.2.2`, disruption was much clearer:

- the composer explained what was blocked
- the current-session banner explained what was paused
- the runtime pill stopped looking idle during reconnects

But there was still one missing moment in the recovery story:

- the gateway could reconnect
- the active session could refresh
- and the UI would quietly return to its normal state without confirming that recovery had actually succeeded

That made the reconnect path feel incomplete, especially after a visible interruption.

### Scope
- detect when a `hello` event represents a real recovery rather than the initial boot connection
- show a short-lived shell-level notice when the gateway reconnects
- show a follow-up short-lived notice when the selected session history finishes refreshing after reconnect
- keep the copy behind a small shared recovery helper instead of adding more inline reconnect logic

### Deliverable
A lightweight recovered/refreshed signal that closes the loop after reconnect without adding another permanent banner.

### Done when
- the initial app connection does not show a recovery notice
- reconnecting after a disconnect shows a short-lived “Gateway reconnected” notice
- reconnecting with an active session shows a follow-up “Session refreshed” notice once the selected session reload completes
- helper-level validation covers the recovery notice rules
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added `src/lib/connection-recovery.ts` to centralize recovery-announcement rules and copy
- updated `src/app.tsx` to detect post-connect recoveries, announce gateway reconnects, and announce active-session refresh completion only for the still-selected session
- updated `ChatView` to render a short-lived shell-level recovery notice in addition to the persistent continuity banner
- added focused helper coverage for the reconnect/recovery notice rules

#### User-facing improvements landed
- reconnects now close with an explicit acknowledgement instead of silently returning to normal
- selected-session recovery feels more trustworthy because the app confirms when the session refresh actually finishes
- first app load still stays quiet, so the new notice reads as recovery rather than startup noise

#### Why this is the right 4.2 follow-through
It completes the reconnect story without escalating to a larger recovery-state redesign.

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If more `4.2` work is needed, the next likely cut is focused post-reconnect cleanup:
- clarify what the app should communicate when an active run was interrupted by the disconnect
- decide whether interrupted runs need a more explicit “resume/retry/manual refresh” follow-up state

## Ticket 4.2.4 — Clarify interrupted active runs after reconnect
### Goal
Make interrupted active runs legible after reconnect so the user can tell the difference between “the gateway recovered” and “the previous run actually finished.”

### Why
After `4.2.3`, reconnect recovery was much clearer:

- the shell acknowledged when the gateway came back
- the shell acknowledged when the selected session history finished refreshing

But there was still one ambiguous path:

- a run could be active when the gateway dropped
- reconnect could succeed
- session refresh could succeed
- and the user could still be left wondering whether the previous run quietly completed, resumed, or was simply cut off

That ambiguity matters most in the exact moment when the app otherwise looks healthy again.

### Scope
- detect when a selected-session run was in flight at disconnect time
- re-check that run after reconnect and session refresh
- if the refreshed session still does not contain a terminal result for that run, show a session-level interrupted-run banner
- give one explicit next step (`Refresh Now`) instead of implying auto-resume
- keep the decision logic behind focused recovery helpers instead of scattering run-interruption heuristics through `app.tsx`

### Deliverable
A clearer post-reconnect outcome for in-flight runs that were interrupted and did not automatically resume.

### Done when
- reconnecting after an in-flight run no longer leaves the outcome ambiguous
- completed runs do not show a false interrupted-run banner after reconnect
- unresolved interrupted runs show a session-level warning with a refresh action
- helper-level validation covers interrupted-run capture, resolution, and banner mapping
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extended `src/lib/connection-recovery.ts` with interrupted-run capture, resolution, and banner-copy helpers
- updated `src/app.tsx` to capture active-run snapshots on disconnect, reconcile them after active-session history refresh, and keep interrupted-run banners session-scoped
- updated `src/lib/connection-feedback.ts` and `ChatView` so connected sessions can show a post-reconnect interrupted-run banner with a `Refresh Now` action
- added focused helper coverage for interrupted-run capture, resolution, and the connected-session banner mapping

#### User-facing improvements landed
- after reconnect, the app now distinguishes “gateway/session recovered” from “the previous run actually finished”
- interrupted runs no longer silently disappear behind a healthy-looking connected state
- the next step is explicit: refresh again if late output is expected, or resend the prompt

#### Why this is the right 4.2 follow-through
It closes the last obvious ambiguity in the reconnect story without claiming background run resume support that the app cannot guarantee.

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If more `4.2` work is needed, the next likely cut is lightweight rather than structural:
- decide whether interrupted runs should eventually expose a richer retry/resend affordance
- otherwise, treat the core reconnect/recovery slice as complete and move to the next milestone hotspot

## Ticket 4.3.1 — Extract the low-risk settings sections from `SettingsModal`
### Goal
Start Slice `4.3` by extracting the easiest standalone settings sections into dedicated components without changing behavior.

### Why
`SettingsModal.tsx` is one of the repo's major architecture hotspots, but it is not the kind of file that should be split through a risky big-bang rewrite.

The safest first move is to extract the sections that are already conceptually independent and minimally entangled with local modal state.

That gives the settings surface a real decomposition path while avoiding churn in the denser shortcut and notification-audio clusters.

### Scope
- extract the UI settings scheme section
- extract the gateway / connection section
- extract the path-prefix mapping section
- keep `SettingsModal.tsx` as the orchestrating container for now
- preserve current behavior and visual layout

### Deliverable
A first-pass section boundary for the settings surface, with dedicated components for the low-risk clusters.

### Done when
- `SettingsModal.tsx` no longer inlines the scheme, gateway, and path-mapping sections
- the extracted sections have clear prop boundaries
- no settings behavior regresses
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extracted `SettingsSchemesSection`
- extracted `GatewaySettingsSection`
- extracted `PathPrefixMappingsSection`
- kept `SettingsModal.tsx` as the state-owning container while narrowing its rendering responsibility

#### Why this is the right first 4.3 slice
This reduces the "multiple apps inside one modal" problem without touching the riskier shortcut, notification-audio, or appearance-editor clusters yet.

It creates real section boundaries first, which makes the next settings cleanup slices less speculative.

#### Recommended next step
Continue `4.3` by extracting one of the denser product-facing clusters next, probably:
- typography / appearance settings, or
- shortcut settings

## Ticket 4.3.2 — Extract the typography and appearance settings cluster
### Goal
Continue Slice `4.3` by moving the appearance-oriented settings into dedicated sections backed by shared field controls.

### Why
After the first low-risk extraction pass, the cleanest next move is the appearance cluster because it is still mostly local-product UI state and does not carry the heavier behavioral coupling of shortcuts or notification-audio flows.

That makes it a good second decomposition cut: meaningful structural progress without risking the more stateful settings interactions yet.

### Scope
- extract the typography / layout section
- extract the color system section
- extract the markdown readability section
- centralize reusable settings field controls used across those sections
- preserve current behavior and layout

### Deliverable
A narrower `SettingsModal.tsx` and a reusable field-control seam for future settings-section extractions.

### Done when
- typography, color, and markdown sections no longer render inline inside `SettingsModal.tsx`
- shared number/toggle/color field controls are no longer local-only to `SettingsModal.tsx`
- no settings behavior regresses
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extracted shared settings form primitives into `SettingsFieldControls`
- extracted `TypographyLayoutSection`
- extracted `ColorSystemSection`
- extracted `MarkdownReadabilitySection`
- kept the more stateful chat-controls and shortcut clusters inside `SettingsModal.tsx` for now

#### Why this is the right next 4.3 slice
This continues real structural cleanup while staying on the safer side of the settings surface.

It also creates a reusable control seam that should make later shortcut and chat-controls extraction less repetitive.

#### Recommended next step
Continue `4.3` with one of the two remaining heavier clusters:
- `Chat Controls`, or
- the shortcut settings groups

## Ticket 4.3.3 — Extract the chat controls cluster from `SettingsModal`
### Goal
Continue Slice `4.3` by moving the chat-controls cluster into a dedicated settings section component without changing behavior.

### Why
After the low-risk and appearance-focused extractions, the next clean structural cut is the chat-controls cluster.

It is heavier than typography and color settings because it includes reply-done sound behavior and custom audio state, but it is still more self-contained than the shortcut groups.

That makes it the right next step before tackling keyboard-scheme-heavy settings.

### Scope
- extract the chat-controls section
- preserve reply-done sound preview behavior
- preserve custom audio upload and clear behavior
- keep `SettingsModal.tsx` as the state owner for local modal state

### Deliverable
A dedicated `ChatControlsSection` with a clear prop boundary around chat-display and reply-done-sound settings.

### Done when
- the chat-controls cluster no longer renders inline inside `SettingsModal.tsx`
- reply-done sound behavior is unchanged
- no settings behavior regresses
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extracted `ChatControlsSection`
- kept custom sound upload state in `SettingsModal.tsx` but passed it through a narrower section-level interface
- preserved the existing reply-done sound preview/update behavior
- later extracted pure reply-done audio validation helpers and added focused unit coverage for file validation, audio data URL normalization, and saved-name normalization

#### Why this is the right next 4.3 slice
This removes another large product-facing cluster from the modal without yet touching the most behavior-dense shortcut groups.

It also leaves the settings surface with a much clearer remaining cleanup target instead of many mixed concerns piled together.

#### Recommended next step
Finish the current `4.3` cleanup pass by extracting the remaining shortcut clusters:
- app action shortcuts
- model shortcut schemes
- agent session shortcuts

## Ticket 4.3.4 — Extract the shortcut settings cluster from `SettingsModal`
### Goal
Finish the main `4.3` decomposition pass by moving the remaining shortcut-heavy settings into dedicated section components.

### Why
After the earlier settings extractions, the shortcut groups were the last large inline settings island in `SettingsModal.tsx`.

They also carried the most obvious repeated UI logic:
- key capture inputs
- modifier toggles
- repeated shortcut-row chrome

That made them the right final major extraction pass for the current settings cleanup track.

### Scope
- extract the app action shortcuts section
- extract the model shortcut schemes section
- extract the agent session shortcuts section
- centralize shared shortcut key/modifier editor controls
- preserve current behavior and layout

### Deliverable
A `SettingsModal` container that orchestrates settings state while delegating the last major shortcut clusters to dedicated section components.

### Done when
- the three shortcut sections no longer render inline inside `SettingsModal.tsx`
- shared shortcut editor controls are centralized instead of duplicated
- shortcut behavior is unchanged
- `make typecheck` and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- extracted `AppActionShortcutsSection`
- extracted `ModelShortcutSchemesSection`
- extracted `AgentSessionShortcutsSection`
- extracted shared shortcut helpers and editor controls into `ShortcutSettingsShared`
- later added focused unit coverage for shortcut key normalization, keyboard-event normalization, and thinking-label formatting via pure helper seams

#### Why this is the right next 4.3 slice
This removes the last major repeated settings-rendering island from the modal and leaves `SettingsModal.tsx` much closer to a true orchestration container.

It also prevents future shortcut-setting changes from requiring edits in three almost-identical inline render blocks.

#### Recommended next step
Pause the current `4.3` cleanup track here unless real usage shows further settings pain.

If we continue later, the next work should probably be:
- smaller cleanup inside the remaining state-owning modal container, or
- broader settings information architecture decisions rather than more extraction for extraction’s sake

## Ticket 5.1.1 — Audit approval event flow and define the first blocked-action surface
### Goal
Start Slice `5.1` by mapping the real approval-related seams in ClawFace and using that audit to choose the smallest honest approval UI cut.

### Why
Approval UX is part of the product direction, but the repo is not ready for a full approvals center yet.

Right now the codebase gives mixed signals:
- the gateway client requests approval-related scopes
- connection-state copy already references pairing approval
- slash-command help advertises `/approve`
- but there is no normalized approval event model or first-class approval surface in the app

That means the right first move is not to guess at UI chrome. It is to audit what the frontend actually knows today and make the first implementation cut match that reality.

### Scope
- inspect gateway connect scopes and advertised method/event inventory relevant to approvals
- inspect existing connection/recovery UI for approval-adjacent blocked states
- inspect slash-command affordances for approval actions
- identify the smallest truthful approval-needed surface that fits Milestone 1
- document the first implementation cut instead of jumping to a full approvals center

### Deliverable
An approval-surface audit captured in the ticket notes, with a concrete follow-up ticket for the first blocked-action/approval-needed UI cut.

### Done when
- the current approval-related seams are documented
- misleading or incomplete current affordances are called out explicitly
- the first implementation cut for `5.1` is identified and scoped
- future agents can start approval UX work from the ticket notes instead of rediscovering the same gaps

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- audited the current approval-related seams across `src/lib/gateway.ts`, `src/app.tsx`, `src/lib/connection-feedback.ts`, and `src/lib/slash-commands.ts`
- confirmed the app already requests `operator.approvals` and `operator.pairing` scopes and records advertised gateway methods from hello
- confirmed pairing-required is currently the only approval-adjacent state surfaced in product UI, mostly through connection/disabled copy
- confirmed `/approve` is advertised in slash-command help but is not implemented in `handleSlashCommand`
- confirmed there is no normalized approval event/state model yet in app types or state ownership

#### Audit findings
- current approval UX is strongest for device-pairing failure states and weakest for generic approval-needed operations
- the app has the beginnings of an approval capability story, but not yet a first-class approval surface
- a full approvals center would overshoot Milestone 1, but a narrow blocked-action shell surface fits the roadmap well
- the existing `/approve` affordance should not remain in limbo for long, because it implies local approval handling that does not yet exist

#### Why this is the right first 5.1 slice
It establishes what the app can truthfully communicate today before adding UI that pretends richer approval workflows already exist.

It also gives the next implementation cut a much smaller target than “build approvals UX”:
- normalize one approval-needed state
- surface it clearly
- make one action path obvious

#### Validation status
- docs-only audit slice; no code validation rerun

#### Recommended next step
Take a narrow first implementation cut:
- `Ticket 5.1.2 — Introduce the first approval-needed shell surface`

That ticket should likely:
- decide whether to remove or wire `/approve`
- normalize the first approval-needed state behind a small shared seam
- show one actionable shell/thread-level approval notice for pairing or blocked approval states before attempting broader approval workflows

## Ticket 5.1.2 — Introduce the first approval-needed shell surface
### Goal
Land the first real approval-needed UI in ClawFace without pretending the app already has a full approvals workflow.

### Why
After the `5.1.1` audit, the right first implementation cut was clear:
- pairing-required is the one approval-adjacent state the app can already identify honestly
- `/approve` was being advertised before it existed
- the app needed one visible blocked-action surface before any broader approval work

This ticket is about making that first approval state explicit and actionable in a narrow, Milestone-1-appropriate way.

### Scope
- stop advertising `/approve` until it is real
- separate approval-needed shell messaging from reconnect/session continuity banners
- show a shell-level approval-needed banner for pairing-required states, even when no session is selected
- keep the first action honest by copying the external approval command instead of implying local approval handling
- add focused helper coverage for the new approval-needed mapping

### Deliverable
The first approval-needed shell surface for pairing-required states, plus removal of the misleading nonfunctional `/approve` affordance.

### Done when
- `/approve` is no longer advertised as available unless it is implemented
- pairing-required is visible as a shell-level approval-needed state, not just disabled composer copy
- the approval-needed surface stays visible without depending on an active session
- helper-level coverage locks in the approval banner and action mapping
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- removed the nonfunctional `/approve` entry from `src/lib/slash-commands.ts`
- extended `src/lib/connection-feedback.ts` with a dedicated approval-needed banner model and a shared `openclaw devices approve` command constant
- updated `ChatView` to render a shell-level approval banner for pairing-required states and expose a `Copy Command` action
- kept pairing-required visible in the composer notice as well, but separated that from session continuity banners so reconnect/recovery copy does not get overloaded
- added helper coverage in `tests/connection-feedback.test.mjs` for the new approval-needed mapping and the “no active session” case

#### User-facing improvements landed
- pairing-required is now clearly visible as an approval-needed state even before a session is selected
- the app no longer advertises a local `/approve` command that it cannot actually handle
- the first approval action is explicit and honest: copy the external `openclaw devices approve` command

#### Why this is the right first 5.1 implementation cut
It gives the app one real approval-needed surface without overshooting into a fake approvals center or pretending OpenClaw approval actions are already fully wired through the frontend.

It also keeps the messaging model cleaner:
- approval-needed shell state
- session continuity/reconnect state
- composer blocked-state guidance

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If approval work continues, the next likely cut should be a contract/normalization slice rather than more banner chrome:
- identify whether OpenClaw exposes approval-request events or approval-related methods that can be normalized into app state
- only then decide whether ClawFace should add richer in-app approval actions beyond pairing guidance

## Ticket 5.1.3 — Normalize approval request events and add the first in-app approval action
### Goal
Turn real OpenClaw approval-request events into session-scoped app state, then expose the narrowest truthful in-app approval action for the selected session.

### Why
After `5.1.2`, ClawFace could clearly show device pairing approval problems, but generic OpenClaw approvals were still invisible in the product even though the backend already emits approval request and resolution events.

This ticket is about using the real gateway contract that already exists:
- `exec.approval.requested` / `exec.approval.resolved`
- `plugin.approval.requested` / `plugin.approval.resolved`
- `exec.approval.resolve` / `plugin.approval.resolve`

That makes it possible to add a real Milestone-1 approval path without inventing a fake approvals center.

### Scope
- normalize approval-request and approval-resolution gateway events into a shared frontend seam
- store pending approvals by session so the selected session can surface them clearly
- add the first selected-session approval request banner with in-app approval actions
- keep the surface narrow: one pending approval at a time for the selected session is enough for now
- add focused helper coverage for approval event extraction, state updates, and method selection

### Deliverable
An approval-request flow that can surface real pending exec/plugin approvals in the current session and submit the supported approval decision back through the gateway.

### Done when
- approval-request gateway events become session-scoped app state
- the selected session shows a visible approval request banner when one is pending
- supported decisions can be submitted in-app through the advertised approval resolve methods
- helper-level tests lock in the event parsing and pending-approval state helpers
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added `src/lib/approval-events.ts` to normalize OpenClaw approval request/resolution events and approval resolve method selection
- added a new `PendingApproval` app type in `src/lib/types.ts`
- updated `src/app.tsx` to track pending approvals by session, resolve approval actions through the advertised gateway methods, and clear pending approvals when resolution events arrive
- updated `src/components/ChatView.tsx` to surface the first selected-session approval banner with `Allow Once`, `Allow Always`, and `Deny` actions when supported
- added banner styling for approval decision actions in `src/styles.css`
- added focused helper coverage in `tests/approval-events.test.mjs`

#### User-facing improvements landed
- real OpenClaw approval requests are now visible in the selected session instead of being silently hidden
- the app can submit the first supported in-app approval decisions for exec and plugin approvals
- pairing approval, reconnect/recovery, and generic pending approvals now stay separated as different shell/session states instead of getting collapsed into one overloaded warning path

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If approval work continues, the next likely slice should stay narrow:
- decide whether the selected session should show more than the first pending approval
- only then consider a broader approval tray or history surface

## Ticket 5.1.4 — Add non-selected session approval visibility
### Goal
Keep pending approvals visible even when they belong to a different session than the one currently open.

### Why
After `5.1.3`, the selected session could show and resolve the first pending approval in-app, but approvals in background sessions were still easy to miss until the user manually clicked into the right thread.

This ticket is about making approval-needed state visible at the session-navigation level without escalating into a broader approvals tray.

### Scope
- surface pending approvals for non-selected sessions through the existing sidebar activity affordance
- keep the selected session behavior unchanged: full approval banner in-thread, compact signal in the sidebar
- define a simple priority rule between current session, approval-needed, unread, and working badges
- add focused helper coverage for the sidebar activity-priority logic

### Deliverable
A sidebar-level approval indicator that makes background session approvals visible without adding a new approval center.

### Done when
- sessions with pending approvals show a visible approval indicator in the sidebar
- approval-needed visibility does not get buried behind generic unread or working badges
- the selected session still prefers `Current` in the sidebar while showing the full approval banner in-thread
- helper-level coverage locks in the sidebar activity-priority rules
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-12)

This ticket is now complete.

#### What changed
- added `src/lib/session-sidebar-activity.ts` to centralize sidebar activity-priority rules
- added `SessionActivityState` to `src/lib/types.ts` so session activity typing is shared instead of re-declared
- updated `SessionSidebar` to show approval-needed badges for non-selected sessions through the existing activity-badge path
- updated `src/app.tsx` to derive pending approval counts by session and pass them into the sidebar
- added approval-specific sidebar styling in `src/styles.css`
- added focused helper coverage in `tests/session-sidebar-activity.test.mjs`

#### User-facing improvements landed
- pending approvals in background sessions are now visible without opening each session one by one
- approval-needed state has higher visibility than generic unread or working status in the session list
- the selected session still reads as `Current` in the sidebar while surfacing the full approval actions in-thread

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
The approval layer is now in a good Milestone 1 pause state.
If approval work continues later, the next slice should probably choose between:
- showing more than the first pending approval in the selected session
- or building a broader approval tray/history surface

## Ticket 5.2.1 — Expose background-task and subagent status through existing command surfaces
### Goal
Make OpenClaw background work more visible without jumping straight to a dedicated task or subagent dashboard.

### Why
The roadmap is clear that Milestone 1 should not build a full task/subagent dashboard yet, but the product brief still expects the user to understand when background work exists.

OpenClaw already exposes two strong existing seams:
- `/tasks` for the current session
- `/status` lines such as `subagentsLine` and `taskLine`

This ticket is about making those existing seams visible in ClawFace instead of inventing a bigger surface too early.

### Scope
- add `/tasks` to the slash-command suggestions
- surface OpenClaw-provided background task / subagent summary lines in the local `/status` card
- keep this slice text-first and narrow
- add focused helper coverage for background-status extraction

### Deliverable
A first background-work visibility pass that improves discoverability and status awareness without adding a dashboard.

### Done when
- `/tasks` is discoverable from the slash-command menu
- the local `/status` card shows background task / subagent summary lines when the gateway provides them
- helper-level tests lock in the background-status extraction seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-13)

This ticket is now complete.

#### What changed
- added `src/lib/status-background-visibility.ts` to normalize `subagentsLine` / `taskLine` extraction from status payloads
- updated `src/app.tsx` so the local `/status` card includes those background-work lines when present
- added `/tasks` to `src/lib/slash-commands.ts` so background-task inspection is discoverable from the composer slash menu
- added focused helper coverage in `tests/status-background-visibility.test.mjs`

#### User-facing improvements landed
- users can now discover `/tasks` directly from the slash-command suggestions
- `/status` in ClawFace surfaces the backend's existing summary of background tasks and subagents instead of silently dropping it
- background work becomes more legible without overcommitting to a dashboard the milestone does not yet want

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.2` continues, the next slice should still stay narrow:
- either improve the shell-level visibility of active background work
- or make `/subagents` slightly more discoverable/trustworthy before designing any broader task surface

## Ticket 5.2.2 — Surface active background work in the chat shell
### Goal
Make background work visible even when the user is focused on a different session.

### Why
After `5.2.1`, users can discover `/tasks` and see richer `/status` output, but those remain explicit command surfaces. The shell still does not proactively tell the user that other sessions are actively running in the background.

ClawFace already tracks per-session working state for the sidebar. This ticket is about reusing that state in the chat shell instead of inventing a dashboard.

### Scope
- add a small shell-level background-work notice when non-selected sessions are still working
- reuse the existing per-session working state instead of introducing a new task model
- keep the message informational and lightweight
- add focused helper coverage for the background-work summary seam

### Deliverable
A narrow shell-level notice that tells the user when one or more other sessions are still working and points them back to the sidebar.

### Done when
- the chat shell surfaces a background-work notice when other sessions are still marked `working`
- the notice stays quiet when only the current session is active
- helper-level tests lock in the summary text and prioritization
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-13)

This ticket is now complete.

#### What changed
- added `src/lib/background-session-visibility.ts` to summarize non-selected working sessions into a lightweight shell notice
- updated `src/app.tsx` to derive the background-session notice from existing `sessionActivity` and `sessions` state
- updated `src/components/ChatView.tsx` to render a low-severity info banner when other sessions are still working
- added focused helper coverage in `tests/background-session-visibility.test.mjs`

#### User-facing improvements landed
- users can now tell from the main chat shell when other sessions are still running in the background
- the app points the user back to the sidebar instead of hiding background work behind a different session tab
- ClawFace improves background-work visibility without overcommitting to a dedicated tasks dashboard

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.2` continues, the next slice should still stay narrow:
- either make `/subagents` slightly more discoverable/trustworthy
- or add one more lightweight current-session summary for task/subagent-heavy runs before considering a broader dashboard

## Ticket 5.2.3 — Make `/subagents` more discoverable and trustworthy in the slash menu
### Goal
Help users discover the real OpenClaw subagent actions from the composer without needing backend-specific command knowledge.

### Why
After `5.2.2`, background work is visible in the shell, but the slash menu still only exposes `/subagents` as a single generic command. Its usage text can also drift from OpenClaw if ClawFace hardcodes outdated action names.

This ticket keeps the slice narrow: improve the existing slash-command surface rather than designing a new task/subagent UI.

### Scope
- align ClawFace’s `/subagents` description and usage text with OpenClaw’s current action set
- add slash-menu suggestions for real `/subagents` actions like `list`, `kill`, `log`, `info`, `send`, `steer`, and `spawn`
- keep the implementation helper-driven and testable
- preserve existing model/thinking slash suggestion behavior

### Deliverable
A more trustworthy `/subagents` slash-menu flow that advertises real OpenClaw actions and helps users start the right command from the composer.

### Done when
- `/subagents` usage text matches OpenClaw’s current action set
- typing `/subagents` in the composer shows actionable subcommand suggestions
- helper-level tests cover the subagent suggestion mapping and preserve the existing model suggestion flow
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-13)

This ticket is now complete.

#### What changed
- added `src/lib/slash-command-suggestions.ts` to centralize slash suggestion derivation in a pure helper
- updated `src/hooks/useSlashCommands.ts` to delegate suggestion generation through that helper
- updated `src/lib/slash-commands.ts` so `/subagents` matches OpenClaw’s current `list|kill|log|info|send|steer|spawn` action set
- updated `src/components/Composer.tsx` so slash suggestions can display a separate detail string from the inserted value
- added focused helper coverage in `tests/slash-command-suggestions.test.mjs`

#### User-facing improvements landed
- typing `/subagents` in the composer now shows real actionable subcommand suggestions instead of a single generic entry
- ClawFace’s `/subagents` help text now matches OpenClaw’s current actions, making the command surface more trustworthy
- the slash menu stays lightweight while becoming much more useful for subagent-heavy sessions

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.2` continues, the next slice should still stay narrow:
- either expose a little more current-session subagent/task summary in the shell
- or pause `5.2` here and move to `5.3` now that the command-level background-work surface is in a good place

## Ticket 5.3.1 — Add the first read-only device visibility surface

### Why
OpenClaw already exposes a real `device.pair.list` method, but ClawFace still leaves device identity and pairing state mostly invisible. The first `5.3` cut should make the current device and gateway pairing index legible without jumping all the way to a device manager.

### Scope
- load the local device identity already used by gateway pairing
- fetch and normalize `device.pair.list` when the gateway supports it
- add a read-only Settings surface for:
  - the current device id
  - current device pairing state
  - pending pairing requests
  - paired devices
- refresh that surface when pairing events arrive while Settings is open

### Deliverable
A lightweight Settings card that helps the user answer:
- “Which device am I using?”
- “Is this device paired yet?”
- “What other devices are pending or paired on this gateway?”

### Done when
- Settings shows a read-only device/pairing summary when connected to a gateway that supports `device.pair.list`
- the current device state is clearly labeled as paired, pending, unlisted, or unavailable
- helper-level tests cover device-pairing payload normalization and current-device status derivation
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-13)

This ticket is now complete.

#### What changed
- added `src/lib/device-pairing-visibility.ts` to normalize `device.pair.list` payloads into a read-only UI shape
- added `src/components/settings-sections/DeviceVisibilitySection.tsx` for the first device/pairing visibility surface in Settings
- updated `src/app.tsx` to:
  - load the local device identity when Settings opens
  - fetch `device.pair.list` when the gateway supports it
  - refresh the snapshot when pairing events arrive while Settings is open
- added focused helper coverage in `tests/device-pairing-visibility.test.mjs`

#### User-facing improvements landed
- Settings now shows the current device id and whether that device is paired, pending approval, unlisted, or unavailable
- the gateway pairing index is visible without leaving ClawFace or dropping into CLI commands
- pending and paired device lists stay read-only and intentionally narrow, which gives users useful visibility without turning Milestone 1 into a full device-management surface

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.3` continues, the next slice should stay narrow too:
- either surface lightweight per-device capability summaries
- or add the first safe device action only after real usage proves which one matters most

## Ticket 5.3.2 — Add lightweight device capability summaries

### Why
The first device slice made pairing state visible, but the device list still leans on raw roles/scopes. The next step should translate those backend concepts into a more human-friendly capability summary so users can tell what a device can actually do at a glance.

### Scope
- derive friendly capability summaries from paired/pending device roles and scopes
- show that summary for the current device, pending requests, and paired devices
- keep the surface read-only
- avoid introducing device actions or backend contract changes

### Deliverable
A clearer `Devices & Pairing` surface that answers:
- “Does this device have full operator control or just read-only access?”
- “Which pending request is asking for approvals/pairing/write access?”
- “Which paired devices have the capabilities I care about?”

### Done when
- the current device card shows a human-friendly capability summary
- pending and paired device rows surface readable capability chips instead of only raw scope strings
- helper-level tests cover capability headline/chip derivation and scope implication rules
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-13)

This ticket is now complete.

#### What changed
- added `src/lib/device-capability-summary.ts` to derive human-friendly capability headlines and chips from device roles/scopes
- updated `src/components/settings-sections/DeviceVisibilitySection.tsx` to show capability summaries for:
  - the current device
  - pending pairing requests
  - paired devices
- added focused helper coverage in `tests/device-capability-summary.test.mjs`

#### User-facing improvements landed
- the device surface now communicates capability state in plain language like `Full operator control`, `Interactive operator access`, and `Read-only visibility`
- scope-heavy rows are easier to scan because the important capabilities now show up as chips
- custom/non-operator scopes still stay visible via the `Extra scopes` detail instead of being silently hidden

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.3` continues after this, the next slice should probably be the first safe device action or capability-specific workflow entry point, but only if real usage shows which one matters most.

## Ticket 5.3.3 — Add the first safe device pairing action

### Why
The device surface now makes pending requests and capabilities visible, but users still need to leave ClawFace to resolve a straightforward pairing request. The next slice should add the smallest safe action: approve or reject pending device requests that the gateway already exposes.

### Scope
- detect whether the gateway advertises `device.pair.approve` and `device.pair.reject`
- add approve/reject actions for pending device requests in the existing `Devices & Pairing` Settings card
- keep paired-device management and token rotation out of scope
- refresh the pairing snapshot after a successful resolution

### Deliverable
A narrow in-app device action that answers:
- “Can I approve this pending device from ClawFace?”
- “Can I reject an obviously unwanted request without dropping into CLI?”

### Done when
- pending pairing requests can be approved or rejected from Settings when the gateway supports those methods
- the action surface is method-gated and does not pretend unsupported actions exist
- helper-level tests cover device-pairing action method selection/support derivation
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-14)

This ticket is now complete.

#### What changed
- added `src/lib/device-pairing-actions.ts` to centralize pairing-action method selection and support derivation
- updated `src/app.tsx` to:
  - track approve/reject method availability from the advertised gateway method list
  - resolve pending device requests through `device.pair.approve` / `device.pair.reject`
  - clear per-request resolving state when pairing resolution events arrive
  - refresh the device pairing snapshot after a successful in-app resolution
- updated `src/components/settings-sections/DeviceVisibilitySection.tsx` so pending requests are fully actionable instead of preview-only
- added focused helper coverage in `tests/device-pairing-actions.test.mjs`

#### User-facing improvements landed
- pending pairing requests can now be approved or rejected directly from the existing `Devices & Pairing` card in Settings
- ClawFace only shows the actions the current gateway actually supports, so unsupported pairing methods stay honest instead of looking broken
- pending requests are now fully visible in Settings when actions are available, which keeps the first device action end-to-end usable without expanding into a full device manager

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.3` continues after this, the next slice should probably be:
- a lightweight device-specific workflow entry point that real usage proves people actually need
- or a pause, since the device surface now has visibility, capability summaries, and one safe action without overbuilding Milestone 1

## Ticket 5.3.4 — Extract device pairing control state out of `app.tsx`

### Why
The first three device slices proved the feature is worth keeping, but they also turned device pairing into a real subsystem. Leaving device identity loading, pairing snapshot state, refresh logic, gateway-event handling, and approve/reject orchestration inside `app.tsx` would make the app root a second gravity well instead of a shell.

### Scope
- extract device pairing state and orchestration into a dedicated controller seam
- keep `SettingsModal` and `DeviceVisibilitySection` as presentation surfaces
- preserve current user-facing pairing behavior
- reduce device-specific prop sprawl from `app.tsx` into Settings

### Deliverable
A dedicated device pairing controller boundary that answers:
- “Where does device pairing state actually live?”
- “Can the shell consume the device surface without owning its runtime behavior inline?”

### Done when
- `app.tsx` no longer directly owns device identity loading, pairing snapshot state, refresh logic, and approve/reject orchestration
- the gateway lifecycle delegates pairing-specific `hello` / `close` / event reactions into the extracted boundary
- Settings receives a grouped device pairing model instead of a long list of device-specific props
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-15)

This ticket is now complete.

#### What changed
- added `src/hooks/useDevicePairingController.ts` to own:
  - local device identity loading
  - pairing snapshot state
  - pairing method support derivation
  - pending request resolve state
  - refresh and approve/reject actions
  - pairing-specific gateway `hello` / `close` / event reactions
- updated `src/app.tsx` to delegate device pairing runtime behavior to that hook instead of carrying the subsystem inline
- updated `src/components/SettingsModal.tsx` and `src/components/settings-sections/DeviceVisibilitySection.tsx` so the device surface is driven by one grouped model instead of a long device-specific prop chain

#### Architectural improvements landed
- `app.tsx` is back to shell composition for the device surface instead of also owning its state machine
- the device pairing feature now has a clear ownership boundary, which makes future device work less likely to sprawl back into the app root
- the settings surface now consumes a cohesive device-pairing model instead of a scattered set of individual state props and callbacks

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If `5.3` continues after this, the next slice should again be user-driven:
- only add another device-specific workflow if real usage proves a concrete need
- otherwise pause device work here and move on to another Milestone 1 hotspot

## Ticket B.1 — Extract the image attachment media controller from `MessageImageAttachment`

### Why
`MessageImageAttachment` has been carrying a large amount of platform-specific image behavior inline:
- desktop local-file reads
- desktop local-image scheme fallback
- remote media fallback
- generated-image retry windows
- preview decode recovery
- debug path exposure

That makes a presentation component reason directly about desktop bridges and media transport concerns, which is exactly the kind of coupling Track B is meant to reduce.

### Scope
- move image attachment load/retry/recovery state into a dedicated hook/controller seam
- keep `MessageImageAttachment` as the rendering surface
- preserve current desktop/web/generated-image behavior
- avoid changing the external attachment API

### Deliverable
A cleaner media/platform boundary that answers:
- “Where does the image attachment runtime behavior actually live?”
- “Can the view component render image state without also owning desktop/media orchestration?”

### Done when
- `MessageImageAttachment` no longer inlines the image load/retry/desktop-bridge state machine
- desktop/web/remote fallback behavior lives behind a dedicated hook/controller seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-15)

This ticket is now complete.

#### What changed
- added `src/hooks/useMessageImageAttachmentController.ts` to own:
  - local image decode attempts
  - desktop local-image fallback
  - remote media fallback
  - generated-image retry timing
  - preview decode recovery
  - image debug path visibility state
- updated `src/components/MessageImageAttachment.tsx` to become a thin rendering surface driven by the extracted controller

#### Architectural improvements landed
- the message image view no longer directly mixes platform/media runtime behavior with rendering markup
- desktop file/image logic is now easier to reason about without reading through JSX branches
- future media changes have a clearer seam that is less likely to sprawl back into the presentation component

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track B continues, the next slice should probably extract one more media/platform seam that has similar coupling pressure:
- either the shell-level remote image resolution path in `app.tsx`
- or the desktop/web image-source mapping seam in `src/lib/message-image-source.ts`

## Ticket B.2 — Extract the shell-level remote image resolver from `app.tsx`

### Why
Even after `MessageImageAttachment` moved its local runtime state behind a controller, the app root still owned the shell-level remote image transport path:
- gateway RPC media-read probing
- gateway HTTP fallback probing
- remote image response decoding into renderable data URLs
- remote image result caching

That means `app.tsx` was still reasoning directly about media transport instead of just providing a resolver boundary to the chat shell.

### Scope
- move remote image resolution and transport fallback logic into a dedicated hook/controller seam
- keep `app.tsx` responsible only for wiring gateway/client refs into that resolver
- preserve the existing RPC-first, HTTP-fallback behavior and cache semantics
- avoid changing the external `resolveRemoteImage(filePath)` contract used by image attachments

### Deliverable
A clearer media/platform boundary that answers:
- “Where does remote image transport behavior actually live?”
- “Can the app shell provide remote image resolution without inlining gateway media logic?”

### Done when
- `app.tsx` no longer inlines the remote image RPC/HTTP fallback stack
- remote image caching and transport probing live behind a dedicated hook/controller seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-15)

This ticket is now complete.

#### What changed
- added `src/hooks/useRemoteImageResolver.ts` to own:
  - remote image result caching
  - gateway RPC media-read probing
  - gateway HTTP fallback probing
  - HTTP response decoding into renderable image data URLs
- updated `src/app.tsx` to consume that hook instead of carrying the remote media transport stack inline
- removed the duplicate local `inferImageMimeTypeFromPath(...)` implementation from `app.tsx` and reused the shared media helper instead

#### Architectural improvements landed
- the app root is back closer to shell composition for remote image resolution instead of also owning the transport/runtime stack
- future remote media work now has a dedicated seam that is easier to extend without reopening `app.tsx`
- the remote image transport logic now lives alongside other media/platform hooks instead of inside a giant root component

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track B continues after this, the next most natural slice is probably the desktop/web image-source mapping seam in `src/lib/message-image-source.ts`.

## Ticket B.3 — Extract the desktop/web image-source mapping seam

### Why
Even after `MessageImageAttachment` and the shell-level remote resolver moved behind dedicated controller seams, the renderer still had one important media/platform boundary split across two places:
- `src/lib/message-image-source.ts` knew how to parse and translate attachment image sources
- `src/app.tsx` still reimplemented runtime-specific image normalization when turning raw gateway payloads into attachments

That duplication kept the attachment-building path and the image-rendering path from sharing one authoritative translation layer, which is exactly the kind of drift Track B is meant to reduce.

### Scope
- move runtime-specific image source normalization behind `src/lib/message-image-source.ts`
- update `src/app.tsx` to consume that shared image-source boundary instead of carrying its own desktop/web mapping helpers inline
- preserve current desktop local-image, web local-proxy, base64, and file-url behavior
- add focused regression coverage for the shared normalization path

### Deliverable
A clearer media/platform boundary that answers:
- “Where does attachment image-source translation actually live?”
- “Can the app shell build image attachments without reimplementing desktop/web source mapping rules?”

### Done when
- `app.tsx` no longer inlines the image-source normalization path used when building attachments
- `src/lib/message-image-source.ts` becomes the shared source of truth for runtime-specific image source translation
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-16)

This ticket is now complete.

#### What changed
- extended `src/lib/message-image-source.ts` with:
  - `toRuntimeRenderableLocalPath(...)`
  - `normalizeRuntimeImageSourceData(...)`
  - the internal desktop local-image URL and web local-proxy parsing/mapping helpers needed by that shared normalization path
- updated `src/app.tsx` to use the shared image-source normalization seam when building attachments from raw gateway image payloads
- removed the overlapping desktop/web image-source translation helpers from `src/app.tsx`
- added regression coverage in `tests/message-image-source.test.mjs` for:
  - file-URL normalization through the shared runtime mapper
  - desktop local-image URL normalization with active path-prefix mappings

#### Architectural improvements landed
- the attachment-building path and the image-rendering path now share one image-source translation boundary instead of maintaining parallel runtime mapping rules
- `app.tsx` is closer to shell/domain composition for media concerns and less of a second home for desktop/web source translation logic
- future image-path or runtime-source fixes now have one more obvious place to land before the renderer or shell need to know about them

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track B continues after this, the next natural slice is probably whichever remaining media seam still feels most coupled in real use:
- either the image lightbox/runtime behavior path in `ChatView.tsx`
- or the remaining app-side media directive / attachment extraction boundary if it still feels too shell-specific

## Ticket B.4 — Extract the image lightbox runtime behavior from `ChatView`

### Why
Even after the image attachment controller and the shared image-source mapping seam were extracted, `ChatView` still owned a small but real image-runtime subsystem for the lightbox:
- modal open/close state
- escape-key dismissal and body scroll lock
- desktop local-image scheme fallback
- lightbox read-image recovery after preview failures
- local-file blocking behavior for web runtimes

That kept media/runtime behavior mixed into one of the biggest UI components in the repo, which is exactly the sort of coupling Track B is meant to shrink.

### Scope
- move image lightbox runtime state and recovery behavior behind a dedicated hook/controller seam
- keep `ChatView` responsible for rendering the lightbox surface and wiring open/close callbacks
- preserve current desktop recovery behavior and web local-file blocking behavior
- avoid expanding the lightbox into a broader redesign or separate workflow

### Deliverable
A clearer media/platform boundary that answers:
- “Where does the lightbox runtime behavior actually live?”
- “Can `ChatView` render the image modal without also owning the desktop recovery state machine?”

### Done when
- `ChatView.tsx` no longer inlines the lightbox modal lifecycle and image-recovery behavior
- the lightbox runtime path lives behind a dedicated hook/controller seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-16)

This ticket is now complete.

#### What changed
- added `src/hooks/useImageLightboxController.ts` to own:
  - lightbox open/close state
  - escape-key dismissal
  - body scroll locking while the modal is open
  - desktop local-image fallback and read-image recovery
  - web local-file blocking state
- updated `src/components/ChatView.tsx` to consume that hook instead of carrying the lightbox runtime behavior inline

#### Architectural improvements landed
- `ChatView` is closer to a rendering/composition surface instead of also owning another media-runtime state machine
- lightbox-specific desktop recovery behavior now has a dedicated seam that can evolve without reopening the main chat component
- Track B now covers the attachment preview, remote resolver, shared image-source mapping, and lightbox runtime layers with clearer boundaries between them

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track B continues after this, the next natural slice is probably the remaining app-side media directive / attachment extraction boundary, since that is the most obvious media-specific logic still living in the app shell.

## Ticket B.5 — Extract the media directive and attachment extraction boundary from `app.tsx`

### Why
Even after the attachment controller, remote resolver, shared image-source mapper, and lightbox controller were extracted, `src/app.tsx` still owned the shell-side media shaping path:
- `MEDIA:` directive parsing
- attachment extraction from text/tool payloads
- raw image payload normalization into chat attachments
- tool-result attachment shaping while loading history and live updates

That left one of the app root’s remaining media-specific seams living inline in the shell, which is exactly the kind of coupling Track B is supposed to shrink.

### Scope
- move `MEDIA:` parsing and attachment extraction into a dedicated shared module
- rewire `app.tsx` to consume that module when shaping messages and tool attachment rows
- preserve the runtime path-hint behavior used by desktop/shared-volume image rendering
- add focused regression coverage for directive parsing and tool-result attachment shaping

### Deliverable
A clearer attachment extraction boundary that answers:
- “Where does text/tool payload media parsing actually live?”
- “Can the app root build chat messages without also owning the image attachment parsing rules?”

### Done when
- `app.tsx` no longer carries the inline `MEDIA:` and attachment extraction helpers
- the shell uses a shared attachment parsing module with the existing runtime-hint behavior preserved
- focused regression coverage exists for the extracted seam
- `make test-unit`, `make typecheck`, and `make build` pass

### Implementation notes (2026-04-16)

This ticket is now complete.

#### What changed
- added `src/lib/chat-message-attachments.ts` to own:
  - `MEDIA:` directive parsing and cleanup
  - attachment signature/dedupe helpers
  - raw payload-to-`ChatMessage` attachment shaping
  - runtime-aware attachment resolution using the shared image-source boundary
- updated `src/app.tsx` to consume that shared module for:
  - history message parsing
  - assistant attachment projection
  - tool-result attachment message construction
- added focused coverage in `tests/chat-message-attachments.test.mjs`

#### Architectural improvements landed
- `app.tsx` no longer inlines a second media parsing/shaping subsystem beside the rest of the chat shell
- Track B now has a clearer boundary for “payload becomes attachment-bearing chat message” separate from both the renderer component layer and the remote transport layer
- attachment shaping now shares the same runtime hint and image-source rules regardless of whether it comes from history, tool output, or assistant reply payloads

#### Validation status
- `make test-unit` passes
- `make typecheck` passes
- `make build` passes

#### Recommended next step
If Track B continues after this, the next natural slice is probably a smaller follow-through or test-driven polish pass rather than another obvious architecture extraction, because the largest media/runtime seams have now been pulled out of the main shell surfaces.
