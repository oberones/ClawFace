import React from "react";
import type { Attachment } from "../lib/types.ts";

type MessageAttachmentListProps = {
  attachments: Attachment[];
  renderImageAttachment: (attachment: Attachment) => React.ReactNode;
  renderFileAttachment: (attachment: Attachment) => React.ReactNode;
};

export function MessageAttachmentList(props: MessageAttachmentListProps) {
  if (props.attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachments-wrap">
      {props.attachments.map((attachment) =>
        attachment.isImage
          ? props.renderImageAttachment(attachment)
          : props.renderFileAttachment(attachment)
      )}
    </div>
  );
}
