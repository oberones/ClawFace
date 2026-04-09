import { useCallback, useState } from "react";
import type { Attachment } from "../lib/types.ts";

export function useStagedAttachments(initialValue: Attachment[] = []) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialValue);

  const replaceAttachments = useCallback((next: Attachment[]) => {
    setAttachments(next);
  }, []);

  const appendAttachments = useCallback((next: Attachment[]) => {
    if (next.length === 0) {
      return;
    }
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    replaceAttachments,
    appendAttachments,
    removeAttachment,
    clearAttachments,
  };
}
