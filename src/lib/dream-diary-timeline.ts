import type { DreamDiaryDocument, DreamDiaryEntry, DreamDiaryEntryKind } from "./dream-diary.ts";
import type { DreamWorkspaceScope } from "./shell-gateway-memory.ts";

export type DreamDiaryTimelineAvailability =
  | "loading"
  | "ready"
  | "empty"
  | "disabled"
  | "unavailable"
  | "limited";

export type DiaryEntryAttachment = {
  entryId: string;
  kind: "imported-insight" | "memory-palace";
  label: string;
  summary: string;
  target: {
    surface: "imported-insight" | "memory-palace";
    id: string;
  };
  relationship: "direct" | "inferred" | "limited";
};

export type DiaryTimelineEntry = {
  id: string;
  kind: DreamDiaryEntryKind;
  title: string;
  dateLabel: string | null;
  occurrenceLabel: string | null;
  sortKey: string;
  body: string;
  paragraphs: string[];
  sourceRange: DreamDiaryEntry["sourceRange"];
  attachmentAnchor: string;
};

export type DiaryTimelineGroup = {
  id: string;
  label: string;
  kind: "dated" | "limited";
  entryIds: string[];
};

export type DreamDiaryTimelineSnapshot = {
  availability: DreamDiaryTimelineAvailability;
  workspaceScope: DreamWorkspaceScope;
  loadedAtMs: number | null;
  diaryUpdatedAtMs: number | null;
  groups: DiaryTimelineGroup[];
  entriesById: Record<string, DiaryTimelineEntry>;
  selectedEntryId: string | null;
  latestEntryId: string | null;
  note: string | null;
  error: string | null;
};

export type DreamDiaryTimelineRefreshState = "idle" | "loading" | "refreshing" | "failed";

export const EMPTY_DREAM_DIARY_DOCUMENT: DreamDiaryDocument = {
  found: false,
  path: "DREAMS.md",
  updatedAtMs: null,
  content: null,
  entries: [],
  error: null,
};

function normalizeDateSortSource(value: string): string {
  return value
    .replace(/\s+at\s+/i, ", ")
    .replace(/\b(AM|PM)([A-Z]{2,5}\b)/i, "$1 $2");
}

function parseDateSortValue(entry: DreamDiaryEntry): number | null {
  if (entry.kind !== "dated" || !entry.dateLabel) {
    return null;
  }
  const dateMatch = entry.dateLabel.match(/^(\d{4}-\d{2}-\d{2})(?:\b|$)/);
  const source = dateMatch?.[1] ? `${dateMatch[1]}T00:00:00.000Z` : normalizeDateSortSource(entry.dateLabel);
  const timestamp = Date.parse(source);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function entryTitle(entry: DreamDiaryEntry): string {
  if (entry.kind === "dated" && entry.dateLabel) {
    return entry.dateLabel;
  }
  if (entry.kind === "heading" && entry.dateLabel) {
    return entry.dateLabel;
  }
  const firstParagraph = entry.paragraphs[0] ?? "Dream Diary";
  return firstParagraph.length > 72 ? `${firstParagraph.slice(0, 69).trim()}...` : firstParagraph;
}

function toTimelineEntry(entry: DreamDiaryEntry, sourceOrder: number): DiaryTimelineEntry {
  const dateSortValue = parseDateSortValue(entry);
  const orderKey = String(sourceOrder).padStart(5, "0");
  return {
    id: entry.id,
    kind: entry.kind,
    title: entryTitle(entry),
    dateLabel: entry.dateLabel,
    occurrenceLabel: null,
    sortKey: dateSortValue === null ? `source:${orderKey}` : `date:${dateSortValue}:${orderKey}`,
    body: entry.body,
    paragraphs: entry.paragraphs,
    sourceRange: entry.sourceRange,
    attachmentAnchor: `diary-entry:${entry.id}`,
  };
}

function compareTimelineEntries(left: DiaryTimelineEntry, right: DiaryTimelineEntry): number {
  const leftDated = left.sortKey.startsWith("date:");
  const rightDated = right.sortKey.startsWith("date:");
  if (leftDated && rightDated) {
    const leftDate = Number(left.sortKey.split(":")[1] ?? 0);
    const rightDate = Number(right.sortKey.split(":")[1] ?? 0);
    if (leftDate !== rightDate) {
      return rightDate - leftDate;
    }
    return left.sourceRange.startLine - right.sourceRange.startLine;
  }
  if (leftDated !== rightDated) {
    return leftDated ? -1 : 1;
  }
  return left.sourceRange.startLine - right.sourceRange.startLine;
}

function annotateDuplicateTimestamps(entries: DiaryTimelineEntry[]): DiaryTimelineEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === "dated" && entry.dateLabel) {
      counts.set(entry.dateLabel, (counts.get(entry.dateLabel) ?? 0) + 1);
    }
  }

  const seen = new Map<string, number>();
  return entries.map((entry) => {
    if (entry.kind !== "dated" || !entry.dateLabel) {
      return entry;
    }
    const count = counts.get(entry.dateLabel) ?? 0;
    if (count <= 1) {
      return entry;
    }
    const index = (seen.get(entry.dateLabel) ?? 0) + 1;
    seen.set(entry.dateLabel, index);
    const occurrenceLabel = `Entry ${index} of ${count}`;
    return {
      ...entry,
      title: `${entry.dateLabel} · ${occurrenceLabel}`,
      occurrenceLabel,
    };
  });
}

function groupTimelineEntries(entries: DiaryTimelineEntry[]): DiaryTimelineGroup[] {
  const groups: DiaryTimelineGroup[] = [];
  const groupById = new Map<string, DiaryTimelineGroup>();
  for (const entry of entries) {
    const dated = entry.kind === "dated" && entry.dateLabel;
    const limited = entry.kind === "limited";
    const label = dated ? entry.dateLabel ?? "Dated diary" : limited ? "Limited diary" : "Undated diary";
    const id = dated ? `date:${entry.dateLabel}` : limited ? "limited" : "undated";
    let group = groupById.get(id);
    if (!group) {
      group = {
        id,
        label,
        kind: dated ? "dated" : "limited",
        entryIds: [],
      };
      groupById.set(id, group);
      groups.push(group);
    }
    group.entryIds.push(entry.id);
  }
  return groups;
}

export function getDreamDiaryTimelineEntry(
  snapshot: DreamDiaryTimelineSnapshot,
  entryId: string | null | undefined,
): DiaryTimelineEntry | null {
  if (!entryId) {
    return null;
  }
  return snapshot.entriesById[entryId] ?? null;
}

export function canReturnToLatestDreamDiaryEntry(
  snapshot: DreamDiaryTimelineSnapshot,
  selectedEntryId: string | null | undefined,
): boolean {
  const currentEntryId = selectedEntryId ?? snapshot.selectedEntryId;
  return Boolean(snapshot.latestEntryId && currentEntryId && snapshot.latestEntryId !== currentEntryId);
}

export function buildDreamDiaryTimelineSnapshot(params: {
  document: DreamDiaryDocument;
  workspaceScope: DreamWorkspaceScope;
  loadedAtMs: number | null;
  selectedEntryId?: string | null;
  loading?: boolean;
  disabled?: boolean;
  unavailable?: boolean;
  note?: string | null;
  error?: string | null;
}): DreamDiaryTimelineSnapshot {
  const timelineEntries = params.document.entries
    .map((entry, index) => toTimelineEntry(entry, index))
    .sort(compareTimelineEntries);
  const annotatedTimelineEntries = annotateDuplicateTimestamps(timelineEntries);
  const entriesById = Object.fromEntries(annotatedTimelineEntries.map((entry) => [entry.id, entry]));
  const groups = groupTimelineEntries(annotatedTimelineEntries);
  const latestEntryId = annotatedTimelineEntries[0]?.id ?? null;
  const selectedEntryId =
    params.selectedEntryId && entriesById[params.selectedEntryId]
      ? params.selectedEntryId
      : latestEntryId;
  const hasEntries = timelineEntries.length > 0;
  const limitedParse = hasEntries && timelineEntries.every((entry) => entry.kind !== "dated");

  let availability: DreamDiaryTimelineAvailability;
  let note = params.note ?? null;
  if (params.loading) {
    availability = "loading";
    note = note ?? "Loading the Dream Diary...";
  } else if (params.disabled) {
    availability = "disabled";
    note = note ?? (hasEntries
      ? "Dreaming is currently off. Existing diary entries are still available to read."
      : "Dreaming is currently off, and no diary entries are available yet.");
  } else if (params.unavailable) {
    availability = hasEntries ? "limited" : "unavailable";
    note = note ?? (hasEntries
      ? "The latest diary snapshot is unavailable, so ClawFace is showing the last readable diary content."
      : "Dream Diary is unavailable right now.");
  } else if (!hasEntries) {
    availability = "empty";
    note = note ?? "No Dream Diary entries are available for this workspace yet.";
  } else if (limitedParse || params.document.error) {
    availability = "limited";
    note = note ?? "Dream Diary content is readable, but chronology is limited by the current document structure.";
  } else {
    availability = "ready";
  }

  return {
    availability,
    workspaceScope: params.workspaceScope,
    loadedAtMs: params.loadedAtMs,
    diaryUpdatedAtMs: params.document.updatedAtMs,
    groups,
    entriesById,
    selectedEntryId,
    latestEntryId,
    note,
    error: params.error ?? params.document.error,
  };
}
