import React, { useCallback, useEffect, useState } from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import DreamCandidateDetail from "./DreamCandidateDetail.tsx";
import DreamDiaryPanel from "./DreamDiaryPanel.tsx";
import DreamLaneList from "./DreamLaneList.tsx";
import DreamRelatedContextPanel from "./DreamRelatedContextPanel.tsx";
import DreamSignalOverview from "./DreamSignalOverview.tsx";
import DreamTimelinePanel from "./DreamTimelinePanel.tsx";
import type { DreamInspectorControllerModel } from "../../hooks/useDreamInspectorController.ts";
import { useDreamTimelineController } from "../../hooks/useDreamTimelineController.ts";
import type { DreamTimelineArtifactLink } from "../../lib/dream-timeline.ts";

type DreamInspectorPaneProps = {
  controller: DreamInspectorControllerModel;
  onClose: () => void;
};

function renderStateBody(
  availability: DreamInspectorControllerModel["snapshot"]["availability"],
  note: string | null,
  error: string | null,
  onRefresh: () => void,
) {
  const copy = error ? `${note ?? ""} ${error}`.trim() : note ?? "";
  if (availability === "loading") {
    return <BrowserEmptyState title="Loading Dream Visibility" copy={copy || "Loading a workspace dream snapshot…"} />;
  }
  if (availability === "unavailable") {
    return (
      <BrowserEmptyState
        title="Dream Visibility unavailable"
        copy={copy || "This gateway cannot provide Dream Visibility right now."}
        actions={<button type="button" className="ui-btn ui-btn-light" onClick={onRefresh}>Retry</button>}
      />
    );
  }
  if (availability === "disabled") {
    return (
      <BrowserEmptyState
        title="Dreaming is off"
        copy={copy || "Dream Visibility is unavailable because dreaming is disabled for this workspace."}
      />
    );
  }
  if (availability === "empty") {
    return (
      <BrowserEmptyState
        title="No dream artifacts yet"
        copy={copy || "This workspace has not produced visible dream artifacts yet."}
        actions={<button type="button" className="ui-btn ui-btn-light" onClick={onRefresh}>Refresh snapshot</button>}
      />
    );
  }
  return null;
}

export default function DreamInspectorPane(props: DreamInspectorPaneProps) {
  const { controller } = props;
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [requestedRelatedSelectionKey, setRequestedRelatedSelectionKey] = useState<string | null>(null);
  const timelineController = useDreamTimelineController({
    snapshot: controller.snapshot,
    selectedCandidate: controller.selectedCandidate,
    selectedDiaryEntry: controller.selectedDiaryEntry,
    diaryRelation: controller.diaryRelation,
    relatedContext: controller.relatedContext,
  });
  const stateBody = renderStateBody(
    controller.snapshot.availability,
    controller.snapshot.note,
    controller.snapshot.error,
    controller.onRefresh,
  );
  const canOpenTimeline = !stateBody;

  useEffect(() => {
    if (!canOpenTimeline && timelineOpen) {
      setTimelineOpen(false);
    }
  }, [canOpenTimeline, timelineOpen]);

  const timelineButtonLabel = timelineOpen ? "Hide Timeline" : "Open Timeline";

  const openArtifactLink = useCallback((link: DreamTimelineArtifactLink) => {
    const scrollTo = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    if (link.kind === "dream-candidate" && link.targetId) {
      controller.onSelectCandidate(link.targetId);
      scrollTo("dream-candidate-detail-panel");
      return;
    }
    if (link.kind === "diary-entry") {
      if (link.targetId) {
        controller.onSelectDiaryEntry(link.targetId);
      }
      scrollTo("dream-diary-panel");
      return;
    }
    if ((link.kind === "related-insight" || link.kind === "related-palace") && link.targetId) {
      setRequestedRelatedSelectionKey(link.targetId);
      scrollTo("dream-related-context-panel");
    }
  }, [controller]);

  return (
    <aside className="dream-inspector-shell">
      <div className="dream-inspector-header">
        <div>
          <div className="dream-inspector-kicker">OpenClaw dreaming</div>
          <div className="dream-inspector-title-row">
            <h2 className="dream-inspector-title">Dream Inspector</h2>
            {controller.snapshot.availability === "partial" ? (
              <span className="dream-partial-pill">Partial data</span>
            ) : null}
          </div>
        </div>
        <div className="dream-inspector-header-actions">
          {canOpenTimeline ? (
            <button
              type="button"
              className={`ui-btn ui-btn-light${timelineOpen ? " is-active" : ""}`}
              onClick={() => setTimelineOpen((value) => !value)}
            >
              {timelineButtonLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="ui-btn ui-btn-light"
            onClick={controller.onRefresh}
            disabled={controller.refreshState === "loading" || controller.refreshState === "refreshing"}
          >
            {controller.refreshState === "refreshing" || controller.refreshState === "loading"
              ? "Refreshing…"
              : "Refresh"}
          </button>
          <button type="button" className="ui-btn ui-btn-light" onClick={props.onClose}>Close</button>
        </div>
      </div>
      <div className="dream-inspector-content">
        {stateBody ? (
          <div className="dream-inspector-empty">{stateBody}</div>
        ) : (
          <>
            {controller.snapshot.availability === "partial" && controller.snapshot.note ? (
              <div className="dream-inspector-banner">
                {controller.snapshot.note}
                {controller.snapshot.error ? ` ${controller.snapshot.error}` : ""}
              </div>
            ) : null}
            <DreamSignalOverview
              overview={controller.snapshot.overview}
              scopeLabel={controller.snapshot.workspaceScope.label}
              scopeDetail={controller.snapshot.workspaceScope.detail}
              loadedAtMs={controller.snapshot.loadedAtMs}
              selectedCandidateKey={controller.selectedCandidate?.key ?? null}
              onSelectCandidate={controller.onSelectCandidate}
            />
            {timelineOpen ? (
              <DreamTimelinePanel
                controller={timelineController}
                selectedCandidate={controller.selectedCandidate}
                onOpenArtifactLink={openArtifactLink}
              />
            ) : null}
            <DreamLaneList
              lanes={controller.snapshot.lanes}
              activeLane={controller.activeLane}
              selectedCandidateKey={controller.selectedCandidate?.key ?? null}
              onSelectLane={controller.onSelectLane}
              onSelectCandidate={controller.onSelectCandidate}
            />
            <DreamCandidateDetail candidate={controller.selectedCandidate} />
            <DreamDiaryPanel
              diary={controller.snapshot.diary}
              relation={controller.diaryRelation}
              selectedEntry={controller.selectedDiaryEntry}
              onSelectEntry={controller.onSelectDiaryEntry}
            />
            <DreamRelatedContextPanel
              relatedContext={controller.relatedContext}
              requestedSelectionKey={requestedRelatedSelectionKey}
            />
          </>
        )}
      </div>
    </aside>
  );
}
