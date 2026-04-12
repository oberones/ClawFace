export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateReplyDoneAudioFile(
  file: { type?: string | null; size: number },
  maxBytes: number,
): string | null {
  const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  if (!type.startsWith("audio/")) {
    return "Only audio files are supported.";
  }
  if (file.size > maxBytes) {
    return `File too large. Max ${formatBytes(maxBytes)}.`;
  }
  return null;
}

export function normalizeReplyDoneAudioDataUrl(result: unknown): string | null {
  const normalized = typeof result === "string" ? result.trim() : "";
  if (!normalized.startsWith("data:audio/") || !normalized.includes(";base64,")) {
    return null;
  }
  return normalized;
}

export function normalizeReplyDoneAudioFileName(fileName: string): string {
  return fileName.trim().slice(0, 120);
}
