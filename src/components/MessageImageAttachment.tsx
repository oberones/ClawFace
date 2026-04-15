import React from "react";
import type { Attachment } from "../lib/types.ts";
import { useMessageImageAttachmentController } from "../hooks/useMessageImageAttachmentController.ts";

type MessageImageAttachmentProps = {
  attachment: Attachment;
  onOpen: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
  generationPending?: boolean;
};

export function MessageImageAttachment(props: MessageImageAttachmentProps) {
  const controller = useMessageImageAttachmentController(props);
  const renderDebugDetails = () => {
    if (!controller.debugDetails.enabled) {
      return null;
    }
    return (
      <div className="attachment-image-debug-list">
        {controller.debugDetails.showSource && (
          <div className="attachment-image-debug-row">
            <span className="attachment-image-debug-label">Source</span>
            <span className="attachment-image-debug-value">{controller.debugDetails.sourceValue}</span>
          </div>
        )}
        {controller.debugDetails.showTry && (
          <div className="attachment-image-debug-row">
            <span className="attachment-image-debug-label">Trying</span>
            <span className="attachment-image-debug-value">{controller.debugDetails.tryValue}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <button
      type="button"
      className="attachment-image-button"
      onClick={() => {
        void controller.openAttachment();
      }}
      aria-label={`Open image ${props.attachment.name}`}
      title="Click to view larger"
    >
      <div className="attachment-image">
        {controller.viewState === "web-blocked" ? (
          <div className="attachment-image-fallback">
            <div className="attachment-image-fallback-content">
              <div>{controller.fallbackMessage}</div>
              {renderDebugDetails()}
            </div>
          </div>
        ) : controller.viewState === "loading-local" ? (
          <div className="attachment-image-fallback">
            <div className="attachment-image-fallback-content">
              <div>{controller.fallbackMessage}</div>
              {renderDebugDetails()}
            </div>
          </div>
        ) : controller.viewState === "fallback" ? (
          <div className="attachment-image-fallback">
            <div className="attachment-image-fallback-content">
              <div>{controller.fallbackMessage}</div>
              {renderDebugDetails()}
            </div>
          </div>
        ) : (
          <img
            src={controller.resolvedSrc}
            alt={props.attachment.name}
            className="attachment-image-preview"
            onError={controller.onPreviewImageError}
          />
        )}
      </div>
    </button>
  );
}
