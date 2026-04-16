import { applyPathPrefixMappings } from "./path-prefix-mappings.ts";

export const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";
const WORKSPACE_MARKER = "/.openclaw/workspace";
const runtimePathHints: { homeDir: string; workspaceDir: string } = {
  homeDir: "",
  workspaceDir: "",
};

export type NormalizedRuntimeImageSourceData = {
  dataUrl: string;
  fromBase64: boolean;
  sourcePath?: string;
};

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

export function setImageSourceRuntimeHints(next: { homeDir?: string | null; workspaceDir?: string | null }) {
  const homeDir = trimTrailingSlashes(next.homeDir ?? "");
  const workspaceDir = trimTrailingSlashes(next.workspaceDir ?? "");
  if (homeDir) {
    runtimePathHints.homeDir = homeDir;
  }
  if (workspaceDir) {
    runtimePathHints.workspaceDir = workspaceDir;
  }
  if (!runtimePathHints.homeDir && runtimePathHints.workspaceDir) {
    const derivedHome = deriveHomeFromWorkspacePath(runtimePathHints.workspaceDir);
    if (derivedHome) {
      runtimePathHints.homeDir = derivedHome;
    }
  }
  if (!runtimePathHints.workspaceDir && runtimePathHints.homeDir) {
    runtimePathHints.workspaceDir = `${runtimePathHints.homeDir}${WORKSPACE_MARKER}`;
  }
}

function getRuntimeHomeDir(): string {
  const desktopHomeDir = trimTrailingSlashes(window.desktopInfo?.homeDir ?? "");
  if (desktopHomeDir) {
    return desktopHomeDir;
  }
  return runtimePathHints.homeDir;
}

function getRuntimeWorkspaceDir(): string {
  const desktopWorkspaceDir = trimTrailingSlashes(window.desktopInfo?.workspaceDir ?? "");
  if (desktopWorkspaceDir) {
    return desktopWorkspaceDir;
  }
  if (runtimePathHints.workspaceDir) {
    return runtimePathHints.workspaceDir;
  }
  const homeDir = getRuntimeHomeDir();
  if (!homeDir) {
    return "";
  }
  return `${homeDir}${WORKSPACE_MARKER}`;
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

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filePathFromFileUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "file:") {
      return null;
    }
    let pathname = safeDecodeURIComponent(parsed.pathname || "");
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
    trimmed.startsWith(".openclaw/media/") ||
    trimmed.startsWith("openclaw/media/") ||
    trimmed.includes("/.openclaw/media/") ||
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

function resolveMediaRelativeLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (!trimmed || !looksLikeImagePath(trimmed)) {
    return null;
  }
  const homeDir = getRuntimeHomeDir();
  if (!homeDir) {
    return null;
  }
  return `${homeDir}/.openclaw/media/${trimmed}`;
}

function resolveWorkspaceRelativeLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (!trimmed || !looksLikeImagePath(trimmed)) {
    return null;
  }
  const workspaceDir = getRuntimeWorkspaceDir();
  if (!workspaceDir) {
    return null;
  }
  return `${workspaceDir}/${trimmed}`;
}

function mapMediaAliasToLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const homeDir = getRuntimeHomeDir();
  if (!trimmed || !homeDir) {
    return null;
  }
  if (trimmed.startsWith(".openclaw/media/")) {
    return `${homeDir}/${trimmed}`;
  }
  if (trimmed.startsWith("openclaw/media/")) {
    return `${homeDir}/.${trimmed}`;
  }
  return null;
}

function mapWorkspaceAliasToLocalPath(value: string): string | null {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const homeDir = getRuntimeHomeDir();
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
    trimmed.startsWith(".openclaw/media/") ||
    trimmed.startsWith("openclaw/media/") ||
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

export function normalizeDataImageUrl(value: string): string | null {
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

export function summarizeSourceForError(value: string): string {
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

export function extractImageSourceCandidates(value: string): string[] {
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
    const mapped = applyPathPrefixMappings(next);
    if (mapped && mapped !== next && !seen.has(mapped)) {
      seen.add(mapped);
      candidates.push(mapped);
    }
  };

  push(initial);

  const decodedBase64 = decodeCompactBase64AsUtf8(initial);
  if (decodedBase64 && isLikelyPathOrUrl(decodedBase64)) {
    push(decodedBase64);
  }

  const mappedMedia = mapMediaAliasToLocalPath(initial);
  if (mappedMedia) {
    push(mappedMedia);
  }

  const mappedWorkspace = mapWorkspaceAliasToLocalPath(initial);
  if (mappedWorkspace) {
    push(mappedWorkspace);
  }

  const resolvedMediaRelative = resolveMediaRelativeLocalPath(initial);
  if (resolvedMediaRelative) {
    push(resolvedMediaRelative);
  }

  const resolvedWorkspaceRelative = resolveWorkspaceRelativeLocalPath(initial);
  if (resolvedWorkspaceRelative) {
    push(resolvedWorkspaceRelative);
  }

  return candidates;
}

export function normalizeHttpImageUrl(value: string): string | null {
  const trimmed = stripPathDecorators(value);
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

export function filePathFromImageSource(value: string): string | null {
  const candidates = extractImageSourceCandidates(value);
  for (const candidate of candidates) {
    const normalizedDataUrl = normalizeDataImageUrl(candidate);
    if (normalizedDataUrl) {
      continue;
    }
    if (/^https?:\/\//i.test(candidate) || candidate.startsWith("//")) {
      continue;
    }
    if (candidate.toLowerCase().startsWith(`${DESKTOP_LOCAL_IMAGE_SCHEME}:`)) {
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === `${DESKTOP_LOCAL_IMAGE_SCHEME}:`) {
          const queryPath = parsed.searchParams.get("path");
          if (queryPath) {
            return applyPathPrefixMappings(decodeURIComponent(queryPath));
          }
          let pathname = decodeURIComponent(parsed.pathname || "");
          if (/^\/[A-Za-z]:\//.test(pathname)) {
            pathname = pathname.slice(1);
          }
          if (pathname) {
            return applyPathPrefixMappings(pathname);
          }
        }
      } catch {
        // Fall back to legacy compact scheme parsing below.
      }
      const encoded = candidate.slice(DESKTOP_LOCAL_IMAGE_SCHEME.length + 1);
      try {
        return applyPathPrefixMappings(decodeURIComponent(encoded));
      } catch {
        return applyPathPrefixMappings(encoded);
      }
    }
    const fileUrlPath = filePathFromFileUrl(candidate);
    if (fileUrlPath) {
      return applyPathPrefixMappings(fileUrlPath);
    }
    const mediaAliasMapped = mapMediaAliasToLocalPath(candidate);
    if (mediaAliasMapped) {
      return applyPathPrefixMappings(mediaAliasMapped);
    }
    const aliasMapped = mapWorkspaceAliasToLocalPath(candidate);
    if (aliasMapped) {
      return applyPathPrefixMappings(aliasMapped);
    }
    if (looksLikeAbsoluteImagePath(candidate)) {
      return applyPathPrefixMappings(candidate);
    }
    const resolvedMediaRelative = resolveMediaRelativeLocalPath(candidate);
    if (resolvedMediaRelative) {
      return applyPathPrefixMappings(resolvedMediaRelative);
    }
    const resolvedWorkspaceRelative = resolveWorkspaceRelativeLocalPath(candidate);
    if (resolvedWorkspaceRelative) {
      return applyPathPrefixMappings(resolvedWorkspaceRelative);
    }
  }
  return null;
}

export function buildDesktopLocalImageUrl(filePath: string): string {
  return `${DESKTOP_LOCAL_IMAGE_SCHEME}://open?path=${encodeURIComponent(filePath)}`;
}

export function isDesktopRuntime(): boolean {
  if (window.desktopInfo?.isDesktop) {
    return true;
  }
  return window.location.protocol === "file:";
}

function canUseWebLocalImageProxy(): boolean {
  const protocol = window.location.protocol;
  return protocol === "http:" || protocol === "https:";
}

function buildWebLocalImageProxyUrl(filePath: string): string {
  if (!canUseWebLocalImageProxy()) {
    return "";
  }
  return `${window.location.origin}/__claw/local-image?path=${encodeURIComponent(filePath)}`;
}

function toFileUrl(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("~/")) {
    const homeDir = getRuntimeHomeDir();
    if (!homeDir) {
      return null;
    }
    const expanded = `${homeDir}/${normalized.slice(2)}`;
    return toFileUrl(expanded);
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }
  if (normalized.startsWith("//")) {
    return `file:${encodeURI(normalized)}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${encodeURI(normalized)}`;
  }
  return null;
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
      return rawPath;
    }
    let pathname = safeDecodeURIComponent(parsed.pathname || "");
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

function localPathFromWebLocalImageProxyUrl(value: string): string | null {
  const trimmed = value.trim();
  if (/^file:\/\/\/__claw\/local-image\?/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const rawPath = parsed.searchParams.get("path");
      if (!rawPath) {
        return null;
      }
      return rawPath;
    } catch {
      return null;
    }
  }
  const marker = "/__claw/local-image?";
  const parsePath = (raw: string | null): string | null => {
    if (!raw) {
      return null;
    }
    return raw;
  };

  if (trimmed.startsWith(marker)) {
    return parsePath(new URLSearchParams(trimmed.slice(marker.length)).get("path"));
  }

  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    return parsePath(new URLSearchParams(trimmed.slice(markerIndex + marker.length)).get("path"));
  }

  if (!trimmed.includes("/__claw/local-image")) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, "http://127.0.0.1");
    return parsePath(parsed.searchParams.get("path"));
  } catch {
    return null;
  }
}

function resolveProxyLocalPath(value: string): string {
  const mapped = applyPathPrefixMappings(value);
  if (!mapped) {
    return value;
  }
  if (isAbsoluteFsPath(mapped) || mapped.startsWith("~")) {
    return mapped;
  }
  const workspaceDir = getRuntimeWorkspaceDir();
  if (!workspaceDir) {
    return mapped;
  }
  return `${workspaceDir}/${mapped.replace(/^\/+/, "")}`;
}

function deriveSourcePathHint(value: string): string | null {
  const trimmed = stripPathDecorators(value);
  if (!trimmed) {
    return null;
  }
  const mediaRelativePath = resolveMediaRelativeLocalPath(trimmed);
  if (mediaRelativePath) {
    return trimmed;
  }
  const workspaceRelativePath = resolveWorkspaceRelativeLocalPath(trimmed);
  if (workspaceRelativePath) {
    return workspaceRelativePath;
  }
  return trimmed;
}

export function toRuntimeRenderableLocalPath(filePath: string): string {
  if (isDesktopRuntime()) {
    return buildDesktopLocalImageUrl(filePath);
  }
  return buildWebLocalImageProxyUrl(filePath) || toFileUrl(filePath) || filePath;
}

export function toRuntimeRenderableSrc(value: string): string {
  const path = filePathFromImageSource(value);
  if (!path) {
    return value;
  }
  return toRuntimeRenderableLocalPath(path);
}

export function normalizeRuntimeImageSourceData(
  rawData: string,
  mimeType: string,
): NormalizedRuntimeImageSourceData {
  const trimmed = rawData.trim();
  if (!trimmed) {
    return { dataUrl: "", fromBase64: false };
  }
  const normalizedDataUrl = normalizeDataImageUrl(trimmed);
  if (normalizedDataUrl) {
    return { dataUrl: normalizedDataUrl, fromBase64: false };
  }
  if (/^(https?:|blob:)/i.test(trimmed)) {
    return { dataUrl: trimmed, fromBase64: false };
  }

  const fromDesktopLocalPath = localPathFromDesktopLocalImageUrl(trimmed);
  if (fromDesktopLocalPath) {
    const mappedLocalPath = applyPathPrefixMappings(fromDesktopLocalPath);
    return {
      dataUrl: toRuntimeRenderableLocalPath(mappedLocalPath),
      fromBase64: false,
      sourcePath: fromDesktopLocalPath,
    };
  }

  const fromProxyPath = localPathFromWebLocalImageProxyUrl(trimmed);
  if (fromProxyPath) {
    const resolvedProxyPath = resolveProxyLocalPath(fromProxyPath);
    return {
      dataUrl: toRuntimeRenderableLocalPath(resolvedProxyPath),
      fromBase64: false,
      sourcePath: fromProxyPath,
    };
  }

  if (/^file:/i.test(trimmed)) {
    const asLocalPath = filePathFromFileUrl(trimmed);
    if (asLocalPath) {
      const mappedLocalPath = applyPathPrefixMappings(asLocalPath);
      return {
        dataUrl: toRuntimeRenderableLocalPath(mappedLocalPath),
        fromBase64: false,
        sourcePath: asLocalPath,
      };
    }
    return { dataUrl: trimmed, fromBase64: false };
  }

  if (filePathFromImageSource(trimmed)) {
    const sourcePathHint = deriveSourcePathHint(trimmed) ?? trimmed;
    return {
      dataUrl: toRuntimeRenderableSrc(trimmed),
      fromBase64: false,
      sourcePath: sourcePathHint,
    };
  }

  return { dataUrl: `data:${mimeType};base64,${trimmed}`, fromBase64: true };
}

export function isLikelyLocalFileSource(value: string): boolean {
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
