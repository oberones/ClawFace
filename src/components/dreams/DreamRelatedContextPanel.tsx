import React, { useEffect, useMemo, useState } from "react";
import type {
  DreamRelatedContext,
  DreamRelatedInsightMatch,
  DreamRelatedPalaceMatch,
} from "../../lib/dream-related-context.ts";

type DreamRelatedContextPanelProps = {
  relatedContext: DreamRelatedContext;
  requestedSelectionKey?: string | null;
};

function selectionKey(item: DreamRelatedInsightMatch | DreamRelatedPalaceMatch): string {
  return `${item.kind}:${item.pagePath}`;
}

export default function DreamRelatedContextPanel(props: DreamRelatedContextPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const items = useMemo(
    () => [...props.relatedContext.insights, ...props.relatedContext.palacePages],
    [props.relatedContext.insights, props.relatedContext.palacePages],
  );
  const selectedItem = items.find((item) => selectionKey(item) === selectedKey) ?? items[0] ?? null;

  useEffect(() => {
    if (!props.requestedSelectionKey) {
      return;
    }
    if (items.some((item) => selectionKey(item) === props.requestedSelectionKey) && props.requestedSelectionKey !== selectedKey) {
      setSelectedKey(props.requestedSelectionKey);
    }
  }, [items, props.requestedSelectionKey, selectedKey]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !items.some((item) => selectionKey(item) === selectedKey)) {
      setSelectedKey(selectionKey(selectedItem));
    }
  }, [items, selectedItem, selectedKey]);

  return (
    <section id="dream-related-context-panel" className="dream-panel-section">
      <div className="dream-panel-heading dream-panel-heading-inline">
        <h3 className="dream-section-title">Related memory context</h3>
      </div>
      {props.relatedContext.status === "loading" ? (
        <div className="dream-inline-note">Loading Imported Insights and Memory Palace context…</div>
      ) : props.relatedContext.status === "unsupported" ? (
        <div className="dream-inline-note">{props.relatedContext.limitationNote}</div>
      ) : props.relatedContext.status === "error" ? (
        <div className="dream-inline-note">
          {props.relatedContext.limitationNote}
          {props.relatedContext.error ? ` ${props.relatedContext.error}` : ""}
        </div>
      ) : props.relatedContext.status === "limited" ? (
        <div className="dream-inline-note">{props.relatedContext.limitationNote}</div>
      ) : props.relatedContext.status === "ready" ? (
        <>
          <div className="dream-related-links">
            {items.map((item) => (
              <button
                key={selectionKey(item)}
                type="button"
                className={`dream-related-link${selectedItem && selectionKey(item) === selectionKey(selectedItem) ? " is-selected" : ""}`}
                onClick={() => setSelectedKey(selectionKey(item))}
              >
                <span className="dream-related-link-kind">{item.kind === "insight" ? "Imported Insight" : "Memory Palace"}</span>
                <span className="dream-related-link-title">{item.title}</span>
              </button>
            ))}
          </div>
          {selectedItem ? (
            <div className="dream-related-preview">
              <div className="dream-related-preview-path">{selectedItem.pagePath}</div>
              {selectedItem.kind === "insight" ? (
                <>
                  <p className="dream-related-preview-copy">{selectedItem.summary}</p>
                  <div className="dream-candidate-cues">
                    <span className="dream-cue-pill">Topic: {selectedItem.topicLabel}</span>
                    <span className="dream-cue-pill">Risk: {selectedItem.riskLevel}</span>
                    {selectedItem.matchedTerms.map((term) => (
                      <span key={term} className="dream-cue-pill">Match: {term}</span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="dream-related-preview-copy">
                    {selectedItem.snippet ?? "OpenClaw exposed this Memory Palace page as nearby durable context."}
                  </p>
                  <div className="dream-candidate-cues">
                    <span className="dream-cue-pill">Kind: {selectedItem.pageKind}</span>
                    <span className="dream-cue-pill">Claims: {selectedItem.claimCount}</span>
                    {selectedItem.matchedTerms.map((term) => (
                      <span key={term} className="dream-cue-pill">Match: {term}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="dream-inline-note">Select a candidate to load nearby imported insights or memory palace pages.</div>
      )}
    </section>
  );
}
