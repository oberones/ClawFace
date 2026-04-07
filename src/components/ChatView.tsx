import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import type { Attachment, ChatMessage, ConnectionStatus, SessionTransitionState, ToolItem } from "../lib/types.ts";
import { ChatThread } from "./ChatThread.tsx";
import { MessageRow } from "./MessageRow.tsx";
import { renderMarkdown } from "../lib/markdown.ts";
import { formatCompactTokens } from "../lib/format.ts";
import { BASE_COMMANDS, type SlashCommand } from "../lib/slash-commands.ts";
import type { UiSettings } from "../lib/ui-settings.ts";

export type SessionInfo = {
  agentId: string;
  agentLabel: string;
  modelLabel: string;
  modelId: string;
  contextLimit: number | null;
  contextTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  thinkingLevel: string | null;
  responseUsage?: "on" | "off" | "tokens" | "full" | null;
};

type ChatViewProps = {
  sessionKey: string | null;
  messages: ChatMessage[];
  streamText: string | null;
  thinking: boolean;
  toolItems: ToolItem[];
  draft: string;
  onDraftChange: (value: string) => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  onSend: () => void;
  onAbort: () => void;
  canAbort: boolean;
  connected: boolean;
  connectionStatus?: ConnectionStatus;
  disabledReason?: string | null;
  sessionInfo: SessionInfo;
  models: Array<{ id: string; name: string; provider: string; contextWindow?: number }>;
  uiSettings: UiSettings;
  canLoadOlder: boolean;
  loadingOlder: boolean;
  isCurrentSessionLoading?: boolean;
  sessionTransitionState?: SessionTransitionState;
  onLoadOlder: () => void;
  onModelSelect: (model: string) => void;
  onThinkingSelect: (level: string) => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
  onResolveRemoteImage?: (filePath: string) => Promise<string | null>;
  onCompact?: () => void;
};

const MESSAGE_RENDER_STEP = 60;
const AUTO_SCROLL_BOTTOM_THRESHOLD = 10;
const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";
const SESSION_SWITCH_OUT_MS = 260;
const SESSION_SWITCH_IN_MS = 800;
const STACK_LIFT_MS = 380;
const DRAWER_KICK_MS = 440;
const POP_MARK_MS = 640;
const FLY_IN_STAGGER_MS = 38;
const MAX_FLY_IN_ELEMENTS = 10;

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

type MotionVarsStyle = React.CSSProperties & Record<`--${string}`, string>;

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildMotionVars(id: string): MotionVarsStyle {
  const hash = hashString(id);
  const byte = (shift: number) => ((hash >>> shift) & 0xff) / 255;
  // Horizontal jitter — slight random drift left/right (GPU translate, no blur)
  const dx = (byte(0) - 0.5) * 6;
  // Time scale — each card animates at a slightly different speed
  const timeScale = 0.9 + byte(24) * 0.2;
  // Emerge Y — how far below the card starts (drawer depth)
  const emergeY = 42 + byte(4) * 30;
  return {
    "--pop-dx": `${dx.toFixed(1)}px`,
    "--pop-time-scale": `${timeScale.toFixed(3)}`,
    "--pop-emerge-y": `${Math.round(emergeY)}px`,
  };
}

const MessageRow = React.memo(
  function MessageRow(props: MessageRowProps) {
    const { message } = props;
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const roleLabel = isSystem ? "System" : isUser ? "You" : "Assistant";
    const rowMotionClass = `${props.drawerPop ? "drawer-pop" : ""} ${props.sessionFlyIn ? "session-fly-in" : ""}`.trim();
    const motionStyle = useMemo(() => buildMotionVars(message.id), [message.id]);
    const markdownHtml = useMemo(
      () => (message.text ? renderMarkdown(message.text) : ""),
      [message.text],
    );

    if (isSystem) {
      return (
        <div className={`message-row system ${rowMotionClass}`} data-message-id={message.id} style={motionStyle}>
          <article
            className="message-bubble system"
            style={{
              fontSize: "var(--claw-font-size)",
              lineHeight: "var(--claw-line-height)",
            }}
          >
            <div className="message-role">{roleLabel}</div>
            <div className="message-body plain-text">{message.text}</div>
            {props.showTimestamp && (
              <div className="message-meta">
                <time
                  className="message-time"
                  dateTime={formatMessageDateTime(message.timestamp)}
                  title={formatLocalDateTime(message.timestamp)}
                  style={{ fontSize: `${props.timestampFontSize}px` }}
                >
                  {formatLocalDateTime(message.timestamp)}
                </time>
              </div>
            )}
          </article>
        </div>
      );
    }

    return (
      <div
        className={`message-row ${isUser ? "user" : "assistant"} ${rowMotionClass}`}
        data-message-id={message.id}
        style={motionStyle}
      >
        <article className={`message-bubble ${isUser ? "user" : "assistant"}`}>
          <CopyButton text={message.text} />
          <div className="message-role">{roleLabel}</div>
          {markdownHtml && (
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
              onClick={handleMarkdownClick}
            />
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="attachments-wrap">
              {message.attachments.map((att) => {
                if (att.isImage) {
                  return (
                    <MessageImageAttachment
                      key={att.id}
                      attachment={att}
                      onOpen={props.onOpenImage}
                      resolveRemoteImage={props.onResolveRemoteImage}
                    />
                  );
                }
                return renderAttachment(att);
              })}
            </div>
          )}
          {props.showTimestamp && (
            <div className="message-meta">
              <time
                className="message-time"
                dateTime={formatMessageDateTime(message.timestamp)}
                title={formatLocalDateTime(message.timestamp)}
                style={{ fontSize: `${props.timestampFontSize}px` }}
              >
                {formatLocalDateTime(message.timestamp)}
              </time>
            </div>
          )}
        </article>
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.showTimestamp === next.showTimestamp &&
    prev.timestampFontSize === next.timestampFontSize &&
    prev.drawerPop === next.drawerPop &&
    prev.sessionFlyIn === next.sessionFlyIn &&
    prev.onOpenImage === next.onOpenImage &&
    prev.onResolveRemoteImage === next.onResolveRemoteImage,
);

export default function ChatView(props: ChatViewProps) {
  const [activeCommand, setActiveCommand] = useState(0);
  const [toolExpanded, setToolExpanded] = useState<Record<string, boolean>>({});
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(MESSAGE_RENDER_STEP);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
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
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const thinkingMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const olderLoadRequestedRef = useRef(false);
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

  const displayedMessages = useMemo(() => {
    const total = props.messages.length;
    const count = Math.max(0, Math.min(total, visibleMessageCount));
    return props.messages.slice(Math.max(0, total - count));
  }, [props.messages, visibleMessageCount]);

  const hiddenMessageCount = Math.max(0, props.messages.length - displayedMessages.length);

  const orderedTools = useMemo(
    () => [...props.toolItems].sort((a, b) => a.startedAt - b.startedAt),
    [props.toolItems],
  );
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

  const modelChoices = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; provider: string; contextWindow?: number }>();
    for (const model of props.models) {
      const full = `${model.provider}/${model.id}`;
      if (!unique.has(full)) {
        unique.set(full, model);
      }
    }
    return [...unique.entries()]
      .map(([full, model]) => ({ full, ...model }))
      .sort((a, b) => a.full.localeCompare(b.full));
  }, [props.models]);

  const activeModel = props.sessionInfo.modelId || props.sessionInfo.modelLabel || "";
  const thinkChoices = ["off", "minimal", "low", "medium", "high", "xhigh"];
  const activeThinking = (props.sessionInfo.thinkingLevel ?? "off").toLowerCase();

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
    setVisibleMessageCount(MESSAGE_RENDER_STEP);
    setAutoScrollEnabled(true);
    setImageLightbox(null);
    setModelMenuOpen(false);
    setThinkingMenuOpen(false);
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

  useEffect(() => {
    const pending = restoreScrollRef.current;
    const container = scrollRef.current;
    if (!pending || !container) {
      return;
    }
    const delta = container.scrollHeight - pending.height;
    container.scrollTop = pending.top + delta;
    restoreScrollRef.current = null;
  }, [displayedMessages.length]);

  useEffect(() => {
    if (props.loadingOlder) {
      return;
    }
    olderLoadRequestedRef.current = false;
  }, [props.loadingOlder]);

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
    const onClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(event.target)) {
        setThinkingMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

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
    const filePath = filePathFromImageSource(imageLightbox.dataUrl);
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
    const filePath = filePathFromImageSource(imageLightbox.dataUrl);
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

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled || !props.uiSettings.showToolActivity) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [orderedTools, autoScrollEnabled, props.uiSettings.showToolActivity]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !autoScrollEnabled) {
      return;
    }
    const lastMessage = displayedMessages[displayedMessages.length - 1];
    if (lastMessage?.role === "assistant" && !props.uiSettings.autoScrollAssistantResponses) {
      return;
    }
    if (props.streamText && !props.uiSettings.autoScrollAssistantResponses) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [
    displayedMessages,
    props.streamText,
    props.thinking,
    autoScrollEnabled,
    props.uiSettings.autoScrollAssistantResponses,
  ]);

  const onScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    const nearBottom = distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    if (nearBottom !== autoScrollEnabled) {
      setAutoScrollEnabled(nearBottom);
    }
    if (container.scrollTop > 80) {
      return;
    }
    if (visibleMessageCount < props.messages.length) {
      restoreScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
      setVisibleMessageCount((prev) => Math.min(props.messages.length, prev + MESSAGE_RENDER_STEP));
      return;
    }
    if (props.canLoadOlder && !props.loadingOlder && !olderLoadRequestedRef.current) {
      olderLoadRequestedRef.current = true;
      props.onLoadOlder();
    }
  };

  const actionScale = props.uiSettings.composerActionScale;
  const actionFontSize = `${Math.round(12 * actionScale)}px`;
  const actionPaddingY = `${Math.round(8 * actionScale)}px`;
  const actionPaddingX = `${Math.round(12 * actionScale)}px`;
  const sendFontSize = `${Math.round(14 * actionScale)}px`;
  const sendPaddingY = `${Math.round(8 * actionScale)}px`;
  const sendPaddingX = `${Math.round(20 * actionScale)}px`;
  const modelBadgeScale = props.uiSettings.modelBadgeScale;
  const modelBadgeFontSize = `${Math.round(12 * modelBadgeScale)}px`;
  const modelBadgePaddingY = `${Math.round(4 * modelBadgeScale)}px`;
  const modelBadgePaddingX = `${Math.round(12 * modelBadgeScale)}px`;
  const toolFontSize = `${props.uiSettings.toolCallFontSize}px`;
  const toolMinorFontSize = `${Math.max(10, props.uiSettings.toolCallFontSize - 2)}px`;
  const typographyFontSize = `${props.uiSettings.fontSize}px`;

  useEffect(() => {
    if (props.messages.length < visibleMessageCount) {
      setVisibleMessageCount(Math.max(MESSAGE_RENDER_STEP, props.messages.length));
    }
  }, [props.messages.length, visibleMessageCount]);

  useLayoutEffect(() => {
    autoResizeComposer();
  }, [props.draft, autoResizeComposer]);

  useEffect(() => {
    window.addEventListener("resize", autoResizeComposer);
    return () => window.removeEventListener("resize", autoResizeComposer);
  }, [autoResizeComposer]);

  const showSlashMenu = props.draft.trim().startsWith("/");
  const commandQuery = props.draft.trim().replace(/^\//, "");
  const tokens = commandQuery.split(/\s+/).filter(Boolean);
  const commandName = tokens[0] ?? "";
  const commandArgs = tokens.slice(1).join(" ");

  const commandSuggestions = useMemo<Array<SlashCommand & { value?: string }>>(() => {
    if (!showSlashMenu) {
      return [];
    }
    const thinkCommand = commandName === "think" || commandName === "thinking" || commandName === "t";
    if (commandName && (commandName === "model" || thinkCommand)) {
      if (commandName === "model") {
        return props.models
          .filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(commandArgs.toLowerCase()))
          .slice(0, 8)
          .map((model) => ({
            name: "model",
            description: model.name,
            value: `${model.provider}/${model.id}`,
          }));
      }
      const thinkLevels = ["off", "minimal", "low", "medium", "high", "xhigh"];
      return thinkLevels
        .filter((level) => level.startsWith(commandArgs.toLowerCase()))
        .map((level) => ({ name: commandName, description: "Thinking level", value: level }));
    }
    return BASE_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(commandName.toLowerCase()));
  }, [showSlashMenu, commandName, commandArgs, props.models]);

  const requiresArgs =
    commandName === "model" ||
    commandName === "think" ||
    commandName === "thinking" ||
    commandName === "t";
  const exactCommand = BASE_COMMANDS.find((cmd) => cmd.name === commandName) ?? null;

  const applySuggestion = (suggestion: SlashCommand & { value?: string }) => {
    if (suggestion.value) {
      props.onDraftChange(`/${suggestion.name} ${suggestion.value} `);
    } else {
      props.onDraftChange(`/${suggestion.name} `);
    }
    setActiveCommand(0);
  };

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
      const next = (activeCommand + delta + commandSuggestions.length) % commandSuggestions.length;
      setActiveCommand(next);
      return;
    }
    if (showSlashMenu && event.key === "Tab" && commandSuggestions.length > 0) {
      event.preventDefault();
      applySuggestion(commandSuggestions[activeCommand]!);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (showSlashMenu && commandSuggestions.length > 0 && commandName && !commandArgs) {
        if (exactCommand && !requiresArgs) {
          sendWithPhysics();
          return;
        }
        applySuggestion(commandSuggestions[activeCommand]!);
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
      <section
        key={key}
        className={`tool-panel ${panelFlyIn ? "session-fly-in" : ""}`}
        data-tool-panel-key={key}
        style={panelMotionStyle}
      >
        <div className="tool-panel-header">
          <div className="tool-panel-title" style={{ fontSize: toolMinorFontSize }}>
            Tool Activity ({tools.length})
          </div>
        </div>

        <div className="tool-grid">
          {tools.map((tool) => {
            const expanded = snapshotMode ? false : (toolExpanded[tool.id] ?? false);
            const statusLabel = tool.status === "result" ? "done" : "running";
            const outputPreview = (tool.output ?? "").replace(/\s+/g, " ").trim();
            const argsPreview = JSON.stringify(tool.args ?? {}).replace(/\s+/g, " ").trim().slice(0, 120);
            const summary = (outputPreview || argsPreview).slice(0, 120);
            const drawerPop = !snapshotMode && poppingToolIdSet.has(tool.id);
            const sessionFlyIn = !snapshotMode && sessionFlyInToolIdSet.has(tool.id);
            const motionStyle = buildMotionVars(tool.id);
            return (
              <article
                key={tool.id}
                className={`tool-entry ${expanded ? "is-expanded" : ""} ${drawerPop ? "drawer-pop" : ""} ${sessionFlyIn ? "session-fly-in" : ""}`}
                data-tool-id={tool.id}
                style={{ ...motionStyle, fontSize: toolFontSize }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (snapshotMode) {
                      return;
                    }
                    setToolExpanded((prev) => ({ ...prev, [tool.id]: !expanded }));
                  }}
                  className="tool-entry-toggle"
                  aria-expanded={expanded}
                >
                  <span className="tool-title-wrap">
                    <span className={`tool-status-dot ${statusLabel === "done" ? "done" : "running"}`} />
                    <span className="tool-title">{tool.name}</span>
                    <span className="tool-status-text" style={{ fontSize: toolMinorFontSize }}>
                      {statusLabel}
                    </span>
                  </span>
                  {!expanded && summary && (
                    <span className="tool-summary" style={{ fontSize: toolMinorFontSize }}>
                      {summary}
                    </span>
                  )}
                </button>

                {expanded && (
                  <div className="tool-expanded">
                    <div>
                      <div className="tool-expanded-title" style={{ fontSize: toolMinorFontSize }}>
                        Args
                      </div>
                      <pre className="tool-pre">{JSON.stringify(tool.args ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="tool-expanded-title" style={{ fontSize: toolMinorFontSize }}>
                        Output
                      </div>
                      <pre className="tool-pre">{tool.output ?? "(no output)"}</pre>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  const outgoingToolTimelineByMessage = useMemo(
    () => new Map(outgoingThreadSnapshot?.toolByMessageEntries ?? []),
    [outgoingThreadSnapshot],
  );

  const connectionStatus = props.connectionStatus ?? (props.connected ? "connected" : "disconnected");
  const isSessionSwitching = props.sessionTransitionState === "switching";
  const isThreadBusy = Boolean(props.isCurrentSessionLoading || isSessionSwitching);
  const statusLabel =
    connectionStatus === "connected"
      ? "Gateway connected"
      : connectionStatus === "connecting"
        ? "Connecting to gateway…"
        : connectionStatus === "pairing-required"
          ? "Gateway pairing required"
          : connectionStatus === "error"
            ? "Gateway connection error"
            : "Gateway disconnected";
  const statusDotClass =
    connectionStatus === "connected"
      ? "connected"
      : connectionStatus === "connecting"
        ? "connecting"
        : connectionStatus === "pairing-required"
          ? "warning"
          : connectionStatus === "error"
            ? "warning"
            : "disconnected";
  const composerWarning =
    connectionStatus === "connecting"
      ? props.disabledReason || "Connecting to the gateway…"
      : connectionStatus === "pairing-required"
        ? props.disabledReason || "Pairing required before sending messages."
        : connectionStatus === "error"
          ? props.disabledReason || "Gateway connection error. Check settings and retry."
          : !props.connected
            ? props.disabledReason || "Gateway disconnected. Update settings to reconnect."
            : null;

  return (
    <section className="claw-chat-area chat-shell">
      <header className={`chat-header ${modelMenuOpen || thinkingMenuOpen ? "menu-layer-active" : ""}`}>
        <div className="chat-header-main">
          <div className="chat-brand-title">ClawUI</div>
          <div className="topbar-status">
            <span className={`status-dot ${statusDotClass}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="chat-header-actions">
          <div className={`relative ${modelMenuOpen ? "menu-open-ctx" : ""}`} ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setModelMenuOpen((prev) => !prev)}
              className="ui-btn ui-btn-light"
              style={{
                fontSize: modelBadgeFontSize,
                padding: `${modelBadgePaddingY} ${modelBadgePaddingX}`,
              }}
            >
              Agent: {props.sessionInfo.agentLabel || "-"} · Model:{" "}
              {props.sessionInfo.modelLabel || "-"}
            </button>

            {modelMenuOpen && (
              <div className="floating-menu" style={{ fontSize: modelBadgeFontSize }}>
                {modelChoices.length === 0 && <div className="floating-empty">No available models.</div>}
                {modelChoices.map((model) => {
                  const isActive =
                    model.full === activeModel || model.id === activeModel || model.name === activeModel;
                  return (
                    <button
                      key={model.full}
                      type="button"
                      onClick={() => {
                        setModelMenuOpen(false);
                        props.onModelSelect(model.full);
                      }}
                      className={`floating-item ${isActive ? "active" : ""}`}
                    >
                      <div className="floating-item-title">{model.full}</div>
                      <div className="floating-item-subtitle">{model.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

              {outgoingThreadSnapshot.displayedMessages.length === 0 && (
                <article className="empty-state">
                  <div className="empty-state-greeting" aria-hidden="true">🦞</div>
                  <div className="empty-state-title">New Conversation</div>
                  <div className="empty-state-copy">
                    Type a message to get started, or use a <code>/command</code>.
                  </div>
                </article>
              )}

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
          chatImpulseActive={chatImpulseActive}
          sessionTransitionPhase={sessionTransitionPhase}
          hiddenMessageCount={hiddenMessageCount}
          loadingOlder={props.loadingOlder}
          messages={displayedMessages}
          isThreadBusy={isThreadBusy}
          isSessionSwitching={isSessionSwitching}
          showToolActivity={props.uiSettings.showToolActivity}
          showMessageTimestamp={props.uiSettings.showMessageTimestamp}
          timestampFontSize={props.uiSettings.messageTimestampFontSize}
          toolBeforeFirst={toolTimeline.beforeFirst}
          toolByMessageId={toolTimeline.byMessageId}
          streamText={props.streamText}
          streamMarkdownHtml={streamMarkdownHtml}
          thinking={props.thinking}
          streamPopActive={streamPopActive}
          sessionFlyInStream={sessionFlyInStream}
          streamMotionStyle={streamMotionStyle}
          poppingMessageIdSet={poppingMessageIdSet}
          sessionFlyInMessageIdSet={sessionFlyInMessageIdSet}
          onOpenImage={setImageLightbox}
          onResolveRemoteImage={props.onResolveRemoteImage}
          onRenderToolPanel={renderToolPanel}
          onHandleMarkdownClick={handleMarkdownClick}
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

      <footer className="composer-shell">
        <div
          className={`composer-inner ${composerLaunchActive ? "is-launching" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length === 0) {
              return;
            }
            const reads: Promise<Attachment>[] = files.map((file) => {
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = typeof reader.result === "string" ? reader.result : "";
                  resolve({
                    id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
                    name: file.name,
                    size: file.size,
                    type: file.type || "application/octet-stream",
                    dataUrl,
                    isImage: file.type.startsWith("image/"),
                  });
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
              });
            });
            Promise.all(reads)
              .then((next) => {
                props.onAttachmentsChange([...props.attachments, ...next]);
              })
              .catch(() => {
                // ignore
              });
          }}
        >
          {composerWarning && (
            <div className="composer-warning">
              {composerWarning}
            </div>
          )}

          <div className="composer-input-wrap">
            <textarea
              ref={composerTextareaRef}
              value={props.draft}
              onChange={(e) => props.onDraftChange(e.target.value)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) {
                  return;
                }
                const imageFiles: File[] = [];
                for (let i = 0; i < items.length; i += 1) {
                  const item = items[i];
                  if (item && item.kind === "file" && item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                      imageFiles.push(file);
                    }
                  }
                }
                if (imageFiles.length === 0) {
                  return;
                }
                e.preventDefault();
                const reads: Promise<Attachment>[] = imageFiles.map((file) => {
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = typeof reader.result === "string" ? reader.result : "";
                      resolve({
                        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
                        name: file.name || `pasted-image.${file.type.split("/")[1] || "png"}`,
                        size: file.size,
                        type: file.type || "image/png",
                        dataUrl,
                        isImage: true,
                      });
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                  });
                });
                Promise.all(reads)
                  .then((next) => {
                    props.onAttachmentsChange([...props.attachments, ...next]);
                  })
                  .catch(() => {
                    // ignore
                  });
              }}
              placeholder="Type a message or /command"
              className="composer-textarea"
              style={{
                fontFamily: "var(--claw-font)",
                fontSize: "var(--claw-font-size)",
                lineHeight: "var(--claw-line-height)",
              }}
            />

            {showSlashMenu && commandSuggestions.length > 0 && (
              <div className="slash-menu" style={{ fontSize: typographyFontSize }}>
                {commandSuggestions.map((cmd, idx) => (
                  <button
                    key={`${cmd.name}-${cmd.value ?? cmd.description}`}
                    type="button"
                    onClick={() => applySuggestion(cmd)}
                    className={`slash-item ${idx === activeCommand ? "active" : ""}`}
                  >
                    <span className="slash-name">/{cmd.name}</span>
                    <span className="slash-detail">{cmd.value ?? cmd.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {props.attachments.length > 0 && (
            <div className="attachment-preview-list">
              {props.attachments.map((att) => (
                <div key={att.id} className={`attachment-preview-item ${att.isImage ? "is-image" : "is-file"}`}>
                  {att.isImage ? (
                    <div className="attachment-preview-thumb">
                      <img src={att.dataUrl} alt={att.name} className="attachment-preview-img" />
                    </div>
                  ) : (
                    <div className="attachment-preview-file-icon">
                      <span className="attachment-preview-file-ext">
                        {att.name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                      </span>
                    </div>
                  )}
                  <div className="attachment-preview-info">
                    <span className="attachment-preview-name" title={att.name}>{truncate(att.name, 20)}</span>
                    <span className="attachment-preview-size">{formatBytes(att.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      props.onAttachmentsChange(props.attachments.filter((item) => item.id !== att.id))
                    }
                    className="attachment-preview-remove"
                    aria-label={`Remove ${att.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="composer-actions-row">
            <div className="composer-actions">
              <label
                className="attachment-trigger"
                style={{
                  fontSize: actionFontSize,
                  padding: `${Math.round(5 * actionScale)}px ${Math.round(10 * actionScale)}px`,
                  minHeight: "auto",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                Attach
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    const events: Promise<Attachment>[] = files.map((file) => {
                      return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = typeof reader.result === "string" ? reader.result : "";
                          resolve({
                            id: `${file.name}-${file.size}-${file.lastModified}`,
                            name: file.name,
                            size: file.size,
                            type: file.type || "application/octet-stream",
                            dataUrl,
                            isImage: file.type.startsWith("image/"),
                          });
                        };
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(file);
                      });
                    });
                    Promise.all(events)
                      .then((next) => {
                        props.onAttachmentsChange([...props.attachments, ...next]);
                      })
                      .catch(() => {
                        // ignore
                      });
                  }}
                />
              </label>

              <button
                type="button"
                onClick={sendWithPhysics}
                disabled={!props.connected}
                className="ui-btn ui-btn-primary"
                style={{
                  fontSize: sendFontSize,
                  padding: `${Math.round(6 * actionScale)}px ${Math.round(16 * actionScale)}px`,
                  minHeight: "auto",
                }}
              >
                Send
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "-2px" }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>

            <div className="footer-stats" style={{ fontSize: `${props.uiSettings.footerStatsFontSize}px` }}>
              {props.onCompact && (
                <button
                  type="button"
                  onClick={props.onCompact}
                  className="ui-btn ui-btn-light compact-btn"
                  title="Compact session context"
                  style={{
                    fontSize: `${props.uiSettings.footerStatsFontSize}px`,
                    padding: `${Math.round(props.uiSettings.footerStatsFontSize * 0.45)}px ${Math.round(props.uiSettings.footerStatsFontSize * 0.8)}px`,
                    minHeight: "auto",
                  }}
                >
                  🧹 Compact
                </button>
              )}
              <span>
                Context:{" "}
                {(() => {
                  const total =
                    props.sessionInfo.totalTokens ??
                    (Number.isFinite(props.sessionInfo.inputTokens) || Number.isFinite(props.sessionInfo.outputTokens)
                      ? (props.sessionInfo.inputTokens ?? 0) + (props.sessionInfo.outputTokens ?? 0)
                      : null);
                  const used = Number.isFinite(total) ? total : null;
                  const modelId = props.sessionInfo.modelId || props.sessionInfo.modelLabel;
                  const model =
                    props.models.find((item) => item.id === modelId) ??
                    props.models.find((item) => `${item.provider}/${item.id}` === modelId) ??
                    props.models.find((item) => `${item.provider}/${item.name}` === modelId) ??
                    null;
                  const limit = model?.contextWindow ?? props.sessionInfo.contextLimit ?? null;
                  if (!Number.isFinite(used)) {
                    return "-";
                  }
                  if (Number.isFinite(limit)) {
                    const percent = Math.max(0, Math.min(100, ((used as number) / (limit as number)) * 100));
                    return `${formatCompactTokens(used)} / ${formatCompactTokens(limit)} (${percent.toFixed(0)}%)`;
                  }
                  return formatCompactTokens(used);
                })()}
              </span>
              <span>In: {formatCompactTokens(props.sessionInfo.inputTokens)}</span>
              <span>Out: {formatCompactTokens(props.sessionInfo.outputTokens)}</span>
              <span>Total: {formatCompactTokens(props.sessionInfo.totalTokens)}</span>

              <div className={`relative ${thinkingMenuOpen ? "menu-open-ctx" : ""}`} ref={thinkingMenuRef}>
                <button
                  type="button"
                  onClick={() => setThinkingMenuOpen((prev) => !prev)}
                  className="ui-btn ui-btn-light"
                  style={{
                    fontSize: `${props.uiSettings.footerStatsFontSize}px`,
                    padding: `${Math.round(props.uiSettings.footerStatsFontSize * 0.45)}px ${Math.round(props.uiSettings.footerStatsFontSize * 0.8)}px`,
                    minHeight: "auto",
                  }}
                >
                  Thinking: {activeThinking}
                </button>
                {thinkingMenuOpen && (
                  <div className="thinking-menu">
                    {thinkChoices.map((level) => {
                      const isActive = level === activeThinking;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            setThinkingMenuOpen(false);
                            props.onThinkingSelect(level);
                          }}
                          className={`thinking-item ${isActive ? "active" : ""}`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

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
      {(modelMenuOpen || thinkingMenuOpen || (showSlashMenu && commandSuggestions.length > 0)) && createPortal(
        <div
          className="menu-scrim"
          onClick={() => {
            setModelMenuOpen(false);
            setThinkingMenuOpen(false);
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
