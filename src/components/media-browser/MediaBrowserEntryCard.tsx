import React from "react";
import { useCardTilt } from "../../hooks/useCardTilt.ts";
import {
  getMediaArtifactProvenanceLabel,
  getMediaArtifactSessionLabel,
  type MediaArtifact,
} from "../../lib/media-browser-items.ts";

export type MediaBrowserEntryCardProps = {
  artifact: MediaArtifact;
  selected: boolean;
  enableAnimations?: boolean;
  onSelect: (artifactId: string) => void;
};

const SOURCE_ICON_BY_KEY: Record<string, string> = {
  generated: "🪄",
  uploaded: "⬆️",
  "session-linked": "💬",
};

function formatRelativeDate(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "Unknown date";
  }
  const diff = Date.now() - timestamp;
  if (diff < 60_000) {
    return "Just now";
  }
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  }
  if (diff < 86_400_000) {
    return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  }
  if (diff < 604_800_000) {
    return `${Math.max(1, Math.floor(diff / 86_400_000))}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

function getArtifactIcon(artifact: MediaArtifact): string {
  if (artifact.kind === "image") {
    return SOURCE_ICON_BY_KEY[artifact.sourceKey] ?? "🖼️";
  }
  if (artifact.kind === "pdf") {
    return "📕";
  }
  if (artifact.kind === "audio") {
    return "🎧";
  }
  if (artifact.kind === "video") {
    return "🎬";
  }
  return "📄";
}

export function MediaBrowserEntryCard(props: MediaBrowserEntryCardProps) {
  const { onMouseMove, onMouseLeave } = useCardTilt();
  const sessionLabel = getMediaArtifactSessionLabel(props.artifact);
  const provenanceLabel = getMediaArtifactProvenanceLabel(props.artifact);
  const previewStateLabel =
    props.artifact.previewState === "unsupported"
      ? "Unsupported"
      : props.artifact.previewState === "error"
        ? "Needs reload"
        : null;

  return (
    <article
      className={`session-card fm-file-card mb-entry-card${props.selected ? " is-active" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={props.selected}
      onClick={() => props.onSelect(props.artifact.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect(props.artifact.id);
        }
      }}
      onMouseMove={(event) => props.enableAnimations && onMouseMove(props.artifact.id, event)}
      onMouseLeave={(event) => props.enableAnimations && onMouseLeave(props.artifact.id, event)}
      style={{
        transform:
          "perspective(700px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(var(--lift, 0px))",
        transformStyle: "preserve-3d",
      }}
    >
      <div className="fm-card-row">
        <span className="fm-card-icon" aria-hidden="true">
          {getArtifactIcon(props.artifact)}
        </span>
        <div className="fm-card-info">
          <div className="fm-card-name">{props.artifact.displayName}</div>
          <div className="fm-card-meta">
            <span>{provenanceLabel}</span>
            {sessionLabel ? (
              <>
                <span>·</span>
                <span>From {sessionLabel}</span>
              </>
            ) : null}
            {props.artifact.createdAt ? (
              <>
                <span>·</span>
                <span>{formatRelativeDate(props.artifact.createdAt)}</span>
              </>
            ) : null}
          </div>
          {props.artifact.runId || previewStateLabel ? (
            <div className="mb-entry-tags">
              {props.artifact.runId ? (
                <span className="mb-entry-tag">Run {props.artifact.runId}</span>
              ) : null}
              {previewStateLabel ? (
                <span className="mb-entry-tag is-warning">{previewStateLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="fm-card-glow"
        style={{
          background:
            "radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(255,255,255,0.22) 0%, transparent 60%)",
        }}
      />
    </article>
  );
}
