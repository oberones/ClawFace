import React, { useMemo } from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import { useMessageImageAttachmentController } from "../../hooks/useMessageImageAttachmentController.ts";
import type { Attachment } from "../../lib/types.ts";
import type { MediaPreviewSelection } from "../../hooks/useMediaBrowserController.ts";

export type MediaBrowserPreviewProps = {
  previewSelection: MediaPreviewSelection | null;
  onOpenImage: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
};

function readRenderRefString(
  renderRef: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = renderRef[key];
  return typeof value === "string" ? value.trim() : "";
}

function formatPreviewDate(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "Unknown date";
  }
  return new Date(timestamp).toLocaleString();
}

function createPreviewAttachment(selection: MediaPreviewSelection): Attachment {
  const mimeType = readRenderRefString(selection.resolvedArtifact.renderRef, "mimeType") || "image/png";
  const sourcePath = readRenderRefString(selection.resolvedArtifact.renderRef, "sourcePath");
  const dataUrl =
    readRenderRefString(selection.resolvedArtifact.renderRef, "dataUrl") ||
    sourcePath ||
    "";

  return {
    id: selection.resolvedArtifact.id,
    name: selection.resolvedArtifact.displayName,
    size: 0,
    type: mimeType,
    dataUrl,
    sourcePath: sourcePath || undefined,
    isImage: selection.resolvedArtifact.kind === "image",
  };
}

function MediaPreviewImage(props: {
  attachment: Attachment;
  onOpenImage: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
}) {
  const controller = useMessageImageAttachmentController({
    attachment: props.attachment,
    onOpen: props.onOpenImage,
    resolveRemoteImage: props.resolveRemoteImage,
  });

  return (
    <div className="message-row assistant">
      <div className="message-bubble assistant fm-preview-bubble mb-preview-bubble">
        <button
          type="button"
          className="mb-preview-open"
          onClick={() => {
            void controller.openAttachment();
          }}
        >
          {controller.viewState === "preview" ? (
            <img
              src={controller.resolvedSrc}
              alt={props.attachment.name}
              className="fm-preview-img mb-preview-image"
              onError={controller.onPreviewImageError}
            />
          ) : (
            <div className="attachment-image-fallback mb-preview-fallback">
              <div className="attachment-image-fallback-content">
                <div>{controller.fallbackMessage}</div>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export function MediaBrowserPreview(props: MediaBrowserPreviewProps) {
  const selection = props.previewSelection;
  const attachment = useMemo(
    () => (selection ? createPreviewAttachment(selection) : null),
    [selection],
  );

  if (!selection || !attachment) {
    return (
      <div className="mb-preview-panel">
        <BrowserEmptyState
          icon={<span style={{ fontSize: "36px" }}>🖼️</span>}
          title="Select media to preview"
          copy="Choose an image from the browser to inspect it here."
        />
      </div>
    );
  }

  const artifact = selection.resolvedArtifact;
  const unsupportedReason =
    artifact.kind !== "image"
      ? `${artifact.kind.toUpperCase()} preview is out of scope for v1.`
      : selection.previewContentState === "unsupported"
        ? "This artifact is visible in the browser but preview is not supported in v1."
        : null;
  const previewWarning =
    selection.previewContentState === "error"
      ? "Recovering preview through the existing desktop/remote image path."
      : null;

  return (
    <div className="mb-preview-panel">
      <div className="mb-preview-header">
        <div className="mb-preview-copy">
          <div className="mb-preview-title">{artifact.displayName}</div>
          <div className="mb-preview-meta">
            <span>{artifact.sourceLabel}</span>
            {artifact.provenance?.label ? (
              <>
                <span>·</span>
                <span>{artifact.provenance.label}</span>
              </>
            ) : null}
            {artifact.sessionKey ? (
              <>
                <span>·</span>
                <span>Session {artifact.sessionKey}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{formatPreviewDate(artifact.createdAt)}</span>
          </div>
          {previewWarning ? <div className="mb-preview-warning">{previewWarning}</div> : null}
        </div>
        {artifact.kind === "image" ? (
          <button
            type="button"
            className="ui-btn ui-btn-light"
            onClick={() => {
              void props.onOpenImage(attachment);
            }}
          >
            Open
          </button>
        ) : null}
      </div>

      <div className="mb-preview-scroll">
        {unsupportedReason ? (
          <BrowserEmptyState
            icon={<span style={{ fontSize: "34px" }}>🧾</span>}
            title="Preview unavailable"
            copy={unsupportedReason}
          />
        ) : (
          <div className="chat-thread mb-preview-thread">
            <MediaPreviewImage
              attachment={attachment}
              onOpenImage={props.onOpenImage}
              resolveRemoteImage={props.resolveRemoteImage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
