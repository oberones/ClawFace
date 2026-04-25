import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ConnectionStatus, ToolItem } from "../lib/types.ts";
import type { AvatarFinalOutcome, AvatarState } from "../lib/avatar-state.ts";
import { deriveAvatarState } from "../lib/avatar-state.ts";

const AVATAR_FINAL_STATE_MS = 1800;

type UseAvatarStatusParams = {
  sessionKey: string | null;
  messages: ChatMessage[];
  streamText: string | null;
  thinking: boolean;
  toolItems: ToolItem[];
  connectionStatus: ConnectionStatus;
  approvalNeeded: boolean;
};

function collectMessageIds(messages: ChatMessage[]): Set<string> {
  return new Set(messages.map((message) => message.id));
}

export function collectToolOutcomeById(toolItems: ToolItem[]): Map<string, ToolItem["outcome"]> {
  return new Map(toolItems.map((tool) => [tool.id, tool.outcome]));
}

export function hasAvatarLiveActivity(params: {
  activeToolCount: number;
  streamText: string | null;
  thinking: boolean;
}): boolean {
  return params.thinking || Boolean(params.streamText) || params.activeToolCount > 0;
}

export function shouldShowTransientAssistantSuccess(params: {
  messages: ChatMessage[];
  previousMessageIds: Set<string>;
  hadLiveActivity: boolean;
  liveActivityActive: boolean;
}): boolean {
  if (!params.hadLiveActivity || params.liveActivityActive) {
    return false;
  }
  return params.messages.some(
    (message) => !params.previousMessageIds.has(message.id) && message.role === "assistant",
  );
}

export function hasKnownToolFailureTransition(
  toolItems: ToolItem[],
  previousToolOutcomes: Map<string, ToolItem["outcome"]>,
): boolean {
  return toolItems.some((tool) => {
    if (tool.outcome !== "failed") {
      return false;
    }
    const previousOutcome = previousToolOutcomes.get(tool.id);
    return previousOutcome !== undefined && previousOutcome !== "failed";
  });
}

/** Keeps avatar state selection near the shell while leaving the pure priority rules in avatar-state.ts. */
export function useAvatarStatus(params: UseAvatarStatusParams): AvatarState {
  const [finalOutcome, setFinalOutcome] = useState<AvatarFinalOutcome>("none");
  const finalResetTimerRef = useRef<number | null>(null);
  const previousMessageIdsRef = useRef<Set<string>>(collectMessageIds(params.messages));
  const previousToolOutcomesRef = useRef<Map<string, ToolItem["outcome"]>>(collectToolOutcomeById(params.toolItems));
  const liveActivitySeenRef = useRef(false);

  const setTransientFinalOutcome = useCallback((outcome: AvatarFinalOutcome) => {
    setFinalOutcome(outcome);
    if (finalResetTimerRef.current !== null) {
      window.clearTimeout(finalResetTimerRef.current);
    }
    finalResetTimerRef.current = window.setTimeout(() => {
      setFinalOutcome("none");
      finalResetTimerRef.current = null;
    }, AVATAR_FINAL_STATE_MS);
  }, []);

  useEffect(() => {
    setFinalOutcome("none");
    if (finalResetTimerRef.current !== null) {
      window.clearTimeout(finalResetTimerRef.current);
      finalResetTimerRef.current = null;
    }
    previousMessageIdsRef.current = collectMessageIds(params.messages);
    previousToolOutcomesRef.current = collectToolOutcomeById(params.toolItems);
    liveActivitySeenRef.current = hasAvatarLiveActivity({
      activeToolCount: params.toolItems.filter((tool) => tool.status !== "result").length,
      streamText: params.streamText,
      thinking: params.thinking,
    });
  }, [params.sessionKey]);

  useEffect(() => {
    const currentIds = collectMessageIds(params.messages);
    const activeToolCount = params.toolItems.filter((tool) => tool.status !== "result").length;
    const liveActivityActive = hasAvatarLiveActivity({
      activeToolCount,
      streamText: params.streamText,
      thinking: params.thinking,
    });
    if (
      shouldShowTransientAssistantSuccess({
        messages: params.messages,
        previousMessageIds: previousMessageIdsRef.current,
        hadLiveActivity: liveActivitySeenRef.current,
        liveActivityActive,
      })
    ) {
      setTransientFinalOutcome("success");
    }
    previousMessageIdsRef.current = currentIds;
    liveActivitySeenRef.current = liveActivityActive;
  }, [params.messages, params.streamText, params.thinking, params.toolItems, setTransientFinalOutcome]);

  useEffect(() => {
    const currentToolOutcomes = collectToolOutcomeById(params.toolItems);
    if (hasKnownToolFailureTransition(params.toolItems, previousToolOutcomesRef.current)) {
      setTransientFinalOutcome("error");
    }
    previousToolOutcomesRef.current = currentToolOutcomes;
  }, [params.toolItems, setTransientFinalOutcome]);

  useEffect(() => {
    return () => {
      if (finalResetTimerRef.current !== null) {
        window.clearTimeout(finalResetTimerRef.current);
      }
    };
  }, []);

  const activeToolCount = useMemo(
    () => params.toolItems.filter((tool) => tool.status !== "result").length,
    [params.toolItems],
  );

  return useMemo(
    () =>
      deriveAvatarState({
        connectionStatus: params.connectionStatus,
        approvalNeeded: params.approvalNeeded,
        activeToolCount,
        thinking: params.thinking,
        streaming: Boolean(params.streamText),
        finalOutcome,
      }),
    [
      activeToolCount,
      finalOutcome,
      params.approvalNeeded,
      params.connectionStatus,
      params.streamText,
      params.thinking,
    ],
  );
}
