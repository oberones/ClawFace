import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { Attachment } from "../lib/types.ts";
import {
  buildDesktopLocalImageUrl,
  filePathFromImageSource,
  isDesktopRuntime,
  isLikelyLocalFileSource,
} from "../lib/message-image-source.ts";

export function useImageLightboxController() {
  const [imageLightbox, setImageLightbox] = useState<Attachment | null>(null);
  const lightboxReadTriedRef = useRef<Set<string>>(new Set());

  const openImageLightbox = useCallback((attachment: Attachment) => {
    lightboxReadTriedRef.current.clear();
    setImageLightbox(attachment);
  }, []);

  const closeImageLightbox = useCallback(() => {
    setImageLightbox(null);
  }, []);

  useEffect(() => {
    if (!imageLightbox) {
      lightboxReadTriedRef.current.clear();
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeImageLightbox();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeImageLightbox, imageLightbox]);

  useEffect(() => {
    if (!imageLightbox) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [imageLightbox]);

  const onLightboxImageError = useCallback(() => {
    if (!imageLightbox) {
      return;
    }
    const filePath = filePathFromImageSource(imageLightbox.sourcePath ?? imageLightbox.dataUrl);
    if (isDesktopRuntime() && filePath) {
      const nextDesktopSrc = buildDesktopLocalImageUrl(filePath);
      if (nextDesktopSrc !== imageLightbox.dataUrl) {
        setImageLightbox((previous) => {
          if (!previous || previous.id !== imageLightbox.id) {
            return previous;
          }
          return {
            ...previous,
            dataUrl: nextDesktopSrc,
          };
        });
        return;
      }
    }
    const attemptedKey = imageLightbox.dataUrl;
    if (!attemptedKey || lightboxReadTriedRef.current.has(attemptedKey)) {
      return;
    }
    lightboxReadTriedRef.current.add(attemptedKey);
    const readImageFile = window.desktopInfo?.readImageFile;
    if (!readImageFile || !filePath) {
      return;
    }
    void readImageFile(filePath)
      .then((result) => {
        const nextDataUrl =
          result.ok && typeof result.dataUrl === "string" ? result.dataUrl.trim() : "";
        if (!nextDataUrl) {
          return;
        }
        setImageLightbox((previous) => {
          if (!previous || previous.id !== imageLightbox.id) {
            return previous;
          }
          lightboxReadTriedRef.current.add(nextDataUrl);
          return {
            ...previous,
            dataUrl: nextDataUrl,
          };
        });
      })
      .catch(() => {
        // ignore
      });
  }, [imageLightbox]);

  const onLightboxImageContextMenu = useCallback((event: MouseEvent<HTMLImageElement>) => {
    if (!imageLightbox) {
      return;
    }
    const showImageContextMenu = window.desktopInfo?.showImageContextMenu;
    if (!isDesktopRuntime() || typeof showImageContextMenu !== "function") {
      return;
    }
    event.preventDefault();
    void showImageContextMenu({
      name: imageLightbox.name,
      dataUrl: imageLightbox.dataUrl,
      sourcePath: imageLightbox.sourcePath,
      x: event.clientX,
      y: event.clientY,
    }).catch(() => {
      // Native context menu errors should not break the image viewer.
    });
  }, [imageLightbox]);

  useEffect(() => {
    if (!imageLightbox || !isDesktopRuntime()) {
      return;
    }
    const filePath = filePathFromImageSource(imageLightbox.sourcePath ?? imageLightbox.dataUrl);
    if (!filePath) {
      return;
    }
    const nextDesktopSrc = buildDesktopLocalImageUrl(filePath);
    if (nextDesktopSrc !== imageLightbox.dataUrl) {
      setImageLightbox((previous) => {
        if (!previous || previous.id !== imageLightbox.id) {
          return previous;
        }
        return {
          ...previous,
          dataUrl: nextDesktopSrc,
        };
      });
    }
  }, [imageLightbox]);

  const lightboxBlockedByWebLocalFile = useMemo(() => {
    if (!imageLightbox) {
      return false;
    }
    return !isDesktopRuntime() && isLikelyLocalFileSource(imageLightbox.dataUrl);
  }, [imageLightbox]);

  return {
    imageLightbox,
    openImageLightbox,
    closeImageLightbox,
    onLightboxImageError,
    onLightboxImageContextMenu,
    lightboxBlockedByWebLocalFile,
  };
}
