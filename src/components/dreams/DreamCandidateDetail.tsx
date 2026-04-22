import React from "react";
import type { DreamCandidate } from "../../lib/dream-candidates.ts";

type DreamCandidateDetailProps = {
  candidate: DreamCandidate | null;
};

function renderCount(label: string, value: number) {
  return (
    <div className="dream-detail-stat">
      <span className="dream-detail-stat-label">{label}</span>
      <strong className="dream-detail-stat-value">{value}</strong>
    </div>
  );
}

export default function DreamCandidateDetail(props: DreamCandidateDetailProps) {
  if (!props.candidate) {
    return (
      <section className="dream-panel-section">
        <div className="dream-panel-heading dream-panel-heading-inline">
          <h3 className="dream-section-title">Candidate detail</h3>
        </div>
        <div className="dream-inline-note">Select a memory candidate to inspect its visible signals and nearby diary context.</div>
      </section>
    );
  }

  return (
    <section className="dream-panel-section">
      <div className="dream-panel-heading dream-panel-heading-inline">
        <div>
          <h3 className="dream-section-title">Candidate detail</h3>
          <div className="dream-detail-path">{props.candidate.path}:{props.candidate.startLine}-{props.candidate.endLine}</div>
        </div>
        <span className={`dream-lane-badge is-${props.candidate.lane}`}>{props.candidate.lane}</span>
      </div>
      <div className="dream-detail-snippet">{props.candidate.snippet}</div>
      <div className="dream-detail-origin">{props.candidate.originLabel}</div>
      <div className="dream-candidate-cues">
        {props.candidate.explanationCues.map((cue) => (
          <span key={cue.key} className="dream-cue-pill">{cue.label}</span>
        ))}
      </div>
      <div className="dream-detail-grid">
        {renderCount("Recalls", props.candidate.recallCount)}
        {renderCount("Daily hits", props.candidate.dailyCount)}
        {renderCount("Grounded", props.candidate.groundedCount)}
        {renderCount("Phase hits", props.candidate.phaseHitCount)}
      </div>
    </section>
  );
}
