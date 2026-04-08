import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Attachment } from "../lib/types.ts";

async function fileToAttachment(file: File, idPrefix: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      resolve({
        id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        name: file.name || `upload.${file.type.split("/")[1] || "bin"}`,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl,
        isImage: file.type.startsWith("image/"),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function isFileDrag(event: React.DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  if (types.includes("Files")) {
    return true;
  }
  const items = Array.from(event.dataTransfer?.items ?? []);
  return items.some((item) => item.kind === "file");
}

export type UseAttachmentIngestionOptions = {
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  onError?: (message: string) => void;
};

export function useAttachmentIngestion(options: UseAttachmentIngestionOptions) {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const attachmentsRef = useRef(options.attachments);

  useEffect(() => {
    attachmentsRef.current = options.attachments;
  }, [options.attachments]);

  const appendFiles = useCallback(async (files: File[], idPrefix: string) => {
    if (files.length === 0) {
      return;
    }
    try {
      const next = await Promise.all(files.map((file) => fileToAttachment(file, idPrefix)));
      options.onAttachmentsChange([...attachmentsRef.current, ...next]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ingest attachments.";
      options.onError?.(message);
    }
  }, [options.onAttachmentsChange, options.onError]);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }, [isDragActive]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    void appendFiles(files, "drop");
  }, [appendFiles]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length === 0) {
      return;
    }
    event.preventDefault();
    void appendFiles(imageFiles, "paste");
  }, [appendFiles]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void appendFiles(files, "upload");
  }, [appendFiles]);

  const removeAttachment = useCallback((attachmentId: string) => {
    options.onAttachmentsChange(attachmentsRef.current.filter((item) => item.id !== attachmentId));
  }, [options.onAttachmentsChange]);

  const dragBindings = useMemo(() => ({
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  }), [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return {
    isDragActive,
    dragBindings,
    handlePaste,
    handleFileInputChange,
    removeAttachment,
  };
}
