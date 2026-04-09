import React, { useMemo, useState } from "react";
import type { Attachment } from "../lib/types.ts";
import type { StagedAttachmentsState } from "../lib/staged-attachments.ts";
import { formatCompactTokens } from "../lib/format.ts";
import { useAttachmentIngestion } from "../hooks/useAttachmentIngestion.ts";
import { StagedAttachmentTray } from "./StagedAttachmentTray.tsx";

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
  uiSettings: UiSettings;
  input: {
    draft: string;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    onDraftChange: (value: string) => void;
    onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
  };
  stagedAttachments: StagedAttachmentsState;
  slash: {
    commandSuggestions: CommandSuggestion[];
    showSlashMenu: boolean;
    activeCommand: number;
    onApplySuggestion: (item: CommandSuggestion) => void;
  };
  runtime: {
    connected: boolean;
    sendDisabled: boolean;
    sendLabel?: string;
    onSend: () => void;
  };
  footer: {
    thinkingMenuOpen: boolean;
    thinkingMenuRef: React.RefObject<HTMLDivElement>;
    activeThinking: string;
    thinkChoices: string[];
    sessionInfo: SessionInfo;
    models: ModelItem[];
    onCompact?: () => void;
    onThinkingMenuToggle: () => void;
    onThinkingSelect: (value: string) => void;
  };
};

export function Composer(props: ComposerProps) {
  const actionScale = props.uiSettings.composerActionScale;
  const actionFontSize = props.uiSettings.composeActionsFontSize;
  const sendFontSize = props.uiSettings.composeSendFontSize;
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentOps = useMemo(() => ({
    appendAttachments: (next: Attachment[]) => {
      setAttachmentError(null);
      props.stagedAttachments.appendAttachments(next);
    },
    removeAttachment: props.stagedAttachments.removeAttachment,
  }), [props.stagedAttachments]);
  const attachmentIngestion = useAttachmentIngestion({
    attachmentOps,
    onError: (message) => {
      setAttachmentError(message);
    },
  });

  return (
    <footer className="composer-shell">
      <div
        className={`composer-inner ${props.composerLaunchActive ? "is-launching" : ""} ${attachmentIngestion.isDragActive ? "is-drag-active" : ""}`}
        {...attachmentIngestion.dragBindings}
      >
        {attachmentIngestion.isDragActive && (
          <div className="composer-drop-overlay" aria-hidden="true">
            <div className="composer-drop-card">
              <div className="composer-drop-title">Drop files to attach</div>
              <div className="composer-drop-copy">Images, screenshots, and files will be staged in the composer.</div>
            </div>
          </div>
        )}

        {props.composerWarning && <div className="composer-warning">{props.composerWarning}</div>}
        {attachmentError && <div className="composer-warning">Attachment error: {attachmentError}</div>}

        <div className="composer-input-wrap">
          <textarea
            ref={props.input.textareaRef}
            value={props.input.draft}
            onChange={(e) => props.input.onDraftChange(e.target.value)}
            onCompositionStart={props.input.onCompositionStart}
            onCompositionEnd={props.input.onCompositionEnd}
            onKeyDown={props.input.onKeyDown}
            onPaste={attachmentIngestion.handlePaste}
            placeholder="Type a message or /command"
            className="composer-textarea"
            style={{
              fontFamily: "var(--claw-font)",
              fontSize: "var(--claw-font-size)",
              lineHeight: "var(--claw-line-height)",
            }}
          />

          {props.slash.showSlashMenu && props.slash.commandSuggestions.length > 0 && (
            <div className="slash-menu" style={{ fontSize: "var(--claw-font-size)" }}>
              {props.slash.commandSuggestions.map((cmd, idx) => (
                <button
                  key={`${cmd.name}-${cmd.value ?? cmd.description}`}
                  type="button"
                  onClick={() => props.slash.onApplySuggestion(cmd)}
                  className={`slash-item ${idx === props.slash.activeCommand ? "active" : ""}`}
                >
                  <span className="slash-name">/{cmd.name}</span>
                  <span className="slash-detail">{cmd.value ?? cmd.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <StagedAttachmentTray
          attachments={props.stagedAttachments.attachments}
          onRemoveAttachment={attachmentIngestion.removeAttachment}
        />

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
                onChange={attachmentIngestion.handleFileInputChange}
              />
            </label>

            <button
              type="button"
              onClick={props.runtime.onSend}
              disabled={props.runtime.sendDisabled}
              className="ui-btn ui-btn-primary"
              style={{
                fontSize: sendFontSize,
                padding: `${Math.round(6 * actionScale)}px ${Math.round(16 * actionScale)}px`,
                minHeight: "auto",
              }}
            >
              {props.runtime.sendLabel ?? "Send"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "-2px" }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>

          <div className="footer-stats" style={{ fontSize: `${props.uiSettings.footerStatsFontSize}px` }}>
            {props.footer.onCompact && (
              <button
                type="button"
                onClick={props.footer.onCompact}
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
                  props.footer.sessionInfo.totalTokens ??
                  (Number.isFinite(props.footer.sessionInfo.inputTokens) || Number.isFinite(props.footer.sessionInfo.outputTokens)
                    ? (props.footer.sessionInfo.inputTokens ?? 0) + (props.footer.sessionInfo.outputTokens ?? 0)
                    : null);
                const used = Number.isFinite(total) ? total : null;
                const modelId = props.footer.sessionInfo.modelId || props.footer.sessionInfo.modelLabel;
                const model =
                  props.footer.models.find((item) => item.id === modelId) ??
                  props.footer.models.find((item) => `${item.provider}/${item.id}` === modelId) ??
                  props.footer.models.find((item) => `${item.provider}/${item.name}` === modelId) ??
                  null;
                const limit = model?.contextWindow ?? props.footer.sessionInfo.contextLimit ?? null;
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
            <span>In: {formatCompactTokens(props.footer.sessionInfo.inputTokens)}</span>
            <span>Out: {formatCompactTokens(props.footer.sessionInfo.outputTokens)}</span>
            <span>Total: {formatCompactTokens(props.footer.sessionInfo.totalTokens)}</span>

            <div className={`relative ${props.footer.thinkingMenuOpen ? "menu-open-ctx" : ""}`} ref={props.footer.thinkingMenuRef}>
              <button
                type="button"
                onClick={props.footer.onThinkingMenuToggle}
                className="ui-btn ui-btn-light"
                style={{
                  fontSize: `${props.uiSettings.footerStatsFontSize}px`,
                  padding: `${Math.round(props.uiSettings.footerStatsFontSize * 0.45)}px ${Math.round(props.uiSettings.footerStatsFontSize * 0.8)}px`,
                  minHeight: "auto",
                }}
              >
                Thinking: {props.footer.activeThinking}
              </button>
              {props.footer.thinkingMenuOpen && (
                <div className="thinking-menu">
                  {props.footer.thinkChoices.map((level) => {
                    const isActive = level === props.footer.activeThinking;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => props.footer.onThinkingSelect(level)}
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
