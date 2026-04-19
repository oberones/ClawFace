# App State Domains

This note defines the current Phase 1 app-state domains for ClawFace.

The goal is not to claim the store architecture is finished. The goal is to answer, plainly:

- where does this state live today?
- which existing hook/controller already owns part of it?
- what future boundary should it move toward?

This is the first concrete Track C artifact.

---

## Domain map

### 1. Connection domain

Primary responsibility:
- gateway configuration
- connection lifecycle
- server capability snapshot
- reconnect/recovery shell notices

Current owner:
- `src/app.tsx`

Current state and refs:
- `gatewayConfig`
- `fsServerUrl`
- `connectionState`
- `serverInfo`
- `maxPayloadBytes`
- `connectionRecoveryNotice`
- `clientRef`
- `connectionStatusRef`
- `hasConnectedOnceRef`
- `gatewayMethodsRef`

Existing adjacent seams:
- `src/lib/gateway.ts` owns raw transport behavior
- `src/lib/connection-feedback.ts` owns shared connection/recovery copy mapping
- `src/lib/connection-recovery.ts` owns reconnect notice and interrupted-run helpers

Future boundary:
- `connectionStore`

Notes:
- connection state is already more explicit than it used to be, but ownership still lives in the app root rather than a dedicated domain module
- gateway method discovery currently sits here because other domains key off advertised capabilities

---

### 2. Session domain

Primary responsibility:
- selected session
- session catalog and previews
- session defaults
- session pagination and deletion state

Current owner:
- `src/app.tsx`

Current state and refs:
- `sessionState`
- `sessionPreviews`
- `allSessionRows`
- `sessionDefaults`
- `sessionActivity`
- `sessionListLimit`
- `canLoadMoreSessions`
- `deletingSessionKeys`
- `selectedSessionRef`
- `sessionsRef`
- `sessionPreviewFetchSeqRef`
- `sessionPreviewKeysSignatureRef`
- `historyLimitBySessionRef`
- `historyCanLoadMoreBySessionRef`

Existing adjacent seams:
- `src/components/SessionSidebar.tsx` is the main session surface
- `Ticket 1.1.5` already introduced a first-pass explicit `SessionState` shape in `src/lib/types.ts`

Future boundary:
- `sessionStore`

Notes:
- selected-session ownership is clearer than it was before the earlier 1.1 work, but the wider session catalog/pagination/cache behavior is still app-root owned
- session matching helpers remain important because some gateway payloads still vary in how they surface session identity

---

### 3. Thread domain

Primary responsibility:
- message list for the selected session
- active streaming text/run state
- thread history loading and cache
- interrupted-run visibility for the selected session

Current owner:
- `src/app.tsx`

Current state and refs:
- `messages`
- `streamText`
- `chatRunId`
- `thinking`
- `canLoadMoreHistory`
- `loadingOlderHistory`
- `connectionRecoveryNotice`
- `interruptedRunsBySession`
- `visibleInterruptedRunsBySession`
- `pendingStreamTextRef`
- `streamFlushRafRef`
- `messagesRef`
- `chatRunRef`
- `thinkingRef`
- `streamTextRef`
- `sessionCacheRef`
- `historyLoadInFlightRef`
- `loadingSessionKeyRef`

Existing adjacent seams:
- `src/components/ChatView.tsx` renders the shell/thread surface
- `src/components/ChatThread.tsx`, `src/components/MessageRow.tsx`, and related Track A/B hooks now own more of the presentation/runtime detail than they used to
- `src/hooks/useThreadToolController.ts` now owns the active thread/tool runtime state cluster inside the app shell
- `src/lib/thread-tool-event-routing.ts` now owns the active-vs-cached chat/agent event routing decision that used to be duplicated inline in `src/app.tsx`

Future boundary:
- `threadStore`

Notes:
- this is still the most overloaded state domain in the app root
- if Track C continues with a concrete extraction, this is the strongest candidate alongside tool state

---

### 4. Composer/input domain

Primary responsibility:
- draft text
- staged attachments
- current send/runtime input knobs

Current owner:
- split between `src/app.tsx` and dedicated hooks/components

Current state and refs:
- `draft`
- `thinkingLevel`
- `sessionModelOverrides`
- `sessionThinkingOverrides`
- `newSessionPreferredModel`
- `useStagedAttachments()` owns staged file/image attachment lifecycle
- composer-local slash-command interaction lives below the app root in `Composer` + `useSlashCommands`

Existing adjacent seams:
- `src/hooks/useStagedAttachments.ts`
- `src/components/Composer.tsx`
- `src/hooks/useSlashCommands.ts`
- `src/lib/runtime-control-state.ts`
- `src/lib/runtime-controls.ts`

Future boundary:
- `composerStore`

Notes:
- the staged attachment lifecycle is already in better shape because it has its own hook
- draft text and runtime override ownership are still app-owned, which is fine for now but should remain explicit

---

### 5. Tool domain

Primary responsibility:
- live tool timeline state
- tool result/failure attachment follow-through
- assistant reply/media projection tied to tool runs
- approval requests that are scoped to runs/sessions

Current owner:
- `src/app.tsx`

Current state and refs:
- `toolItems`
- `pendingApprovalsBySession`
- `resolvingApprovalIds`
- `toolItemsRef`
- `agentFinalizeTimerByRunRef`
- `finalizedAssistantByRunRef`
- `assistantReplyByRunRef`
- `committedAssistantAttachmentByRunRef`
- `scheduledHistoryHydrationByRunRef`

Existing adjacent seams:
- `src/lib/tool-final-messages.ts`
- `src/lib/final-assistant-message.ts`
- `src/lib/media-hydration.ts`
- `src/lib/approval-events.ts`
- `src/lib/session-run-routing.ts`
- `src/hooks/useThreadToolController.ts` now owns the active live tool/thread runtime state, even though higher-level event orchestration still lives in `src/app.tsx`
- `src/lib/thread-tool-event-routing.ts` now owns the first event-level dispatch seam for deciding whether chat/agent events should update the active thread or a cached background session

Future boundary:
- `toolStore`

Notes:
- this is the second strongest Track C candidate after thread state
- a lot of the risky branching has already been extracted into pure helpers, which makes a future store/controller cut much safer than it would have been earlier

---

### 6. UI domain

Primary responsibility:
- shell panes/modals
- transient shell visibility and chrome behavior

Current owner:
- `src/app.tsx`

Current state:
- `sidebarCollapsed`
- `activeView`
- `showSettings`
- `showNewSession`

Future boundary:
- `uiStore`

Notes:
- this domain is comparatively simple right now
- it should stay lightweight and not absorb settings persistence or thread/tool data

---

### 7. Settings domain

Primary responsibility:
- persisted user preferences
- schemes, shortcuts, and media/path settings

Current owner:
- `src/app.tsx` plus `src/components/SettingsModal.tsx`

Current state:
- `uiSettings`
- `pathPrefixMappingsText`
- `uiSettingsSchemes`
- `activeUiSettingsSchemeId`
- `modelShortcutSchemes`
- `agentSessionShortcutSchemes`
- `appActionShortcuts`

Existing adjacent seams:
- the `4.3` extraction work already moved most rendering concerns out of `SettingsModal.tsx`

Future boundary:
- `settingsStore`

Notes:
- this domain is structurally much healthier than it used to be on the view side
- persistence and ownership still live in the app shell, which is acceptable for now as long as that ownership stays explicit

---

## Specialized controller seams already outside the app root

These do not replace the main domains above, but they matter because they already own meaningful slices of state and behavior:

- `useStagedAttachments`
  Owns staged attachment lifecycle inside the composer/input domain.

- `useRemoteImageResolver`
  Owns remote image transport/retrieval behavior used by the thread/media path.

- `useDevicePairingController`
  Owns device pairing visibility and actions; this is effectively a specialized device subdomain.

- `useMessageImageAttachmentController`
  Owns attachment preview load/retry behavior inside the media/view layer.

- `useImageLightboxController`
  Owns lightbox runtime behavior for image viewing.

These seams are good examples of the direction Track C should keep taking: explicit ownership, narrower boundaries, and less giant-component state.

---

## Recommended next Track C move

If this work continues immediately, the strongest next state-ownership slice is:

- pause and reassess whether the next clean boundary is now Track D normalization rather than another blind Track C extraction

Why:
- connection and session state already have clearer first-pass shapes
- the active thread/tool runtime state, the active-vs-cached event routing decision, and the cached-vs-active branch orchestration now all have dedicated seams:
  - `useThreadToolController`
  - `thread-tool-event-routing`
  - `useThreadToolEventController`
- the remaining density is less about state ownership and more about raw gateway payload shaping still living in `src/app.tsx`

If work continues immediately, the cleanest next seam is likely:
- normalize raw chat and agent payloads into a domain-event boundary (Track D)

That Track D seam now also exists:
- `src/lib/thread-tool-domain-events.ts` owns raw thread/tool chat/agent payload shaping
- `src/app.tsx` now normalizes thread/tool gateway payloads there before delegating into the existing controller seams

The next Track D seam now also exists:
- `src/lib/shell-gateway-events.ts` owns approval and device-pairing gateway event normalization for the shell-facing path
- `src/app.tsx` now consumes normalized shell event kinds for those families instead of parsing approval/device payloads inline
- `useDevicePairingController` now consumes normalized device-pairing events instead of raw event names/payloads

The next Track D shell-state seam now also exists:
- `src/lib/shell-gateway-state.ts` owns gateway hello normalization, gateway close normalization, and shared status snapshot extraction
- `src/app.tsx` now consumes normalized hello/close state instead of parsing those payloads inline
- `src/lib/status-background-visibility.ts` now reuses the shared status snapshot seam instead of keeping a second copy of status-root parsing logic

The next Track D response seam now also exists:
- `src/lib/shell-gateway-responses.ts` owns shell-facing response normalization for agents/models/sessions/session previews
- `src/app.tsx` now consumes normalized catalog/session response helpers instead of relying on optimistic result casts in those loaders

The next Track D config seam now also exists:
- `src/lib/shell-gateway-config.ts` owns shell-facing `config.get` normalization for configured model keys, runtime path hints, provider auth labels, queue mode, and heartbeat-session overrides
- `src/app.tsx` now consumes normalized config state instead of keeping its own parallel config-root scanners for those shell-facing behaviors

If work continues from here, the next density is more likely to be the remaining shell-facing history response shaping rather than another state-ownership extraction inside that same subsystem.
