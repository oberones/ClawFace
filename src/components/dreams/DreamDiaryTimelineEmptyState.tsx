import React from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import type { DreamDiaryTimelineAvailability } from "../../lib/dream-diary-timeline.ts";

type DreamDiaryTimelineEmptyStateProps = {
  availability: DreamDiaryTimelineAvailability;
  note: string | null;
  error: string | null;
  onRefresh: () => void;
};

function copyForAvailability(availability: DreamDiaryTimelineAvailability, note: string | null, error: string | null) {
  if (note) {
    return note;
  }
  if (error && availability === "unavailable") {
    return "Dream Diary is unavailable right now. Refresh after reconnecting or once the gateway is ready.";
  }
  if (availability === "loading") {
    return "Loading the Dream Diary for this workspace.";
  }
  if (availability === "empty") {
    return "No Dream Diary entries have been written for this workspace yet.";
  }
  if (availability === "disabled") {
    return "Dreaming is currently off, and no readable diary entries are available yet.";
  }
  if (availability === "limited") {
    return "Dream Diary content is available, but ClawFace cannot split it into readable entries yet.";
  }
  return "Dream Diary is unavailable right now.";
}

function titleForAvailability(availability: DreamDiaryTimelineAvailability) {
  if (availability === "loading") return "Loading Dream Diary";
  if (availability === "empty") return "No diary entries yet";
  if (availability === "disabled") return "Dreaming is off";
  if (availability === "limited") return "Diary structure is limited";
  return "Dream Diary unavailable";
}

export default function DreamDiaryTimelineEmptyState(props: DreamDiaryTimelineEmptyStateProps) {
  const retryable = props.availability === "empty" || props.availability === "unavailable" || props.availability === "limited";
  return (
    <BrowserEmptyState
      title={titleForAvailability(props.availability)}
      copy={copyForAvailability(props.availability, props.note, props.error)}
      actions={retryable ? <button type="button" className="ui-btn ui-btn-light" onClick={props.onRefresh}>Refresh diary</button> : null}
    />
  );
}
