import React from "react";
import type { Attachment } from "../lib/types.ts";
import { formatBytes, formatCompactTokens, truncate } from "../lib/format.ts";

type UiSettings = {
  composerActionScale: number;
  footerStatsFontSize: number;
  composeActionsFontSize: number;
  composeSendFontSize: number;
};

type CommandSuggestion = {
  name: string;
  description: string;
  value?: string;
};

type SessionInfo = {
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  modelId?: string | null;
  modelLabel?: string | null;
  contextLimit?: number | null;
};

type ModelItem = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number | null;
};

export type ComposerProps = {
  composerLaunchActive: boolean;
  composerWarning: string | null;
  draft: string;
  attachments: Attachment[];
  connected: boolean;
  sendDisabled: boolean;
  sendLabel?: string;
  uiSettings: UiSettings;
  commandSuggestions: CommandSuggestion[];
  showSlashMenu: boolean;
  activeCommand: number;
  thinkingMenuOpen: boolean;
  thinkingMenuRef: React.RefObject<HTMLDivElement>;
  activeThinking: string;
  thinkChoices: string[];
  sessionInfo: SessionInfo;
  models: ModelItem[];
  onDraftChange: (value: string) => void;
  onAttachmentsChange: (next: Attachment[]) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onApplySuggestion: (item: CommandSuggestion) => void;
  onSend: () => void;
  onCompact?: () => void;
  onThinkingMenuToggle: () => void;
  onThinkingSelect: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

async function fileToAttachment(file: File, idPrefix: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      resolve({
        id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        name: file.name || `upload.${file.type.split("/")[1] || "bin"}`,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl,
        isImage: file.type.startsWith("image/"),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Composer(props: ComposerProps) {
  const actionScale = props.uiSettings.composerActionScale;
  const actionFontSize = props.uiSettings.composeActionsFontSize;
  const sendFontSize = props.uiSettings.composeSendFontSize;

  return (
    <footer className="composer-shell">
      <div
        className={`composer-inner ${props.composerLaunchActive ? "is-launching" : ""}`}
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
          Promise.all(files.map((file) => fileToAttachment(file, "drop")))
            .then((next) => {
              props.onAttachmentsChange([...props.attachments, ...next]);
            })
            .catch(() => {
              // ignore
            });
        }}
      >
        {props.composerWarning && <div className="composer-warning">{props.composerWarning}</div>}

        <div className="composer-input-wrap">
          <textarea
            ref={props.textareaRef}
            value={props.draft}
            onChange={(e) => props.onDraftChange(e.target.value)}
            onCompositionStart={props.onCompositionStart}
            onCompositionEnd={props.onCompositionEnd}
            onKeyDown={props.onKeyDown}
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
              Promise.all(imageFiles.map((file) => fileToAttachment(file, "paste")))
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

          {props.showSlashMenu && props.commandSuggestions.length > 0 && (
            <div className="slash-menu" style={{ fontSize: "var(--claw-font-size)" }}>
              {props.commandSuggestions.map((cmd, idx) => (
                <button
                  key={`${cmd.name}-${cmd.value ?? cmd.description}`}
                  type="button"
                  onClick={() => props.onApplySuggestion(cmd)}
                  className={`slash-item ${idx === props.activeCommand ? "active" : ""}`}
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
                  onClick={() => props.onAttachmentsChange(props.attachments.filter((item) => item.id !== att.id))}
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
                  Promise.all(files.map((file) => fileToAttachment(file, "upload")))
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
              onClick={props.onSend}
              disabled={props.sendDisabled}
              className="ui-btn ui-btn-primary"
              style={{
                fontSize: sendFontSize,
                padding: `${Math.round(6 * actionScale)}px ${Math.round(16 * actionScale)}px`,
                minHeight: "auto",
              }}
            >
              {props.sendLabel ?? "Send"}
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

            <div className={`relative ${props.thinkingMenuOpen ? "menu-open-ctx" : ""}`} ref={props.thinkingMenuRef}>
              <button
                type="button"
                onClick={props.onThinkingMenuToggle}
                className="ui-btn ui-btn-light"
                style={{
                  fontSize: `${props.uiSettings.footerStatsFontSize}px`,
                  padding: `${Math.round(props.uiSettings.footerStatsFontSize * 0.45)}px ${Math.round(props.uiSettings.footerStatsFontSize * 0.8)}px`,
                  minHeight: "auto",
                }}
              >
                Thinking: {props.activeThinking}
              </button>
              {props.thinkingMenuOpen && (
                <div className="thinking-menu">
                  {props.thinkChoices.map((level) => {
                    const isActive = level === props.activeThinking;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => props.onThinkingSelect(level)}
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
  );
}
