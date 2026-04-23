import type { DreamCandidate, DreamCandidateLane } from "./dream-candidates.ts";
import type { DreamDiaryDocument, DreamDiaryEntry } from "./dream-diary.ts";
import type { DreamInspectorSnapshot } from "../hooks/useDreamInspectorController.ts";

export type DreamTimelineAvailability = "loading" | "ready" | "empty" | "disabled" | "unavailable" | "partial";

export type DreamTimelineSourceKind = "promotedAt" | "lastRecalledAt" | "diaryDate" | "diaryUpdatedAt";

export type DreamTimelineMomentKind = "promotion" | "replay" | "diary-entry" | "diary-update" | "mixed" | "limited";

export type DreamTimelineArtifactLink = {
  kind: "diary-entry" | "dream-candidate" | "related-insight" | "related-palace";
  targetId: string | null;
  label: string;
  detail: string | null;
  relationship: "direct" | "nearby" | "inferred" | "limited";
};

export type DreamTimelineCandidateRef = {
  candidateKey: string | null;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  label: string;
  relationship: "direct" | "grouped" | "inferred" | "limited";
  status: DreamCandidateLane | null;
};

export type DreamTimelineMomentGroup = {
  id: string;
  kind: DreamTimelineMomentKind;
  headline: string;
  summary: string;
  timestamp: string;
  phaseLabel: string | null;
  candidateRefs: DreamTimelineCandidateRef[];
  artifactLinks: DreamTimelineArtifactLink[];
  sourceKinds: DreamTimelineSourceKind[];
  limitationNote: string | null;
};

export type DreamTimelineCandidateTrack = {
  candidateKey: string;
  headline: string;
  currentStatus: DreamCandidateLane | null;
  momentGroupIds: string[];
  limitationNote: string | null;
};

export type DreamTimelineRange = {
  startAt: string | null;
  endAt: string | null;
  derivedFrom: DreamTimelineSourceKind[];
};

export type DreamTimelineSnapshot = {
  workspaceScopeLabel: string;
  workspaceScopeDetail: string;
  loadedAtMs: number | null;
  availability: DreamTimelineAvailability;
  range: DreamTimelineRange | null;
  momentGroups: DreamTimelineMomentGroup[];
  candidateTracks: DreamTimelineCandidateTrack[];
  note: string | null;
  error: string | null;
};

type TimelineMomentSeed = {
  id: string;
  kind: DreamTimelineMomentKind;
  timestamp: string;
  headline: string;
  summary: string;
  sourceKinds: DreamTimelineSourceKind[];
  limitationNote: string | null;
  candidateRefs: DreamTimelineCandidateRef[];
};

function truncateSnippet(value: string, max = 54): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function diaryEntryTimestamp(entry: DreamDiaryEntry): string | null {
  if (!entry.dateLabel) {
    return null;
  }
  const trimmed = entry.dateLabel.trim();
  if (!trimmed) {
    return null;
  }
  const dayMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\b|$)/);
  if (dayMatch?.[1]) {
    return `${dayMatch[1]}T12:00:00.000Z`;
  }
  const parsed = parseTimestamp(trimmed);
  if (parsed === null) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function compareMoments(left: TimelineMomentSeed, right: TimelineMomentSeed): number {
  const leftTime = parseTimestamp(left.timestamp) ?? 0;
  const rightTime = parseTimestamp(right.timestamp) ?? 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return left.id.localeCompare(right.id);
}

function sortStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildCandidateRef(candidate: DreamCandidate, relationship: DreamTimelineCandidateRef["relationship"]): DreamTimelineCandidateRef {
  return {
    candidateKey: candidate.key,
    path: candidate.path,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
    label: truncateSnippet(candidate.snippet),
    relationship,
    status: candidate.lane,
  };
}

function buildCandidateTimelineMoment(
  kind: "promotion" | "replay",
  timestamp: string,
  candidates: DreamCandidate[],
): TimelineMomentSeed {
  const grouped = candidates.length > 1;
  const relationship = grouped ? "grouped" : "direct";
  const candidateRefs = candidates.map((candidate) => buildCandidateRef(candidate, relationship));
  const headline = kind === "promotion"
    ? grouped
      ? `${candidates.length} memories promoted`
      : `Promoted · ${truncateSnippet(candidates[0]?.snippet ?? "memory")}`
    : grouped
      ? `${candidates.length} replay touchpoints`
      : `Replay touchpoint · ${truncateSnippet(candidates[0]?.snippet ?? "memory")}`;
  const summary = kind === "promotion"
    ? grouped
      ? `${candidates.length} visible candidates share this promotion timestamp in the current snapshot.`
      : "Visible promotion timing shows this memory had already promoted by this point."
    : grouped
      ? `${candidates.length} visible candidates share this latest replay touchpoint in the current snapshot.`
      : "Visible recall timing shows this memory was touched again around this point.";
  return {
    id: `${kind}:${timestamp}:${sortStrings(candidates.map((candidate) => candidate.key)).join(",")}`,
    kind,
    timestamp,
    headline,
    summary,
    sourceKinds: [kind === "promotion" ? "promotedAt" : "lastRecalledAt"],
    limitationNote: null,
    candidateRefs,
  };
}

function buildDiaryEntryMoment(entry: DreamDiaryEntry, timestamp: string): TimelineMomentSeed {
  return {
    id: `diary-entry:${entry.id}`,
    kind: "diary-entry",
    timestamp,
    headline: `Dream Diary · ${entry.dateLabel ?? "Entry"}`,
    summary: entry.paragraphs[0] ?? "Dream Diary provided nearby narrative context for this snapshot.",
    sourceKinds: ["diaryDate"],
    limitationNote: "Dream Diary timing is derived from entry headings and may be day-level rather than exact.",
    candidateRefs: [],
  };
}

function buildDiaryUpdateMoment(document: DreamDiaryDocument): TimelineMomentSeed | null {
  if (!document.found || !document.content || !document.updatedAtMs) {
    return null;
  }
  return {
    id: `diary-update:${document.updatedAtMs}`,
    kind: "diary-update",
    timestamp: new Date(document.updatedAtMs).toISOString(),
    headline: "Dream Diary update",
    summary: "Dream Diary content is visible, but only file-level update timing could be derived from the current snapshot.",
    sourceKinds: ["diaryUpdatedAt"],
    limitationNote: "Entry dates could not be parsed, so this moment is file-level evidence only.",
    candidateRefs: [],
  };
}

function collectCandidateMoments(candidates: readonly DreamCandidate[]): TimelineMomentSeed[] {
  const promotionGroups = new Map<string, DreamCandidate[]>();
  const replayGroups = new Map<string, DreamCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.promotedAt) {
      const group = promotionGroups.get(candidate.promotedAt) ?? [];
      group.push(candidate);
      promotionGroups.set(candidate.promotedAt, group);
    }
    if (candidate.lastRecalledAt) {
      const group = replayGroups.get(candidate.lastRecalledAt) ?? [];
      group.push(candidate);
      replayGroups.set(candidate.lastRecalledAt, group);
    }
  }

  const moments: TimelineMomentSeed[] = [];
  for (const [timestamp, groupedCandidates] of promotionGroups.entries()) {
    moments.push(buildCandidateTimelineMoment("promotion", timestamp, groupedCandidates));
  }
  for (const [timestamp, groupedCandidates] of replayGroups.entries()) {
    moments.push(buildCandidateTimelineMoment("replay", timestamp, groupedCandidates));
  }
  return moments;
}

function collectDiaryMoments(document: DreamDiaryDocument): { moments: TimelineMomentSeed[]; usedUpdateFallback: boolean } {
  const parsedMoments = document.entries
    .map((entry) => {
      const timestamp = diaryEntryTimestamp(entry);
      if (!timestamp) {
        return null;
      }
      return buildDiaryEntryMoment(entry, timestamp);
    })
    .filter((entry): entry is TimelineMomentSeed => entry !== null);

  if (parsedMoments.length > 0) {
    return {
      moments: parsedMoments,
      usedUpdateFallback: false,
    };
  }

  const fallback = buildDiaryUpdateMoment(document);
  return {
    moments: fallback ? [fallback] : [],
    usedUpdateFallback: fallback !== null,
  };
}

function buildCandidateTracks(candidatesByKey: Record<string, DreamCandidate>, momentGroups: DreamTimelineMomentGroup[]): DreamTimelineCandidateTrack[] {
  const momentIdsByCandidate = new Map<string, string[]>();
  for (const moment of momentGroups) {
    for (const ref of moment.candidateRefs) {
      if (!ref.candidateKey) {
        continue;
      }
      const ids = momentIdsByCandidate.get(ref.candidateKey) ?? [];
      ids.push(moment.id);
      momentIdsByCandidate.set(ref.candidateKey, ids);
    }
  }

  const tracks: DreamTimelineCandidateTrack[] = [];
  for (const [candidateKey, momentGroupIds] of momentIdsByCandidate.entries()) {
    const candidate = candidatesByKey[candidateKey];
    if (!candidate) {
      continue;
    }
    tracks.push({
      candidateKey,
      headline: truncateSnippet(candidate.snippet),
      currentStatus: candidate.lane,
      momentGroupIds,
      limitationNote: null,
    });
  }

  return tracks.sort((left, right) => left.headline.localeCompare(right.headline));
}

export function getTimelineMomentById(
  timeline: DreamTimelineSnapshot,
  momentId: string | null | undefined,
): DreamTimelineMomentGroup | null {
  if (!momentId) {
    return null;
  }
  return timeline.momentGroups.find((moment) => moment.id === momentId) ?? null;
}

export function getTimelineCandidateTrack(
  timeline: DreamTimelineSnapshot,
  candidateKey: string | null | undefined,
): DreamTimelineCandidateTrack | null {
  if (!candidateKey) {
    return null;
  }
  return timeline.candidateTracks.find((track) => track.candidateKey === candidateKey) ?? null;
}

export function filterTimelineMomentsForCandidate(
  timeline: DreamTimelineSnapshot,
  candidateKey: string | null | undefined,
): DreamTimelineMomentGroup[] {
  const track = getTimelineCandidateTrack(timeline, candidateKey);
  if (!track) {
    return [];
  }
  const allowed = new Set(track.momentGroupIds);
  return timeline.momentGroups.filter((moment) => allowed.has(moment.id));
}

export function buildDreamTimelineSnapshot(snapshot: DreamInspectorSnapshot): DreamTimelineSnapshot {
  const base: DreamTimelineSnapshot = {
    workspaceScopeLabel: snapshot.workspaceScope.label,
    workspaceScopeDetail: snapshot.workspaceScope.detail,
    loadedAtMs: snapshot.loadedAtMs,
    availability: "empty",
    range: null,
    momentGroups: [],
    candidateTracks: [],
    note: null,
    error: snapshot.error,
  };

  if (snapshot.availability === "loading") {
    return {
      ...base,
      availability: "loading",
      note: "Loading visible dream chronology from the current snapshot…",
      error: null,
    };
  }

  if (snapshot.availability === "unavailable") {
    return {
      ...base,
      availability: "unavailable",
      note: snapshot.note ?? "Dream Timeline is unavailable because Dream Inspector is unavailable.",
      error: snapshot.error,
    };
  }

  if (snapshot.availability === "disabled") {
    return {
      ...base,
      availability: "disabled",
      note: "Dreaming is off for this workspace, so no timeline can be derived.",
      error: snapshot.error,
    };
  }

  const candidates = Object.values(snapshot.candidatesByKey);
  const candidateMoments = collectCandidateMoments(candidates);
  const diaryMoments = collectDiaryMoments(snapshot.diary);
  const moments = [...candidateMoments, ...diaryMoments.moments].sort(compareMoments);

  if (moments.length === 0) {
    return {
      ...base,
      availability: "empty",
      note:
        snapshot.availability === "empty"
          ? snapshot.note ?? "This workspace has not produced visible dream artifacts yet."
          : "Current dream artifacts do not expose enough timestamped evidence for a meaningful timeline yet.",
      error: null,
    };
  }

  const momentGroups: DreamTimelineMomentGroup[] = moments.map((moment) => ({
    ...moment,
    phaseLabel: null,
    artifactLinks: [],
  }));

  const timestamps = momentGroups
    .map((moment) => parseTimestamp(moment.timestamp))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  const range: DreamTimelineRange | null = timestamps.length > 0
    ? {
        startAt: new Date(timestamps[0]).toISOString(),
        endAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
        derivedFrom: sortStrings(momentGroups.flatMap((moment) => moment.sourceKinds)) as DreamTimelineSourceKind[],
      }
    : null;

  const candidateTracks = buildCandidateTracks(snapshot.candidatesByKey, momentGroups);
  const partial = snapshot.availability === "partial" || diaryMoments.usedUpdateFallback;
  const noteParts = [
    "Derived from visible current data.",
    partial ? "Some chronology is limited by the current snapshot." : null,
    snapshot.availability === "partial" && snapshot.note ? snapshot.note : null,
  ].filter(Boolean);

  return {
    ...base,
    availability: partial ? "partial" : "ready",
    range,
    momentGroups,
    candidateTracks,
    note: noteParts.join(" "),
    error: snapshot.availability === "partial" ? snapshot.error : null,
  };
}
