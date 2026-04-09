import React from "react";
import type { Attachment } from "../lib/types.ts";
import { formatBytes, truncate } from "../lib/format.ts";

type StagedAttachmentTrayProps = {
  attachments: Attachment[];
  onRemoveAttachment: (attachmentId: string) => void;
};

export function StagedAttachmentTray(props: StagedAttachmentTrayProps) {
  if (props.attachments.length === 0) {
    return null;
  }

  return (
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
            onClick={() => props.onRemoveAttachment(att.id)}
            className="attachment-preview-remove"
            aria-label={`Remove ${att.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
