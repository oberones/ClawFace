import React, { useMemo } from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import { BrowserRootTabs } from "../browser-shell/BrowserRootTabs.tsx";
import type { DreamCandidate, DreamCandidateLane, DreamLane } from "../../lib/dream-candidates.ts";

type DreamLaneListProps = {
  lanes: Record<DreamCandidateLane, DreamLane>;
  activeLane: DreamCandidateLane;
  selectedCandidateKey: string | null;
  onSelectLane: (lane: DreamCandidateLane) => void;
  onSelectCandidate: (candidateKey: string) => void;
};

function renderCandidateCard(
  candidate: DreamCandidate,
  selectedCandidateKey: string | null,
  onSelectCandidate: (candidateKey: string) => void,
) {
  return (
    <button
      key={candidate.key}
      type="button"
      className={`dream-candidate-card${candidate.key === selectedCandidateKey ? " is-selected" : ""}`}
      onClick={() => onSelectCandidate(candidate.key)}
    >
      <div className="dream-candidate-card-top">
        <span className={`dream-lane-badge is-${candidate.lane}`}>{candidate.lane}</span>
        <span className="dream-candidate-origin">{candidate.originLabel}</span>
      </div>
      <div className="dream-candidate-snippet">{candidate.snippet}</div>
      <div className="dream-candidate-cues">
        {candidate.explanationCues.map((cue) => (
          <span key={cue.key} className="dream-cue-pill">{cue.label}</span>
        ))}
      </div>
    </button>
  );
}

export default function DreamLaneList(props: DreamLaneListProps) {
  const activeLaneData = props.lanes[props.activeLane];
  const tabs = useMemo(
    () => ([
      props.lanes.waiting,
      props.lanes.grounded,
      props.lanes.promoted,
    ]).map((lane) => ({
      key: lane.key,
      label: `${lane.label} (${lane.count})`,
    })),
    [props.lanes],
  );

  return (
    <section className="dream-panel-section">
      <div className="dream-panel-heading dream-panel-heading-inline">
        <h3 className="dream-section-title">Memory lanes</h3>
      </div>
      <BrowserRootTabs
        tabs={tabs}
        activeKey={props.activeLane}
        onSelect={(key) => props.onSelectLane(key as DreamCandidateLane)}
        className="dream-lane-tabs"
        tabClassName="dream-lane-tab"
        activeTabClassName="is-active"
      />
      {activeLaneData.items.length > 0 ? (
        <div className="dream-candidate-list">
          {activeLaneData.items.map((candidate) =>
            renderCandidateCard(candidate, props.selectedCandidateKey, props.onSelectCandidate)
          )}
        </div>
      ) : (
        <BrowserEmptyState
          disableAnimation
          title={`${activeLaneData.label} is empty`}
          copy={activeLaneData.emptyCopy}
        />
      )}
    </section>
  );
}
