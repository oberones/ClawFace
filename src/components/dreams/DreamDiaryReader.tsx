import React from "react";
import type { DiaryTimelineEntry } from "../../lib/dream-diary-timeline.ts";

type DreamDiaryReaderProps = {
  entry: DiaryTimelineEntry | null;
  disabledNote: string | null;
};

function kindLabel(entry: DiaryTimelineEntry) {
  if (entry.kind === "dated") {
    return entry.dateLabel ?? "Dated entry";
  }
  if (entry.kind === "heading") {
    return "Undated diary entry";
  }
  return "Limited chronology";
}

export default function DreamDiaryReader(props: DreamDiaryReaderProps) {
  if (!props.entry) {
    return (
      <section className="dream-diary-reader">
        <div className="dream-inline-note">Select a diary entry to read it here.</div>
      </section>
    );
  }

  return (
    <article className="dream-diary-reader">
      <header className="dream-diary-reader-header">
        <div>
          <div className="dream-diary-kicker">{kindLabel(props.entry)}</div>
          <h3 className="dream-diary-reader-title">{props.entry.title}</h3>
        </div>
      </header>
      {props.disabledNote ? <div className="dream-inline-note">{props.disabledNote}</div> : null}
      <div className="dream-diary-reader-body">
        {props.entry.paragraphs.map((paragraph, index) => (
          <p key={`${props.entry?.id}:${index}`} className="dream-diary-paragraph">{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
