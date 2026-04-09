import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, ChatMessage } from "../lib/types.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import { MessageAttachmentList } from "./MessageAttachmentList.tsx";
import { MessageFileAttachment } from "./MessageFileAttachment.tsx";
import { MessageImageAttachment } from "./MessageImageAttachment.tsx";
import {
  buildDesktopLocalImageUrl,
  filePathFromImageSource,
  isDesktopRuntime,
  isLikelyLocalFileSource,
} from "../lib/message-image-source.ts";

type MotionVarsStyle = React.CSSProperties & Record<`--${string}`, string>;

function normalizeMessageTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return Date.now();
  }
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatLocalDateTime(timestamp: number): string {
  const date = new Date(normalizeMessageTimestamp(timestamp));
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatMessageDateTime(timestamp: number): string {
  const normalized = normalizeMessageTimestamp(timestamp);
  return new Date(normalized).toISOString();
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function buildMotionVars(id: string): MotionVarsStyle {
  const hash = hashString(id);
  const byte = (shift: number) => ((hash >>> shift) & 0xff) / 255;
  const dx = (byte(0) - 0.5) * 6;
  const timeScale = 0.9 + byte(24) * 0.2;
  const emergeY = 42 + byte(4) * 30;
  return {
    "--pop-dx": `${dx.toFixed(1)}px`,
    "--pop-time-scale": `${timeScale.toFixed(3)}`,
    "--pop-emerge-y": `${Math.round(emergeY)}px`,
  };
}

function handleMarkdownClick(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest(".md-code-copy") as HTMLElement | null;
  if (!copyBtn) return;
  e.preventDefault();
  e.stopPropagation();
  const codeBlock = copyBtn.closest(".md-code");
  const codeEl = codeBlock?.querySelector("pre code");
  if (codeEl) {
    navigator.clipboard
      .writeText(codeEl.textContent || "")
      .then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("is-copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("is-copied");
        }, 2000);
      })
      .catch(() => {});
  }
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className={`msg-copy-btn ${copied ? "is-copied" : ""}`}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      title={copied ? "Copied!" : "Copy"}
      aria-label={copied ? "Copied!" : "Copy message"}
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export type MessageRowProps = {
  message: ChatMessage;
  showTimestamp: boolean;
  timestampFontSize: number;
  drawerPop?: boolean;
  sessionFlyIn?: boolean;
  onOpenImage: (attachment: Attachment) => void;
  onResolveRemoteImage?: (filePath: string) => Promise<string | null>;
};

export const MessageRow = React.memo(
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
            <MessageAttachmentList
              attachments={message.attachments}
              renderImageAttachment={(att) => (
                <MessageImageAttachment
                  attachment={att}
                  onOpen={props.onOpenImage}
                  resolveRemoteImage={props.onResolveRemoteImage}
                />
              )}
              renderFileAttachment={(att) => <MessageFileAttachment attachment={att} />}
            />
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

