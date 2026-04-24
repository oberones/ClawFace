import React from "react";
import type { DiaryTimelineEntry, DiaryTimelineGroup } from "../../lib/dream-diary-timeline.ts";

type DreamDiaryTimelineListProps = {
  groups: DiaryTimelineGroup[];
  entriesById: Record<string, DiaryTimelineEntry>;
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
};

function entryMeta(entry: DiaryTimelineEntry) {
  if (entry.kind === "dated" && entry.dateLabel) {
    return entry.dateLabel;
  }
  if (entry.kind === "heading") {
    return "Undated entry";
  }
  return "Limited chronology";
}

export default function DreamDiaryTimelineList(props: DreamDiaryTimelineListProps) {
  return (
    <nav className="dream-diary-timeline-list" aria-label="Dream Diary entries">
      {props.groups.map((group) => (
        <section key={group.id} className="dream-diary-timeline-group">
          <div className="dream-diary-timeline-group-label">{group.label}</div>
          <div className="dream-diary-timeline-items">
            {group.entryIds.map((entryId) => {
              const entry = props.entriesById[entryId];
              if (!entry) {
                return null;
              }
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`dream-diary-timeline-entry${props.selectedEntryId === entry.id ? " is-selected" : ""}`}
                  onClick={() => props.onSelectEntry(entry.id)}
                >
                  <span className="dream-diary-timeline-entry-title">{entry.title}</span>
                  <span className="dream-diary-timeline-entry-meta">{entryMeta(entry)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
