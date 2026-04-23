import React from "react";
import type { DreamCandidate } from "../../lib/dream-candidates.ts";
import type { DreamTimelineArtifactLink } from "../../lib/dream-timeline.ts";
import type { DreamTimelineControllerModel } from "../../hooks/useDreamTimelineController.ts";
import DreamCandidateTimeline from "./DreamCandidateTimeline.tsx";
import DreamTimelineEmptyState from "./DreamTimelineEmptyState.tsx";
import DreamTimelineEventGroup, {
  formatDreamTimelineSourceLabel,
  formatDreamTimelineTimestamp,
} from "./DreamTimelineEventGroup.tsx";

type DreamTimelinePanelProps = {
  controller: DreamTimelineControllerModel;
  selectedCandidate: DreamCandidate | null;
  onOpenArtifactLink: (link: DreamTimelineArtifactLink) => void;
};

function formatRange(startAt: string | null, endAt: string | null): string | null {
  if (!startAt || !endAt) {
    return null;
  }
  if (startAt === endAt) {
    return formatDreamTimelineTimestamp(startAt);
  }
  return `${formatDreamTimelineTimestamp(endAt)} to ${formatDreamTimelineTimestamp(startAt)}`;
}

function formatDerivedFrom(sourceKinds: readonly string[]): string {
  return sourceKinds
    .map((kind) => {
      if (kind === "promotedAt") {
        return "promotions";
      }
      if (kind === "lastRecalledAt") {
        return "replay touchpoints";
      }
      if (kind === "diaryDate") {
        return "dated diary entries";
      }
      if (kind === "diaryUpdatedAt") {
        return "diary update timing";
      }
      return kind;
    })
    .join(", ");
}

export default function DreamTimelinePanel(props: DreamTimelinePanelProps) {
  const { snapshot, selectedMoment } = props.controller;
  const statefulAvailability =
    snapshot.availability === "loading" ||
    snapshot.availability === "empty" ||
    snapshot.availability === "disabled" ||
    snapshot.availability === "unavailable";

  return (
    <section className="dream-panel-section dream-timeline-panel">
      <div className="dream-panel-heading">
        <div>
          <div className="dream-panel-kicker">{snapshot.workspaceScopeLabel}</div>
          <h3 className="dream-panel-title">Dream Timeline</h3>
        </div>
        <div className="dream-panel-meta">
          {snapshot.loadedAtMs ? `Snapshot ${formatDreamTimelineTimestamp(new Date(snapshot.loadedAtMs).toISOString())}` : "No snapshot yet"}
        </div>
      </div>
      <p className="dream-panel-copy">
        {snapshot.workspaceScopeDetail} Exact dream runs are not exposed on the current gateway, so this view stays grounded in visible evidence only.
      </p>
      {snapshot.note && snapshot.availability === "partial" ? (
        <div className="dream-inline-note">{snapshot.note}</div>
      ) : null}
      {statefulAvailability ? (
        <DreamTimelineEmptyState
          availability={snapshot.availability}
          note={snapshot.note}
          error={snapshot.error}
        />
      ) : (
        <>
          {snapshot.range ? (
            <div className="dream-timeline-range">
              <strong>{formatRange(snapshot.range.startAt, snapshot.range.endAt)}</strong>
              <span>{formatDerivedFrom(snapshot.range.derivedFrom)}</span>
            </div>
          ) : null}
          <div className="dream-timeline-list">
            {snapshot.momentGroups.map((moment) => (
              <DreamTimelineEventGroup
                key={moment.id}
                moment={moment}
                selected={selectedMoment?.id === moment.id}
                onSelect={props.controller.onSelectMoment}
              />
            ))}
          </div>
          {selectedMoment ? (
            <div className="dream-timeline-detail">
              <div className="dream-panel-heading dream-panel-heading-inline">
                <div>
                  <h4 className="dream-section-title">{selectedMoment.headline}</h4>
                  <div className="dream-panel-meta">
                    {formatDreamTimelineSourceLabel(selectedMoment)} · {formatDreamTimelineTimestamp(selectedMoment.timestamp)}
                  </div>
                </div>
              </div>
              <p className="dream-panel-copy">{selectedMoment.summary}</p>
              {selectedMoment.limitationNote ? (
                <div className="dream-inline-note">{selectedMoment.limitationNote}</div>
              ) : null}
              {selectedMoment.candidateRefs.length > 0 ? (
                <div className="dream-timeline-detail-grid">
                  {selectedMoment.candidateRefs.map((ref) => (
                    <button
                      key={`${selectedMoment.id}:${ref.candidateKey ?? ref.label}`}
                      type="button"
                      className="dream-timeline-detail-card"
                      onClick={() => {
                        if (ref.candidateKey) {
                          props.onOpenArtifactLink({
                            kind: "dream-candidate",
                            targetId: ref.candidateKey,
                            label: ref.label,
                            detail: ref.path,
                            relationship: ref.relationship === "direct" || ref.relationship === "grouped" ? "direct" : "inferred",
                          });
                        }
                      }}
                    >
                      <span className="dream-timeline-detail-label">{ref.status ? `${ref.status} memory` : "Visible memory"}</span>
                      <strong className="dream-timeline-detail-title">{ref.label}</strong>
                      {ref.path ? <span className="dream-timeline-detail-path">{ref.path}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedMoment.artifactLinks.length > 0 ? (
                <div className="dream-timeline-artifacts">
                  {selectedMoment.artifactLinks.map((link) => (
                    <button
                      key={`${selectedMoment.id}:${link.kind}:${link.targetId ?? link.label}`}
                      type="button"
                      className="dream-timeline-artifact-link"
                      onClick={() => props.onOpenArtifactLink(link)}
                    >
                      <span className="dream-timeline-artifact-kind">{link.kind.replace(/-/g, " ")}</span>
                      <span className="dream-timeline-artifact-title">{link.label}</span>
                      {link.detail ? <span className="dream-timeline-artifact-detail">{link.detail}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <DreamCandidateTimeline
            candidate={props.selectedCandidate}
            candidateTrack={props.controller.candidateTrack}
            candidateMoments={props.controller.candidateMoments}
            candidateTrackNote={props.controller.candidateTrackNote}
            selectedMomentId={selectedMoment?.id ?? null}
            onSelectMoment={props.controller.onSelectMoment}
          />
        </>
      )}
    </section>
  );
}
