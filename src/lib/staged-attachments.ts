import type { Attachment } from "./types.ts";

export type StagedAttachmentsState = {
  attachments: Attachment[];
  replaceAttachments: (next: Attachment[]) => void;
  appendAttachments: (next: Attachment[]) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
};
