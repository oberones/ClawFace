import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, ChatMessage } from "../lib/types.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import { formatBytes, truncate } from "../lib/format.ts";

const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";

type MotionVarsStyle = React.CSSProperties & Record<`--${string}`, string>;

function normalizeMessageTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return Date.now();
  }
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatLocalDateTime(timestamp: number): string {
  const date = new Date(normalizeMessageTimestamp(timestamp));
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatMessageDateTime(timestamp: number): string {
  const normalized = normalizeMessageTimestamp(timestamp);
  return new Date(normalized).toISOString();
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildMotionVars(id: string): MotionVarsStyle {
  const hash = hashString(id);
  const byte = (shift: number) => ((hash >>> shift) & 0xff) / 255;
  const dx = (byte(0) - 0.5) * 6;
  const timeScale = 0.9 + byte(24) * 0.2;
  const emergeY = 42 + byte(4) * 30;
  return {
    "--pop-dx": `${dx.toFixed(1)}px`,
    "--pop-time-scale": `${timeScale.toFixed(3)}`,
    "--pop-emerge-y": `${Math.round(emergeY)}px`,
  };
}

function filePathFromFileUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "file:") {
      return null;
    }
    let pathname = decodeURIComponent(parsed.pathname || "");
    if (!pathname) {
      return null;
    }
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return null;
  }
}

function stripPathDecorators(value: string): string {
  let next = value.trim();
  next = next.replace(/^media\s*:\s*/i, "").trim();
  if (!next) {
    return "";
  }
  const wrappers: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["`", "`"],
    ["<", ">"],
    ["(", ")"],
    ["[", "]"],
  ];
  for (const [left, right] of wrappers) {
    if (next.startsWith(left) && next.endsWith(right) && next.length >= 2) {
      next = next.slice(1, -1).trim();
    }
  }
  return next.trim();
}

function looksLikeImagePath(value: string): boolean {
  const noQuery = value.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!noQuery) {
    return false;
  }
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(noQuery);
}

function looksLikeAbsoluteImagePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (
    trimmed.startsWith(".openclaw/workspace/") ||
    trimmed.startsWith("openclaw/workspace/") ||
    trimmed.includes("/.openclaw/workspace/")
  ) {
    return true;
  }
  if (!looksLikeImagePath(trimmed)) {
    return false;
  }
  return /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("~/");
}

function resolveWorkspaceRelativeLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (!trimmed || !looksLikeImagePath(trimmed)) {
    return null;
  }
  const workspaceDir = window.desktopInfo?.workspaceDir?.trim();
  if (!workspaceDir) {
    return null;
  }
  return `${workspaceDir}/${trimmed}`;
}

function mapWorkspaceAliasToLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const homeDir = window.desktopInfo?.homeDir?.trim();
  if (!trimmed || !homeDir) {
    return null;
  }
  if (trimmed.startsWith(".openclaw/workspace/")) {
    return `${homeDir}/${trimmed}`;
  }
  if (trimmed.startsWith("openclaw/workspace/")) {
    return `${homeDir}/.${trimmed}`;
  }
  return null;
}

function isLikelyPathOrUrl(value: string): boolean {
  const trimmed = stripPathDecorators(value);
  if (!trimmed) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.toLowerCase().includes("__claw/local-image")) {
    return true;
  }
  if (
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~/") ||
    trimmed.startsWith(".openclaw/workspace/") ||
    trimmed.startsWith("openclaw/workspace/")
  ) {
    return true;
  }
  return looksLikeImagePath(trimmed);
}

function decodeCompactBase64AsUtf8(value: string): string | null {
  const compact = value.replace(/\s+/g, "").trim();
  if (!compact || compact.length > 32768) {
    return null;
  }
  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+=*$/.test(normalized)) {
    return null;
  }
  const remainder = normalized.length % 4;
  if (remainder === 1) {
    return null;
  }
  const padded = remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`;
  try {
    const binary = atob(padded);
    if (!binary) {
      return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decodedRaw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const printableCount = decodedRaw.split("").filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    }).length;
    if (decodedRaw.length === 0 || printableCount / decodedRaw.length < 0.75) {
      return null;
    }
    const decoded = decodedRaw.trim();
    if (!decoded || decoded.length > 2048) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function normalizeDataImageUrl(value: string): string | null {
  const trimmed = value.trim();
  const match = /^data:(image\/[a-z0-9.+-]+)(?:;[a-z0-9.+-]+=[^;,]+)*;base64,([\s\S]+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const mimeType = match[1].toLowerCase();
  const payloadRaw = match[2] ?? "";
  const payloadVariants = [payloadRaw];
  if (payloadRaw.includes("%")) {
    try {
      const decoded = decodeURIComponent(payloadRaw);
      if (decoded && decoded !== payloadRaw) {
        payloadVariants.push(decoded);
      }
    } catch {
      // keep raw payload only
    }
  }
  for (const payloadVariant of payloadVariants) {
    const payloadCompact = payloadVariant.replace(/\s+/g, "");
    if (!payloadCompact) {
      continue;
    }
    const payloadNormalized = payloadCompact.replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]+=*$/.test(payloadNormalized)) {
      continue;
    }
    const remainder = payloadNormalized.length % 4;
    if (remainder === 1) {
      continue;
    }
    const padded =
      remainder === 0 ? payloadNormalized : `${payloadNormalized}${"=".repeat(4 - remainder)}`;
    return `data:${mimeType};base64,${padded}`;
  }
  return null;
}

function summarizeSourceForError(value: string): string {
  const trimmed = stripPathDecorators(value).replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "empty";
  }
  if (trimmed.toLowerCase().startsWith("data:image/")) {
    const payload = /^data:image\/[^;]+;base64,([\s\S]+)$/i.exec(trimmed)?.[1] ?? "";
    const compact = payload.replace(/\s+/g, "");
    return `data-len-${compact.length}`;
  }
  if (trimmed.length <= 64) {
    return trimmed;
  }
  return `${trimmed.slice(0, 64)}...`;
}

function extractImageSourceCandidates(value: string): string[] {
  const initial = stripPathDecorators(value);
  if (!initial) {
    return [];
  }
  const seen = new Set<string>();
  const candidates: string[] = [];
  const push = (raw: string) => {
    const next = stripPathDecorators(raw);
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    candidates.push(next);
  };
  const tryExtractFromText = (text: string) => {
    const candidate = stripPathDecorators(text);
    if (!candidate) {
      return;
    }
    if (isLikelyPathOrUrl(candidate)) {
      push(candidate);
    }
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded && decoded !== candidate && isLikelyPathOrUrl(decoded)) {
        push(decoded);
      }
    } catch {
      // ignore
    }
    const maybeJson = candidate.trim();
    if (!maybeJson.startsWith("{") && !maybeJson.startsWith("[")) {
      return;
    }
    try {
      const parsed = JSON.parse(maybeJson) as unknown;
      const queue: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
      let traversed = 0;
      while (queue.length > 0 && traversed < 220) {
        const current = queue.shift();
        if (!current) {
          continue;
        }
        traversed += 1;
        if (typeof current.value === "string") {
          const textValue = stripPathDecorators(current.value);
          if (textValue && isLikelyPathOrUrl(textValue)) {
            push(textValue);
          }
          continue;
        }
        if (!current.value || current.depth >= 6) {
          continue;
        }
        if (Array.isArray(current.value)) {
          for (const nested of current.value) {
            queue.push({ value: nested, depth: current.depth + 1 });
          }
          continue;
        }
        if (typeof current.value === "object") {
          for (const nested of Object.values(current.value as Record<string, unknown>)) {
            if (typeof nested === "string" || Array.isArray(nested) || (nested && typeof nested === "object")) {
              queue.push({ value: nested, depth: current.depth + 1 });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  };

  push(initial);
  tryExtractFromText(initial);
  try {
    const decoded = decodeURIComponent(initial);
    if (decoded && decoded !== initial) {
      push(decoded);
      tryExtractFromText(decoded);
    }
  } catch {
    // ignore
  }

  const dataUrlPayload = /^data:image\/[^;]+;base64,([^,\s]+)$/i.exec(initial)?.[1]?.trim() ?? "";
  if (dataUrlPayload) {
    push(dataUrlPayload);
    try {
      const decodedPayload = decodeURIComponent(dataUrlPayload);
      if (decodedPayload && decodedPayload !== dataUrlPayload) {
        push(decodedPayload);
      }
      const decodedPayloadText = decodeCompactBase64AsUtf8(decodedPayload);
      if (decodedPayloadText && isLikelyPathOrUrl(decodedPayloadText)) {
        push(decodedPayloadText);
        tryExtractFromText(decodedPayloadText);
      }
    } catch {
      // ignore
    }
    const decodedPayloadText = decodeCompactBase64AsUtf8(dataUrlPayload);
    if (decodedPayloadText && isLikelyPathOrUrl(decodedPayloadText)) {
      push(decodedPayloadText);
      tryExtractFromText(decodedPayloadText);
    }
  }

  const initialDecodedText = decodeCompactBase64AsUtf8(initial);
  if (initialDecodedText && isLikelyPathOrUrl(initialDecodedText)) {
    push(initialDecodedText);
    tryExtractFromText(initialDecodedText);
  }

  return candidates;
}

function buildDesktopLocalImageUrl(filePath: string): string {
  return `${DESKTOP_LOCAL_IMAGE_SCHEME}://open?path=${encodeURIComponent(filePath)}`;
}

function localPathFromDesktopLocalImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== `${DESKTOP_LOCAL_IMAGE_SCHEME}:`) {
      return null;
    }
    const rawPath = parsed.searchParams.get("path");
    if (rawPath) {
      return decodeURIComponent(rawPath);
    }
    let pathname = decodeURIComponent(parsed.pathname || "");
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

function filePathFromImageSource(value: string): string | null {
  const trimmed = stripPathDecorators(value);
  if (!trimmed) {
    return null;
  }
  const fromDesktopLocalImage = localPathFromDesktopLocalImageUrl(trimmed);
  if (fromDesktopLocalImage) {
    return fromDesktopLocalImage;
  }
  const dataUrlPayload = /^data:image\/[^;]+;base64,([^,\s]+)$/i.exec(trimmed)?.[1]?.trim() ?? "";
  if (dataUrlPayload) {
    let decodedPayload = dataUrlPayload;
    try {
      decodedPayload = decodeURIComponent(dataUrlPayload);
    } catch {
      // keep raw payload
    }
    const cleanedPayload = stripPathDecorators(decodedPayload);
    const mappedFromAlias = mapWorkspaceAliasToLocalPath(cleanedPayload);
    if (mappedFromAlias) {
      return mappedFromAlias;
    }
    if (looksLikeAbsoluteImagePath(cleanedPayload)) {
      return cleanedPayload;
    }
    const workspaceRelativePayload = resolveWorkspaceRelativeLocalPath(cleanedPayload);
    if (workspaceRelativePayload) {
      return workspaceRelativePayload;
    }
  }
  if (/^file:\/\/\/__claw\/local-image\?/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const rawPath = parsed.searchParams.get("path");
      if (!rawPath) {
        return null;
      }
      return decodeURIComponent(rawPath);
    } catch {
      return null;
    }
  }
  if (trimmed.toLowerCase().includes("__claw/local-image")) {
    const marker = "__claw/local-image?";
    const parsePath = (raw: string | null): string | null => {
      if (!raw) {
        return null;
      }
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    };
    const normalized = trimmed.toLowerCase();
    if (normalized.startsWith(marker)) {
      return parsePath(new URLSearchParams(trimmed.slice(marker.length)).get("path"));
    }
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex >= 0) {
      return parsePath(new URLSearchParams(trimmed.slice(markerIndex + marker.length)).get("path"));
    }
    try {
      const parsed = new URL(trimmed, "http://127.0.0.1");
      return parsePath(parsed.searchParams.get("path"));
    } catch {
      return null;
    }
  }
  const fromFileUrl = filePathFromFileUrl(trimmed);
  if (fromFileUrl) {
    return fromFileUrl;
  }
  const mappedFromAlias = mapWorkspaceAliasToLocalPath(trimmed);
  if (mappedFromAlias) {
    return mappedFromAlias;
  }
  if (trimmed.startsWith("~/")) {
    const homeDir = window.desktopInfo?.homeDir?.trim();
    if (homeDir) {
      return `${homeDir}/${trimmed.slice(2)}`;
    }
    return trimmed;
  }
  const workspaceRelativePath = resolveWorkspaceRelativeLocalPath(trimmed);
  if (workspaceRelativePath) {
    return workspaceRelativePath;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("/")) {
    try {
      const strippedQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
      return decodeURIComponent(strippedQuery);
    } catch {
      return trimmed;
    }
  }
  return null;
}

function normalizeHttpImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}${trimmed}`;
  }
  return null;
}

function isDesktopRuntime(): boolean {
  if (window.desktopInfo?.isDesktop) {
    return true;
  }
  return window.location.protocol === "file:";
}

function toDesktopRenderableSrc(value: string): string {
  if (!isDesktopRuntime()) {
    return value;
  }
  const path = filePathFromImageSource(value);
  if (!path) {
    return value;
  }
  return buildDesktopLocalImageUrl(path);
}

function isLikelyLocalFileSource(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.toLowerCase().startsWith(`${DESKTOP_LOCAL_IMAGE_SCHEME}:`)) {
    return true;
  }
  if (/^file:/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return true;
  }
  if (
    /^\/(?:home|users|tmp|var|private|mnt|volumes)\//i.test(trimmed) ||
    trimmed.startsWith("~/") ||
    trimmed.startsWith("\\\\")
  ) {
    return true;
  }
  return false;
}

function MessageImageAttachment(props: {
  attachment: Attachment;
  onOpen: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
}) {
  const [resolvedSrc, setResolvedSrc] = useState(toDesktopRenderableSrc(props.attachment.dataUrl));
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const desktopReadImageFile = window.desktopInfo?.readImageFile;
  const desktopFetchImageUrl = window.desktopInfo?.fetchImageUrl;
  const localPathCandidate = filePathFromImageSource(resolvedSrc || props.attachment.dataUrl);
  const usesDesktopLocalScheme = resolvedSrc.trim().toLowerCase().startsWith(`${DESKTOP_LOCAL_IMAGE_SCHEME}:`);
  const requiresDesktopDecode =
    isDesktopRuntime() &&
    typeof desktopReadImageFile === "function" &&
    Boolean(localPathCandidate) &&
    !usesDesktopLocalScheme;
  const desktopBridgeMissing =
    isDesktopRuntime() && typeof desktopReadImageFile !== "function";
  const webLocalFileBlocked = !isDesktopRuntime() && isLikelyLocalFileSource(resolvedSrc);
  const desktopResolveTriedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setResolvedSrc(toDesktopRenderableSrc(props.attachment.dataUrl));
    setFailedToLoad(false);
    setLoadError(null);
  }, [props.attachment.dataUrl]);

  const tryResolveLocalImage = useCallback(async (): Promise<Attachment | null> => {
    const sourceValue = (resolvedSrc || props.attachment.dataUrl).trim();
    const sourceCandidates = extractImageSourceCandidates(sourceValue);
    const sourceKind = sourceValue.toLowerCase().startsWith("data:image/")
      ? "data-url"
      : sourceValue.toLowerCase().startsWith("http:")
      ? "http-url"
      : sourceValue.toLowerCase().startsWith("https:")
      ? "https-url"
      : sourceValue.toLowerCase().startsWith("file:")
      ? "file-url"
      : sourceValue.toLowerCase().includes("__claw/local-image")
      ? "proxy-url"
      : "raw";
    let filePath: string | null = null;
    for (const candidate of sourceCandidates) {
      filePath = filePathFromImageSource(candidate);
      if (filePath) {
        break;
      }
    }
    if (!filePath) {
      if (sourceKind === "data-url") {
        for (const candidate of sourceCandidates) {
          const normalizedDataUrl = normalizeDataImageUrl(candidate);
          if (normalizedDataUrl && normalizedDataUrl !== sourceValue) {
            setResolvedSrc(normalizedDataUrl);
            setFailedToLoad(false);
            setLoadError(null);
            return {
              ...props.attachment,
              dataUrl: normalizedDataUrl,
            };
          }
        }
        setFailedToLoad(true);
        setLoadError(`img-decode-failed:${sourceKind}:${summarizeSourceForError(sourceValue)}`);
        return null;
      }
      let remoteUrl: string | null = null;
      for (const candidate of sourceCandidates) {
        remoteUrl = normalizeHttpImageUrl(candidate);
        if (remoteUrl) {
          break;
        }
      }
      if (remoteUrl && typeof desktopFetchImageUrl === "function") {
        try {
          const fetched = await desktopFetchImageUrl(remoteUrl);
          const nextDataUrl =
            fetched?.ok && typeof fetched.dataUrl === "string" ? fetched.dataUrl.trim() : "";
          if (nextDataUrl) {
            setResolvedSrc(nextDataUrl);
            setFailedToLoad(false);
            setLoadError(null);
            return {
              ...props.attachment,
              dataUrl: nextDataUrl,
            };
          }
          setFailedToLoad(true);
          setLoadError(fetched?.error ?? "remote-fetch-failed");
          return null;
        } catch {
          setFailedToLoad(true);
          setLoadError("remote-fetch-failed");
          return null;
        }
      }
      setFailedToLoad(true);
      setLoadError(`path-parse-failed:${sourceKind}:${summarizeSourceForError(sourceValue)}`);
      return null;
    }
    const tryResolveRemote = async (): Promise<Attachment | null> => {
      if (!props.resolveRemoteImage) {
        return null;
      }
      const remoteDataUrl = await props.resolveRemoteImage(filePath);
      const nextDataUrl = typeof remoteDataUrl === "string" ? remoteDataUrl.trim() : "";
      if (!nextDataUrl) {
        return null;
      }
      setResolvedSrc(nextDataUrl);
      setFailedToLoad(false);
      setLoadError(null);
      return {
        ...props.attachment,
        dataUrl: nextDataUrl,
      };
    };

    let localError: string | null = null;
    const readImageFile = desktopReadImageFile;
    if (readImageFile) {
      try {
        const result = await readImageFile(filePath);
        if (result.ok && typeof result.dataUrl === "string" && result.dataUrl.trim()) {
          const nextDataUrl = result.dataUrl.trim();
          setResolvedSrc(nextDataUrl);
          setFailedToLoad(false);
          setLoadError(null);
          return {
            ...props.attachment,
            dataUrl: nextDataUrl,
          };
        }
        localError = result.error ?? "read-failed";
      } catch {
        localError = "read-failed";
      }
    } else {
      localError = "desktop-api-unavailable";
    }

    const remoteResolved = await tryResolveRemote();
    if (remoteResolved) {
      return remoteResolved;
    }

    if (localError) {
      setFailedToLoad(true);
      setLoadError(localError);
      return null;
    }
    setFailedToLoad(true);
    setLoadError("read-failed");
    return null;
  }, [desktopFetchImageUrl, desktopReadImageFile, props.attachment, props.resolveRemoteImage, resolvedSrc]);

  useEffect(() => {
    if (!requiresDesktopDecode || !localPathCandidate) {
      return;
    }
    if (desktopResolveTriedRef.current.has(localPathCandidate)) {
      return;
    }
    desktopResolveTriedRef.current.add(localPathCandidate);
    void tryResolveLocalImage();
  }, [localPathCandidate, props.attachment.dataUrl, requiresDesktopDecode, resolvedSrc, tryResolveLocalImage]);

  const openAttachment = useCallback(async () => {
    if (requiresDesktopDecode || failedToLoad) {
      const recovered = await tryResolveLocalImage();
      if (recovered) {
        props.onOpen(recovered);
        return;
      }
    }
    if (!failedToLoad) {
      const next =
        resolvedSrc === props.attachment.dataUrl
          ? props.attachment
          : {
              ...props.attachment,
              dataUrl: resolvedSrc,
            };
      props.onOpen(next);
      return;
    }
    props.onOpen(props.attachment);
  }, [failedToLoad, props, requiresDesktopDecode, resolvedSrc, tryResolveLocalImage]);

  const onPreviewImageError = useCallback(() => {
    const pathCandidate = filePathFromImageSource(resolvedSrc || props.attachment.dataUrl);
    if (isDesktopRuntime() && pathCandidate && !usesDesktopLocalScheme) {
      const desktopSrc = buildDesktopLocalImageUrl(pathCandidate);
      if (desktopSrc !== resolvedSrc) {
        setResolvedSrc(desktopSrc);
        setFailedToLoad(false);
        setLoadError(null);
        return;
      }
    }
    if (
      isDesktopRuntime() &&
      (typeof desktopReadImageFile === "function" || typeof desktopFetchImageUrl === "function")
    ) {
      void tryResolveLocalImage();
      return;
    }
    setFailedToLoad(true);
    if (!loadError) {
      setLoadError("img-decode-failed");
    }
  }, [
    desktopReadImageFile,
    desktopFetchImageUrl,
    loadError,
    props.attachment.dataUrl,
    resolvedSrc,
    tryResolveLocalImage,
    usesDesktopLocalScheme,
  ]);

  return (
    <button
      type="button"
      className="attachment-image-button"
      onClick={() => {
        void openAttachment();
      }}
      aria-label={`Open image ${props.attachment.name}`}
      title="Click to view larger"
    >
      <div className="attachment-image">
        {webLocalFileBlocked ? (
          <div className="attachment-image-fallback">
            Web cannot read local file paths. Open this session in desktop app.
          </div>
        ) : requiresDesktopDecode && !failedToLoad ? (
          <div className="attachment-image-fallback">Loading local image...</div>
        ) : failedToLoad ? (
          <div className="attachment-image-fallback">
            {loadError
              ? `Image load failed: ${loadError}`
              : desktopBridgeMissing
              ? "Image load failed: desktop-api-unavailable"
              : "Click to load local image"}
          </div>
        ) : (
          <img
            src={resolvedSrc}
            alt={props.attachment.name}
            className="attachment-image-preview"
            onError={onPreviewImageError}
          />
        )}
      </div>
    </button>
  );
}

function renderAttachment(att: Attachment) {
  if (att.isImage) {
    return (
      <div key={att.id} className="attachment-image">
        <img src={att.dataUrl} alt={att.name} className="attachment-image-preview" />
      </div>
    );
  }
  return (
    <div key={att.id} className="attachment-file">
      <div>
        <div className="attachment-file-name">{truncate(att.name, 32)}</div>
        <div className="attachment-file-size">{formatBytes(att.size)}</div>
      </div>
      <div className="attachment-file-kind">FILE</div>
    </div>
  );
}

function handleMarkdownClick(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest(".md-code-copy") as HTMLElement | null;
  if (!copyBtn) return;
  e.preventDefault();
  e.stopPropagation();
  const codeBlock = copyBtn.closest(".md-code");
  const codeEl = codeBlock?.querySelector("pre code");
  if (codeEl) {
    navigator.clipboard
      .writeText(codeEl.textContent || "")
      .then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("is-copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("is-copied");
        }, 2000);
      })
      .catch(() => {});
  }
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className={`msg-copy-btn ${copied ? "is-copied" : ""}`}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      title={copied ? "Copied!" : "Copy"}
      aria-label={copied ? "Copied!" : "Copy message"}
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export type MessageRowProps = {
  message: ChatMessage;
  showTimestamp: boolean;
  timestampFontSize: number;
  drawerPop?: boolean;
  sessionFlyIn?: boolean;
  onOpenImage: (attachment: Attachment) => void;
  onResolveRemoteImage?: (filePath: string) => Promise<string | null>;
};

export const MessageRow = React.memo(
  function MessageRow(props: MessageRowProps) {
    const { message } = props;
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const roleLabel = isSystem ? "System" : isUser ? "You" : "Assistant";
    const rowMotionClass = `${props.drawerPop ? "drawer-pop" : ""} ${props.sessionFlyIn ? "session-fly-in" : ""}`.trim();
    const motionStyle = useMemo(() => buildMotionVars(message.id), [message.id]);
    const markdownHtml = useMemo(
      () => (message.text ? renderMarkdown(message.text) : ""),
      [message.text],
    );

    if (isSystem) {
      return (
        <div className={`message-row system ${rowMotionClass}`} data-message-id={message.id} style={motionStyle}>
          <article
            className="message-bubble system"
            style={{
              fontSize: "var(--claw-font-size)",
              lineHeight: "var(--claw-line-height)",
            }}
          >
            <div className="message-role">{roleLabel}</div>
            <div className="message-body plain-text">{message.text}</div>
            {props.showTimestamp && (
              <div className="message-meta">
                <time
                  className="message-time"
                  dateTime={formatMessageDateTime(message.timestamp)}
                  title={formatLocalDateTime(message.timestamp)}
                  style={{ fontSize: `${props.timestampFontSize}px` }}
                >
                  {formatLocalDateTime(message.timestamp)}
                </time>
              </div>
            )}
          </article>
        </div>
      );
    }

    return (
      <div
        className={`message-row ${isUser ? "user" : "assistant"} ${rowMotionClass}`}
        data-message-id={message.id}
        style={motionStyle}
      >
        <article className={`message-bubble ${isUser ? "user" : "assistant"}`}>
          <CopyButton text={message.text} />
          <div className="message-role">{roleLabel}</div>
          {markdownHtml && (
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
              onClick={handleMarkdownClick}
            />
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="attachments-wrap">
              {message.attachments.map((att) => {
                if (att.isImage) {
                  return (
                    <MessageImageAttachment
                      key={att.id}
                      attachment={att}
                      onOpen={props.onOpenImage}
                      resolveRemoteImage={props.onResolveRemoteImage}
                    />
                  );
                }
                return renderAttachment(att);
              })}
            </div>
          )}
          {props.showTimestamp && (
            <div className="message-meta">
              <time
                className="message-time"
                dateTime={formatMessageDateTime(message.timestamp)}
                title={formatLocalDateTime(message.timestamp)}
                style={{ fontSize: `${props.timestampFontSize}px` }}
              >
                {formatLocalDateTime(message.timestamp)}
              </time>
            </div>
          )}
        </article>
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.showTimestamp === next.showTimestamp &&
    prev.timestampFontSize === next.timestampFontSize &&
    prev.drawerPop === next.drawerPop &&
    prev.sessionFlyIn === next.sessionFlyIn &&
    prev.onOpenImage === next.onOpenImage &&
    prev.onResolveRemoteImage === next.onResolveRemoteImage,
);
