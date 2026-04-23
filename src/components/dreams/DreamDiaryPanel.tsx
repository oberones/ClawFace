import React from "react";
import type { DreamDiaryDocument, DreamDiaryEntry, DreamDiaryRelation } from "../../lib/dream-diary.ts";

type DreamDiaryPanelProps = {
  diary: DreamDiaryDocument;
  relation: DreamDiaryRelation | null;
  selectedEntry: DreamDiaryEntry | null;
  onSelectEntry: (entryId: string) => void;
};

export default function DreamDiaryPanel(props: DreamDiaryPanelProps) {
  const selectedEntry = props.selectedEntry;

  return (
    <section id="dream-diary-panel" className="dream-panel-section">
      <div className="dream-panel-heading dream-panel-heading-inline">
        <h3 className="dream-section-title">Dream Diary</h3>
        <span className="dream-panel-meta">{props.diary.path}</span>
      </div>
      {props.relation ? <div className="dream-inline-note">{props.relation.note}</div> : null}
      {!props.diary.found ? (
        <div className="dream-inline-note">No Dream Diary is visible for this workspace yet.</div>
      ) : props.diary.entries.length === 0 ? (
        <div className="dream-inline-note">
          {props.diary.error
            ? `Dream Diary is currently unavailable: ${props.diary.error}`
            : "Dream Diary exists, but no readable entries were parsed from this snapshot."}
        </div>
      ) : (
        <>
          {props.diary.entries.length > 1 ? (
            <div className="dream-entry-tabs">
              {props.diary.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`dream-entry-tab${props.selectedEntry?.id === entry.id ? " is-selected" : ""}`}
                  onClick={() => props.onSelectEntry(entry.id)}
                >
                  {entry.dateLabel ?? "Entry"}
                </button>
              ))}
            </div>
          ) : null}
          {selectedEntry ? (
            <div className="dream-diary-entry">
              {selectedEntry.dateLabel ? (
                <div className="dream-diary-entry-date">{selectedEntry.dateLabel}</div>
              ) : null}
              {selectedEntry.paragraphs.map((paragraph, index) => (
                <p key={`${selectedEntry.id}:${index}`} className="dream-diary-paragraph">{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className="dream-inline-note">Select a diary entry to read the narrative context.</div>
          )}
        </>
      )}
    </section>
  );
}
