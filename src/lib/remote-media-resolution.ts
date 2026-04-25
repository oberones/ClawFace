const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";

export const DEFAULT_REMOTE_MEDIA_READ_METHODS = [
  "artifacts.read",
  "artifact.read",
  "workspace.file.read",
  "workspace.read",
  "files.read",
  "file.read",
  "fs.read",
  "image.read",
  "images.read",
  "media.read",
] as const;

// Candidate counts are intentionally capped because remote media probing fans out
// across advertised RPC methods, parameter shapes, and HTTP fallback endpoints.
const MAX_GATEWAY_REMOTE_MEDIA_URL_CANDIDATES = 18;
const MAX_REMOTE_MEDIA_READ_METHODS = 8;

type RemoteMediaReferenceKind = "artifact" | "path" | "opaque";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeGatewayUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return trimmed;
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

function looksLikeBase64Payload(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 24 || compact.length % 4 === 1) {
    return false;
  }
  return /^[A-Za-z0-9+/]+=*$/.test(compact);
}

function toImageDataUrl(base64Payload: string, sourcePathHint: string, mimeHint?: string | null): string | null {
  const compact = base64Payload.replace(/\s+/g, "").trim();
  if (!looksLikeBase64Payload(compact)) {
    return null;
  }
  const mimeType = mimeHint ?? inferImageMimeTypeFromPath(sourcePathHint) ?? "image/png";
  return `data:${mimeType};base64,${compact}`;
}

function isSkippableRemoteReference(value: string): boolean {
  const trimmed = stripPathDecorators(value);
  if (!trimmed) {
    return true;
  }
  if (/^data:image\//i.test(trimmed)) {
    return true;
  }
  if (/^(https?:|blob:)/i.test(trimmed) || trimmed.startsWith("//")) {
    return true;
  }
  if (/^file:/i.test(trimmed)) {
    return true;
  }
  if (trimmed.toLowerCase().startsWith(`${DESKTOP_LOCAL_IMAGE_SCHEME}:`)) {
    return true;
  }
  return false;
}

function classifyRemoteMediaReference(reference: string): RemoteMediaReferenceKind {
  const trimmed = stripPathDecorators(reference);
  if (!trimmed) {
    return "opaque";
  }
  if (/^artifact:/i.test(trimmed)) {
    return "artifact";
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("~/") ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith(".openclaw/") ||
    trimmed.startsWith("openclaw/") ||
    trimmed.includes("/.openclaw/") ||
    trimmed.includes("\\.openclaw\\") ||
    Boolean(inferImageMimeTypeFromPath(trimmed))
  ) {
    return "path";
  }
  return "opaque";
}

export function inferImageMimeTypeFromPath(value: string): string | null {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();
  const noQuery = normalized.split("?")[0]?.split("#")[0] ?? normalized;
  if (noQuery.endsWith(".png")) {
    return "image/png";
  }
  if (noQuery.endsWith(".jpg") || noQuery.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (noQuery.endsWith(".webp")) {
    return "image/webp";
  }
  if (noQuery.endsWith(".gif")) {
    return "image/gif";
  }
  if (noQuery.endsWith(".bmp")) {
    return "image/bmp";
  }
  if (noQuery.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return null;
}

export function extractRenderableImageSourceFromUnknown(
  value: unknown,
  sourcePathHint: string,
  mimeHint?: string | null,
): string | null {
  // Gateway implementations return media in several shapes: raw base64 strings,
  // data URLs, HTTP URLs, or nested objects. Breadth-first traversal finds the
  // nearest renderable image while maxDepth/maxNodes prevent pathological payloads.
  const queue: Array<{ value: unknown; depth: number; mimeHint?: string | null }> = [
    { value, depth: 0, mimeHint },
  ];
  const seen = new Set<unknown>();
  let traversed = 0;
  const maxNodes = 220;
  const maxDepth = 6;

  while (queue.length > 0 && traversed < maxNodes) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    traversed += 1;
    const node = current.value;
    if (node === null || node === undefined || seen.has(node)) {
      continue;
    }
    seen.add(node);

    if (typeof node === "string") {
      const trimmed = node.trim();
      if (!trimmed) {
        continue;
      }
      if (/^data:image\//i.test(trimmed)) {
        return trimmed;
      }
      if (/^(https?:|blob:)/i.test(trimmed)) {
        return trimmed;
      }
      const dataUrl = toImageDataUrl(trimmed, sourcePathHint, current.mimeHint);
      if (dataUrl) {
        return dataUrl;
      }
      continue;
    }

    if (Array.isArray(node)) {
      if (current.depth < maxDepth) {
        for (const item of node) {
          queue.push({ value: item, depth: current.depth + 1, mimeHint: current.mimeHint });
        }
      }
      continue;
    }

    if (!isRecord(node)) {
      continue;
    }

    const inferredMime =
      getString(node, ["mimeType", "mime_type", "media_type", "contentType", "content_type"]) ??
      current.mimeHint ??
      null;
    const directUrl = getString(node, [
      "dataUrl",
      "data_url",
      "url",
      "uri",
      "href",
      "image_url",
      "imageUrl",
      "mediaUrl",
      "media_url",
    ]);
    if (directUrl) {
      if (/^data:image\//i.test(directUrl) || /^(https?:|blob:)/i.test(directUrl)) {
        return directUrl;
      }
      const fromRaw = toImageDataUrl(directUrl, sourcePathHint, inferredMime);
      if (fromRaw) {
        return fromRaw;
      }
    }

    const directBase64 = getString(node, [
      "base64",
      "b64",
      "b64_json",
      "data",
      "content",
      "bytes",
      "image",
      "image_base64",
    ]);
    if (directBase64) {
      const asDataUrl = toImageDataUrl(directBase64, sourcePathHint, inferredMime);
      if (asDataUrl) {
        return asDataUrl;
      }
    }

    if (current.depth >= maxDepth) {
      continue;
    }
    for (const nested of Object.values(node)) {
      if (isRecord(nested) || Array.isArray(nested) || typeof nested === "string") {
        queue.push({ value: nested, depth: current.depth + 1, mimeHint: inferredMime });
      }
    }
  }

  return null;
}

export function pickRemoteMediaReadMethods(methods: Iterable<string>): string[] {
  const values = [...methods].filter((entry) => typeof entry === "string" && entry.trim());
  if (values.length === 0) {
    return [...DEFAULT_REMOTE_MEDIA_READ_METHODS].slice(0, MAX_REMOTE_MEDIA_READ_METHODS);
  }
  const scored = values
    .map((method) => {
      const lower = method.trim().toLowerCase();
      let score = 0;
      if (lower.includes("read")) {
        score += 3;
      }
      if (lower.includes("file") || lower.includes("fs")) {
        score += 3;
      }
      if (
        lower.includes("workspace") ||
        lower.includes("media") ||
        lower.includes("image") ||
        lower.includes("artifact")
      ) {
        score += 2;
      }
      if (lower.includes("chat")) {
        score -= 2;
      }
      return { method, score };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);

  const methodsByScore = scored.map((item) => item.method);
  const relatedMethods = values.filter((method) => {
    const lower = method.toLowerCase();
    return (
      lower.includes("read") ||
      lower.includes("file") ||
      lower.includes("fs") ||
      lower.includes("image") ||
      lower.includes("media") ||
      lower.includes("workspace") ||
      lower.includes("artifact")
    );
  });
  const advertisedDefaults = DEFAULT_REMOTE_MEDIA_READ_METHODS.filter((method) => values.includes(method));
  const merged = [...methodsByScore, ...relatedMethods, ...advertisedDefaults].filter(
    (method, index, arr) => arr.indexOf(method) === index,
  );
  return merged.slice(0, MAX_REMOTE_MEDIA_READ_METHODS);
}

export function buildRemoteMediaReadParamVariants(reference: string): Record<string, unknown>[] {
  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    return [];
  }
  const referenceKind = classifyRemoteMediaReference(normalizedReference);
  // Different OpenClaw/gateway versions have used different parameter names for
  // the same media reference, so build a small ordered compatibility matrix.
  const paramBases: Record<string, unknown>[] =
    referenceKind === "artifact"
      ? [
          { artifact: normalizedReference },
          { artifactPath: normalizedReference },
          { artifactUri: normalizedReference },
          { source: normalizedReference },
          { uri: normalizedReference },
        ]
      : referenceKind === "path"
        ? [
            { path: normalizedReference },
            { filePath: normalizedReference },
            { mediaPath: normalizedReference },
            { source: normalizedReference },
            { uri: normalizedReference },
          ]
        : [
            { source: normalizedReference },
            { uri: normalizedReference },
            { artifact: normalizedReference },
            { path: normalizedReference },
            { filePath: normalizedReference },
          ];
  const extraShapesByIndex =
    referenceKind === "artifact"
      ? new Map<number, Array<Record<string, unknown>>>([
          [0, [{ encoding: "base64" }]],
          [3, [{ encoding: "base64" }]],
        ])
      : referenceKind === "path"
        ? new Map<number, Array<Record<string, unknown>>>([
            [0, [{ encoding: "base64" }]],
            [1, [{ encoding: "base64" }]],
          ])
        : new Map<number, Array<Record<string, unknown>>>([[0, [{ encoding: "base64" }]]]);
  const seen = new Set<string>();
  const variants: Record<string, unknown>[] = [];
  for (let index = 0; index < paramBases.length; index += 1) {
    const base = paramBases[index];
    const extraShapes = [{}, ...(extraShapesByIndex.get(index) ?? [])];
    for (const extra of extraShapes) {
      const candidate = { ...base, ...extra };
      const key = JSON.stringify(candidate);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      variants.push(candidate);
    }
  }
  return variants;
}

export function toGatewayHttpBaseCandidates(rawGatewayUrl: string): string[] {
  const trimmed = normalizeGatewayUrl(rawGatewayUrl).trim();
  if (!trimmed) {
    return [];
  }
  const seen = new Set<string>();
  const candidates: string[] = [];
  const push = (value: string) => {
    const next = value.trim().replace(/\/+$/g, "");
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    candidates.push(next);
  };
  const collectFromUrl = (value: URL) => {
    const protocol =
      value.protocol === "wss:"
        ? "https:"
        : value.protocol === "ws:"
          ? "http:"
          : value.protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      return;
    }
    // A gateway URL may point at a websocket subpath; try each parent HTTP path
    // before falling back to the origin so deployments behind prefixes work.
    const originBase = `${protocol}//${value.host}`;
    const segments = value.pathname.split("/").filter(Boolean);
    for (let i = segments.length; i >= 1; i -= 1) {
      push(`${originBase}/${segments.slice(0, i).join("/")}`);
    }
    push(originBase);
  };

  try {
    collectFromUrl(new URL(trimmed));
  } catch {
    try {
      collectFromUrl(new URL(`ws://${trimmed}`));
    } catch {
      return [];
    }
  }
  return candidates;
}

export function buildGatewayRemoteMediaUrlCandidates(rawGatewayUrl: string, reference: string): string[] {
  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    return [];
  }
  const referenceKind = classifyRemoteMediaReference(normalizedReference);
  const seen = new Set<string>();
  const candidates: string[] = [];
  const push = (value: string) => {
    const next = value.trim();
    if (!next || seen.has(next) || candidates.length >= MAX_GATEWAY_REMOTE_MEDIA_URL_CANDIDATES) {
      return;
    }
    seen.add(next);
    candidates.push(next);
  };
  const endpointCandidates =
    referenceKind === "artifact"
      ? [
          ["/__claw/artifacts/read", "artifact"],
          ["/__claw/artifacts/read", "artifactUri"],
          ["/__claw/media/read", "artifact"],
          ["/__claw/media/read", "source"],
          ["/artifacts/read", "artifact"],
          ["/media/read", "artifact"],
        ]
      : referenceKind === "path"
        ? [
            ["/__claw/local-image", "path"],
            ["/__claw/media/read", "path"],
            ["/__claw/media/read", "filePath"],
            ["/media/read", "path"],
            ["/media/read", "filePath"],
          ]
        : [
            ["/__claw/media/read", "source"],
            ["/__claw/media/read", "uri"],
            ["/__claw/artifacts/read", "artifact"],
            ["/media/read", "source"],
            ["/artifacts/read", "artifact"],
          ];
  for (const base of toGatewayHttpBaseCandidates(rawGatewayUrl)) {
    for (const [pathname, queryKey] of endpointCandidates) {
      push(`${base}${pathname}?${queryKey}=${encodeURIComponent(normalizedReference)}`);
      if (candidates.length >= MAX_GATEWAY_REMOTE_MEDIA_URL_CANDIDATES) {
        break;
      }
    }
    if (candidates.length >= MAX_GATEWAY_REMOTE_MEDIA_URL_CANDIDATES) {
      break;
    }
  }
  return candidates;
}

export function buildRemoteMediaReferenceCandidates(params: {
  sourcePath?: string | null;
  sourceCandidates?: readonly string[];
  localFilePath?: string | null;
}): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const push = (value: string | null | undefined) => {
    if (typeof value !== "string") {
      return;
    }
    const next = stripPathDecorators(value);
    if (!next || isSkippableRemoteReference(next) || seen.has(next)) {
      return;
    }
    seen.add(next);
    candidates.push(next);
  };

  push(params.sourcePath);
  for (const candidate of params.sourceCandidates ?? []) {
    push(candidate);
  }
  push(params.localFilePath);

  return candidates;
}
