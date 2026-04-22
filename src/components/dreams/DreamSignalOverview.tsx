import React from "react";
import type { DreamCandidate, DreamOverview } from "../../lib/dream-candidates.ts";

type DreamSignalOverviewProps = {
  overview: DreamOverview;
  scopeLabel: string;
  scopeDetail: string;
  loadedAtMs: number | null;
  selectedCandidateKey: string | null;
  onSelectCandidate: (candidateKey: string) => void;
};

function formatLoadedAt(value: number | null): string {
  if (!value) {
    return "Snapshot not loaded yet";
  }
  return `Snapshot loaded ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(value)}`;
}

function renderTopCandidateButton(
  candidate: DreamCandidate,
  selectedCandidateKey: string | null,
  onSelectCandidate: (candidateKey: string) => void,
) {
  return (
    <button
      key={candidate.key}
      type="button"
      className={`dream-top-candidate${selectedCandidateKey === candidate.key ? " is-selected" : ""}`}
      onClick={() => onSelectCandidate(candidate.key)}
    >
      <div className="dream-top-candidate-title">{candidate.snippet}</div>
      <div className="dream-top-candidate-meta">
        <span>{candidate.originLabel}</span>
        {candidate.explanationCues[0] ? <span>{candidate.explanationCues[0].label}</span> : null}
      </div>
    </button>
  );
}

export default function DreamSignalOverview(props: DreamSignalOverviewProps) {
  return (
    <section className="dream-panel-section">
      <div className="dream-panel-heading">
        <div>
          <div className="dream-panel-kicker">{props.scopeLabel}</div>
          <h2 className="dream-panel-title">Dream Inspector</h2>
        </div>
        <div className="dream-panel-meta">{formatLoadedAt(props.loadedAtMs)}</div>
      </div>
      <p className="dream-panel-copy">{props.scopeDetail}</p>
      <div className="dream-overview-metrics">
        <div className="dream-metric-card">
          <span className="dream-metric-label">Short-term</span>
          <strong className="dream-metric-value">{props.overview.shortTermCount}</strong>
        </div>
        <div className="dream-metric-card">
          <span className="dream-metric-label">Grounded</span>
          <strong className="dream-metric-value">{props.overview.groundedSignalCount}</strong>
        </div>
        <div className="dream-metric-card">
          <span className="dream-metric-label">Signals</span>
          <strong className="dream-metric-value">{props.overview.totalSignalCount}</strong>
        </div>
        <div className="dream-metric-card">
          <span className="dream-metric-label">Promoted today</span>
          <strong className="dream-metric-value">{props.overview.promotedToday}</strong>
        </div>
      </div>
      {props.overview.phaseSummary.length > 0 ? (
        <div className="dream-phase-summary">
          {props.overview.phaseSummary.map((phase) => (
            <div key={phase.id} className={`dream-phase-chip${phase.enabled ? " is-enabled" : ""}`}>
              <span className="dream-phase-chip-label">{phase.label}</span>
              <span className="dream-phase-chip-detail">{phase.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="dream-panel-heading dream-panel-heading-inline">
        <h3 className="dream-section-title">Heating up now</h3>
      </div>
      {props.overview.topCandidates.length > 0 ? (
        <div className="dream-top-candidates">
          {props.overview.topCandidates.map((candidate) =>
            renderTopCandidateButton(candidate, props.selectedCandidateKey, props.onSelectCandidate)
          )}
        </div>
      ) : (
        <div className="dream-inline-note">No active dream candidates are visible in this snapshot yet.</div>
      )}
    </section>
  );
}
