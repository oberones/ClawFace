import React from "react";
import { BrowserEmptyState } from "../browser-shell/BrowserEmptyState.tsx";
import type { DreamTimelineAvailability } from "../../lib/dream-timeline.ts";

type DreamTimelineEmptyStateProps = {
  availability: DreamTimelineAvailability;
  note: string | null;
  error: string | null;
};

export default function DreamTimelineEmptyState(props: DreamTimelineEmptyStateProps) {
  const copy = props.error ? `${props.note ?? ""} ${props.error}`.trim() : props.note ?? "";
  if (props.availability === "loading") {
    return <BrowserEmptyState title="Loading Dream Timeline" copy={copy || "Deriving visible chronology from the current snapshot…"} />;
  }
  if (props.availability === "disabled") {
    return (
      <BrowserEmptyState
        title="Dream Timeline disabled"
        copy={copy || "Dreaming is off for this workspace, so no timeline can be derived."}
      />
    );
  }
  if (props.availability === "unavailable") {
    return (
      <BrowserEmptyState
        title="Dream Timeline unavailable"
        copy={copy || "Dream Inspector is unavailable, so the timeline cannot be derived right now."}
      />
    );
  }
  return (
    <BrowserEmptyState
      title="No timeline evidence yet"
      copy={copy || "Current dream artifacts do not expose enough timestamped evidence for a meaningful timeline yet."}
    />
  );
}
