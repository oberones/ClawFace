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
- slash-command logic is more isolated
- streaming behavior is cleaner and more stable
- the app feels more dependable in the core chat shell

That is the bar for leaving Phase 1 and moving confidently into media-heavy and tool-visibility slices.
