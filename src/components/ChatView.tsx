import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type {
  Attachment,
  ChatMessage,
  ConnectionStatus,
  ModelListItem,
  SessionInfo,
  SessionRuntimeStatus,
  SessionTransitionState,
  ToolItem,
} from "../lib/types.ts";
import type { StagedAttachmentsState } from "../lib/staged-attachments.ts";
import { ChatThread, renderThreadStateCard } from "./ChatThread.tsx";
import { ToolActivityPanel } from "./ToolActivityPanel.tsx";
import { Composer } from "./Composer.tsx";
import { SessionRuntimeControls } from "./SessionRuntimeControls.tsx";
import { buildMotionVars, MessageRow } from "./MessageRow.tsx";
import {
  buildDesktopLocalImageUrl,
  filePathFromImageSource,
  isDesktopRuntime,
  isLikelyLocalFileSource,
} from "../lib/message-image-source.ts";
import { formatCompactTokens } from "../lib/format.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import { deriveConnectionFeedback, PAIRING_APPROVAL_COMMAND } from "../lib/connection-feedback.ts";
import type { ConnectionRecoveryNotice, InterruptedRunSessionBanner } from "../lib/connection-recovery.ts";
import { useAutoScroll } from "../hooks/useAutoScroll.ts";
import { useSlashCommands } from "../hooks/useSlashCommands.ts";
import type { UiSettings } from "../lib/ui-settings.ts";
import { createBottomPinScheduler } from "../lib/scroll-anchoring.ts";

type ChatViewProps = {
  sessionKey: string | null;
  messages: ChatMessage[];
  streamText: string | null;
  thinking: boolean;
  toolItems: ToolItem[];
  draft: string;
  onDraftChange: (value: string) => void;
  stagedAttachments: StagedAttachmentsState;
  onSend: () => void;
  onAbort: () => void;
  canAbort: boolean;
  connected: boolean;
  connectionStatus?: ConnectionStatus;
  connectionRecoveryNotice?: ConnectionRecoveryNotice | null;
  interruptedRunBanner?: InterruptedRunSessionBanner | null;
  disabledReason?: string | null;
  sessionInfo: SessionInfo;
  models: ModelListItem[];
  uiSettings: UiSettings;
  canLoadOlder: boolean;
  loadingOlder: boolean;
  isCurrentSessionLoading?: boolean;
  sessionTransitionState?: SessionTransitionState;
  onLoadOlder: () => void;
  onRefreshSession: () => void;
  onModelSelect: (model: string) => void;
  onThinkingSelect: (level: string) => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
  onResolveRemoteImage?: (filePath: string) => Promise<string | null>;
  onCompact?: () => void;
};

const MESSAGE_RENDER_STEP = 60;
const EMPTY_STRING_SET = new Set<string>();
const SESSION_SWITCH_OUT_MS = 260;
const SESSION_SWITCH_IN_MS = 800;
const STACK_LIFT_MS = 380;
const DRAWER_KICK_MS = 440;
const POP_MARK_MS = 640;
const FLY_IN_STAGGER_MS = 38;
const MAX_FLY_IN_ELEMENTS = 10;
const CHAT_BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}clawface-logo.png`;

type ThreadSnapshot = {
  sessionKey: string | null;
  hiddenMessageCount: number;
  loadingOlder: boolean;
  displayedMessages: ChatMessage[];
  toolBeforeFirst: ToolItem[];
  toolByMessageEntries: Array<[string, ToolItem[]]>;
  streamText: string | null;
  thinking: boolean;
};


export default function ChatView(props: ChatViewProps) {
  const [activeCommand, setActiveCommand] = useState(0);
  const [runtimeControlsMenuOpen, setRuntimeControlsMenuOpen] = useState(false);
  const [toolExpanded, setToolExpanded] = useState<Record<string, boolean>>({});
  const [imageLightbox, setImageLightbox] = useState<Attachment | null>(null);
  const [chatImpulseActive, setChatImpulseActive] = useState(false);
  const [composerLaunchActive, setComposerLaunchActive] = useState(false);
  const [sessionTransitionPhase, setSessionTransitionPhase] = useState<"idle" | "out" | "preparing" | "in">("idle");
  const [outgoingThreadSnapshot, setOutgoingThreadSnapshot] = useState<ThreadSnapshot | null>(null);
  const [poppingMessageIds, setPoppingMessageIds] = useState<string[]>([]);
  const [poppingToolIds, setPoppingToolIds] = useState<string[]>([]);
  const [sessionFlyInMessageIds, setSessionFlyInMessageIds] = useState<string[]>([]);
  const [sessionFlyInToolIds, setSessionFlyInToolIds] = useState<string[]>([]);
  const [sessionFlyInToolPanelKeys, setSessionFlyInToolPanelKeys] = useState<string[]>([]);
  const [sessionFlyInStream, setSessionFlyInStream] = useState(false);
  const [streamPopActive, setStreamPopActive] = useState(false);
  const lightboxReadTriedRef = useRef<Set<string>>(new Set());
  const isComposingRef = useRef(false);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mainThreadRef = useRef<HTMLDivElement | null>(null);
  const prevSessionKeyRef = useRef<string | null>(props.sessionKey);
  const prevSessionKeyForLayoutRef = useRef<string | null>(props.sessionKey);

  // Pre-paint: hide main thread AND set overlay state synchronously.
  // useLayoutEffect fires after React commits DOM but BEFORE the browser paints.
  // By setting overlay state here, React does a synchronous re-render — the overlay
  // is in the DOM before the first paint. Zero blank frames.
  useLayoutEffect(() => {
    if (prevSessionKeyForLayoutRef.current === props.sessionKey) {
      return;
    }
    prevSessionKeyForLayoutRef.current = props.sessionKey;
    if (!props.uiSettings.enableAnimations) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const mainThread = container.querySelector<HTMLElement>(".chat-thread-main");
    if (mainThread) {
      mainThread.style.visibility = "hidden";
    }
    // Set overlay state synchronously — triggers sync re-render before paint
    const previousSnapshot = latestThreadSnapshotRef.current;
    if (previousSnapshot) {
      setOutgoingThreadSnapshot(previousSnapshot);
      setSessionTransitionPhase("out");
    } else {
      // No snapshot (first visit) — skip out phase, go straight to preparing
      setSessionTransitionPhase("preparing");
    }
  }, [props.sessionKey, props.uiSettings.enableAnimations]);
  const chatImpulseResetTimerRef = useRef<number | null>(null);
  const composerLaunchResetTimerRef = useRef<number | null>(null);
  const popMessageResetTimerRef = useRef<number | null>(null);
  const popToolResetTimerRef = useRef<number | null>(null);
  const sessionFlyInResetTimerRef = useRef<number | null>(null);
  const streamPopResetTimerRef = useRef<number | null>(null);
  const chatImpulseRafRef = useRef<number | null>(null);
  const composerLaunchRafRef = useRef<number | null>(null);
  const sessionFlyInRafRefs = useRef<number[]>([]);
  const sessionSwitchTimersRef = useRef<number[]>([]);
  const streamWasActiveRef = useRef(Boolean(props.streamText));
  const prevMessageIdsRef = useRef<Set<string>>(new Set(props.messages.map((message) => message.id)));
  const prevToolIdsRef = useRef<Set<string>>(new Set(props.toolItems.map((tool) => tool.id)));
  const latestThreadSnapshotRef = useRef<ThreadSnapshot | null>(null);
  const snapshotSessionKeyRef = useRef<string | null>(props.sessionKey);

  const orderedTools = useMemo(
    () => [...props.toolItems].sort((a, b) => a.startedAt - b.startedAt),
    [props.toolItems],
  );
  const messageTailKey = useMemo(() => {
    const lastMessage = props.messages[props.messages.length - 1];
    if (!lastMessage) {
      return null;
    }
    const attachmentKey = (lastMessage.attachments ?? [])
      .map((attachment) => `${attachment.type}:${attachment.dataUrl.length}`)
      .join("|");
    return [
      lastMessage.id,
      lastMessage.role,
      String(lastMessage.timestamp),
      String(lastMessage.text.length),
      attachmentKey,
    ].join(":");
  }, [props.messages]);
  const {
    scrollRef,
    visibleMessageCount,
    autoScrollEnabled,
    onScroll,
    resetAutoScrollState,
  } = useAutoScroll({
    messageCount: props.messages.length,
    messageTailKey,
    lastMessageRole: props.messages[Math.max(0, props.messages.length - 1)]?.role ?? null,
    orderedTools,
    streamText: props.streamText,
    thinking: props.thinking,
    canLoadOlder: props.canLoadOlder,
    loadingOlder: props.loadingOlder,
    showToolActivity: props.uiSettings.showToolActivity,
    autoScrollAssistantResponses: props.uiSettings.autoScrollAssistantResponses,
    messageRenderStep: MESSAGE_RENDER_STEP,
    onLoadOlder: props.onLoadOlder,
  });

  const displayedMessages = useMemo(() => {
    const total = props.messages.length;
    const count = Math.max(0, Math.min(total, visibleMessageCount));
    return props.messages.slice(Math.max(0, total - count));
  }, [props.messages, visibleMessageCount]);

  const hiddenMessageCount = Math.max(0, props.messages.length - displayedMessages.length);

  const toolTimeline = useMemo(() => {
    const beforeFirst: ToolItem[] = [];
    const byMessageId = new Map<string, ToolItem[]>();
    if (orderedTools.length === 0) {
      return { beforeFirst, byMessageId };
    }
    if (displayedMessages.length === 0) {
      return { beforeFirst: [...orderedTools], byMessageId };
    }
    let messageIndex = -1;
    for (const tool of orderedTools) {
      while (
        messageIndex + 1 < displayedMessages.length &&
        displayedMessages[messageIndex + 1]!.timestamp <= tool.startedAt
      ) {
        messageIndex += 1;
      }
      if (messageIndex < 0) {
        beforeFirst.push(tool);
        continue;
      }
      const anchor = displayedMessages[messageIndex]!;
      const bucket = byMessageId.get(anchor.id);
      if (bucket) {
        bucket.push(tool);
      } else {
        byMessageId.set(anchor.id, [tool]);
      }
    }
    return { beforeFirst, byMessageId };
  }, [orderedTools, displayedMessages]);
  const poppingMessageIdSet = useMemo(() => new Set(poppingMessageIds), [poppingMessageIds]);
  const poppingToolIdSet = useMemo(() => new Set(poppingToolIds), [poppingToolIds]);
  const sessionFlyInMessageIdSet = useMemo(() => new Set(sessionFlyInMessageIds), [sessionFlyInMessageIds]);
  const sessionFlyInToolIdSet = useMemo(() => new Set(sessionFlyInToolIds), [sessionFlyInToolIds]);
  const sessionFlyInToolPanelKeySet = useMemo(() => new Set(sessionFlyInToolPanelKeys), [sessionFlyInToolPanelKeys]);

  useEffect(() => {
    if (snapshotSessionKeyRef.current !== props.sessionKey) {
      snapshotSessionKeyRef.current = props.sessionKey;
      return;
    }
    latestThreadSnapshotRef.current = {
      sessionKey: props.sessionKey,
      hiddenMessageCount,
      loadingOlder: props.loadingOlder,
      displayedMessages: [...displayedMessages],
      toolBeforeFirst: [...toolTimeline.beforeFirst],
      toolByMessageEntries: Array.from(toolTimeline.byMessageId.entries()).map(([messageId, tools]) => [
        messageId,
        [...tools],
      ]),
      streamText: props.streamText,
      thinking: props.thinking,
    };
  }, [
    hiddenMessageCount,
    props.loadingOlder,
    props.sessionKey,
    displayedMessages,
    toolTimeline.beforeFirst,
    toolTimeline.byMessageId,
    props.streamText,
    props.thinking,
  ]);

  const autoResizeComposer = useCallback(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) {
      return;
    }
    const computed = window.getComputedStyle(textarea);
    const parsedMinHeight = Number.parseFloat(computed.minHeight);
    const defaultHeight = Number.isFinite(parsedMinHeight) ? parsedMinHeight : 78;
    const maxHeight = Math.max(defaultHeight, Math.floor(window.innerHeight * 0.5));

    textarea.style.height = `${defaultHeight}px`;
    const contentHeight = textarea.scrollHeight;
    const nextHeight = Math.min(Math.max(contentHeight, defaultHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const triggerChatImpulse = useCallback(() => {
    if (!props.uiSettings.enableAnimations) {
      return;
    }
    if (chatImpulseResetTimerRef.current !== null) {
      return;
    }
    if (chatImpulseRafRef.current !== null) {
      window.cancelAnimationFrame(chatImpulseRafRef.current);
      chatImpulseRafRef.current = null;
    }
    setChatImpulseActive(false);
    chatImpulseRafRef.current = window.requestAnimationFrame(() => {
      chatImpulseRafRef.current = null;
      setChatImpulseActive(true);
      chatImpulseResetTimerRef.current = window.setTimeout(() => {
        setChatImpulseActive(false);
        chatImpulseResetTimerRef.current = null;
      }, STACK_LIFT_MS);
    });
  }, [props.uiSettings.enableAnimations]);

  const triggerComposerLaunch = useCallback(() => {
    if (!props.uiSettings.enableAnimations) {
      return;
    }
    if (composerLaunchResetTimerRef.current !== null) {
      window.clearTimeout(composerLaunchResetTimerRef.current);
      composerLaunchResetTimerRef.current = null;
    }
    if (composerLaunchRafRef.current !== null) {
      window.cancelAnimationFrame(composerLaunchRafRef.current);
      composerLaunchRafRef.current = null;
    }
    setComposerLaunchActive(false);
    composerLaunchRafRef.current = window.requestAnimationFrame(() => {
      composerLaunchRafRef.current = null;
      setComposerLaunchActive(true);
      composerLaunchResetTimerRef.current = window.setTimeout(() => {
        setComposerLaunchActive(false);
        composerLaunchResetTimerRef.current = null;
      }, DRAWER_KICK_MS);
    });
  }, [props.uiSettings.enableAnimations]);

  const markPoppingMessages = useCallback((ids: string[]) => {
    if (!props.uiSettings.enableAnimations || ids.length === 0) {
      return;
    }
    setPoppingMessageIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return [...next];
    });
    if (popMessageResetTimerRef.current !== null) {
      window.clearTimeout(popMessageResetTimerRef.current);
    }
    popMessageResetTimerRef.current = window.setTimeout(() => {
      setPoppingMessageIds([]);
      popMessageResetTimerRef.current = null;
    }, POP_MARK_MS);
  }, [props.uiSettings.enableAnimations]);

  const markPoppingTools = useCallback((ids: string[]) => {
    if (!props.uiSettings.enableAnimations || ids.length === 0) {
      return;
    }
    setPoppingToolIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return [...next];
    });
    if (popToolResetTimerRef.current !== null) {
      window.clearTimeout(popToolResetTimerRef.current);
    }
    popToolResetTimerRef.current = window.setTimeout(() => {
      setPoppingToolIds([]);
      popToolResetTimerRef.current = null;
    }, POP_MARK_MS);
  }, [props.uiSettings.enableAnimations]);

  const clearSessionSwitchTimers = useCallback(() => {
    if (sessionSwitchTimersRef.current.length === 0) {
      return;
    }
    for (const timer of sessionSwitchTimersRef.current) {
      window.clearTimeout(timer);
    }
    sessionSwitchTimersRef.current = [];
  }, []);

  const clearSessionFlyInMarks = useCallback(() => {
    if (sessionFlyInResetTimerRef.current !== null) {
      window.clearTimeout(sessionFlyInResetTimerRef.current);
      sessionFlyInResetTimerRef.current = null;
    }
    if (sessionFlyInRafRefs.current.length > 0) {
      for (const rafId of sessionFlyInRafRefs.current) {
        window.cancelAnimationFrame(rafId);
      }
      sessionFlyInRafRefs.current = [];
    }
    setSessionFlyInMessageIds([]);
    setSessionFlyInToolIds([]);
    setSessionFlyInToolPanelKeys([]);
    setSessionFlyInStream(false);
  }, []);

  const triggerVisibleSessionFlyIn = useCallback((onReady?: () => void) => {
    if (!props.uiSettings.enableAnimations) {
      // Still need to clear visibility:hidden from useLayoutEffect
      const container = scrollRef.current;
      const mainThread = container?.querySelector<HTMLElement>(".chat-thread-main");
      if (mainThread) {
        mainThread.style.visibility = "";
      }
      onReady?.();
      return;
    }
    clearSessionFlyInMarks();
    // Single RAF — React has committed the DOM with new session content by now
    const raf = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) {
        onReady?.();
        return;
      }
      const mainThread = container.querySelector<HTMLElement>(".chat-thread-main");
      if (!mainThread) {
        onReady?.();
        return;
      }
      // Ensure scroll is at the bottom before measuring visibility.
      // loadHistory may have replaced messages since the initial scroll,
      // changing scrollHeight while scrollTop stayed stale.
      container.scrollTop = container.scrollHeight;

      const viewport = container.getBoundingClientRect();
      const messageIds = new Set<string>();
      const toolIds = new Set<string>();
      const toolPanelKeys = new Set<string>();
      const isVisible = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > viewport.top + 2 && rect.top < viewport.bottom - 2;
      };

      // Collect visible elements with position for stagger
      const visibleEls: Array<{ el: HTMLElement; bottom: number }> = [];

      mainThread.querySelectorAll<HTMLElement>(".message-row[data-message-id]").forEach((el) => {
        if (!isVisible(el)) {
          return;
        }
        const id = el.dataset.messageId;
        if (id) {
          messageIds.add(id);
          visibleEls.push({ el, bottom: el.getBoundingClientRect().bottom });
        }
      });
      mainThread.querySelectorAll<HTMLElement>(".tool-panel[data-tool-panel-key]").forEach((el) => {
        if (!isVisible(el)) {
          return;
        }
        const key = el.dataset.toolPanelKey;
        if (key) {
          toolPanelKeys.add(key);
          // Tool panels fade in independently (no stagger, no translateY).
          // Don't add to visibleEls — children handle the waterfall.
        }
      });
      mainThread.querySelectorAll<HTMLElement>(".tool-entry[data-tool-id]").forEach((el) => {
        if (!isVisible(el)) {
          return;
        }
        const id = el.dataset.toolId;
        if (id) {
          toolIds.add(id);
          visibleEls.push({ el, bottom: el.getBoundingClientRect().bottom });
        }
      });
      const streamRow = mainThread.querySelector<HTMLElement>(".message-row[data-stream-row='1']");
      const streamVisible = Boolean(streamRow && isVisible(streamRow));
      if (streamRow && streamVisible) {
        visibleEls.push({ el: streamRow, bottom: streamRow.getBoundingClientRect().bottom });
      }

      // Sort bottom-first (closest to drawer animates first).
      // All visible elements get animation; stagger is capped at MAX_FLY_IN_ELEMENTS
      // so elements beyond the cap animate simultaneously at the maximum stagger delay.
      visibleEls.sort((a, b) => b.bottom - a.bottom);
      visibleEls.forEach((item, index) => {
        const stagger = Math.min(index, MAX_FLY_IN_ELEMENTS) * FLY_IN_STAGGER_MS;
        item.el.style.setProperty("--pop-stagger", `${stagger}ms`);
      });

      // flushSync forces React to commit state + re-render synchronously,
      // so animation classes are in the DOM BEFORE we reveal the thread.
      // Without this, there's a flash: visibility="" runs while React state
      // is still batched → elements appear at full opacity for one frame
      // before animation classes apply opacity:0.
      flushSync(() => {
        setSessionFlyInMessageIds([...messageIds]);
        setSessionFlyInToolIds([...toolIds]);
        setSessionFlyInToolPanelKeys([...toolPanelKeys]);
        setSessionFlyInStream(streamVisible);
      });

      // Now animation classes are committed — reveal the thread.
      // Animated elements start at opacity:0 (animation 0%), non-animated appear instantly.
      mainThread.style.visibility = "";
      onReady?.();

      // Cleanup after all animations finish
      const maxStagger = Math.min(visibleEls.length, MAX_FLY_IN_ELEMENTS + 1) * FLY_IN_STAGGER_MS;
      sessionFlyInResetTimerRef.current = window.setTimeout(() => {
        setSessionFlyInMessageIds([]);
        setSessionFlyInToolIds([]);
        setSessionFlyInToolPanelKeys([]);
        setSessionFlyInStream(false);
        visibleEls.forEach((item) => {
          item.el.style.removeProperty("--pop-stagger");
        });
        sessionFlyInResetTimerRef.current = null;
      }, SESSION_SWITCH_IN_MS + maxStagger + 100);
    });
    sessionFlyInRafRefs.current.push(raf);
  }, [clearSessionFlyInMarks, props.uiSettings.enableAnimations]);

  const sendWithPhysics = useCallback(() => {
    if (props.connected) {
      triggerChatImpulse();
      triggerComposerLaunch();
    }
    props.onSend();
  }, [props.connected, props.onSend, triggerChatImpulse, triggerComposerLaunch]);

  useEffect(() => {
    if (prevSessionKeyRef.current === props.sessionKey) {
      return;
    }
    clearSessionSwitchTimers();

    const previousSnapshot = latestThreadSnapshotRef.current;
    const hasAnimations = props.uiSettings.enableAnimations;

    if (hasAnimations) {
      // Overlay + phase already set in useLayoutEffect (before paint).
      // Here we only set up timers.
      if (previousSnapshot) {
        // OUT → PREPARING → IN
        const outTimer = window.setTimeout(() => {
          setOutgoingThreadSnapshot(null);
          setSessionTransitionPhase("preparing");
          triggerVisibleSessionFlyIn(() => {
            setSessionTransitionPhase("in");
            triggerComposerLaunch();
            const inTimer = window.setTimeout(() => {
              setSessionTransitionPhase("idle");
              const ct = scrollRef.current;
              const mt = ct?.querySelector<HTMLElement>(".chat-thread-main");
              if (mt) mt.style.visibility = "";
            }, SESSION_SWITCH_IN_MS);
            sessionSwitchTimersRef.current.push(inTimer);
          });
        }, SESSION_SWITCH_OUT_MS);
        sessionSwitchTimersRef.current.push(outTimer);
      } else {
        // No snapshot (first visit to session) — skip OUT, fly in immediately
        triggerVisibleSessionFlyIn(() => {
          setSessionTransitionPhase("in");
          triggerComposerLaunch();
          const inTimer = window.setTimeout(() => {
            setSessionTransitionPhase("idle");
            const ct = scrollRef.current;
            const mt = ct?.querySelector<HTMLElement>(".chat-thread-main");
            if (mt) mt.style.visibility = "";
          }, SESSION_SWITCH_IN_MS);
          sessionSwitchTimersRef.current.push(inTimer);
        });
      }
    } else {
      setOutgoingThreadSnapshot(null);
      setSessionTransitionPhase("idle");
      const ct = scrollRef.current;
      const mt = ct?.querySelector<HTMLElement>(".chat-thread-main");
      if (mt) mt.style.visibility = "";
    }

    prevSessionKeyRef.current = props.sessionKey;
    setToolExpanded({});
    resetAutoScrollState();
    setImageLightbox(null);
    setRuntimeControlsMenuOpen(false);
    setChatImpulseActive(false);
    setComposerLaunchActive(false);
    setPoppingMessageIds([]);
    setPoppingToolIds([]);
    setStreamPopActive(false);
    clearSessionFlyInMarks();
    prevMessageIdsRef.current = new Set(props.messages.map((message) => message.id));
    prevToolIdsRef.current = new Set(props.toolItems.map((tool) => tool.id));

    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [
    props.sessionKey,
    props.uiSettings.enableAnimations,
    props.messages,
    props.toolItems,
    clearSessionSwitchTimers,
    clearSessionFlyInMarks,
    triggerComposerLaunch,
    triggerVisibleSessionFlyIn,
  ]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const thread = mainThreadRef.current;
    if (!container || !thread || !autoScrollEnabled || typeof ResizeObserver === "undefined") {
      return;
    }
    const bottomPinScheduler = createBottomPinScheduler({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (handle) => window.cancelAnimationFrame(handle),
      shouldPin: () => Boolean(scrollRef.current) && autoScrollEnabled,
      pinToBottom: () => {
        if (!scrollRef.current) {
          return;
        }
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      },
    });
    const observer = new ResizeObserver(() => {
      bottomPinScheduler.schedule();
    });
    observer.observe(thread);
    return () => {
      observer.disconnect();
      bottomPinScheduler.dispose();
    };
  }, [autoScrollEnabled, props.sessionKey, scrollRef]);


  useEffect(() => {
    if (sessionTransitionPhase !== "idle") {
      streamWasActiveRef.current = Boolean(props.streamText);
      return;
    }
    const isStreaming = Boolean(props.streamText);
    if (isStreaming && !streamWasActiveRef.current) {
      triggerChatImpulse();
      if (props.uiSettings.enableAnimations) {
        setStreamPopActive(true);
        if (streamPopResetTimerRef.current !== null) {
          window.clearTimeout(streamPopResetTimerRef.current);
        }
        streamPopResetTimerRef.current = window.setTimeout(() => {
          setStreamPopActive(false);
          streamPopResetTimerRef.current = null;
        }, POP_MARK_MS);
      }
    }
    if (!isStreaming) {
      setStreamPopActive(false);
    }
    streamWasActiveRef.current = isStreaming;
  }, [props.streamText, props.uiSettings.enableAnimations, triggerChatImpulse, sessionTransitionPhase]);

  useEffect(() => {
    const currentIds = props.messages.map((message) => message.id);
    if (sessionTransitionPhase !== "idle") {
      prevMessageIdsRef.current = new Set(currentIds);
      return;
    }
    const previousIds = prevMessageIdsRef.current;
    const addedIds = currentIds.filter((id) => !previousIds.has(id));
    if (addedIds.length > 0) {
      markPoppingMessages(addedIds);
      triggerChatImpulse();
    }
    prevMessageIdsRef.current = new Set(currentIds);
  }, [props.messages, sessionTransitionPhase, markPoppingMessages, triggerChatImpulse]);

  useEffect(() => {
    const currentIds = props.toolItems.map((tool) => tool.id);
    if (sessionTransitionPhase !== "idle") {
      prevToolIdsRef.current = new Set(currentIds);
      return;
    }
    const previousIds = prevToolIdsRef.current;
    const addedIds = currentIds.filter((id) => !previousIds.has(id));
    if (addedIds.length > 0) {
      markPoppingTools(addedIds);
      triggerChatImpulse();
    }
    prevToolIdsRef.current = new Set(currentIds);
  }, [props.toolItems, sessionTransitionPhase, markPoppingTools, triggerChatImpulse]);

  useEffect(() => {
    return () => {
      clearSessionSwitchTimers();
      clearSessionFlyInMarks();
      if (chatImpulseResetTimerRef.current !== null) {
        window.clearTimeout(chatImpulseResetTimerRef.current);
      }
      if (composerLaunchResetTimerRef.current !== null) {
        window.clearTimeout(composerLaunchResetTimerRef.current);
      }
      if (popMessageResetTimerRef.current !== null) {
        window.clearTimeout(popMessageResetTimerRef.current);
      }
      if (popToolResetTimerRef.current !== null) {
        window.clearTimeout(popToolResetTimerRef.current);
      }
      if (sessionFlyInResetTimerRef.current !== null) {
        window.clearTimeout(sessionFlyInResetTimerRef.current);
      }
      if (streamPopResetTimerRef.current !== null) {
        window.clearTimeout(streamPopResetTimerRef.current);
      }
      if (chatImpulseRafRef.current !== null) {
        window.cancelAnimationFrame(chatImpulseRafRef.current);
      }
      if (composerLaunchRafRef.current !== null) {
        window.cancelAnimationFrame(composerLaunchRafRef.current);
      }
    };
  }, [clearSessionFlyInMarks, clearSessionSwitchTimers]);

  useEffect(() => {
    if (!imageLightbox) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImageLightbox(null);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [imageLightbox]);

  useEffect(() => {
    if (!imageLightbox) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [imageLightbox]);

  const onLightboxImageError = useCallback(() => {
    if (!imageLightbox) {
      return;
    }
    const filePath = filePathFromImageSource(imageLightbox.sourcePath ?? imageLightbox.dataUrl);
    if (isDesktopRuntime() && filePath) {
      const nextDesktopSrc = buildDesktopLocalImageUrl(filePath);
      if (nextDesktopSrc !== imageLightbox.dataUrl) {
        setImageLightbox((previous) => {
          if (!previous || previous.id !== imageLightbox.id) {
            return previous;
          }
          return {
            ...previous,
            dataUrl: nextDesktopSrc,
          };
        });
        return;
      }
    }
    const attemptedKey = imageLightbox.dataUrl;
    if (!attemptedKey || lightboxReadTriedRef.current.has(attemptedKey)) {
      return;
    }
    lightboxReadTriedRef.current.add(attemptedKey);
    const readImageFile = window.desktopInfo?.readImageFile;
    if (!readImageFile) {
      return;
    }
    if (!filePath) {
      return;
    }
    void readImageFile(filePath)
      .then((result) => {
        const nextDataUrl =
          result.ok && typeof result.dataUrl === "string" ? result.dataUrl.trim() : "";
        if (!nextDataUrl) {
          return;
        }
        setImageLightbox((previous) => {
          if (!previous || previous.id !== imageLightbox.id) {
            return previous;
          }
          lightboxReadTriedRef.current.add(nextDataUrl);
          return {
            ...previous,
            dataUrl: nextDataUrl,
          };
        });
      })
      .catch(() => {
        // ignore
      });
  }, [imageLightbox]);

  useEffect(() => {
    if (!imageLightbox) {
      return;
    }
    if (!isDesktopRuntime()) {
      return;
    }
    const filePath = filePathFromImageSource(imageLightbox.sourcePath ?? imageLightbox.dataUrl);
    if (filePath) {
      const nextDesktopSrc = buildDesktopLocalImageUrl(filePath);
      if (nextDesktopSrc !== imageLightbox.dataUrl) {
        setImageLightbox((previous) => {
          if (!previous || previous.id !== imageLightbox.id) {
            return previous;
          }
          return {
            ...previous,
            dataUrl: nextDesktopSrc,
          };
        });
      }
      return;
    }
  }, [imageLightbox]);
  const lightboxBlockedByWebLocalFile = useMemo(() => {
    if (!imageLightbox) {
      return false;
    }
    return !isDesktopRuntime() && isLikelyLocalFileSource(imageLightbox.dataUrl);
  }, [imageLightbox]);


  const actionScale = props.uiSettings.composerActionScale;
  const actionFontSize = `${Math.round(12 * actionScale)}px`;
  const actionPaddingY = `${Math.round(8 * actionScale)}px`;
  const actionPaddingX = `${Math.round(12 * actionScale)}px`;
  const sendFontSize = `${Math.round(14 * actionScale)}px`;
  const sendPaddingY = `${Math.round(8 * actionScale)}px`;
  const sendPaddingX = `${Math.round(20 * actionScale)}px`;
  const modelBadgeScale = props.uiSettings.modelBadgeScale;
  const toolFontSize = `${props.uiSettings.toolCallFontSize}px`;
  const toolMinorFontSize = `${Math.max(10, props.uiSettings.toolCallFontSize - 2)}px`;
  const typographyFontSize = `${props.uiSettings.fontSize}px`;


  useLayoutEffect(() => {
    autoResizeComposer();
  }, [props.draft, autoResizeComposer]);

  useEffect(() => {
    window.addEventListener("resize", autoResizeComposer);
    return () => window.removeEventListener("resize", autoResizeComposer);
  }, [autoResizeComposer]);

  const {
    showSlashMenu,
    commandName,
    commandArgs,
    commandSuggestions,
    requiresArgs,
    exactCommand,
    applySuggestion,
    moveSelection,
    applyActiveSuggestion,
  } = useSlashCommands({
    draft: props.draft,
    models: props.models,
    onDraftChange: props.onDraftChange,
  });

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    const nativeEvent = event.nativeEvent as KeyboardEvent;
    const keyCode = (nativeEvent as KeyboardEvent & { keyCode?: number }).keyCode;
    if (
      nativeEvent.isComposing ||
      isComposingRef.current ||
      event.key === "Process" ||
      keyCode === 229
    ) {
      return;
    }
    if (
      showSlashMenu &&
      commandSuggestions.length > 0 &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      moveSelection(delta);
      return;
    }
    if (showSlashMenu && event.key === "Tab" && commandSuggestions.length > 0) {
      event.preventDefault();
      if (applyActiveSuggestion()) {
        return;
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (showSlashMenu && commandSuggestions.length > 0 && commandName && !commandArgs) {
        if (exactCommand && !requiresArgs) {
          sendWithPhysics();
          return;
        }
        if (applyActiveSuggestion()) {
          return;
        }
        return;
      }
      if (showSlashMenu && exactCommand && !requiresArgs) {
        sendWithPhysics();
        return;
      }
      if (showSlashMenu && requiresArgs && !commandArgs) {
        return;
      }
      sendWithPhysics();
    }
  };

  const scrollToMessage = useCallback((direction: "up" | "down") => {
    const container = scrollRef.current;
    if (!container) return;
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>(".chat-thread-main .message-row[data-message-id], .chat-thread-main .message-row[data-stream-row]"),
    );
    if (rows.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    // Threshold in pixels: if a message top is within this distance of the container top, consider it "current"
    const threshold = 2;

    if (direction === "up") {
      // Find the message to scroll to:
      // If current scroll position is in the middle/bottom of a message, scroll to its top.
      // Otherwise scroll to the previous message's top.
      let target: HTMLElement | null = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i]!;
        const rowTop = row.getBoundingClientRect().top - containerRect.top + scrollTop;
        if (rowTop < scrollTop - threshold) {
          target = row;
          break;
        }
      }
      if (target) {
        const targetTop = target.getBoundingClientRect().top - containerRect.top + scrollTop;
        container.scrollTo({ top: targetTop, behavior: "smooth" });
      } else {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      // Find the next message whose top is below the current scroll position
      let target: HTMLElement | null = null;
      for (const row of rows) {
        const rowTop = row.getBoundingClientRect().top - containerRect.top + scrollTop;
        if (rowTop > scrollTop + threshold) {
          target = row;
          break;
        }
      }
      if (target) {
        const targetTop = target.getBoundingClientRect().top - containerRect.top + scrollTop;
        container.scrollTo({ top: targetTop, behavior: "smooth" });
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, []);

  const streamMarkdownHtml = useMemo(
    () => (props.streamText ? renderMarkdown(props.streamText) : ""),
    [props.streamText],
  );
  const streamMotionStyle = useMemo(
    () => buildMotionVars(`stream-${props.sessionKey ?? "none"}`),
    [props.sessionKey],
  );

  const renderToolPanel = (tools: ToolItem[], key: string, opts?: { snapshot?: boolean }) => {
    if (tools.length === 0) {
      return null;
    }
    const snapshotMode = opts?.snapshot ?? false;
    const panelFlyIn = !snapshotMode && sessionFlyInToolPanelKeySet.has(key);
    const panelMotionStyle = buildMotionVars(key);
    return (
      <ToolActivityPanel
        key={key}
        tools={tools}
        panelKey={key}
        panelFlyIn={panelFlyIn}
        panelMotionStyle={panelMotionStyle}
        toolFontSize={toolFontSize}
        toolMinorFontSize={toolMinorFontSize}
        expandedById={toolExpanded}
        poppingToolIdSet={snapshotMode ? EMPTY_STRING_SET : poppingToolIdSet}
        sessionFlyInToolIdSet={snapshotMode ? EMPTY_STRING_SET : sessionFlyInToolIdSet}
        buildMotionVars={buildMotionVars}
        onToggleExpanded={(toolId, nextExpanded) => {
          setToolExpanded((prev) => ({ ...prev, [toolId]: nextExpanded }));
        }}
        snapshotMode={snapshotMode}
      />
    );
  };

  const outgoingToolTimelineByMessage = useMemo(
    () => new Map(outgoingThreadSnapshot?.toolByMessageEntries ?? []),
    [outgoingThreadSnapshot],
  );
  const imageGenerationPending =
    props.thinking || Boolean(props.streamText) || props.canAbort || props.toolItems.some((item) => item.status !== "result");

  const connectionStatus = props.connectionStatus ?? (props.connected ? "connected" : "disconnected");
  const isSessionSwitching = props.sessionTransitionState === "switching";
  const hasRenderableThreadContent = displayedMessages.length > 0 || Boolean(props.streamText) || props.thinking;
  const threadState = hasRenderableThreadContent
    ? { kind: "ready" as const }
    : isSessionSwitching
      ? {
          kind: "loading" as const,
          title: "Switching Sessions",
          copy: "Preparing the selected session and restoring its thread context.",
        }
      : props.isCurrentSessionLoading
        ? {
            kind: "loading" as const,
            title: "Loading Session",
            copy: "Loading the current session history and thread state.",
          }
        : props.sessionKey
          ? {
              kind: "empty" as const,
              title: "No Messages Yet",
              copy: "This session is ready, but nothing has been sent yet. Type a message or use a /command.",
              showHints: true,
            }
          : {
              kind: "empty" as const,
              title: "New Conversation",
              copy: "Type a message to get started, or use a /command.",
              showHints: true,
            };
  const composerRuntimeState = !props.connected
    ? "offline"
    : props.canAbort || props.thinking
      ? "busy"
      : "ready";
  const connectionFeedback = useMemo(
    () =>
      deriveConnectionFeedback({
        connectionStatus,
        hasActiveSession: Boolean(props.sessionKey),
        disabledReason: props.disabledReason,
        composerRuntimeState,
        interruptedRunBanner: props.interruptedRunBanner,
      }),
    [connectionStatus, props.disabledReason, composerRuntimeState, props.interruptedRunBanner, props.sessionKey],
  );

  const handleCopyPairingCommand = useCallback(() => {
    void navigator.clipboard?.writeText(PAIRING_APPROVAL_COMMAND);
  }, []);

  const currentSessionRuntime = useMemo<{
    status: SessionRuntimeStatus;
    label: string;
    detail: string;
    tone: "neutral" | "active" | "warning";
  }>(() => {
    if (connectionFeedback.approvalBanner) {
      return {
        status: "disconnected",
        label: connectionFeedback.approvalBanner.title,
        detail: connectionFeedback.approvalBanner.message,
        tone: "warning",
      };
    }
    if (connectionFeedback.sessionBanner) {
      return {
        status: connectionStatus === "connecting" ? "reconnecting" : "disconnected",
        label: connectionFeedback.sessionBanner.title,
        detail: connectionFeedback.sessionBanner.message,
        tone: connectionFeedback.sessionBanner.tone === "info" ? "neutral" : "warning",
      };
    }
    if (isSessionSwitching) {
      return {
        status: "switching",
        label: "Switching session",
        detail: "Restoring the selected conversation and thread state.",
        tone: "neutral",
      };
    }
    if (props.isCurrentSessionLoading) {
      return {
        status: "loading",
        label: "Loading session",
        detail: "Fetching history and rebuilding the current thread.",
        tone: "neutral",
      };
    }
    if (props.streamText) {
      return {
        status: "streaming",
        label: "Streaming reply",
        detail: "The assistant is actively streaming output into this session.",
        tone: "active",
      };
    }
    if (props.thinking) {
      return {
        status: "thinking",
        label: "Thinking",
        detail: "The assistant is working before it starts streaming a reply.",
        tone: "active",
      };
    }
    if (props.canAbort || props.toolItems.some((item) => item.status !== "result")) {
      return {
        status: "working",
        label: "Working",
        detail: "This session still has active runtime work in progress.",
        tone: "active",
      };
    }
    return {
      status: "idle",
      label: "Idle",
      detail: props.sessionKey
        ? "This session is connected and ready for the next action."
        : "Create or select a session to start working.",
      tone: "neutral",
    };
  }, [
    connectionFeedback.approvalBanner,
    connectionFeedback.sessionBanner,
    connectionStatus,
    isSessionSwitching,
    props.canAbort,
    props.isCurrentSessionLoading,
    props.sessionKey,
    props.streamText,
    props.thinking,
    props.toolItems,
  ]);

  const sendDisabled = composerRuntimeState !== "ready";
  const sendLabel = composerRuntimeState === "busy" ? "Busy" : "Send";

  return (
    <section className="claw-chat-area chat-shell">
      <header className={`chat-header ${runtimeControlsMenuOpen ? "menu-layer-active" : ""}`}>
        <div className="chat-header-main">
          <div className="chat-header-identity">
            <div className="chat-brand-lockup">
              <img className="chat-brand-mark" src={CHAT_BRAND_LOGO_SRC} alt="ClawFace logo" />
              <div className="chat-brand-copy">
                <div className="chat-brand-title">ClawFace</div>
                <div className="chat-brand-subtitle">OpenClaw control surface · v{__APP_VERSION__}</div>
              </div>
            </div>
            <div
              className={`session-runtime-pill${currentSessionRuntime.tone === "active" ? " is-active" : currentSessionRuntime.tone === "warning" ? " is-warning" : ""}`}
              title={currentSessionRuntime.detail}
              aria-label={`Current session status: ${currentSessionRuntime.label}. ${currentSessionRuntime.detail}`}
            >
              <span className={`session-runtime-dot is-${currentSessionRuntime.status}`} />
              <span className="session-runtime-copy">
                <span className="session-runtime-label">{currentSessionRuntime.label}</span>
                <span className="session-runtime-detail">{currentSessionRuntime.detail}</span>
              </span>
            </div>
          </div>
          <div className="topbar-status">
            <span className={`status-dot ${connectionFeedback.statusDotClass}`} />
            <span>{connectionFeedback.statusLabel}</span>
          </div>
        </div>

        <div className="chat-header-actions">
          <SessionRuntimeControls
            sessionKey={props.sessionKey}
            sessionInfo={props.sessionInfo}
            models={props.models}
            modelBadgeScale={modelBadgeScale}
            onModelSelect={props.onModelSelect}
            onThinkingSelect={props.onThinkingSelect}
            onMenuOpenChange={setRuntimeControlsMenuOpen}
          />

          {props.canAbort && (
            <button type="button" onClick={props.onAbort} className="ui-btn ui-btn-light" style={{ color: "#b45309" }}>
              &#9632; Stop
            </button>
          )}
          <button type="button" onClick={props.onCreateSession} className="ui-btn ui-btn-light">
            New Session
          </button>
          <button type="button" onClick={props.onOpenSettings} className="ui-btn ui-btn-primary">
            Settings
          </button>
        </div>
      </header>

      {connectionFeedback.approvalBanner && (
        <div className="session-recovery-banner approval-needed-banner is-warning">
          <div className="session-recovery-banner-copy">
            <div className="session-recovery-banner-title">{connectionFeedback.approvalBanner.title}</div>
            <div className="session-recovery-banner-detail">{connectionFeedback.approvalBanner.message}</div>
          </div>
          {connectionFeedback.approvalBanner.action === "copy-pairing-command" && (
            <button
              type="button"
              className="ui-btn ui-btn-light session-recovery-banner-action"
              onClick={handleCopyPairingCommand}
            >
              Copy Command
            </button>
          )}
        </div>
      )}

      {connectionFeedback.sessionBanner && (
        <div
          className={`session-recovery-banner${connectionFeedback.sessionBanner.tone === "info" ? " is-info" : " is-warning"}`}
        >
          <div className="session-recovery-banner-copy">
            <div className="session-recovery-banner-title">{connectionFeedback.sessionBanner.title}</div>
            <div className="session-recovery-banner-detail">{connectionFeedback.sessionBanner.message}</div>
          </div>
          {connectionFeedback.sessionBanner.action === "open-settings" && (
            <button
              type="button"
              className="ui-btn ui-btn-light session-recovery-banner-action"
              onClick={props.onOpenSettings}
            >
              Open Settings
            </button>
          )}
          {connectionFeedback.sessionBanner.action === "refresh-session" && (
            <button
              type="button"
              className="ui-btn ui-btn-light session-recovery-banner-action"
              onClick={props.onRefreshSession}
            >
              Refresh Now
            </button>
          )}
        </div>
      )}

      {props.connectionRecoveryNotice && (
        <div
          className={`session-recovery-flash${props.connectionRecoveryNotice.tone === "success" ? " is-success" : " is-info"}`}
          role="status"
          aria-live="polite"
        >
          <div className="session-recovery-flash-title">{props.connectionRecoveryNotice.title}</div>
          <div className="session-recovery-flash-detail">{props.connectionRecoveryNotice.message}</div>
        </div>
      )}

      <div className="chat-scroll-wrap">
      <div ref={scrollRef} onScroll={onScroll} className="chat-scroll">
        {outgoingThreadSnapshot && sessionTransitionPhase === "out" && (
          <div className="chat-thread-overlay" aria-hidden="true">
            <div
              key={`outgoing-${outgoingThreadSnapshot.sessionKey ?? "none"}`}
              className="chat-thread chat-thread-outgoing"
              style={{ maxWidth: "var(--claw-content-width)", gap: "var(--claw-message-gap)" }}
            >
              {(outgoingThreadSnapshot.hiddenMessageCount > 0 || outgoingThreadSnapshot.loadingOlder) && (
                <div className="history-hint">
                  {outgoingThreadSnapshot.loadingOlder
                    ? "Loading older messages..."
                    : `${outgoingThreadSnapshot.hiddenMessageCount} older messages available. Scroll up to load.`}
                </div>
              )}

              {outgoingThreadSnapshot.displayedMessages.length === 0 && renderThreadStateCard({
                kind: "empty",
                title: "No Messages Yet",
                copy: "This session is ready, but nothing has been sent yet.",
              })}

              {props.uiSettings.showToolActivity &&
                renderToolPanel(outgoingThreadSnapshot.toolBeforeFirst, "snapshot-tool-before-first", { snapshot: true })}

              {outgoingThreadSnapshot.displayedMessages.map((msg) => (
                <React.Fragment key={`snapshot-${msg.id}`}>
                  <MessageRow
                    message={msg}
                    showTimestamp={props.uiSettings.showMessageTimestamp}
                    timestampFontSize={props.uiSettings.messageTimestampFontSize}
                    drawerPop={false}
                    onOpenImage={setImageLightbox}
                    onResolveRemoteImage={props.onResolveRemoteImage}
                    imageGenerationPending={false}
                  />
                  {props.uiSettings.showToolActivity &&
                    renderToolPanel(outgoingToolTimelineByMessage.get(msg.id) ?? [], `snapshot-tool-after-${msg.id}`, {
                      snapshot: true,
                    })}
                </React.Fragment>
              ))}

              {outgoingThreadSnapshot.streamText && (
                <div className="message-row assistant">
                  <article className="message-bubble assistant stream-bubble">
                    <div className="message-role">Assistant</div>
                    <div
                      className="markdown"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(outgoingThreadSnapshot.streamText) }}
                    />
                  </article>
                </div>
              )}

              {!outgoingThreadSnapshot.streamText && outgoingThreadSnapshot.thinking && (
                <div className="message-row assistant">
                  <article className="message-bubble assistant thinking-indicator">
                    <span className="thinking-label">Thinking</span>
                    <span className="thinking-dots" aria-hidden="true">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                  </article>
                </div>
              )}
            </div>
          </div>
        )}

        <ChatThread
          sessionKey={props.sessionKey}
          threadRef={mainThreadRef}
          chatImpulseActive={chatImpulseActive}
          sessionTransitionPhase={sessionTransitionPhase}
          hiddenMessageCount={hiddenMessageCount}
          loadingOlder={props.loadingOlder}
          messages={displayedMessages}
          threadState={threadState}
          showToolActivity={props.uiSettings.showToolActivity}
          showMessageTimestamp={props.uiSettings.showMessageTimestamp}
          timestampFontSize={props.uiSettings.messageTimestampFontSize}
          toolBeforeFirst={toolTimeline.beforeFirst}
          toolByMessageId={toolTimeline.byMessageId}
          streamText={props.streamText}
          streamMarkdownHtml={streamMarkdownHtml}
          thinking={props.thinking}
          imageGenerationPending={imageGenerationPending}
          streamPopActive={streamPopActive}
          sessionFlyInStream={sessionFlyInStream}
          streamMotionStyle={streamMotionStyle}
          poppingMessageIdSet={poppingMessageIdSet}
          sessionFlyInMessageIdSet={sessionFlyInMessageIdSet}
          onOpenImage={setImageLightbox}
          onResolveRemoteImage={props.onResolveRemoteImage}
          onRenderToolPanel={renderToolPanel}
          onHandleMarkdownClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;

            const copyTrigger = target.closest(
              '[data-copy-code], [data-code-copy], .md-code-copy, .code-copy-button, button[aria-label="Copy code"]',
            ) as HTMLElement | null;

            if (!copyTrigger) return;

            const codeContainer =
              copyTrigger.closest("pre") ??
              copyTrigger.parentElement?.querySelector("pre") ??
              copyTrigger.closest("[data-code-block], .markdown-code-block, .code-block");

            const codeElement = codeContainer?.querySelector("code");
            const codeText = codeElement?.textContent;

            if (!codeText) return;

            event.preventDefault();
            void navigator.clipboard?.writeText(codeText);
          }}
        />
      </div>

      <div className="msg-nav-buttons">
        <button
          type="button"
          className="msg-nav-btn"
          onClick={() => scrollToMessage("up")}
          aria-label="Previous message"
          title="Previous message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          type="button"
          className="msg-nav-btn"
          onClick={() => scrollToMessage("down")}
          aria-label="Next message"
          title="Next message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      </div>

      <Composer
        composerLaunchActive={composerLaunchActive}
        composerNotice={
          connectionFeedback.composerNotice
            ? {
                tone: connectionFeedback.composerNotice.tone,
                message: connectionFeedback.composerNotice.message,
                actionLabel:
                  connectionFeedback.composerNotice.action === "open-settings"
                    ? "Open Settings"
                    : connectionFeedback.composerNotice.action === "copy-pairing-command"
                      ? "Copy Command"
                      : undefined,
                onAction:
                  connectionFeedback.composerNotice.action === "open-settings"
                    ? props.onOpenSettings
                    : connectionFeedback.composerNotice.action === "copy-pairing-command"
                      ? handleCopyPairingCommand
                      : undefined,
              }
            : null
        }
        uiSettings={{
          composerActionScale: actionScale,
          footerStatsFontSize: props.uiSettings.footerStatsFontSize,
          composeActionsFontSize: Math.round(12 * actionScale),
          composeSendFontSize: Math.round(14 * actionScale),
        }}
        input={{
          draft: props.draft,
          textareaRef: composerTextareaRef,
          onDraftChange: props.onDraftChange,
          onKeyDown,
          onCompositionStart: () => {
            isComposingRef.current = true;
          },
          onCompositionEnd: () => {
            isComposingRef.current = false;
          },
        }}
        stagedAttachments={props.stagedAttachments}
        slash={{
          commandSuggestions,
          showSlashMenu,
          activeCommand,
          onApplySuggestion: applySuggestion,
        }}
        runtime={{
          connected: props.connected,
          sendDisabled,
          sendLabel,
          onSend: sendWithPhysics,
        }}
        footer={{
          sessionInfo: props.sessionInfo,
          models: props.models,
          onCompact: props.onCompact,
        }}
      />

      {imageLightbox && (
        <div
          className="image-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={() => setImageLightbox(null)}
        >
          <div className="image-lightbox" onClick={(event) => event.stopPropagation()}>
            <div className="image-lightbox-header">
              <div className="image-lightbox-name" title={imageLightbox.name}>
                {imageLightbox.name}
              </div>
              <div className="image-lightbox-actions">
                <a
                  className="ui-btn ui-btn-light"
                  href={imageLightbox.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
                <button
                  type="button"
                  className="ui-btn ui-btn-primary"
                  onClick={() => setImageLightbox(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="image-lightbox-body">
              {lightboxBlockedByWebLocalFile ? (
                <div className="attachment-image-fallback">
                  Web cannot render local file paths. Use desktop app or provide http/data image URL.
                </div>
              ) : (
                <img
                  src={imageLightbox.dataUrl}
                  alt={imageLightbox.name}
                  className="image-lightbox-image"
                  onError={onLightboxImageError}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrim: portaled to document.body so it paints below menus.
          Dims the background when a dropdown menu is open. */}
      {showSlashMenu && commandSuggestions.length > 0 && createPortal(
        <div
          className="menu-scrim"
          onClick={() => {
            // For slash menu: blur the textarea so the user can interact with the page
            if (showSlashMenu) {
              const ta = document.querySelector(".composer-textarea") as HTMLElement | null;
              if (ta) ta.blur();
            }
          }}
        />,
        document.body
      )}
    </section>
  );
}
