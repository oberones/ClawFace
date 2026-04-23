import React from "react";
import type { DreamTimelineMomentGroup } from "../../lib/dream-timeline.ts";

type DreamTimelineEventGroupProps = {
  moment: DreamTimelineMomentGroup;
  selected: boolean;
  onSelect: (momentId: string) => void;
};

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  const date = new Date(parsed);
  if (/T12:00:00\.000Z$/.test(value)) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sourceLabel(moment: DreamTimelineMomentGroup): string {
  switch (moment.kind) {
    case "promotion":
      return "Promotion evidence";
    case "replay":
      return "Replay touchpoint";
    case "diary-entry":
      return "Dream Diary entry";
    case "diary-update":
      return "Dream Diary update";
    case "limited":
      return "Limited chronology";
    default:
      return "Visible chronology";
  }
}

export function formatDreamTimelineTimestamp(value: string): string {
  return formatTimestamp(value);
}

export function formatDreamTimelineSourceLabel(moment: DreamTimelineMomentGroup): string {
  return sourceLabel(moment);
}

export default function DreamTimelineEventGroup(props: DreamTimelineEventGroupProps) {
  return (
    <button
      type="button"
      className={`dream-timeline-card${props.selected ? " is-selected" : ""}`}
      onClick={() => props.onSelect(props.moment.id)}
    >
      <div className="dream-timeline-card-top">
        <span className={`dream-timeline-source is-${props.moment.kind}`}>{sourceLabel(props.moment)}</span>
        <span className="dream-panel-meta">{formatTimestamp(props.moment.timestamp)}</span>
      </div>
      <div className="dream-timeline-card-title">{props.moment.headline}</div>
      <div className="dream-timeline-card-summary">{props.moment.summary}</div>
      {props.moment.candidateRefs.length > 0 ? (
        <div className="dream-candidate-cues">
          {props.moment.candidateRefs.slice(0, 3).map((candidateRef) => (
            <span key={`${props.moment.id}:${candidateRef.candidateKey ?? candidateRef.label}`} className="dream-cue-pill">
              {candidateRef.status ? `${candidateRef.status} · ` : ""}{candidateRef.label}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
