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
- Ticket 1.1.3
- Ticket 1.1.6
- Ticket 1.3.4

## Step 6
- Ticket P1-X2
- Ticket P1-X3

This keeps discovery first, then state boundaries, then component extraction, then behavior hardening.

---

# Definition of Phase 1 done

Phase 1 is done when:
- connection state is explicitly modeled and less fragile
- selected session ownership is clearer
- session switching is more predictable
- `ChatView.tsx` has materially reduced responsibilities
- thread rendering has meaningful component boundaries
- composer logic has been extracted and clarified
- slash-command logic is more isolated
- streaming behavior is cleaner and more stable
- the app feels more dependable in the core chat shell

That is the bar for leaving Phase 1 and moving confidently into media-heavy and tool-visibility slices.
