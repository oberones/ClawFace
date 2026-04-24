import React from "react";
import type { DreamDiaryTimelineControllerModel } from "../../hooks/useDreamDiaryTimelineController.ts";
import DreamDiaryReader from "./DreamDiaryReader.tsx";
import DreamDiaryTimelineEmptyState from "./DreamDiaryTimelineEmptyState.tsx";
import DreamDiaryTimelineList from "./DreamDiaryTimelineList.tsx";

type DreamDiaryTimelinePaneProps = {
  controller: DreamDiaryTimelineControllerModel;
  onClose: () => void;
};

function formatSnapshotTime(value: number | null) {
  if (!value) {
    return "No snapshot yet";
  }
  return `Loaded ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function formatDiaryFreshness(value: number | null) {
  if (!value) {
    return null;
  }
  return `Diary updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

export default function DreamDiaryTimelinePane(props: DreamDiaryTimelinePaneProps) {
  const { controller } = props;
  const snapshot = controller.snapshot;
  const hasReadableContent = Boolean(snapshot.latestEntryId);
  const refreshing = controller.refreshState === "loading" || controller.refreshState === "refreshing";
  const disabledReaderNote =
    snapshot.availability === "disabled" && hasReadableContent ? snapshot.note : null;
  const freshness = formatDiaryFreshness(snapshot.diaryUpdatedAtMs);

  return (
    <aside className="dream-diary-shell">
      <div className="dream-diary-header">
        <div>
          <div className="dream-diary-kicker">OpenClaw Dream Diary</div>
          <div className="dream-diary-title-row">
            <h2 className="dream-diary-title">Dreams</h2>
            {snapshot.availability === "limited" ? <span className="dream-state-pill">Limited chronology</span> : null}
            {snapshot.availability === "disabled" ? <span className="dream-state-pill">Dreaming off</span> : null}
          </div>
          <div className="dream-diary-scope">{snapshot.workspaceScope.label}</div>
        </div>
        <div className="dream-diary-header-actions">
          {controller.canReturnToLatest ? (
            <button type="button" className="ui-btn ui-btn-light" onClick={controller.onSelectLatest}>Latest</button>
          ) : null}
          <button
            type="button"
            className="ui-btn ui-btn-light"
            onClick={controller.onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="ui-btn ui-btn-light" onClick={props.onClose}>Close</button>
        </div>
      </div>

      <div className="dream-diary-content">
        <div className="dream-diary-meta-row">
          <span>{formatSnapshotTime(snapshot.loadedAtMs)}</span>
          {freshness ? <span>{freshness}</span> : null}
        </div>
        {hasReadableContent && snapshot.note && snapshot.availability !== "ready" ? (
          <div className="dream-diary-banner">{snapshot.note}</div>
        ) : null}
        {hasReadableContent ? (
          <div className="dream-diary-reader-layout">
            <DreamDiaryTimelineList
              groups={snapshot.groups}
              entriesById={snapshot.entriesById}
              selectedEntryId={controller.selectedEntryId}
              onSelectEntry={controller.onSelectEntry}
            />
            <DreamDiaryReader entry={controller.selectedEntry} disabledNote={disabledReaderNote} />
          </div>
        ) : (
          <div className="dream-diary-empty">
            <DreamDiaryTimelineEmptyState
              availability={snapshot.availability}
              note={snapshot.note}
              error={snapshot.error}
              onRefresh={controller.onRefresh}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
