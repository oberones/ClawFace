import { extractImages, extractMessageRunId, extractText, isToolMessage } from "./message-extract.ts";
import { normalizeMediaPathCandidate } from "./media-path-utils.ts";
import { applyPathPrefixMappings } from "./path-prefix-mappings.ts";
import {
  isDesktopRuntime,
  normalizeRuntimeImageSourceData,
  toRuntimeRenderableLocalPath,
} from "./message-image-source.ts";
import { inferImageMimeTypeFromPath } from "./remote-media-resolution.ts";
import type { Attachment, ChatMessage } from "./types.ts";
import { generateUUID } from "./uuid.ts";

const MEDIA_PREFIX_RE = /\bmedia\s*:/i;
const ATTACHMENT_FINGERPRINT_HEAD = 96;
const ATTACHMENT_FINGERPRINT_TAIL = 64;
const WORKSPACE_MARKER = "/.openclaw/workspace";

export type AttachmentParsingRuntimeHints = {
  homeDir?: string | null;
  workspaceDir?: string | null;
};

type ToChatMessageOptions = {
  fallbackTimestamp?: number;
  runtimeHints?: AttachmentParsingRuntimeHints;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimTrailingSlashes(value: string): string {
  const normalized = normalizeFsPath(value).trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/g, "");
}

function deriveHomeFromWorkspacePath(workspacePath: string): string {
  const normalized = trimTrailingSlashes(workspacePath).toLowerCase();
  const markerIndex = normalized.indexOf(WORKSPACE_MARKER);
  if (markerIndex <= 0) {
    return "";
  }
  return trimTrailingSlashes(workspacePath).slice(0, markerIndex);
}

function resolveRuntimeHints(runtimeHints?: AttachmentParsingRuntimeHints): {
  homeDir: string;
  workspaceDir: string;
} {
  const desktopHomeDir = trimTrailingSlashes(window.desktopInfo?.homeDir ?? "");
  const desktopWorkspaceDir = trimTrailingSlashes(window.desktopInfo?.workspaceDir ?? "");
  const hintedHomeDir = trimTrailingSlashes(runtimeHints?.homeDir ?? "");
  const hintedWorkspaceDir = trimTrailingSlashes(runtimeHints?.workspaceDir ?? "");
  const homeDir =
    desktopHomeDir ||
    hintedHomeDir ||
    (hintedWorkspaceDir ? deriveHomeFromWorkspacePath(hintedWorkspaceDir) : "");
  const workspaceDir =
    desktopWorkspaceDir ||
    hintedWorkspaceDir ||
    (homeDir ? `${homeDir}${WORKSPACE_MARKER}` : "");
  return { homeDir, workspaceDir };
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeMediaDirectivePath(value: string): string {
  let next = normalizeMediaPathCandidate(value);
  if (!next) {
    return "";
  }
  if (next.startsWith("`") && next.endsWith("`") && next.length > 1) {
    next = next.slice(1, -1).trim();
  }
  return stripWrappingQuotes(next);
}

function isAbsoluteFsPath(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("~/")
  );
}

function fileNameFromPath(value: string): string {
  const normalized = normalizeFsPath(value);
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "image";
}

function resolveMediaRelativeImagePath(value: string, runtimeHints?: AttachmentParsingRuntimeHints): string | null {
  const trimmed = value.trim().replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (!trimmed || !inferImageMimeTypeFromPath(trimmed)) {
    return null;
  }
  const { homeDir } = resolveRuntimeHints(runtimeHints);
  if (!homeDir) {
    return null;
  }
  return `${homeDir}/.openclaw/media/${trimmed}`;
}

function resolveMediaDirectivePath(
  rawPath: string,
  runtimeHints?: AttachmentParsingRuntimeHints,
): string | null {
  const cleaned = normalizeMediaDirectivePath(rawPath);
  if (!cleaned) {
    return null;
  }
  const { homeDir, workspaceDir } = resolveRuntimeHints(runtimeHints);
  const normalized = normalizeFsPath(cleaned);
  if (cleaned.startsWith("~/")) {
    if (!homeDir) {
      return null;
    }
    return `${homeDir}/${cleaned.slice(2)}`;
  }
  if (isAbsoluteFsPath(cleaned)) {
    return cleaned;
  }
  if (homeDir) {
    if (normalized.startsWith(".openclaw/media/")) {
      return `${homeDir}/${normalized}`;
    }
    if (normalized.startsWith("openclaw/media/")) {
      return `${homeDir}/.${normalized}`;
    }
    if (normalized.startsWith(".openclaw/workspace/")) {
      return `${homeDir}/${normalized}`;
    }
    if (normalized.startsWith("openclaw/workspace/")) {
      return `${homeDir}/.${normalized}`;
    }
  }
  if (normalized.includes("/") || normalized.includes("\\")) {
    return !isDesktopRuntime() ? cleaned : null;
  }
  const mediaRelativePath = resolveMediaRelativeImagePath(cleaned, runtimeHints);
  if (mediaRelativePath) {
    return mediaRelativePath;
  }
  if (!workspaceDir) {
    if (!isDesktopRuntime()) {
      return cleaned;
    }
    return null;
  }
  return `${workspaceDir}/${cleaned}`;
}

export function extractMediaAttachmentsFromText(
  text: string,
  runtimeHints?: AttachmentParsingRuntimeHints,
): {
  cleanedText: string;
  attachments: Attachment[];
} {
  const attachments: Attachment[] = [];
  const seen = new Set<string>();
  const retainedLines: string[] = [];
  const lines = text.split(/\r?\n/);
  const { homeDir } = resolveRuntimeHints(runtimeHints);

  for (const line of lines) {
    const match = MEDIA_PREFIX_RE.exec(line);
    if (!match || match.index < 0) {
      retainedLines.push(line);
      continue;
    }
    const prefix = line.slice(0, match.index).trimEnd();
    const rawPath = line.slice(match.index + match[0].length).trim();
    const resolved = resolveMediaDirectivePath(rawPath, runtimeHints);
    if (!resolved) {
      retainedLines.push(line);
      continue;
    }
    const mappedResolved = applyPathPrefixMappings(resolved, { homeDir });
    const mimeType = inferImageMimeTypeFromPath(mappedResolved);
    const dataUrl = toRuntimeRenderableLocalPath(mappedResolved);
    if (!mimeType || !dataUrl) {
      retainedLines.push(line);
      continue;
    }
    if (seen.has(dataUrl)) {
      continue;
    }
    seen.add(dataUrl);
    attachments.push({
      id: `${generateUUID()}-media`,
      name: fileNameFromPath(mappedResolved),
      size: 0,
      type: mimeType,
      dataUrl,
      sourcePath: resolved,
      isImage: true,
    });
    if (prefix) {
      retainedLines.push(prefix);
    }
  }

  const cleanedText = retainedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cleanedText, attachments };
}

export function buildAttachmentSignature(type: string, dataUrl: string): string {
  const normalizedType = type.trim().toLowerCase();
  const normalizedDataUrl = dataUrl.trim();
  const head = normalizedDataUrl.slice(0, ATTACHMENT_FINGERPRINT_HEAD);
  const tail =
    normalizedDataUrl.length > ATTACHMENT_FINGERPRINT_HEAD + ATTACHMENT_FINGERPRINT_TAIL
      ? normalizedDataUrl.slice(-ATTACHMENT_FINGERPRINT_TAIL)
      : "";
  return `${normalizedType}:${normalizedDataUrl.length}:${head}:${tail}`;
}

function estimateBase64Bytes(base64: string): number {
  const sanitized = base64.replace(/\s+/g, "");
  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
}

function toolMessageMayContainImage(raw: unknown): boolean {
  if (!isRecord(raw)) {
    return false;
  }
  if (Object.keys(raw).some((key) => key.toLowerCase().includes("image"))) {
    return true;
  }
  const directType = getString(raw, ["type", "event", "kind"])?.toLowerCase() ?? "";
  if (directType.includes("image")) {
    return true;
  }
  const content = raw.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!isRecord(part)) {
        continue;
      }
      const type = getString(part, ["type"])?.toLowerCase() ?? "";
      if (type.includes("image")) {
        return true;
      }
      if (part.image_url !== undefined || part.imageUrl !== undefined) {
        return true;
      }
      if (isRecord(part.source)) {
        const mediaType =
          getString(part.source, ["media_type", "mimeType", "mime_type", "contentType", "content_type"]) ??
          "";
        if (mediaType.toLowerCase().includes("image")) {
          return true;
        }
      }
      if (Object.keys(part).some((key) => key.toLowerCase().includes("image"))) {
        return true;
      }
    }
  }
  const candidates = [raw.content, raw.output, raw.result, raw.response, raw.text];
  for (const value of candidates) {
    if (typeof value !== "string") {
      continue;
    }
    const sample = value.slice(0, 2048).toLowerCase();
    if (
      sample.includes("data:image/") ||
      sample.includes("media:") ||
      /\.(png|jpe?g|webp|gif|bmp|svg)\b/i.test(sample)
    ) {
      return true;
    }
  }
  const extractedText = extractText(raw);
  if (extractedText) {
    const sample = extractedText.slice(0, 2048).toLowerCase();
    if (
      sample.includes("data:image/") ||
      sample.includes("media:") ||
      /\.(png|jpe?g|webp|gif|bmp|svg)\b/i.test(sample)
    ) {
      return true;
    }
  }
  return false;
}

export function toChatMessage(raw: unknown, options?: ToChatMessageOptions): ChatMessage | null {
  const toolMessage = isToolMessage(raw);
  if (toolMessage && !toolMessageMayContainImage(raw)) {
    return null;
  }
  const rawText = extractText(raw) ?? "";
  let text = rawText;
  let mediaAttachments: Attachment[] = [];
  if (rawText && MEDIA_PREFIX_RE.test(rawText)) {
    const mediaResult = extractMediaAttachmentsFromText(rawText, options?.runtimeHints);
    text = mediaResult.cleanedText;
    mediaAttachments = mediaResult.attachments;
  }
  const images = extractImages(raw);
  const imageAttachments: Attachment[] = images
    .map((img, index): Attachment | null => {
      const normalized = normalizeRuntimeImageSourceData(img.data, img.mimeType);
      if (!normalized.dataUrl) {
        return null;
      }
      return {
        id: `${generateUUID()}-${index}`,
        name: `image-${index + 1}`,
        size: normalized.fromBase64 ? estimateBase64Bytes(img.data) : normalized.dataUrl.length,
        type: img.mimeType,
        dataUrl: normalized.dataUrl,
        sourcePath: normalized.sourcePath,
        isImage: true,
      };
    })
    .filter((item): item is Attachment => item !== null);
  const dedupeSignatures = new Set<string>();
  const attachments = [...imageAttachments, ...mediaAttachments].filter((item) => {
    const signature = buildAttachmentSignature(item.type, item.dataUrl);
    if (dedupeSignatures.has(signature)) {
      return false;
    }
    dedupeSignatures.add(signature);
    return true;
  });
  if (toolMessage && attachments.length === 0) {
    return null;
  }
  const renderedText = toolMessage ? "" : text;
  if (!renderedText && attachments.length === 0) {
    return null;
  }
  const roleRaw = (raw as Record<string, unknown>)?.role;
  const timestampRaw = (raw as Record<string, unknown>)?.timestamp;
  const runIdRaw = extractMessageRunId(raw) ?? undefined;
  const role = toolMessage
    ? "assistant"
    : roleRaw === "user"
      ? "user"
      : roleRaw === "assistant"
        ? "assistant"
        : "system";
  return {
    id: generateUUID(),
    role,
    text: renderedText,
    timestamp:
      typeof timestampRaw === "number" && Number.isFinite(timestampRaw)
        ? timestampRaw
        : options?.fallbackTimestamp ?? Date.now(),
    attachments: attachments.length > 0 ? attachments : undefined,
    runId: runIdRaw,
    raw,
  };
}

export function toChatMessageSafe(raw: unknown, options?: ToChatMessageOptions): ChatMessage | null {
  try {
    return toChatMessage(raw, options);
  } catch {
    return null;
  }
}
