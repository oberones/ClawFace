export const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";

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
  };

  push(initial);

  const decodedBase64 = decodeCompactBase64AsUtf8(initial);
  if (decodedBase64 && isLikelyPathOrUrl(decodedBase64)) {
    push(decodedBase64);
  }

  const mappedWorkspace = mapWorkspaceAliasToLocalPath(initial);
  if (mappedWorkspace) {
    push(mappedWorkspace);
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
      const encoded = candidate.slice(DESKTOP_LOCAL_IMAGE_SCHEME.length + 1);
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
    const fileUrlPath = filePathFromFileUrl(candidate);
    if (fileUrlPath) {
      return fileUrlPath;
    }
    const aliasMapped = mapWorkspaceAliasToLocalPath(candidate);
    if (aliasMapped) {
      return aliasMapped;
    }
    if (looksLikeAbsoluteImagePath(candidate)) {
      return candidate;
    }
    const resolvedWorkspaceRelative = resolveWorkspaceRelativeLocalPath(candidate);
    if (resolvedWorkspaceRelative) {
      return resolvedWorkspaceRelative;
    }
  }
  return null;
}

export function buildDesktopLocalImageUrl(filePath: string): string {
  return `${DESKTOP_LOCAL_IMAGE_SCHEME}:${encodeURIComponent(filePath)}`;
}

export function isDesktopRuntime(): boolean {
  if (window.desktopInfo?.isDesktop) {
    return true;
  }
  return window.location.protocol === "file:";
}

export function toDesktopRenderableSrc(value: string): string {
  if (!isDesktopRuntime()) {
    return value;
  }
  const path = filePathFromImageSource(value);
  if (!path) {
    return value;
  }
  return buildDesktopLocalImageUrl(path);
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
