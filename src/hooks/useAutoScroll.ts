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
  const [visibleMessageCount, setVisibleMessageCount] = useState(options.messageRenderStep);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const olderLoadRequestedRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled || !options.showToolActivity) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [options.orderedTools, autoScrollEnabled, options.showToolActivity]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled) {
      return;
    }
    if (options.lastMessageRole === "assistant" && !options.autoScrollAssistantResponses) {
      return;
    }
    if (options.streamText && !options.autoScrollAssistantResponses) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [
    visibleMessageCount,
    options.lastMessageRole,
    options.streamText,
    options.thinking,
    autoScrollEnabled,
    options.autoScrollAssistantResponses,
  ]);

  const onScroll = useCallback<React.UIEventHandler<HTMLDivElement>>((event) => {
    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    const nearBottom = distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    setAutoScrollEnabled((previous) => (nearBottom !== previous ? nearBottom : previous));

    if (container.scrollTop > 80) {
      return;
    }
    if (visibleMessageCount < options.messageCount) {
      restoreScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
      setVisibleMessageCount((prev) => Math.min(options.messageCount, prev + options.messageRenderStep));
      return;
    }
    if (options.canLoadOlder && !options.loadingOlder && !olderLoadRequestedRef.current) {
      olderLoadRequestedRef.current = true;
      options.onLoadOlder();
    }
  }, [options, visibleMessageCount]);

  useEffect(() => {
    if (options.messageCount < visibleMessageCount) {
      setVisibleMessageCount(Math.max(options.messageRenderStep, options.messageCount));
    }
  }, [options.messageCount, options.messageRenderStep, visibleMessageCount]);

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
    if (options.loadingOlder) {
      return;
    }
    olderLoadRequestedRef.current = false;
  }, [options.loadingOlder]);

  const resetAutoScrollState = useCallback(() => {
    setVisibleMessageCount(options.messageRenderStep);
    setAutoScrollEnabled(true);
    restoreScrollRef.current = null;
    olderLoadRequestedRef.current = false;
  }, [options.messageRenderStep]);

  return {
    scrollRef,
    visibleMessageCount,
    autoScrollEnabled,
    onScroll,
    resetAutoScrollState,
  };
}
