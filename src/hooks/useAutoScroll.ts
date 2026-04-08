import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ToolItem } from "../lib/types.ts";

const AUTO_SCROLL_BOTTOM_THRESHOLD = 10;

type UseAutoScrollOptions = {
  messageCount: number;
  lastMessageRole: string | null;
  orderedTools: ToolItem[];
  streamText: string | null;
  thinking: boolean;
  canLoadOlder: boolean;
  loadingOlder: boolean;
  showToolActivity: boolean;
  autoScrollAssistantResponses: boolean;
  messageRenderStep: number;
  onLoadOlder: () => void;
};

export function useAutoScroll(options: UseAutoScrollOptions) {
  const {
    messageCount,
    lastMessageRole,
    orderedTools,
    streamText,
    thinking,
    canLoadOlder,
    loadingOlder,
    showToolActivity,
    autoScrollAssistantResponses,
    messageRenderStep,
    onLoadOlder,
  } = options;

  const [visibleMessageCount, setVisibleMessageCount] = useState(messageRenderStep);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const olderLoadRequestedRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled || !showToolActivity) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [orderedTools, autoScrollEnabled, showToolActivity]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled) {
      return;
    }
    if (lastMessageRole === "assistant" && !autoScrollAssistantResponses) {
      return;
    }
    if (streamText && !autoScrollAssistantResponses) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [
    visibleMessageCount,
    lastMessageRole,
    streamText,
    thinking,
    autoScrollEnabled,
    autoScrollAssistantResponses,
  ]);

  const onScroll = useCallback<React.UIEventHandler<HTMLDivElement>>((event) => {
    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    const nearBottom = distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    setAutoScrollEnabled((previous) => (nearBottom !== previous ? nearBottom : previous));

    if (container.scrollTop > 80) {
      return;
    }
    if (visibleMessageCount < messageCount) {
      restoreScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
      setVisibleMessageCount((prev) => Math.min(messageCount, prev + messageRenderStep));
      return;
    }
    if (canLoadOlder && !loadingOlder && !olderLoadRequestedRef.current) {
      olderLoadRequestedRef.current = true;
      onLoadOlder();
    }
  }, [canLoadOlder, loadingOlder, messageCount, messageRenderStep, onLoadOlder, visibleMessageCount]);

  useEffect(() => {
    if (messageCount < visibleMessageCount) {
      setVisibleMessageCount(Math.max(messageRenderStep, messageCount));
    }
  }, [messageCount, messageRenderStep, visibleMessageCount]);

  useEffect(() => {
    const pending = restoreScrollRef.current;
    const container = scrollRef.current;
    if (!pending || !container) {
      return;
    }
    const delta = container.scrollHeight - pending.height;
    container.scrollTop = pending.top + delta;
    restoreScrollRef.current = null;
  }, [visibleMessageCount]);

  useEffect(() => {
    if (loadingOlder) {
      return;
    }
    olderLoadRequestedRef.current = false;
  }, [loadingOlder]);

  const resetAutoScrollState = useCallback(() => {
    setVisibleMessageCount(messageRenderStep);
    setAutoScrollEnabled(true);
    restoreScrollRef.current = null;
    olderLoadRequestedRef.current = false;
  }, [messageRenderStep]);

  return {
    scrollRef,
    visibleMessageCount,
    autoScrollEnabled,
    onScroll,
    resetAutoScrollState,
  };
}
