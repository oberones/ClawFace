import React from "react";
import type { ChatMessage, ToolItem } from "../lib/types.ts";
import { MessageRow } from "./MessageRow.tsx";

export type ChatThreadProps = {
  sessionKey: string | null;
  chatImpulseActive: boolean;
  sessionTransitionPhase: "idle" | "out" | "preparing" | "in";
  hiddenMessageCount: number;
  loadingOlder: boolean;
  messages: ChatMessage[];
  isThreadBusy: boolean;
  isSessionSwitching: boolean;
  showToolActivity: boolean;
  showMessageTimestamp: boolean;
  timestampFontSize: number;
  toolBeforeFirst: ToolItem[];
  toolByMessageId: Map<string, ToolItem[]>;
  streamText: string;
  streamMarkdownHtml: string;
  thinking: boolean;
  streamPopActive: boolean;
  sessionFlyInStream: boolean;
  streamMotionStyle?: React.CSSProperties;
  poppingMessageIdSet: Set<string>;
  sessionFlyInMessageIdSet: Set<string>;
  onOpenImage: (payload: { src: string; alt?: string; localHint?: string | null }) => void;
  onResolveRemoteImage?: ((src: string) => Promise<string | null>) | undefined;
  onRenderToolPanel: (items: ToolItem[], keyPrefix: string, opts?: { snapshot?: boolean }) => React.ReactNode;
  onHandleMarkdownClick: React.MouseEventHandler<HTMLElement>;
};

export function ChatThread(props: ChatThreadProps) {
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

      {props.messages.length === 0 && props.isThreadBusy && (
        <article className="empty-state">
          <div className="empty-state-greeting" aria-hidden="true">🦞</div>
          <div className="empty-state-title">{props.isSessionSwitching ? "Switching Sessions" : "Loading Session"}</div>
          <div className="empty-state-copy">
            {props.isSessionSwitching
              ? "Preparing the selected session and restoring its thread context."
              : "Loading the current session history and thread state."}
          </div>
        </article>
      )}

      {props.messages.length === 0 && !props.isThreadBusy && (
        <article className="empty-state">
          <div className="empty-state-greeting" aria-hidden="true">🦞</div>
          <div className="empty-state-title">New Conversation</div>
          <div className="empty-state-copy">
            Type a message to get started, or use a <code>/command</code>.
          </div>
          <div className="empty-state-hints">
            <span className="empty-state-hint">/model</span>
            <span className="empty-state-hint">/status</span>
            <span className="empty-state-hint">/usage</span>
            <span className="empty-state-hint">/compact</span>
          </div>
        </article>
      )}

      {props.showToolActivity && props.onRenderToolPanel(props.toolBeforeFirst, "tool-before-first")}

      {props.messages.map((msg) => (
        <React.Fragment key={msg.id}>
          <MessageRow
            message={msg}
            showTimestamp={props.showMessageTimestamp}
            timestampFontSize={props.timestampFontSize}
            drawerPop={props.poppingMessageIdSet.has(msg.id)}
            sessionFlyIn={props.sessionFlyInMessageIdSet.has(msg.id)}
            onOpenImage={props.onOpenImage}
            onResolveRemoteImage={props.onResolveRemoteImage}
          />
          {props.showToolActivity &&
            props.onRenderToolPanel(props.toolByMessageId.get(msg.id) ?? [], `tool-after-${msg.id}`)}
        </React.Fragment>
      ))}

      {props.streamText && (
        <div
          className={`message-row assistant ${props.streamPopActive ? "drawer-pop" : ""} ${props.sessionFlyInStream ? "session-fly-in" : ""}`}
          data-stream-row="1"
          style={props.streamMotionStyle}
        >
          <article className="message-bubble assistant stream-bubble">
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
  );
}
