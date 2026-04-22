import React from "react";
import type { DraftMediaReference } from "../lib/media-browser-items.ts";
import { formatDraftMediaReferenceLabel } from "../lib/media-browser-reference.ts";

type DraftMediaReferenceTrayProps = {
  references: DraftMediaReference[];
  onRemoveReference: (artifactId: string) => void;
};

export function DraftMediaReferenceTray(props: DraftMediaReferenceTrayProps) {
  if (props.references.length === 0) {
    return null;
  }

  return (
    <div className="draft-media-reference-list">
      {props.references.map((reference) => (
        <div key={reference.artifactId} className="draft-media-reference-item">
          <div className="draft-media-reference-icon" aria-hidden="true">🔗</div>
          <div className="draft-media-reference-copy">
            <span
              className="draft-media-reference-name"
              title={formatDraftMediaReferenceLabel(reference)}
            >
              {reference.displayName}
            </span>
            <span className="draft-media-reference-meta">{reference.sourceLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => props.onRemoveReference(reference.artifactId)}
            className="draft-media-reference-remove"
            aria-label={`Remove ${reference.displayName}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
