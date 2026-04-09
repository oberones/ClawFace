import React, { useCallback, useEffect, useRef, useState } from "react";
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
  toDesktopRenderableSrc,
} from "../lib/message-image-source.ts";

type MessageImageAttachmentProps = {
  attachment: Attachment;
  onOpen: (attachment: Attachment) => void;
  resolveRemoteImage?: (filePath: string) => Promise<string | null>;
};

export function MessageImageAttachment(props: MessageImageAttachmentProps) {
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
