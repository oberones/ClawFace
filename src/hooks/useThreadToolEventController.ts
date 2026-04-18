import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  resolveAgentEventDispatch,
  resolveChatEventDispatch,
  type ThreadToolEventSessionMatcher,
  type ThreadToolEventSessionResolver,
} from "../lib/thread-tool-event-routing.ts";
import {
  resolveActiveThreadToolRunSync,
  resolveThreadToolDeltaOutcome,
  resolveThreadToolFinalOutcome,
  resolveThreadToolLifecycleOutcome,
} from "../lib/thread-tool-event-outcomes.ts";
import {
  extractToolUpdatesFromMessage,
  mergeAssistantReplyMessageCandidate,
  type NormalizedAgentEvent,
  type NormalizedChatEvent as ThreadToolNormalizedChatEvent,
  type ToolUpdate as ThreadToolEventToolUpdate,
} from "../lib/thread-tool-domain-events.ts";
import { extractText, isToolMessage } from "../lib/message-extract.ts";
import type {
  Attachment,
  ChatMessage,
  SessionActivityState,
  ToolItem,
} from "../lib/types.ts";
import type { ThreadToolStateSnapshot } from "../lib/thread-tool-state.ts";

type ThreadToolSessionCacheState = ThreadToolStateSnapshot & {
  draft: string;
  attachments: Attachment[];
  lastLoadedAt: number;
};

type AssistantReplyProjection = {
  runId: string;
  assistantReply: Record<string, unknown>;
  attachmentMessage: ChatMessage;
  attachmentSignature: string;
};

type UseThreadToolEventControllerParams = {
  chatRunRef: MutableRefObject<string | null>;
  thinkingRef: MutableRefObject<boolean>;
  streamTextRef: MutableRefObject<string | null>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setChatRunId: Dispatch<SetStateAction<string | null>>;
  setThinking: Dispatch<SetStateAction<boolean>>;
  setToolItems: Dispatch<SetStateAction<ToolItem[]>>;
  mergeStreamTextSynced: (
    incoming: string,
    mergeText: (previous: string | null, incoming: string) => string,
  ) => void;
  reloadActiveSessionHistory: () => Promise<void>;
  resolveSessionKeyFromCache: ThreadToolEventSessionResolver;
  sessionKeysMatch: ThreadToolEventSessionMatcher;
  updateCacheField: (
    key: string,
    updater: (cached: ThreadToolSessionCacheState) => ThreadToolSessionCacheState,
  ) => void;
  getCachedStreamText: (key: string) => string;
  getCachedChatRunId: (key: string) => string | null;
  updateSessionActivity: (key: string, update: Partial<SessionActivityState>) => void;
  clearAgentFinalizeTimer: (runId: string | null | undefined) => void;
  getAssistantReplyForRun: (runId: string | null | undefined) => Record<string, unknown> | null;
  applySessionTokenStatsFromMessage: (rawMessage: unknown, sessionKeyHint?: string | null) => void;
  clearRunAssistantProjectionState: (
    runId: string | null | undefined,
    options?: { clearScheduledHydration?: boolean },
  ) => void;
  clearCachedStreamingState: (key: string) => void;
  clearActiveRunTransientState: (
    runId: string | null | undefined,
    options?: { clearScheduledHydration?: boolean },
  ) => void;
  updateActiveSessionRunActivity: (params: { working: boolean; unread?: boolean }) => void;
  applyFinalizedRunHydrationDecision: (
    runId: string | null | undefined,
    decision: "clear" | "schedule",
  ) => void;
  scheduleActiveHistoryHydration: (runId: string | null | undefined) => void;
  hasCommittedAssistantAttachmentForRun: (runId: string | null | undefined) => boolean;
  runHasExpectedMediaForRun: (
    runId: string | null | undefined,
    options?: { toolUpdates?: ThreadToolEventToolUpdate[] | null },
  ) => boolean;
  shouldSkipAssistantFinal: (runId: string | null | undefined, text: string) => boolean;
  refreshSessionListsSoon: () => void;
  notifyReplyCompleted: () => void;
  attachLifecycleErrorToCachedTools: (
    sessionKey: string,
    params: { runId?: string | null; errorMessage?: string | null },
  ) => void;
  attachLifecycleErrorToActiveTools: (params: {
    runId?: string | null;
    errorMessage?: string | null;
  }) => void;
  scheduleAgentFinalizeFallback: (params: {
    sessionKey?: string | null;
    runId: string | null | undefined;
    phase: "end" | "error";
    errorMessage?: string | null;
  }) => void;
  clearInterruptedRunSnapshotForRun: (
    sessionKey: string | null | undefined,
    runId: string | null | undefined,
  ) => void;
  pushSystemMessage: (text: string) => void;
  buildStreamCommittedAssistantMessage: (streamedText: string) => ChatMessage | null;
  buildToolAttachmentMessage: (rawMessage: unknown) => ChatMessage | null;
  buildAttachmentMessagesFromToolUpdates: (
    updates: ThreadToolEventToolUpdate[],
  ) => ChatMessage[];
  collectToolFinalMessages: (params: {
    committedStreamMessage: ChatMessage | null;
    includeCommittedStreamMessage: boolean;
    toolAttachmentMessage: ChatMessage | null;
    toolAttachmentMessagesFromUpdates: ChatMessage[];
  }) => ChatMessage[];
  buildFinalAssistantMessage: (
    rawMessage: unknown,
    streamedText: string,
    runId?: string | null,
  ) => ChatMessage | null;
  upsertAssistantMessageForRun: (
    messages: ChatMessage[],
    runId: string | null | undefined,
    prepared: ChatMessage | null | undefined,
  ) => ChatMessage[];
  appendDistinctMessages: (
    messages: ChatMessage[],
    additions: Array<ChatMessage | null | undefined>,
  ) => ChatMessage[];
  mergeToolItems: (prev: ToolItem[], updates: ThreadToolEventToolUpdate[]) => ToolItem[];
  buildAssistantReplyAttachmentProjection: (
    assistantReply: unknown,
    runId: string | null,
  ) => AssistantReplyProjection | null;
  commitAssistantReplyAttachmentProjection: (
    projection: AssistantReplyProjection | null,
    commitAttachmentMessage: (params: { runId: string; attachmentMessage: ChatMessage }) => void,
  ) => void;
  mergeStreamingText: (previous: string | null, incoming: string) => string;
  resolveActiveFinalAssistantEvent: (params: {
    message: Pick<ChatMessage, "text" | "attachments"> | null;
    hasCommittedAttachment: boolean;
    expectsMedia: boolean;
    shouldSkipText: boolean;
  }) =>
    | { kind: "schedule-history-hydration" }
    | {
      kind: "final-assistant-message";
      shouldCommitMessage: boolean;
      hydrationDecision: "clear" | "schedule";
    };
};

export function useThreadToolEventController(params: UseThreadToolEventControllerParams) {
  const handleCachedFinalChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    payload: unknown,
    targetKey: string,
  ) => {
    params.clearAgentFinalizeTimer(parsed.runId);
    const pendingAssistantReply = params.getAssistantReplyForRun(parsed.runId);
    const toolUpdates = extractToolUpdatesFromMessage(parsed.message, undefined, parsed.runId);
    if (toolUpdates.length > 0) {
      params.updateCacheField(targetKey, (cached) => ({
        ...cached,
        toolItems: params.mergeToolItems(cached.toolItems, toolUpdates),
      }));
    }
    params.applySessionTokenStatsFromMessage(parsed.message, parsed.sessionKey);
    params.applySessionTokenStatsFromMessage(payload, parsed.sessionKey);
    const isToolFinal = isToolMessage(parsed.message);
    const cachedStreamText = params.getCachedStreamText(targetKey).trim();
    const committedStreamMessage = params.buildStreamCommittedAssistantMessage(cachedStreamText);
    const toolAttachmentMessage = isToolFinal ? params.buildToolAttachmentMessage(parsed.message) : null;
    const toolAttachmentMessagesFromUpdates = isToolFinal
      ? params.buildAttachmentMessagesFromToolUpdates(toolUpdates)
      : [];
    const cachedToolFinalMessages = params.collectToolFinalMessages({
      committedStreamMessage,
      includeCommittedStreamMessage: true,
      toolAttachmentMessage,
      toolAttachmentMessagesFromUpdates,
    });
    const finalOutcome = resolveThreadToolFinalOutcome({
      isToolFinal,
      hasCommittedStreamMessage: Boolean(committedStreamMessage),
      toolFinalMessageCount: cachedToolFinalMessages.length,
    });

    if (finalOutcome.kind === "tool-final-with-committed-stream" ||
      finalOutcome.kind === "tool-final-with-attachments") {
      params.updateCacheField(targetKey, (cached) => ({
        ...cached,
        messages: params.appendDistinctMessages(cached.messages, cachedToolFinalMessages),
        streamText: null,
      }));
      params.clearRunAssistantProjectionState(parsed.runId);
      params.updateSessionActivity(targetKey, { working: true });
      return;
    }

    const msg = params.buildFinalAssistantMessage(
      mergeAssistantReplyMessageCandidate(parsed.message, pendingAssistantReply),
      cachedStreamText,
      parsed.runId,
    );
    if (msg) {
      params.updateCacheField(targetKey, (cached) => ({
        ...cached,
        messages: params.upsertAssistantMessageForRun(cached.messages, parsed.runId, msg),
        streamText: null,
        chatRunId: null,
        thinking: false,
      }));
      params.updateSessionActivity(targetKey, { working: false, unread: true });
    }
    params.clearRunAssistantProjectionState(parsed.runId);
    params.refreshSessionListsSoon();
  }, [params]);

  const handleCachedTerminalChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    targetKey: string,
  ) => {
    params.clearAgentFinalizeTimer(parsed.runId);
    params.clearRunAssistantProjectionState(parsed.runId);
    params.clearCachedStreamingState(targetKey);
    if (parsed.state === "error") {
      params.attachLifecycleErrorToCachedTools(targetKey, {
        runId: parsed.runId,
        errorMessage: parsed.errorMessage,
      });
      params.updateSessionActivity(targetKey, { working: false, unread: true });
      return;
    }
    params.updateSessionActivity(targetKey, { working: false });
  }, [params]);

  const handleActiveFinalChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    payload: unknown,
    activeSessionKey: string | null,
  ) => {
    params.clearAgentFinalizeTimer(parsed.runId);
    params.clearInterruptedRunSnapshotForRun(activeSessionKey, parsed.runId);

    const runSync = resolveActiveThreadToolRunSync({
      activeRunId: params.chatRunRef.current,
      incomingRunId: parsed.runId,
      thinking: params.thinkingRef.current,
      onMismatchWithoutThinking: "reload-history",
    });
    if (runSync.kind === "reload-history") {
      void params.reloadActiveSessionHistory();
      return;
    }
    if (runSync.kind === "switch-run") {
      params.chatRunRef.current = runSync.runId;
      params.setChatRunId(runSync.runId);
    }

    const activeRunAfterSync = params.chatRunRef.current;
    if (activeRunAfterSync && parsed.runId && parsed.runId !== activeRunAfterSync) {
      void params.reloadActiveSessionHistory();
      return;
    }

    const pendingAssistantReply = params.getAssistantReplyForRun(parsed.runId);
    const toolUpdates = extractToolUpdatesFromMessage(parsed.message, undefined, parsed.runId);
    if (toolUpdates.length > 0) {
      params.setToolItems((prev) => params.mergeToolItems(prev, toolUpdates));
    }
    params.applySessionTokenStatsFromMessage(parsed.message, parsed.sessionKey);
    params.applySessionTokenStatsFromMessage(payload, parsed.sessionKey);

    const isToolFinal = isToolMessage(parsed.message);
    const streamedText = (params.streamTextRef.current ?? "").trim();
    const committedStreamMessage = params.buildStreamCommittedAssistantMessage(streamedText);
    const toolAttachmentMessage = isToolFinal ? params.buildToolAttachmentMessage(parsed.message) : null;
    const toolAttachmentMessagesFromUpdates = isToolFinal
      ? params.buildAttachmentMessagesFromToolUpdates(toolUpdates)
      : [];
    const activeToolFinalMessages = params.collectToolFinalMessages({
      committedStreamMessage,
      includeCommittedStreamMessage:
        Boolean(committedStreamMessage) &&
        !params.shouldSkipAssistantFinal(parsed.runId, committedStreamMessage?.text ?? ""),
      toolAttachmentMessage,
      toolAttachmentMessagesFromUpdates,
    });
    const finalOutcome = resolveThreadToolFinalOutcome({
      isToolFinal,
      hasCommittedStreamMessage: Boolean(committedStreamMessage),
      toolFinalMessageCount: activeToolFinalMessages.length,
    });

    if (finalOutcome.kind === "tool-final-with-committed-stream") {
      const hydrationDecision = params.resolveActiveFinalAssistantEvent({
        message: committedStreamMessage,
        hasCommittedAttachment: params.hasCommittedAssistantAttachmentForRun(parsed.runId),
        expectsMedia: params.runHasExpectedMediaForRun(parsed.runId, { toolUpdates }),
        shouldSkipText:
          committedStreamMessage?.text.trim()
            ? params.shouldSkipAssistantFinal(parsed.runId, committedStreamMessage.text)
            : true,
      });
      if (activeToolFinalMessages.length > 0) {
        params.setMessages((prev) => params.appendDistinctMessages(prev, activeToolFinalMessages));
      }
      if (hydrationDecision.kind === "final-assistant-message") {
        params.applyFinalizedRunHydrationDecision(parsed.runId, hydrationDecision.hydrationDecision);
      }
      params.clearActiveRunTransientState(parsed.runId);
      params.updateActiveSessionRunActivity({ working: true, unread: false });
      return;
    }

    if (finalOutcome.kind === "tool-final-with-attachments") {
      params.setMessages((prev) => params.appendDistinctMessages(prev, activeToolFinalMessages));
      params.clearActiveRunTransientState(parsed.runId);
      params.updateActiveSessionRunActivity({ working: true, unread: false });
      return;
    }

    const msg = params.buildFinalAssistantMessage(
      mergeAssistantReplyMessageCandidate(parsed.message, pendingAssistantReply),
      streamedText,
      parsed.runId,
    );
    const activeFinalAssistantResolution = params.resolveActiveFinalAssistantEvent({
      message: msg,
      hasCommittedAttachment: params.hasCommittedAssistantAttachmentForRun(parsed.runId),
      expectsMedia: params.runHasExpectedMediaForRun(parsed.runId, { toolUpdates }),
      shouldSkipText: msg?.text.trim()
        ? params.shouldSkipAssistantFinal(parsed.runId, msg.text)
        : true,
    });
    if (activeFinalAssistantResolution.kind === "final-assistant-message") {
      if (activeFinalAssistantResolution.shouldCommitMessage) {
        params.setMessages((prev) => params.upsertAssistantMessageForRun(prev, parsed.runId, msg));
        params.notifyReplyCompleted();
      }
      params.applyFinalizedRunHydrationDecision(
        parsed.runId,
        activeFinalAssistantResolution.hydrationDecision,
      );
    } else {
      params.scheduleActiveHistoryHydration(parsed.runId);
    }
    params.clearActiveRunTransientState(parsed.runId);
    params.updateActiveSessionRunActivity({ working: false, unread: false });
    params.refreshSessionListsSoon();
  }, [params]);

  const handleActiveTerminalChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    activeSessionKey: string | null,
  ) => {
    params.clearAgentFinalizeTimer(parsed.runId);
    params.clearInterruptedRunSnapshotForRun(activeSessionKey, parsed.runId);
    params.clearActiveRunTransientState(parsed.runId, { clearScheduledHydration: true });
    if (parsed.state === "error") {
      params.attachLifecycleErrorToActiveTools({
        runId: parsed.runId,
        errorMessage: parsed.errorMessage,
      });
      if (parsed.errorMessage) {
        params.pushSystemMessage(`Error: ${parsed.errorMessage}`);
      }
    }
    params.updateActiveSessionRunActivity({ working: false, unread: false });
  }, [params]);

  const handleCachedAgentToolUpdates = useCallback((
    targetKey: string,
    runId: string | null,
    updates: ThreadToolEventToolUpdate[],
  ) => {
    if (updates.length === 0) {
      return;
    }
    const toolAttachmentMessagesFromUpdates = params.buildAttachmentMessagesFromToolUpdates(updates);
    params.updateCacheField(targetKey, (cached) => ({
      ...cached,
      toolItems: params.mergeToolItems(cached.toolItems, updates),
      messages: params.appendDistinctMessages(cached.messages, toolAttachmentMessagesFromUpdates),
      chatRunId: runId ?? cached.chatRunId,
    }));
    params.updateSessionActivity(targetKey, { working: true });
  }, [params]);

  const handleCachedAgentAssistantEvent = useCallback((
    assistantReply: unknown,
    assistantText: string | null,
    targetKey: string,
    runId: string | null,
  ) => {
    params.commitAssistantReplyAttachmentProjection(
      params.buildAssistantReplyAttachmentProjection(assistantReply, runId),
      ({ runId: projectedRunId, attachmentMessage }) => {
        params.updateCacheField(targetKey, (cached) => ({
          ...cached,
          messages: params.upsertAssistantMessageForRun(
            cached.messages,
            projectedRunId,
            attachmentMessage,
          ),
        }));
      },
    );
    const cachedChatRunId = params.getCachedChatRunId(targetKey);
    if (cachedChatRunId && (!runId || runId === cachedChatRunId)) {
      return;
    }
    const next = assistantText;
    if (!next) {
      return;
    }
    params.updateCacheField(targetKey, (cached) => ({
      ...cached,
      streamText: params.mergeStreamingText(cached.streamText, next),
      thinking: false,
      chatRunId: runId ?? cached.chatRunId,
    }));
    params.updateSessionActivity(targetKey, { working: true });
  }, [params]);

  const handleCachedAgentLifecycleEvent = useCallback((
    targetKey: string,
    runId: string | null,
    lifecyclePhase: NormalizedAgentEvent["lifecyclePhase"],
    lifecycleErrorMessage: string | null,
  ) => {
    const phase = resolveThreadToolLifecycleOutcome(
      lifecyclePhase,
    );
    if (phase === "ignore") {
      return;
    }
    params.clearAgentFinalizeTimer(runId);
    if (phase === "error") {
      params.attachLifecycleErrorToCachedTools(targetKey, {
        runId,
        errorMessage: lifecycleErrorMessage,
      });
      params.updateSessionActivity(targetKey, { working: false, unread: true });
      return;
    }
    params.updateSessionActivity(targetKey, { working: false });
  }, [params]);

  const handleActiveAgentToolUpdates = useCallback((
    updates: ThreadToolEventToolUpdate[],
    activeSessionKey: string | null,
  ) => {
    if (updates.length === 0) {
      return;
    }
    for (const update of updates) {
      params.clearInterruptedRunSnapshotForRun(activeSessionKey, update.runId);
    }
    const toolAttachmentMessagesFromUpdates = params.buildAttachmentMessagesFromToolUpdates(updates);
    params.setToolItems((prev) => params.mergeToolItems(prev, updates));
    if (toolAttachmentMessagesFromUpdates.length > 0) {
      params.setMessages((prev) => params.appendDistinctMessages(prev, toolAttachmentMessagesFromUpdates));
    }
    params.updateActiveSessionRunActivity({ working: true, unread: false });
  }, [params]);

  const handleActiveAgentAssistantEvent = useCallback((
    assistantReply: unknown,
    assistantText: string | null,
    runId: string | null,
    activeSessionKey: string | null,
  ) => {
    params.clearInterruptedRunSnapshotForRun(activeSessionKey, runId);
    params.commitAssistantReplyAttachmentProjection(
      params.buildAssistantReplyAttachmentProjection(assistantReply, runId),
      ({ runId: projectedRunId, attachmentMessage }) => {
        params.setMessages((prev) => params.upsertAssistantMessageForRun(prev, projectedRunId, attachmentMessage));
      },
    );
    const activeRun = params.chatRunRef.current;
    if (activeRun && (!runId || runId === activeRun)) {
      return;
    }
    const next = assistantText;
    if (!next) {
      return;
    }
    const runSync = resolveActiveThreadToolRunSync({
      activeRunId: params.chatRunRef.current,
      incomingRunId: runId,
      thinking: params.thinkingRef.current,
      onMismatchWithoutThinking: "continue",
    });
    if (runSync.kind === "ignore") {
      return;
    }
    if (runSync.kind === "switch-run") {
      params.chatRunRef.current = runSync.runId;
      params.setChatRunId(runSync.runId);
    }
    params.mergeStreamTextSynced(next, params.mergeStreamingText);
    params.setThinking(false);
    params.updateActiveSessionRunActivity({ working: true, unread: false });
  }, [params]);

  const handleActiveAgentLifecycleEvent = useCallback((
    activeSessionKey: string | null,
    runId: string | null,
    lifecyclePhase: NormalizedAgentEvent["lifecyclePhase"],
    lifecycleErrorMessage: string | null,
  ) => {
    params.clearInterruptedRunSnapshotForRun(activeSessionKey, runId);
    const phase = resolveThreadToolLifecycleOutcome(
      lifecyclePhase,
    );
    if (phase === "ignore") {
      return;
    }
    if (phase === "error") {
      params.attachLifecycleErrorToActiveTools({ runId, errorMessage: lifecycleErrorMessage });
    }
    params.updateActiveSessionRunActivity({ working: false, unread: false });
    params.scheduleAgentFinalizeFallback({
      sessionKey: activeSessionKey,
      runId,
      phase,
      errorMessage: lifecycleErrorMessage,
    });
  }, [params]);

  const handleCachedDeltaChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    targetKey: string,
  ) => {
    const deltaToolUpdates = extractToolUpdatesFromMessage(parsed.message, undefined, parsed.runId);
    const deltaOutcome = resolveThreadToolDeltaOutcome({
      toolUpdateCount: deltaToolUpdates.length,
      isToolMessage: isToolMessage(parsed.message),
      extractedText: extractText(parsed.message),
    });
    if (deltaOutcome.kind === "tool-updates") {
      const toolAttachmentMessage = params.buildToolAttachmentMessage(parsed.message);
      const toolAttachmentMessagesFromUpdates = params.buildAttachmentMessagesFromToolUpdates(deltaToolUpdates);
      params.updateCacheField(targetKey, (cached) => ({
        ...cached,
        toolItems: params.mergeToolItems(cached.toolItems, deltaToolUpdates),
        messages: params.appendDistinctMessages(cached.messages, [
          toolAttachmentMessage,
          ...toolAttachmentMessagesFromUpdates,
        ]),
        chatRunId: parsed.runId ?? cached.chatRunId,
      }));
      params.updateSessionActivity(targetKey, { working: true });
      return;
    }
    if (deltaOutcome.kind === "assistant-text") {
      params.updateCacheField(targetKey, (cached) => ({
        ...cached,
        streamText: params.mergeStreamingText(cached.streamText, deltaOutcome.text),
        thinking: false,
        chatRunId: parsed.runId ?? cached.chatRunId,
      }));
      params.updateSessionActivity(targetKey, { working: true });
    }
  }, [params]);

  const handleActiveDeltaChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    activeSessionKey: string | null,
  ) => {
    params.clearInterruptedRunSnapshotForRun(activeSessionKey, parsed.runId);
    const runSync = resolveActiveThreadToolRunSync({
      activeRunId: params.chatRunRef.current,
      incomingRunId: parsed.runId,
      thinking: params.thinkingRef.current,
      onMismatchWithoutThinking: "ignore",
    });
    if (runSync.kind === "ignore") {
      return;
    }
    if (runSync.kind === "switch-run") {
      params.chatRunRef.current = runSync.runId;
      params.setChatRunId(runSync.runId);
    }
    const deltaToolUpdates = extractToolUpdatesFromMessage(parsed.message, undefined, parsed.runId);
    const deltaOutcome = resolveThreadToolDeltaOutcome({
      toolUpdateCount: deltaToolUpdates.length,
      isToolMessage: isToolMessage(parsed.message),
      extractedText: extractText(parsed.message),
    });
    if (deltaOutcome.kind === "tool-updates") {
      const toolAttachmentMessage = params.buildToolAttachmentMessage(parsed.message);
      const toolAttachmentMessagesFromUpdates = params.buildAttachmentMessagesFromToolUpdates(deltaToolUpdates);
      params.setToolItems((prev) => params.mergeToolItems(prev, deltaToolUpdates));
      params.setMessages((prev) => params.appendDistinctMessages(prev, [
        toolAttachmentMessage,
        ...toolAttachmentMessagesFromUpdates,
      ]));
      params.updateActiveSessionRunActivity({ working: true, unread: false });
      return;
    }
    if (deltaOutcome.kind === "assistant-text") {
      params.mergeStreamTextSynced(deltaOutcome.text, params.mergeStreamingText);
      params.setThinking(false);
      params.updateActiveSessionRunActivity({ working: true, unread: false });
    }
  }, [params]);

  const handleChatEvent = useCallback((
    parsed: ThreadToolNormalizedChatEvent,
    payload: unknown,
    activeSessionKey: string | null,
  ) => {
    const dispatch = resolveChatEventDispatch({
      state: parsed.state,
      sessionKeyHint: parsed.sessionKey,
      runId: parsed.runId,
      activeSessionKey,
      activeRunId: params.chatRunRef.current,
      resolveSessionKey: params.resolveSessionKeyFromCache,
      sessionKeysMatch: params.sessionKeysMatch,
    });

    if (dispatch.kind === "cached") {
      if (dispatch.state === "delta") {
        handleCachedDeltaChatEvent(parsed, dispatch.targetKey);
        return;
      }
      if (dispatch.state === "final") {
        handleCachedFinalChatEvent(parsed, payload, dispatch.targetKey);
        return;
      }
      handleCachedTerminalChatEvent(parsed, dispatch.targetKey);
      return;
    }

    if (dispatch.state === "delta") {
      handleActiveDeltaChatEvent(parsed, activeSessionKey);
      return;
    }
    if (dispatch.state === "final") {
      handleActiveFinalChatEvent(parsed, payload, activeSessionKey);
      return;
    }
    if (dispatch.state === "aborted" || dispatch.state === "error") {
      handleActiveTerminalChatEvent(parsed, activeSessionKey);
    }
  }, [
    handleActiveDeltaChatEvent,
    handleActiveFinalChatEvent,
    handleActiveTerminalChatEvent,
    handleCachedDeltaChatEvent,
    handleCachedFinalChatEvent,
    handleCachedTerminalChatEvent,
    params.chatRunRef,
    params.resolveSessionKeyFromCache,
    params.sessionKeysMatch,
  ]);

  const handleAgentEvent = useCallback((
    normalized: NormalizedAgentEvent,
    activeSessionKey: string | null,
  ) => {
    const dispatch = resolveAgentEventDispatch({
      sessionKeyHint: normalized.sessionKey,
      runId: normalized.runId,
      activeSessionKey,
      activeRunId: params.chatRunRef.current,
      resolveSessionKey: params.resolveSessionKeyFromCache,
      sessionKeysMatch: params.sessionKeysMatch,
    });

    if (dispatch.kind === "cached") {
      handleCachedAgentToolUpdates(dispatch.targetKey, normalized.runId, normalized.toolUpdates);
      if (normalized.stream === "assistant") {
        handleCachedAgentAssistantEvent(
          normalized.assistantReply,
          normalized.assistantText,
          dispatch.targetKey,
          normalized.runId,
        );
        return;
      }
      if (normalized.stream === "lifecycle") {
        handleCachedAgentLifecycleEvent(
          dispatch.targetKey,
          normalized.runId,
          normalized.lifecyclePhase,
          normalized.lifecycleErrorMessage,
        );
      }
      return;
    }

    handleActiveAgentToolUpdates(normalized.toolUpdates, activeSessionKey);
    if (normalized.stream === "assistant") {
      handleActiveAgentAssistantEvent(
        normalized.assistantReply,
        normalized.assistantText,
        normalized.runId,
        activeSessionKey,
      );
      return;
    }
    if (normalized.stream === "lifecycle") {
      handleActiveAgentLifecycleEvent(
        activeSessionKey,
        normalized.runId,
        normalized.lifecyclePhase,
        normalized.lifecycleErrorMessage,
      );
    }
  }, [
    handleActiveAgentAssistantEvent,
    handleActiveAgentLifecycleEvent,
    handleActiveAgentToolUpdates,
    handleCachedAgentAssistantEvent,
    handleCachedAgentLifecycleEvent,
    handleCachedAgentToolUpdates,
    params.chatRunRef,
    params.resolveSessionKeyFromCache,
    params.sessionKeysMatch,
  ]);

  return {
    handleChatEvent,
    handleAgentEvent,
  };
}
