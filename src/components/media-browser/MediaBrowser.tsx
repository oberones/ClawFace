import React from "react";
import { BrowserShellLayout } from "../browser-shell/BrowserShellLayout.tsx";
import { MediaBrowserSidebar } from "./MediaBrowserSidebar.tsx";
import { MediaBrowserPreview } from "./MediaBrowserPreview.tsx";
import { useImageLightboxController } from "../../hooks/useImageLightboxController.ts";
import { useMediaBrowserController } from "../../hooks/useMediaBrowserController.ts";
import { isMediaArtifactReusableInV1 } from "../../lib/media-browser-items.ts";
import type { MediaBrowserSourceData } from "../../lib/media-browser-sources.ts";

export type MediaBrowserProps = {
  sourceData: MediaBrowserSourceData;
  activeSessionKey?: string | null;
  enableAnimations?: boolean;
  onSwitchToChat?: () => void;
  onOpenFiles?: () => void;
  onOpenSettings?: () => void;
  onReuseArtifact?: Parameters<typeof useMediaBrowserController>[0]["onReuseArtifact"];
  onResolveRemoteImage?: (filePath: string) => Promise<string | null>;
};

export default function MediaBrowser(props: MediaBrowserProps) {
  const controller = useMediaBrowserController({
    sourceData: props.sourceData,
    activeSessionKey: props.activeSessionKey,
    onReuseArtifact: props.onReuseArtifact,
  });
  const {
    imageLightbox,
    openImageLightbox,
    closeImageLightbox,
    onLightboxImageError,
    lightboxBlockedByWebLocalFile,
  } = useImageLightboxController();

  return (
    <BrowserShellLayout
      areaClassName="mb-area"
      scrollClassName="mb-scroll"
      title="Media Browser"
      meta={`${controller.visibleArtifacts.length} visible · ${props.sourceData.artifacts.length} loaded`}
      actions={(
        <>
          {props.onSwitchToChat ? (
            <button type="button" className="ui-btn ui-btn-light" onClick={props.onSwitchToChat}>
              Chat
            </button>
          ) : null}
          {props.onOpenFiles ? (
            <button type="button" className="ui-btn ui-btn-light" onClick={props.onOpenFiles}>
              Files
            </button>
          ) : null}
          {props.onOpenSettings ? (
            <button type="button" className="ui-btn ui-btn-primary" onClick={props.onOpenSettings}>
              Settings
            </button>
          ) : null}
        </>
      )}
    >
      <div className="media-browser-shell">
        <MediaBrowserSidebar
          roots={controller.roots}
          activeRootKey={controller.activeRootKey}
          activeRoot={controller.activeRoot}
          visibleArtifacts={controller.visibleArtifacts}
          selectedArtifactId={controller.selectedArtifactId}
          filterState={controller.filterState}
          enableAnimations={props.enableAnimations}
          onSelectRoot={controller.selectRoot}
          onSelectArtifact={controller.selectArtifact}
          onSetQuery={controller.setQuery}
          onSetSort={(sortKey) => {
            const nextDir =
              controller.filterState.sortKey === sortKey &&
              controller.filterState.sortDir === "desc"
                ? "asc"
                : "desc";
            controller.setSort(sortKey, nextDir);
          }}
          onClearFilters={controller.clearFilters}
        />

        <MediaBrowserPreview
          previewSelection={controller.previewSelection}
          canReuseInChat={Boolean(
            props.activeSessionKey &&
            controller.previewSelection?.resolvedArtifact &&
            isMediaArtifactReusableInV1(controller.previewSelection.resolvedArtifact),
          )}
          reuseRequest={controller.reuseRequest}
          onReuseInChat={() => {
            void controller.requestReuse();
          }}
          onOpenImage={openImageLightbox}
          resolveRemoteImage={props.onResolveRemoteImage}
        />
      </div>

      {imageLightbox && (
        <div
          className="image-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={closeImageLightbox}
        >
          <div className="image-lightbox" onClick={(event) => event.stopPropagation()}>
            <div className="image-lightbox-header">
              <div className="image-lightbox-name" title={imageLightbox.name}>
                {imageLightbox.name}
              </div>
              <div className="image-lightbox-actions">
                <a
                  className="ui-btn ui-btn-light"
                  href={imageLightbox.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
                <button
                  type="button"
                  className="ui-btn ui-btn-primary"
                  onClick={closeImageLightbox}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="image-lightbox-body">
              {lightboxBlockedByWebLocalFile ? (
                <div className="attachment-image-fallback">
                  Web cannot render local file paths. Use desktop app or provide http/data image URL.
                </div>
              ) : (
                <img
                  src={imageLightbox.dataUrl}
                  alt={imageLightbox.name}
                  className="image-lightbox-image"
                  onError={onLightboxImageError}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </BrowserShellLayout>
  );
}
