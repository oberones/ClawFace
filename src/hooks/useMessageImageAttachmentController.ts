import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "../lib/types.ts";
import {
  buildDesktopLocalImageUrl,
  DESKTOP_LOCAL_IMAGE_SCHEME,
  extractImageSourceCandidates,
  filePathFromImageSource,
  isDesktopRuntime,
  isLikelyLocalFileSource,
  normalizeDataImageUrl,
  normalizeHttpImageUrl,
  summarizeSourceForError,
  toRuntimeRenderableSrc,
} from "../lib/message-image-source.ts";
import { buildRemoteMediaReferenceCandidates } from "../lib/remote-media-resolution.ts";

const RETRY_DELAY_STEPS_MS = [800, 1600, 2600, 4000, 6000, 8500];
const ACTIVE_GENERATION_RETRY_WINDOW_MS = 90_000;
const SETTLE_RETRY_WINDOW_MS = 15_000;
const IMAGE_DEBUG_PATHS_STORAGE_KEY = "clawui.image.debugPaths";
const ENABLED_IMAGE_DEBUG_VALUES = new Set(["1", "true", "on", "yes"]);

export type MessageImageAttachmentControllerParams = {
  attachment: Attachment;
  onOpen: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
  generationPending?: boolean;
};

export type MessageImageAttachmentViewState =
  | "web-blocked"
  | "loading-local"
  | "fallback"
  | "preview";

export type MessageImageDebugDetails = {
  enabled: boolean;
  sourceValue: string;
  tryValue: string;
  showSource: boolean;
  showTry: boolean;
};

function loadImageDebugPathsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const searchValue = new URLSearchParams(window.location.search).get("imageDebugPaths");
    if (searchValue && ENABLED_IMAGE_DEBUG_VALUES.has(searchValue.trim().toLowerCase())) {
      return true;
    }
    const storedValue = window.localStorage.getItem(IMAGE_DEBUG_PATHS_STORAGE_KEY);
    return storedValue ? ENABLED_IMAGE_DEBUG_VALUES.has(storedValue.trim().toLowerCase()) : false;
  } catch {
    return false;
  }
}

function buildFallbackMessage(params: {
  viewState: MessageImageAttachmentViewState;
  hasAutoRetryWindowRemaining: boolean;
  generationPending?: boolean;
  autoRetryAttempt: number;
  loadError: string | null;
  desktopBridgeMissing: boolean;
}): string | null {
  if (params.viewState === "web-blocked") {
    return "Web cannot read local file paths. Open this session in desktop app.";
  }
  if (params.viewState === "loading-local") {
    return "Loading local image...";
  }
  if (params.viewState !== "fallback") {
    return null;
  }
  if (params.hasAutoRetryWindowRemaining) {
    return params.generationPending
      ? `Waiting for generated image while OpenClaw is still working... retrying (${params.autoRetryAttempt + 1})`
      : `Finalizing generated image... retrying (${params.autoRetryAttempt + 1})`;
  }
  if (params.loadError) {
    return `Image load failed: ${params.loadError}`;
  }
  if (params.desktopBridgeMissing) {
    return "Image load failed: desktop-api-unavailable";
  }
  return "Click to load local image";
}

export function useMessageImageAttachmentController(
  params: MessageImageAttachmentControllerParams,
) {
  const attachmentSource = params.attachment.sourcePath?.trim() || params.attachment.dataUrl;
  const originalSourcePath = params.attachment.sourcePath?.trim() || "";
  const preferredRenderableSrc = toRuntimeRenderableSrc(attachmentSource);
  const [resolvedSrc, setResolvedSrc] = useState(preferredRenderableSrc);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);
  const desktopReadImageFile = window.desktopInfo?.readImageFile;
  const desktopFetchImageUrl = window.desktopInfo?.fetchImageUrl;
  const localPathCandidate = filePathFromImageSource(attachmentSource || resolvedSrc || params.attachment.dataUrl);
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
  const previewErrorTriedRef = useRef<Set<string>>(new Set());
  const autoRetryTimerRef = useRef<number | null>(null);
  const autoRetryDeadlineRef = useRef<number>(Date.now() + SETTLE_RETRY_WINDOW_MS);
  const canAutoRetryLocalLoad =
    Boolean(localPathCandidate) &&
    isDesktopRuntime() &&
    !webLocalFileBlocked &&
    loadError !== "desktop-api-unavailable";
  const autoRetryWindowRemainingMs = autoRetryDeadlineRef.current - Date.now();
  const hasAutoRetryWindowRemaining = canAutoRetryLocalLoad && autoRetryWindowRemainingMs > 0;
  const debugSourceValue = originalSourcePath || attachmentSource || "";
  const debugTryValue = localPathCandidate || debugSourceValue || resolvedSrc || "";
  const showDebugSource = Boolean(debugSourceValue);
  const showDebugTry = Boolean(debugTryValue) && debugTryValue !== debugSourceValue;
  const [showImageDebugPaths] = useState(loadImageDebugPathsEnabled);

  useEffect(() => {
    if (autoRetryTimerRef.current !== null) {
      window.clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    previewErrorTriedRef.current.clear();
    setResolvedSrc(preferredRenderableSrc);
    setFailedToLoad(false);
    setLoadError(null);
    setAutoRetryAttempt(0);
    autoRetryDeadlineRef.current =
      Date.now() + (params.generationPending ? ACTIVE_GENERATION_RETRY_WINDOW_MS : SETTLE_RETRY_WINDOW_MS);
  }, [attachmentSource, params.generationPending, preferredRenderableSrc]);

  useEffect(() => {
    const extensionMs = params.generationPending ? ACTIVE_GENERATION_RETRY_WINDOW_MS : SETTLE_RETRY_WINDOW_MS;
    autoRetryDeadlineRef.current = Math.max(autoRetryDeadlineRef.current, Date.now() + extensionMs);
  }, [params.generationPending]);

  useEffect(() => {
    if (!preferredRenderableSrc || resolvedSrc === preferredRenderableSrc) {
      return;
    }
    if (isDesktopRuntime() && preferredRenderableSrc.toLowerCase().startsWith(`${DESKTOP_LOCAL_IMAGE_SCHEME}:`)) {
      setResolvedSrc(preferredRenderableSrc);
      setFailedToLoad(false);
      setLoadError(null);
    }
  }, [preferredRenderableSrc, resolvedSrc]);

  useEffect(
    () => () => {
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    },
    [],
  );

  const tryResolveLocalImage = useCallback(async (): Promise<Attachment | null> => {
    const sourceValue = (params.attachment.sourcePath?.trim() || resolvedSrc || params.attachment.dataUrl).trim();
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
    const remoteReferenceCandidates = buildRemoteMediaReferenceCandidates({
      sourcePath: params.attachment.sourcePath ?? sourceValue,
      sourceCandidates,
      localFilePath: filePath,
    });
    const tryResolveRemote = async (): Promise<Attachment | null> => {
      if (!params.resolveRemoteImage) {
        return null;
      }
      for (const remoteReferenceCandidate of remoteReferenceCandidates) {
        const remoteDataUrl = await params.resolveRemoteImage(remoteReferenceCandidate);
        const nextDataUrl = typeof remoteDataUrl === "string" ? remoteDataUrl.trim() : "";
        if (!nextDataUrl) {
          continue;
        }
        setResolvedSrc(nextDataUrl);
        setFailedToLoad(false);
        setLoadError(null);
        return {
          ...params.attachment,
          dataUrl: nextDataUrl,
        };
      }
      return null;
    };
    if (!filePath) {
      if (sourceKind === "data-url") {
        for (const candidate of sourceCandidates) {
          const normalizedDataUrl = normalizeDataImageUrl(candidate);
          if (normalizedDataUrl && normalizedDataUrl !== sourceValue) {
            setResolvedSrc(normalizedDataUrl);
            setFailedToLoad(false);
            setLoadError(null);
            return {
              ...params.attachment,
              dataUrl: normalizedDataUrl,
            };
          }
        }
        setFailedToLoad(true);
        setLoadError(`img-decode-failed:${sourceKind}:${summarizeSourceForError(sourceValue)}`);
        return null;
      }
      const remotelyResolved = await tryResolveRemote();
      if (remotelyResolved) {
        return remotelyResolved;
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
              ...params.attachment,
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

    let localError: string | null = null;
    const readImageFile = desktopReadImageFile;
    if (readImageFile) {
      const maxLocalReadAttempts = 4;
      for (let attempt = 1; attempt <= maxLocalReadAttempts; attempt += 1) {
        try {
          const result = await readImageFile(filePath);
          if (result.ok && typeof result.dataUrl === "string" && result.dataUrl.trim()) {
            const nextDataUrl = result.dataUrl.trim();
            setResolvedSrc(nextDataUrl);
            setFailedToLoad(false);
            setLoadError(null);
            return {
              ...params.attachment,
              dataUrl: nextDataUrl,
            };
          }
          localError = result.error ?? "read-failed";
        } catch {
          localError = "read-failed";
        }
        if (attempt < maxLocalReadAttempts) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, attempt * 150);
          });
        }
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
  }, [desktopFetchImageUrl, desktopReadImageFile, params.attachment, params.resolveRemoteImage, resolvedSrc]);

  useEffect(() => {
    if (!requiresDesktopDecode || !localPathCandidate) {
      return;
    }
    if (desktopResolveTriedRef.current.has(localPathCandidate)) {
      return;
    }
    desktopResolveTriedRef.current.add(localPathCandidate);
    void tryResolveLocalImage();
  }, [localPathCandidate, params.attachment.dataUrl, requiresDesktopDecode, resolvedSrc, tryResolveLocalImage]);

  useEffect(() => {
    if (!failedToLoad || !canAutoRetryLocalLoad) {
      return;
    }
    const remainingMs = autoRetryDeadlineRef.current - Date.now();
    if (remainingMs <= 0) {
      return;
    }
    const retryDelayMs = Math.min(
      RETRY_DELAY_STEPS_MS[Math.min(autoRetryAttempt, RETRY_DELAY_STEPS_MS.length - 1)] ?? SETTLE_RETRY_WINDOW_MS,
      remainingMs,
    );
    autoRetryTimerRef.current = window.setTimeout(() => {
      autoRetryTimerRef.current = null;
      void tryResolveLocalImage().finally(() => {
        setAutoRetryAttempt((prev) => prev + 1);
      });
    }, retryDelayMs);
    return () => {
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [autoRetryAttempt, canAutoRetryLocalLoad, failedToLoad, tryResolveLocalImage]);

  const openAttachment = useCallback(async () => {
    if (requiresDesktopDecode || failedToLoad) {
      const recovered = await tryResolveLocalImage();
      if (recovered) {
        params.onOpen(recovered);
        return;
      }
    }
    if (!failedToLoad) {
      const nextDataUrl = preferredRenderableSrc || resolvedSrc;
      const next =
        nextDataUrl === params.attachment.dataUrl
          ? params.attachment
          : {
              ...params.attachment,
              dataUrl: nextDataUrl,
            };
      params.onOpen(next);
      return;
    }
    params.onOpen(params.attachment);
  }, [failedToLoad, params, preferredRenderableSrc, requiresDesktopDecode, resolvedSrc, tryResolveLocalImage]);

  const onPreviewImageError = useCallback(() => {
    const sourceKey = `${attachmentSource}::${resolvedSrc}`;
    if (previewErrorTriedRef.current.has(sourceKey)) {
      setFailedToLoad(true);
      if (!loadError) {
        setLoadError("img-decode-failed");
      }
      return;
    }
    previewErrorTriedRef.current.add(sourceKey);

    const pathCandidate = filePathFromImageSource(
      params.attachment.sourcePath?.trim() || resolvedSrc || params.attachment.dataUrl,
    );
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
      void tryResolveLocalImage()
        .then((recovered) => {
          if (!recovered) {
            setFailedToLoad(true);
            setLoadError((prev) => prev ?? "img-decode-failed");
          }
        })
        .catch(() => {
          setFailedToLoad(true);
          setLoadError((prev) => prev ?? "img-decode-failed");
        });
      return;
    }
    setFailedToLoad(true);
    if (!loadError) {
      setLoadError("img-decode-failed");
    }
  }, [
    attachmentSource,
    desktopFetchImageUrl,
    desktopReadImageFile,
    loadError,
    params.attachment.dataUrl,
    params.attachment.sourcePath,
    resolvedSrc,
    tryResolveLocalImage,
    usesDesktopLocalScheme,
  ]);

  const viewState: MessageImageAttachmentViewState = webLocalFileBlocked
    ? "web-blocked"
    : requiresDesktopDecode && !failedToLoad
    ? "loading-local"
    : failedToLoad
    ? "fallback"
    : "preview";

  return {
    resolvedSrc,
    viewState,
    fallbackMessage: buildFallbackMessage({
      viewState,
      hasAutoRetryWindowRemaining,
      generationPending: params.generationPending,
      autoRetryAttempt,
      loadError,
      desktopBridgeMissing,
    }),
    debugDetails: {
      enabled: showImageDebugPaths && (showDebugSource || showDebugTry),
      sourceValue: debugSourceValue,
      tryValue: debugTryValue,
      showSource: showDebugSource,
      showTry: showDebugTry,
    } satisfies MessageImageDebugDetails,
    openAttachment,
    onPreviewImageError,
  };
}
