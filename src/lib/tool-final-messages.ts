export function collectToolFinalMessages<T>(params: {
  committedStreamMessage: T | null;
  includeCommittedStreamMessage: boolean;
  toolAttachmentMessage: T | null;
  toolAttachmentMessagesFromUpdates: T[];
}): T[] {
  const out: T[] = [];
  if (params.includeCommittedStreamMessage && params.committedStreamMessage) {
    out.push(params.committedStreamMessage);
  }
  if (params.toolAttachmentMessage) {
    out.push(params.toolAttachmentMessage);
  }
  if (params.toolAttachmentMessagesFromUpdates.length > 0) {
    out.push(...params.toolAttachmentMessagesFromUpdates);
  }
  return out;
}
