import React from "react";
import type { DreamCandidate } from "../../lib/dream-candidates.ts";
import type { DreamTimelineCandidateTrack, DreamTimelineMomentGroup } from "../../lib/dream-timeline.ts";
import { formatDreamTimelineSourceLabel, formatDreamTimelineTimestamp } from "./DreamTimelineEventGroup.tsx";

type DreamCandidateTimelineProps = {
  candidate: DreamCandidate | null;
  candidateTrack: DreamTimelineCandidateTrack | null;
  candidateMoments: DreamTimelineMomentGroup[];
  candidateTrackNote: string | null;
  selectedMomentId: string | null;
  onSelectMoment: (momentId: string) => void;
};

export default function DreamCandidateTimeline(props: DreamCandidateTimelineProps) {
  if (!props.candidate) {
    return (
      <section className="dream-panel-section">
        <div className="dream-panel-heading dream-panel-heading-inline">
          <h3 className="dream-section-title">Candidate timeline</h3>
        </div>
        <div className="dream-inline-note">{props.candidateTrackNote}</div>
      </section>
    );
  }

  return (
    <section className="dream-panel-section">
      <div className="dream-panel-heading dream-panel-heading-inline">
        <div>
          <h3 className="dream-section-title">Candidate timeline</h3>
          <div className="dream-detail-path">{props.candidate.path}:{props.candidate.startLine}-{props.candidate.endLine}</div>
        </div>
        <span className={`dream-lane-badge is-${props.candidate.lane}`}>{props.candidate.lane}</span>
      </div>
      <div className="dream-detail-snippet">{props.candidate.snippet}</div>
      {props.candidateTrackNote ? <div className="dream-inline-note">{props.candidateTrackNote}</div> : null}
      {props.candidateTrack && props.candidateMoments.length > 0 ? (
        <div className="dream-timeline-track-list">
          {props.candidateMoments.map((moment) => (
            <button
              key={moment.id}
              type="button"
              className={`dream-timeline-track-item${props.selectedMomentId === moment.id ? " is-selected" : ""}`}
              onClick={() => props.onSelectMoment(moment.id)}
            >
              <span className="dream-timeline-track-label">{moment.headline}</span>
              <span className="dream-timeline-track-meta">
                {formatDreamTimelineSourceLabel(moment)} · {formatDreamTimelineTimestamp(moment.timestamp)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
