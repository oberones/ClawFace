import React from "react";
import type { Attachment, ChatMessage, ToolItem } from "../lib/types.ts";
import { CopyButton, MessageRow } from "./MessageRow.tsx";

export type ThreadState =
  | { kind: "ready" }
  | {
      kind: "loading";
      title: string;
      copy: string;
    }
  | {
      kind: "empty";
      title: string;
      copy: string;
      showHints?: boolean;
    };

export type ChatThreadProps = {
  sessionKey: string | null;
  chatImpulseActive: boolean;
  sessionTransitionPhase: "idle" | "out" | "preparing" | "in";
  hiddenMessageCount: number;
  loadingOlder: boolean;
  messages: ChatMessage[];
  threadState: ThreadState;
  showToolActivity: boolean;
  showMessageTimestamp: boolean;
  timestampFontSize: number;
  toolBeforeFirst: ToolItem[];
  toolByMessageId: Map<string, ToolItem[]>;
  streamText: string | null;
  streamMarkdownHtml: string;
  thinking: boolean;
  streamPopActive: boolean;
  sessionFlyInStream: boolean;
  streamMotionStyle?: React.CSSProperties;
  poppingMessageIdSet: Set<string>;
  sessionFlyInMessageIdSet: Set<string>;
  onOpenImage: (attachment: Attachment) => void;
  onResolveRemoteImage?: ((filePath: string) => Promise<string | null>) | undefined;
  onRenderToolPanel: (items: ToolItem[], keyPrefix: string, opts?: { snapshot?: boolean }) => React.ReactNode;
  onHandleMarkdownClick: React.MouseEventHandler<HTMLElement>;
};

export function renderThreadStateCard(state: Exclude<ThreadState, { kind: "ready" }>) {
  return (
    <article className="empty-state">
      <div className="empty-state-greeting" aria-hidden="true">🦞</div>
      <div className="empty-state-title">{state.title}</div>
      <div className="empty-state-copy">
        {state.copy}
      </div>
      {state.kind === "empty" && state.showHints && (
        <div className="empty-state-hints">
          <span className="empty-state-hint">/model</span>
          <span className="empty-state-hint">/status</span>
          <span className="empty-state-hint">/usage</span>
          <span className="empty-state-hint">/compact</span>
        </div>
      )}
    </article>
  );
}

export function ChatThread(props: ChatThreadProps) {
  const firstMessageFollowsTools = props.toolBeforeFirst.length > 0 && props.messages[0]?.role === "assistant";
  const trailingToolCount = props.messages.length > 0
    ? (props.toolByMessageId.get(props.messages[props.messages.length - 1]!.id)?.length ?? 0)
    : props.toolBeforeFirst.length;
  const streamOrThinkingFollowsTools = trailingToolCount > 0;

  return (
    <div
      key={`main-${props.sessionKey ?? "none"}`}
      className={`chat-thread chat-thread-main ${props.chatImpulseActive ? "is-impulsing" : ""} ${(props.sessionTransitionPhase === "out" || props.sessionTransitionPhase === "preparing") ? "is-hidden-for-switch-out" : ""}`}
      style={{ maxWidth: "var(--claw-content-width)", gap: "var(--claw-message-gap)" }}
    >
      {(props.hiddenMessageCount > 0 || props.loadingOlder) && (
        <div className="history-hint">
          {props.loadingOlder
            ? "Loading older messages..."
            : `${props.hiddenMessageCount} older messages available. Scroll up to load.`}
        </div>
      )}

      {props.threadState.kind !== "ready" && props.messages.length === 0 && renderThreadStateCard(props.threadState)}

      {props.showToolActivity && props.toolBeforeFirst.length > 0 && (
        <div
          className={`tool-panel-row${firstMessageFollowsTools || (!props.messages.length && (Boolean(props.streamText) || props.thinking)) ? " is-followed-by-assistant" : ""}`}
        >
          {props.onRenderToolPanel(props.toolBeforeFirst, "tool-before-first")}
        </div>
      )}

      {props.messages.map((msg, index) => {
        const previousMessage = index > 0 ? props.messages[index - 1] : null;
        const previousToolCount = previousMessage ? (props.toolByMessageId.get(previousMessage.id)?.length ?? 0) : props.toolBeforeFirst.length;
        const followsTools = msg.role === "assistant" && previousToolCount > 0;
        const toolItemsAfter = props.toolByMessageId.get(msg.id) ?? [];
        const nextMessage = index < props.messages.length - 1 ? props.messages[index + 1] : null;
        const toolPanelFollowedByAssistant = toolItemsAfter.length > 0 && (
          nextMessage?.role === "assistant" ||
          (!nextMessage && (Boolean(props.streamText) || props.thinking))
        );

        return (
          <React.Fragment key={msg.id}>
            <MessageRow
              message={msg}
              showTimestamp={props.showMessageTimestamp}
              timestampFontSize={props.timestampFontSize}
              drawerPop={props.poppingMessageIdSet.has(msg.id)}
              sessionFlyIn={props.sessionFlyInMessageIdSet.has(msg.id)}
              followupType={followsTools ? "tool" : undefined}
              onOpenImage={props.onOpenImage}
              onResolveRemoteImage={props.onResolveRemoteImage}
            />
            {props.showToolActivity && toolItemsAfter.length > 0 && (
              <div className={`tool-panel-row${toolPanelFollowedByAssistant ? " is-followed-by-assistant" : ""}`}>
                {props.onRenderToolPanel(toolItemsAfter, `tool-after-${msg.id}`)}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {props.streamText && (
        <div
          className={`message-row assistant ${streamOrThinkingFollowsTools ? "is-tool-followup" : ""} ${props.streamPopActive ? "drawer-pop" : ""} ${props.sessionFlyInStream ? "session-fly-in" : ""}`}
          data-stream-row="1"
          style={props.streamMotionStyle}
        >
          <article className={`message-bubble assistant ${streamOrThinkingFollowsTools ? "is-tool-followup" : ""} stream-bubble`}>
            <CopyButton text={props.streamText || ""} />
            <div className="message-role">Assistant</div>
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: props.streamMarkdownHtml }}
              onClick={props.onHandleMarkdownClick}
            />
          </article>
        </div>
      )}

      {!props.streamText && props.thinking && (
        <div className={`message-row assistant ${streamOrThinkingFollowsTools ? "is-tool-followup" : ""}`}>
          <article className={`message-bubble assistant ${streamOrThinkingFollowsTools ? "is-tool-followup" : ""} thinking-indicator`}>
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
  );
}
