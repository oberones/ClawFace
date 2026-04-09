import React from "react";
import type { Attachment } from "../lib/types.ts";
import { formatBytes, truncate } from "../lib/format.ts";

type MessageFileAttachmentProps = {
  attachment: Attachment;
};

export function MessageFileAttachment(props: MessageFileAttachmentProps) {
  const { attachment } = props;

  return (
    <div className="attachment-file">
      <div>
        <div className="attachment-file-name">{truncate(attachment.name, 32)}</div>
        <div className="attachment-file-size">{formatBytes(attachment.size)}</div>
      </div>
      <div className="attachment-file-kind">FILE</div>
    </div>
  );
}
