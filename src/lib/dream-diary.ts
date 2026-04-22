import type { DreamCandidate } from "./dream-candidates.ts";
import type { DreamDiarySource } from "./shell-gateway-memory.ts";

const DIARY_STOP_WORDS = new Set([
  "about",
  "again",
  "also",
  "been",
  "from",
  "into",
  "just",
  "more",
  "only",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "were",
  "with",
]);

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function buildEntryId(seed: string, index: number): string {
  return `${seed || "entry"}:${index}`;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s/._-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !DIARY_STOP_WORDS.has(token));
}

function parseEntryHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim();
  }
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\b|$)/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }
  return null;
}

function finalizeEntry(params: {
  id: string;
  dateLabel: string | null;
  lines: string[];
  startLine: number;
  endLine: number;
}): DreamDiaryEntry | null {
  const body = params.lines.join("\n").trim();
  if (!body && !params.dateLabel) {
    return null;
  }
  const normalizedBody = body || (params.dateLabel ?? "");
  const paragraphs = normalizedBody
    .split(/\n\s*\n/g)
    .map((entry) => entry.replace(/\n+/g, " ").trim())
    .filter((entry) => entry.length > 0);
  return {
    id: params.id,
    dateLabel: params.dateLabel,
    body: normalizedBody,
    paragraphs,
    sourceRange: {
      startLine: params.startLine,
      endLine: params.endLine,
    },
  };
}

function fallbackDiaryEntry(content: string): DreamDiaryEntry | null {
  const paragraphs = content
    .split(/\n\s*\n/g)
    .map((entry) => entry.replace(/\n+/g, " ").trim())
    .filter((entry) => entry.length > 0);
  if (paragraphs.length === 0) {
    return null;
  }
  return {
    id: "entry:0",
    dateLabel: null,
    body: content.trim(),
    paragraphs,
    sourceRange: {
      startLine: 1,
      endLine: content.split("\n").length,
    },
  };
}

function candidateTokens(candidate: DreamCandidate): string[] {
  const pathBits = candidate.path.replace(/\\/g, "/").split("/").pop() ?? candidate.path;
  return Array.from(new Set(tokenize(`${candidate.snippet} ${pathBits.replace(/\.[a-z0-9]+$/i, "")}`)));
}

function entryTokens(entry: DreamDiaryEntry): string[] {
  return Array.from(new Set(tokenize(`${entry.dateLabel ?? ""} ${entry.body}`)));
}

export type DreamDiaryEntry = {
  id: string;
  dateLabel: string | null;
  body: string;
  paragraphs: string[];
  sourceRange: {
    startLine: number;
    endLine: number;
  };
};

export type DreamDiaryDocument = {
  found: boolean;
  path: string;
  updatedAtMs: number | null;
  content: string | null;
  entries: DreamDiaryEntry[];
  error: string | null;
};

export type DreamDiaryRelation = {
  status: "direct" | "limited";
  entryId: string | null;
  matchedTerms: string[];
  note: string;
};

export function parseDreamDiarySnapshot(source: DreamDiarySource | null | undefined): DreamDiaryDocument {
  if (!source) {
    return {
      found: false,
      path: "DREAMS.md",
      updatedAtMs: null,
      content: null,
      entries: [],
      error: null,
    };
  }
  if (!source.found || !source.content) {
    return {
      found: source.found,
      path: source.path,
      updatedAtMs: source.updatedAtMs,
      content: source.content,
      entries: [],
      error: source.error,
    };
  }

  const content = normalizeLineBreaks(source.content);
  const lines = content.split("\n");
  const entries: DreamDiaryEntry[] = [];
  let currentLabel: string | null = null;
  let currentLines: string[] = [];
  let currentStartLine = 1;

  const flushEntry = (endLine: number) => {
    const entry = finalizeEntry({
      id: buildEntryId(currentLabel ?? "entry", entries.length),
      dateLabel: currentLabel,
      lines: currentLines,
      startLine: currentStartLine,
      endLine,
    });
    if (entry) {
      entries.push(entry);
    }
    currentLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const heading = parseEntryHeading(rawLine);
    if (heading) {
      if (currentLines.length > 0 || currentLabel !== null) {
        flushEntry(index);
      }
      currentLabel = heading;
      currentStartLine = index + 1;
      currentLines = [];
      continue;
    }
    if (currentLabel === null && currentLines.length === 0 && !rawLine.trim()) {
      currentStartLine = index + 2;
      continue;
    }
    currentLines.push(rawLine);
  }

  if (currentLines.length > 0 || currentLabel !== null) {
    flushEntry(lines.length);
  }

  if (entries.length === 0) {
    const fallback = fallbackDiaryEntry(content);
    return {
      found: true,
      path: source.path,
      updatedAtMs: source.updatedAtMs,
      content,
      entries: fallback ? [fallback] : [],
      error: source.error,
    };
  }

  return {
    found: true,
    path: source.path,
    updatedAtMs: source.updatedAtMs,
    content,
    entries,
    error: source.error,
  };
}

export function getDreamDiaryEntryById(
  document: DreamDiaryDocument,
  entryId: string | null | undefined,
): DreamDiaryEntry | null {
  if (!entryId) {
    return null;
  }
  return document.entries.find((entry) => entry.id === entryId) ?? null;
}

export function relateDreamDiaryToCandidate(
  document: DreamDiaryDocument,
  candidate: DreamCandidate | null,
): DreamDiaryRelation {
  if (!candidate || document.entries.length === 0) {
    return {
      status: "limited",
      entryId: null,
      matchedTerms: [],
      note: "No diary entry is available to relate to this candidate yet.",
    };
  }

  const tokens = candidateTokens(candidate);
  if (tokens.length === 0) {
    return {
      status: "limited",
      entryId: document.entries[0]?.id ?? null,
      matchedTerms: [],
      note: "Dream Diary is available as nearby narrative context, but relationship detail is limited.",
    };
  }

  let bestEntry: DreamDiaryEntry | null = null;
  let bestMatches: string[] = [];

  for (const entry of document.entries) {
    const matches = tokens.filter((token) => entryTokens(entry).includes(token));
    if (matches.length > bestMatches.length) {
      bestEntry = entry;
      bestMatches = matches;
    }
  }

  if (bestEntry && bestMatches.length >= 2) {
    return {
      status: "direct",
      entryId: bestEntry.id,
      matchedTerms: bestMatches.slice(0, 4),
      note: `Related from visible overlap: ${bestMatches.slice(0, 3).join(", ")}.`,
    };
  }

  return {
    status: "limited",
    entryId: bestEntry?.id ?? document.entries[0]?.id ?? null,
    matchedTerms: bestMatches.slice(0, 4),
    note: "Dream Diary is available as nearby narrative context, but relationship detail is limited.",
  };
}
