import React, { useMemo } from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import { useMessageImageAttachmentController } from "../../hooks/useMessageImageAttachmentController.ts";
import {
  getMediaArtifactProvenanceLabel,
  getMediaArtifactSessionLabel,
} from "../../lib/media-browser-items.ts";
import type { Attachment } from "../../lib/types.ts";
import type { MediaPreviewSelection } from "../../hooks/useMediaBrowserController.ts";
import type { MediaReuseRequest } from "../../lib/media-browser-reference.ts";

export type MediaBrowserPreviewProps = {
  previewSelection: MediaPreviewSelection | null;
  canReuseInChat?: boolean;
  reuseRequest?: MediaReuseRequest | null;
  onReuseInChat?: () => void;
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
  const sessionLabel = getMediaArtifactSessionLabel(artifact);
  const provenanceLabel = getMediaArtifactProvenanceLabel(artifact);
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
  const reuseFeedback =
    props.reuseRequest?.artifactId === artifact.id
      ? props.reuseRequest.status === "inserted"
        ? "Inserted into the current chat draft."
        : props.reuseRequest.status === "failed"
          ? "Could not insert this image into the current chat."
          : props.reuseRequest.status === "inserting"
            ? "Adding image reference to the current chat draft..."
            : null
      : null;

  return (
    <div className="mb-preview-panel">
      <div className="mb-preview-header">
        <div className="mb-preview-copy">
          <div className="mb-preview-title">{artifact.displayName}</div>
          <div className="mb-preview-meta">
            <span>{provenanceLabel}</span>
            {sessionLabel ? (
              <>
                <span>·</span>
                <span>From {sessionLabel}</span>
              </>
            ) : null}
            {artifact.runId ? (
              <>
                <span>·</span>
                <span>Run {artifact.runId}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{formatPreviewDate(artifact.createdAt)}</span>
          </div>
          {previewWarning ? <div className="mb-preview-warning">{previewWarning}</div> : null}
          {reuseFeedback ? <div className="mb-preview-note">{reuseFeedback}</div> : null}
        </div>
        <div className="mb-preview-actions">
          {props.canReuseInChat && props.onReuseInChat ? (
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={props.onReuseInChat}
            >
              Reuse In Chat
            </button>
          ) : null}
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
