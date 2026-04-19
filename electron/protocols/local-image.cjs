const fs = require("node:fs");
const path = require("node:path");

const IMAGE_CACHE_LIMIT = 5;
const DEFAULT_REMOTE_GATEWAY_FETCH_TIMEOUT_MS = 2000;
const DEFAULT_MAX_REMOTE_GATEWAY_URLS = 18;
const LOCAL_GATEWAY_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
  "::",
]);
const IMAGE_MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function imageMimeTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_MIME_BY_EXT[ext] ?? null;
}

function isLikelyImageFileName(value) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(value || "");
}

function normalizePathSeparators(value) {
  return String(value || "").replace(/\\/g, "/");
}

function stripPathDecorators(value) {
  let next = String(value || "").trim();
  next = next.replace(/^media\s*:\s*/i, "").trim();
  if (!next) {
    return "";
  }
  const wrappers = [
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

function classifyRemoteMediaReference(value) {
  const trimmed = stripPathDecorators(value);
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
    isLikelyImageFileName(trimmed)
  ) {
    return "path";
  }
  return "opaque";
}

function getWorkspaceRoot(homeDir) {
  return path.join(homeDir, ".openclaw", "workspace");
}

function getMediaRoot(homeDir) {
  return path.join(homeDir, ".openclaw", "media");
}

function mapOpenClawPathToLocalHome(rawPath, homeDir, dirName) {
  const normalized = normalizePathSeparators(rawPath).trim();
  const marker = `/.openclaw/${dirName}/`;
  const markerIndex = normalized.toLowerCase().indexOf(marker);
  if (markerIndex < 0) {
    const rootMarker = `/.openclaw/${dirName}`;
    if (normalized.toLowerCase().endsWith(rootMarker)) {
      return path.join(homeDir, ".openclaw", dirName);
    }
    return null;
  }
  const suffix = normalized.slice(markerIndex + marker.length);
  if (!suffix) {
    return path.join(homeDir, ".openclaw", dirName);
  }
  return path.join(homeDir, ".openclaw", dirName, suffix);
}

function mapWorkspacePathToLocalHome(rawPath, homeDir) {
  return mapOpenClawPathToLocalHome(rawPath, homeDir, "workspace");
}

function mapMediaPathToLocalHome(rawPath, homeDir) {
  return mapOpenClawPathToLocalHome(rawPath, homeDir, "media");
}

function resolveOpenClawRelativePath(rawPath, homeDir, dirName) {
  const normalized = normalizePathSeparators(rawPath)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const dotRelativeMarker = `.openclaw/${dirName}/`;
  const bareRelativeMarker = `openclaw/${dirName}/`;
  if (lower === `.openclaw/${dirName}` || lower === `openclaw/${dirName}`) {
    return path.join(homeDir, ".openclaw", dirName);
  }
  if (lower.startsWith(dotRelativeMarker)) {
    return path.join(homeDir, normalized);
  }
  if (lower.startsWith(bareRelativeMarker)) {
    return path.join(homeDir, `.${normalized}`);
  }
  return null;
}

function resolveWorkspaceRelativePath(rawPath, homeDir) {
  const resolved = resolveOpenClawRelativePath(rawPath, homeDir, "workspace");
  if (resolved) {
    return resolved;
  }
  const normalized = normalizePathSeparators(rawPath)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  if (!normalized.includes("/") && isLikelyImageFileName(normalized)) {
    return path.join(homeDir, ".openclaw", "workspace", normalized);
  }
  return null;
}

function resolveMediaRelativePath(rawPath, homeDir) {
  return resolveOpenClawRelativePath(rawPath, homeDir, "media");
}

function resolveGatewayHttpBaseCandidates(rawGatewayUrl) {
  if (typeof rawGatewayUrl !== "string") {
    return [];
  }
  const trimmed = rawGatewayUrl.trim();
  if (!trimmed) {
    return [];
  }
  const seen = new Set();
  const candidates = [];
  const push = (value) => {
    const next = String(value || "").trim().replace(/\/+$/g, "");
    if (!next || seen.has(next)) {
      return;
    }
    seen.add(next);
    candidates.push(next);
  };
  const collectFromUrl = (value) => {
    const protocol =
      value.protocol === "wss:"
        ? "https:"
        : value.protocol === "ws:"
          ? "http:"
          : value.protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      return;
    }
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

function isRemoteGatewayBaseUrl(rawBaseUrl) {
  try {
    const parsed = new URL(rawBaseUrl);
    const host = parsed.hostname.trim().toLowerCase();
    if (!host) {
      return false;
    }
    if (LOCAL_GATEWAY_HOSTS.has(host)) {
      return false;
    }
    if (host.startsWith("127.")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function hasRemoteGatewayCandidates(candidates) {
  return Array.isArray(candidates) && candidates.some((item) => isRemoteGatewayBaseUrl(item));
}

function createLocalImageTransport(params) {
  const {
    homeDir,
    localImageScheme,
    getGatewayBaseCandidates,
    viteDevServerPort = "3000",
    remoteGatewayFetchTimeoutMs = DEFAULT_REMOTE_GATEWAY_FETCH_TIMEOUT_MS,
    maxRemoteGatewayUrls = DEFAULT_MAX_REMOTE_GATEWAY_URLS,
  } = params || {};

  if (
    typeof homeDir !== "string" ||
    !homeDir.trim() ||
    typeof localImageScheme !== "string" ||
    !localImageScheme ||
    typeof getGatewayBaseCandidates !== "function"
  ) {
    throw new Error(
      "createLocalImageTransport requires homeDir, localImageScheme, and getGatewayBaseCandidates",
    );
  }

  const imageDataCache = new Map();

  function getCachedImage(pathKey, mimeType, stat) {
    const entry = imageDataCache.get(pathKey);
    if (!entry) {
      return null;
    }
    if (entry.mimeType !== mimeType) {
      imageDataCache.delete(pathKey);
      return null;
    }
    if (stat && (entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs)) {
      imageDataCache.delete(pathKey);
      return null;
    }
    imageDataCache.delete(pathKey);
    imageDataCache.set(pathKey, entry);
    return entry;
  }

  function setCachedImage(pathKey, value) {
    if (imageDataCache.has(pathKey)) {
      imageDataCache.delete(pathKey);
    }
    imageDataCache.set(pathKey, value);
    while (imageDataCache.size > IMAGE_CACHE_LIMIT) {
      const oldestKey = imageDataCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      imageDataCache.delete(oldestKey);
    }
  }

  function resolveLocalImagePathCandidates(rawPath) {
    if (typeof rawPath !== "string") {
      return [];
    }
    const workspaceRoot = getWorkspaceRoot(homeDir);
    const mediaRoot = getMediaRoot(homeDir);
    const initial = stripPathDecorators(rawPath);
    if (!initial) {
      return [];
    }

    const variants = new Set([initial]);
    try {
      const decoded = decodeURIComponent(initial);
      if (decoded && decoded !== initial) {
        variants.add(decoded);
      }
    } catch {
      // ignore decode errors
    }

    const candidates = [];
    const seen = new Set();
    const pushCandidate = (candidate) => {
      if (!candidate || typeof candidate !== "string") {
        return;
      }
      const resolved = path.resolve(candidate);
      if (seen.has(resolved)) {
        return;
      }
      seen.add(resolved);
      candidates.push(resolved);
    };

    for (const variant of variants) {
      if (variant.startsWith("file:")) {
        try {
          const parsed = new URL(variant);
          if (parsed.protocol === "file:") {
            let pathname = decodeURIComponent(parsed.pathname || "");
            if (/^\/[A-Za-z]:\//.test(pathname)) {
              pathname = pathname.slice(1);
            }
            if (pathname) {
              pushCandidate(pathname);
            }
          }
        } catch {
          // ignore malformed file URL
        }
      }

      if (variant.startsWith("~/")) {
        pushCandidate(path.join(homeDir, variant.slice(2)));
      }

      const workspaceMapped = mapWorkspacePathToLocalHome(variant, homeDir);
      if (workspaceMapped) {
        pushCandidate(workspaceMapped);
      }

      const mediaMapped = mapMediaPathToLocalHome(variant, homeDir);
      if (mediaMapped) {
        pushCandidate(mediaMapped);
      }

      const workspaceResolved = resolveWorkspaceRelativePath(variant, homeDir);
      if (workspaceResolved) {
        pushCandidate(workspaceResolved);
      }

      const mediaResolved = resolveMediaRelativePath(variant, homeDir);
      if (mediaResolved) {
        pushCandidate(mediaResolved);
      }

      if (path.isAbsolute(variant)) {
        pushCandidate(variant);
      }

      const normalized = normalizePathSeparators(variant)
        .trim()
        .replace(/^\.\/+/, "")
        .replace(/^\/+/, "");
      if (normalized) {
        if (normalized.includes("/") || isLikelyImageFileName(normalized)) {
          pushCandidate(path.join(workspaceRoot, normalized));
          pushCandidate(path.join(mediaRoot, normalized));
        }
        const baseName = path.basename(normalized);
        if (isLikelyImageFileName(baseName)) {
          pushCandidate(path.join(workspaceRoot, baseName));
          pushCandidate(path.join(mediaRoot, baseName));
        }
      }

      pushCandidate(variant);
    }

    return candidates;
  }

  function localImageCandidatesFromDesktopUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== `${localImageScheme}:`) {
        return [];
      }
      const queryPath = parsed.searchParams.get("path");
      if (queryPath) {
        return resolveLocalImagePathCandidates(queryPath);
      }
      let pathname = decodeURIComponent(parsed.pathname || "");
      if (/^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return resolveLocalImagePathCandidates(pathname);
    } catch {
      return [];
    }
  }

  function localImagePathFromDesktopUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== `${localImageScheme}:`) {
        return "";
      }
      const queryPath = parsed.searchParams.get("path");
      if (queryPath) {
        try {
          return decodeURIComponent(queryPath);
        } catch {
          return queryPath;
        }
      }
      let pathname = decodeURIComponent(parsed.pathname || "");
      if (/^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
      }
      return pathname || "";
    } catch {
      return "";
    }
  }

  function buildAllowedRemoteFetchOrigins(seedUrl, includeGatewayOrigins = true) {
    const allowed = new Set();
    const pushOrigin = (rawUrl) => {
      try {
        const origin = new URL(rawUrl).origin;
        if (origin && origin !== "null") {
          allowed.add(origin);
        }
      } catch {
        // ignore invalid origin candidates
      }
    };
    pushOrigin(seedUrl);
    if (includeGatewayOrigins) {
      for (const baseUrl of getGatewayBaseCandidates()) {
        pushOrigin(baseUrl);
      }
    }
    return allowed;
  }

  function isAllowedFollowUpUrl(rawUrl, allowedOrigins) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      if (!(allowedOrigins instanceof Set) || allowedOrigins.size === 0) {
        return true;
      }
      return allowedOrigins.has(parsed.origin);
    } catch {
      return false;
    }
  }

  function buildRemoteGatewayUrlCandidates(reference) {
    const normalizedReference = stripPathDecorators(reference);
    if (!normalizedReference) {
      return [];
    }
    const referenceKind = classifyRemoteMediaReference(normalizedReference);
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
    const seen = new Set();
    const candidates = [];
    const push = (value) => {
      const next = String(value || "").trim();
      if (!next || seen.has(next) || candidates.length >= maxRemoteGatewayUrls) {
        return;
      }
      seen.add(next);
      candidates.push(next);
    };
    const encodedReference = encodeURIComponent(normalizedReference);
    for (const baseUrl of getGatewayBaseCandidates()) {
      for (const [pathname, queryKey] of endpointCandidates) {
        push(`${baseUrl}${pathname}?${queryKey}=${encodedReference}`);
        if (candidates.length >= maxRemoteGatewayUrls) {
          break;
        }
      }
      if (candidates.length >= maxRemoteGatewayUrls) {
        break;
      }
    }
    return candidates;
  }

  function looksLikeBase64Payload(value) {
    const compact = String(value || "").replace(/\s+/g, "");
    if (compact.length < 24 || compact.length % 4 === 1) {
      return false;
    }
    return /^[A-Za-z0-9+/]+=*$/.test(compact);
  }

  function toImageDataUrl(base64Payload, sourcePathHint, mimeHint) {
    const compact = String(base64Payload || "").replace(/\s+/g, "").trim();
    if (!looksLikeBase64Payload(compact)) {
      return null;
    }
    const mimeType = mimeHint || imageMimeTypeFromPath(sourcePathHint) || "image/png";
    return `data:${mimeType};base64,${compact}`;
  }

  function extractRenderableImageSourceFromUnknown(value, sourcePathHint, mimeHint) {
    const queue = [{ value, depth: 0, mimeHint }];
    const seen = new Set();
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
        if (/^data:image\//i.test(trimmed) || /^(https?:|blob:)/i.test(trimmed)) {
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

      if (!node || typeof node !== "object") {
        continue;
      }

      const inferredMime =
        ["mimeType", "mime_type", "media_type", "contentType", "content_type"]
          .map((key) => node[key])
          .find((entry) => typeof entry === "string" && entry.trim()) ||
        current.mimeHint ||
        null;
      const directUrl =
        [
          "dataUrl",
          "data_url",
          "url",
          "uri",
          "href",
          "image_url",
          "imageUrl",
          "mediaUrl",
          "media_url",
        ]
          .map((key) => node[key])
          .find((entry) => typeof entry === "string" && entry.trim()) || null;
      if (directUrl) {
        if (/^data:image\//i.test(directUrl) || /^(https?:|blob:)/i.test(directUrl)) {
          return directUrl;
        }
        const fromRaw = toImageDataUrl(directUrl, sourcePathHint, inferredMime);
        if (fromRaw) {
          return fromRaw;
        }
      }

      const directBase64 =
        ["base64", "b64", "b64_json", "data", "content", "bytes", "image", "image_base64"]
          .map((key) => node[key])
          .find((entry) => typeof entry === "string" && entry.trim()) || null;
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
        if (
          (nested && typeof nested === "object") ||
          Array.isArray(nested) ||
          typeof nested === "string"
        ) {
          queue.push({ value: nested, depth: current.depth + 1, mimeHint: inferredMime });
        }
      }
    }

    return null;
  }

  function decodeDataImageUrl(dataUrl) {
    const match = /^data:(image\/[a-z0-9.+-]+)(?:;[a-z0-9.+-]+=[^;,]+)*;base64,([\s\S]+)$/i.exec(
      String(dataUrl || "").trim(),
    );
    if (!match) {
      return { ok: false, error: "invalid-data-url" };
    }
    try {
      const mimeType = match[1].toLowerCase();
      const payload = match[2].replace(/\s+/g, "");
      const data = Buffer.from(payload, "base64");
      if (data.length === 0) {
        return { ok: false, error: "empty-body" };
      }
      return {
        ok: true,
        mimeType,
        size: data.length,
        data,
      };
    } catch {
      return { ok: false, error: "invalid-data-url" };
    }
  }

  async function resolveFetchedImageSource(source, sourcePathHint, depth, options) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      return { ok: false, error: "empty-body" };
    }
    if (/^data:image\//i.test(trimmed)) {
      return decodeDataImageUrl(trimmed);
    }
    if (/^https?:\/\//i.test(trimmed)) {
      if (!isAllowedFollowUpUrl(trimmed, options?.allowedOrigins)) {
        return { ok: false, error: "disallowed-follow-up-origin" };
      }
      return tryFetchImageFromUrl(trimmed, sourcePathHint, depth + 1, options);
    }
    return { ok: false, error: "wrong-content-type:unusable-response" };
  }

  async function tryFetchImageFromUrl(targetUrl, sourcePathHint = "", depth = 0, options = {}) {
    if (depth > 2) {
      return { ok: false, error: "redirect-depth-exceeded" };
    }
    const timeoutMs =
      typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : 0;
    let timeoutId = null;
    const controller = timeoutMs > 0 ? new AbortController() : null;
    try {
      if (controller) {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, timeoutMs);
      }
      const response = await fetch(targetUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });
      if (!response.ok) {
        return { ok: false, error: `http-${response.status}` };
      }
      const contentType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (contentType.includes("json")) {
        try {
          const payload = await response.json();
          const extracted = extractRenderableImageSourceFromUnknown(payload, sourcePathHint);
          if (!extracted) {
            return { ok: false, error: "wrong-content-type:json" };
          }
          return resolveFetchedImageSource(extracted, sourcePathHint, depth, options);
        } catch {
          return { ok: false, error: "invalid-json" };
        }
      }
      if (contentType.startsWith("text/")) {
        const payload = await response.text();
        if (!payload.trim()) {
          return { ok: false, error: "empty-body" };
        }
        try {
          const parsed = JSON.parse(payload);
          const extracted = extractRenderableImageSourceFromUnknown(parsed, sourcePathHint);
          if (!extracted) {
            return { ok: false, error: `wrong-content-type:${contentType || "unknown"}` };
          }
          return resolveFetchedImageSource(extracted, sourcePathHint, depth, options);
        } catch {
          const extracted = extractRenderableImageSourceFromUnknown(payload, sourcePathHint);
          if (!extracted) {
            return { ok: false, error: `wrong-content-type:${contentType || "unknown"}` };
          }
          return resolveFetchedImageSource(extracted, sourcePathHint, depth, options);
        }
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      if (data.length === 0) {
        return { ok: false, error: "empty-body" };
      }
      const mimeType =
        (contentType.startsWith("image/") && contentType) ||
        imageMimeTypeFromPath(sourcePathHint) ||
        imageMimeTypeFromPath(new URL(targetUrl).pathname);
      if (!mimeType) {
        return { ok: false, error: `wrong-content-type:${contentType || "unknown"}` };
      }
      return {
        ok: true,
        mimeType,
        size: data.length,
        data,
      };
    } catch (error) {
      if (error && typeof error === "object" && error.name === "AbortError") {
        return { ok: false, error: "timeout" };
      }
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "fetch-failed";
      return { ok: false, error: code };
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function readImageFromRemoteGateway(rawPath) {
    const normalizedPath = stripPathDecorators(rawPath);
    if (!normalizedPath) {
      return { ok: false, error: "invalid-path" };
    }
    const encodedPath = encodeURIComponent(normalizedPath);
    let lastError = "gateway-fetch-failed";

    const viteUrls = [
      `http://localhost:${viteDevServerPort}/__claw/local-image?path=${encodedPath}`,
    ];
    for (const url of viteUrls) {
      const result = await tryFetchImageFromUrl(url, normalizedPath, 0, {
        allowedOrigins: buildAllowedRemoteFetchOrigins(url),
        timeoutMs: remoteGatewayFetchTimeoutMs,
      });
      if (result.ok) {
        return result;
      }
      lastError = `vite-${result.error}`;
    }

    const gatewayUrls = buildRemoteGatewayUrlCandidates(normalizedPath);
    for (const targetUrl of gatewayUrls) {
      const result = await tryFetchImageFromUrl(targetUrl, normalizedPath, 0, {
        allowedOrigins: buildAllowedRemoteFetchOrigins(targetUrl),
        timeoutMs: remoteGatewayFetchTimeoutMs,
      });
      if (result.ok) {
        return result;
      }
      lastError = `gateway-${result.error}`;
    }

    return { ok: false, error: lastError };
  }

  async function readImageFromCandidates(candidates) {
    let lastErrorCode = "ENOENT";
    let lastTriedPath = "";
    for (const candidate of candidates) {
      const mimeType = imageMimeTypeFromPath(candidate);
      if (!mimeType) {
        continue;
      }
      try {
        const stat = await fs.promises.stat(candidate);
        if (!stat.isFile()) {
          continue;
        }
        const cached = getCachedImage(candidate, mimeType, stat);
        if (cached) {
          return {
            ok: true,
            path: candidate,
            mimeType: cached.mimeType,
            size: cached.size,
            data: cached.data,
          };
        }
        const data = await fs.promises.readFile(candidate);
        setCachedImage(candidate, {
          mimeType,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          data,
        });
        return {
          ok: true,
          path: candidate,
          mimeType,
          size: stat.size,
          data,
        };
      } catch (error) {
        lastTriedPath = candidate;
        lastErrorCode =
          error &&
          typeof error === "object" &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : "unknown";
      }
    }
    const suffix = lastTriedPath ? `:${lastTriedPath}` : "";
    return { ok: false, error: `read-failed:${lastErrorCode}${suffix}`, path: lastTriedPath };
  }

  async function handleDesktopLocalImageRequest(request) {
    const rawPath = localImagePathFromDesktopUrl(request.url);
    if (rawPath) {
      const fromRemoteGateway = await readImageFromRemoteGateway(rawPath);
      if (fromRemoteGateway.ok) {
        return new Response(fromRemoteGateway.data, {
          status: 200,
          headers: {
            "Content-Type": fromRemoteGateway.mimeType,
            "Cache-Control": "no-store",
          },
        });
      }
    }
    const candidates = localImageCandidatesFromDesktopUrl(request.url);
    if (candidates.length === 0) {
      return new Response("invalid-path", { status: 400 });
    }
    const loaded = await readImageFromCandidates(candidates);
    if (!loaded.ok) {
      return new Response(loaded.error, { status: 404 });
    }
    return new Response(loaded.data, {
      status: 200,
      headers: {
        "Content-Type": loaded.mimeType,
        "Cache-Control": "no-store",
      },
    });
  }

  async function readDesktopImageFile(rawPath) {
    const candidates = resolveLocalImagePathCandidates(rawPath);
    if (candidates.length === 0) {
      return { ok: false, error: "invalid-path" };
    }
    const loaded = await readImageFromCandidates(candidates);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }
    return {
      ok: true,
      path: loaded.path,
      mimeType: loaded.mimeType,
      size: loaded.size,
      dataUrl: `data:${loaded.mimeType};base64,${loaded.data.toString("base64")}`,
    };
  }

  async function fetchDesktopImageUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return { ok: false, error: "invalid-url" };
    }
    let parsed;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { ok: false, error: "invalid-url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "invalid-url-protocol" };
    }
    const fetched = await tryFetchImageFromUrl(parsed.toString(), parsed.pathname, 0, {
      allowedOrigins: buildAllowedRemoteFetchOrigins(parsed.toString(), false),
    });
    if (!fetched.ok) {
      return { ok: false, error: fetched.error };
    }
    return {
      ok: true,
      mimeType: fetched.mimeType,
      size: fetched.size,
      dataUrl: `data:${fetched.mimeType};base64,${fetched.data.toString("base64")}`,
    };
  }

  return {
    handleDesktopLocalImageRequest,
    readDesktopImageFile,
    fetchDesktopImageUrl,
  };
}

module.exports = {
  createLocalImageTransport,
  resolveGatewayHttpBaseCandidates,
  hasRemoteGatewayCandidates,
};
