import { useCallback, useRef, type MutableRefObject } from "react";
import type { GatewayClient } from "../lib/gateway.ts";
import {
  buildGatewayRemoteMediaUrlCandidates,
  buildRemoteMediaReadParamVariants,
  extractRenderableImageSourceFromUnknown,
  inferImageMimeTypeFromPath,
  pickRemoteMediaReadMethods,
} from "../lib/remote-media-resolution.ts";

const REMOTE_IMAGE_CACHE_LIMIT = 5;
const REMOTE_IMAGE_HTTP_FETCH_TIMEOUT_MS = 2000;

type UseRemoteImageResolverParams = {
  connected: boolean;
  gatewayUrl: string;
  clientRef: MutableRefObject<GatewayClient | null>;
  gatewayMethodsRef: MutableRefObject<Set<string>>;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("empty-data-url"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("file-reader-failed"));
    };
    reader.readAsDataURL(blob);
  });
}

async function extractImageDataUrlFromHttpResponse(
  response: Response,
  sourcePathHint: string,
): Promise<string | null> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("json")) {
    try {
      const payload = await response.json();
      return extractRenderableImageSourceFromUnknown(payload, sourcePathHint);
    } catch {
      return null;
    }
  }
  if (contentType.startsWith("text/")) {
    const payload = await response.text();
    if (!payload.trim()) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload);
      return extractRenderableImageSourceFromUnknown(parsed, sourcePathHint);
    } catch {
      return extractRenderableImageSourceFromUnknown(payload, sourcePathHint);
    }
  }
  const blob = await response.blob();
  if (!blob.size) {
    return null;
  }
  if (blob.type.toLowerCase().startsWith("image/")) {
    return blobToDataUrl(blob);
  }
  const inferredType = inferImageMimeTypeFromPath(sourcePathHint) ?? "image/png";
  return blobToDataUrl(new Blob([blob], { type: inferredType }));
}

export function useRemoteImageResolver(
  params: UseRemoteImageResolverParams,
): (filePath: string) => Promise<string | null> {
  const remoteImageDataCacheRef = useRef<Map<string, string>>(new Map());

  const cacheRemoteImageDataUrl = useCallback((pathKey: string, dataUrl: string) => {
    const cache = remoteImageDataCacheRef.current;
    if (cache.has(pathKey)) {
      cache.delete(pathKey);
    }
    cache.set(pathKey, dataUrl);
    while (cache.size > REMOTE_IMAGE_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
  }, []);

  const resolveRemoteImageViaHttpProxy = useCallback(async (
    gatewayUrl: string,
    filePath: string,
  ): Promise<string | null> => {
    const candidates = buildGatewayRemoteMediaUrlCandidates(gatewayUrl, filePath);
    const desktopFetchImageUrl = window.desktopInfo?.fetchImageUrl;
    for (const candidate of candidates) {
      if (typeof desktopFetchImageUrl === "function") {
        try {
          const result = await desktopFetchImageUrl(candidate);
          const dataUrl =
            result?.ok && typeof result.dataUrl === "string" ? result.dataUrl.trim() : "";
          if (dataUrl) {
            return dataUrl;
          }
        } catch {
          // fall back to renderer-side fetch
        }
      }
      let timeoutId: number | null = null;
      try {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        timeoutId =
          controller !== null
            ? window.setTimeout(() => {
                controller.abort();
              }, REMOTE_IMAGE_HTTP_FETCH_TIMEOUT_MS)
            : null;
        const response = await fetch(candidate, {
          method: "GET",
          cache: "no-store",
          signal: controller?.signal,
        });
        if (!response.ok) {
          continue;
        }
        const dataUrl = await extractImageDataUrlFromHttpResponse(response, filePath);
        if (dataUrl) {
          return dataUrl;
        }
      } catch {
        // try next candidate
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      }
    }
    return null;
  }, []);

  return useCallback(async (filePath: string): Promise<string | null> => {
    const normalizedPath = filePath.trim();
    if (!normalizedPath) {
      return null;
    }
    const cached = remoteImageDataCacheRef.current.get(normalizedPath);
    if (cached) {
      cacheRemoteImageDataUrl(normalizedPath, cached);
      return cached;
    }
    const client = params.clientRef.current;
    if (!client || !params.connected) {
      return null;
    }
    const methods = pickRemoteMediaReadMethods(params.gatewayMethodsRef.current);
    const paramVariants = buildRemoteMediaReadParamVariants(normalizedPath);

    const seenParamKeys = new Set<string>();
    for (const method of methods) {
      for (const rpcParams of paramVariants) {
        const dedupeKey = `${method}:${JSON.stringify(rpcParams)}`;
        if (seenParamKeys.has(dedupeKey)) {
          continue;
        }
        seenParamKeys.add(dedupeKey);
        try {
          const payload = await client.request(method, rpcParams);
          const dataUrl = extractRenderableImageSourceFromUnknown(payload, normalizedPath);
          if (!dataUrl) {
            continue;
          }
          cacheRemoteImageDataUrl(normalizedPath, dataUrl);
          return dataUrl;
        } catch {
          // try next method/params
        }
      }
    }

    const httpDataUrl = await resolveRemoteImageViaHttpProxy(params.gatewayUrl, normalizedPath);
    if (httpDataUrl) {
      cacheRemoteImageDataUrl(normalizedPath, httpDataUrl);
      return httpDataUrl;
    }
    return null;
  }, [
    cacheRemoteImageDataUrl,
    params.clientRef,
    params.connected,
    params.gatewayMethodsRef,
    params.gatewayUrl,
    resolveRemoteImageViaHttpProxy,
  ]);
}
