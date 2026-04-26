import type { DreamDiarySource } from "./shell-gateway-memory.ts";

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function buildEntryId(seed: string, index: number): string {
  const normalizedSeed = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${normalizedSeed || "entry"}:${index}`;
}

function stripMarkdownEmphasis(value: string): string {
  const trimmed = value.trim();
  const strongMatch = trimmed.match(/^\*\*(.+)\*\*$/) ?? trimmed.match(/^__(.+)__$/);
  if (strongMatch?.[1]?.trim()) {
    return strongMatch[1].trim();
  }
  const emphasisMatch = trimmed.match(/^\*(.+)\*$/) ?? trimmed.match(/^_(.+)_$/);
  if (emphasisMatch?.[1]?.trim()) {
    return emphasisMatch[1].trim();
  }
  return trimmed;
}

function parseDateLabel(value: string): string | null {
  const trimmed = stripMarkdownEmphasis(value);
  const isoDate = trimmed.match(
    /^(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}|[A-Z]{2,5}|GMT[+-]\d{1,2}(?::\d{2})?))?)?)(?:\b|$)/,
  );
  if (isoDate?.[1]) {
    return isoDate[1].trim();
  }
  const monthDate = trimmed.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}(?:(?:,\s+|\s+at\s+)\d{1,2}:\d{2}\s+(?:AM|PM)(?:\s*(?:[A-Z]{2,5}|GMT[+-]\d{1,2}(?::\d{2})?))?)?$/i,
  );
  return monthDate ? trimmed.replace(/\b(AM|PM)([A-Z]{2,5}\b)/i, "$1 $2") : null;
}

function isDiaryTitle(line: string): boolean {
  return /^#\s+Dream Diary\s*$/i.test(line.trim());
}

function isDiaryComment(line: string): boolean {
  return /^<!--[\s\S]*-->$/.test(line.trim());
}

function isDiaryStartMarker(line: string): boolean {
  return /^<!--\s*openclaw:dreaming:diary:start\s*-->$/i.test(line.trim());
}

function isDiaryEndMarker(line: string): boolean {
  return /^<!--\s*openclaw:dreaming:diary:end\s*-->$/i.test(line.trim());
}

function isDiarySeparator(line: string): boolean {
  return /^-{3,}$/.test(line.trim());
}

function parseEntryHeading(line: string): { label: string; kind: DreamDiaryEntryKind } | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
  if (headingMatch?.[1]?.trim()) {
    const label = headingMatch[1].trim();
    return {
      label,
      kind: parseDateLabel(label) ? "dated" : "heading",
    };
  }
  const dateLabel = parseDateLabel(trimmed);
  if (dateLabel) {
    return {
      label: dateLabel,
      kind: "dated",
    };
  }
  return null;
}

function shouldSkipDiaryLine(line: string): boolean {
  return isDiaryTitle(line) || isDiaryComment(line) || isDiarySeparator(line);
}

function firstParagraphFromLines(lines: string[]): string {
  return lines.join("\n")
    .split(/\n\s*\n/g)[0]
    ?.replace(/\n+/g, " ")
    .trim() ?? "";
}

function isGeneratedDiaryArtifact(lines: string[]): boolean {
  const firstParagraph = firstParagraphFromLines(lines);
  if (!firstParagraph) {
    return false;
  }
  if (/^(?:user|assistant|system)\s*:/i.test(firstParagraph)) {
    return true;
  }
  if (/^possible\s+lasting\s+truths\s*:/i.test(firstParagraph)) {
    return true;
  }
  if (
    /^reflections\s*:/i.test(firstParagraph) &&
    /\b(?:theme|confidence|evidence|note)\s*:/i.test(firstParagraph)
  ) {
    return true;
  }
  return false;
}

function finalizeEntry(params: {
  id: string;
  kind: DreamDiaryEntryKind;
  dateLabel: string | null;
  lines: string[];
  startLine: number;
  endLine: number;
  filterGeneratedArtifacts?: boolean;
}): DreamDiaryEntry | null {
  if (params.filterGeneratedArtifacts && params.kind === "dated" && isGeneratedDiaryArtifact(params.lines)) {
    return null;
  }
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
    kind: params.kind,
    dateLabel: params.dateLabel,
    body: normalizedBody,
    paragraphs,
    sourceRange: {
      startLine: params.startLine,
      endLine: params.endLine,
    },
  };
}

function fallbackDiaryEntry(content: string, startLine = 1): DreamDiaryEntry | null {
  const paragraphs = content
    .split(/\n\s*\n/g)
    .map((entry) => entry.replace(/\n+/g, " ").trim())
    .filter((entry) => entry.length > 0);
  if (paragraphs.length === 0) {
    return null;
  }
  return {
    id: "limited:0",
    kind: "limited",
    dateLabel: null,
    body: content.trim(),
    paragraphs,
    sourceRange: {
      startLine,
      endLine: startLine + content.split("\n").length - 1,
    },
  };
}

export type DreamDiaryEntryKind = "dated" | "heading" | "limited";

export type DreamDiaryEntry = {
  id: string;
  kind: DreamDiaryEntryKind;
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
  const diaryStartIndex = lines.findIndex(isDiaryStartMarker);
  const diaryEndIndex =
    diaryStartIndex >= 0
      ? lines.findIndex((line, index) => index > diaryStartIndex && isDiaryEndMarker(line))
      : -1;
  const parseStartIndex = diaryStartIndex >= 0 ? diaryStartIndex + 1 : 0;
  const parseEndIndex = diaryStartIndex >= 0 && diaryEndIndex > diaryStartIndex ? diaryEndIndex : lines.length;
  const scopedContent = lines.slice(parseStartIndex, parseEndIndex).join("\n");
  const filterGeneratedArtifacts = diaryStartIndex >= 0;
  const entries: DreamDiaryEntry[] = [];
  let currentLabel: string | null = null;
  let currentKind: DreamDiaryEntryKind = "limited";
  let currentLines: string[] = [];
  let currentStartLine = parseStartIndex + 1;

  const flushEntry = (endLine: number) => {
    const seed = currentLabel ?? currentKind;
    const entry = finalizeEntry({
      id: buildEntryId(seed, entries.length),
      kind: currentKind,
      dateLabel: currentLabel,
      lines: currentLines,
      startLine: currentStartLine,
      endLine,
      filterGeneratedArtifacts,
    });
    if (entry) {
      entries.push(entry);
    }
    currentLabel = null;
    currentKind = "limited";
    currentLines = [];
  };

  for (let index = parseStartIndex; index < parseEndIndex; index += 1) {
    const rawLine = lines[index] ?? "";
    if (shouldSkipDiaryLine(rawLine)) {
      if (currentLabel === null && currentLines.length === 0) {
        currentStartLine = index + 2;
      }
      continue;
    }
    const heading = parseEntryHeading(rawLine);
    if (heading) {
      if (currentLines.length > 0 || currentLabel !== null) {
        flushEntry(index);
      }
      currentLabel = heading.label;
      currentKind = heading.kind;
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

  if (entries.length === 0 && diaryStartIndex < 0) {
    const fallback = fallbackDiaryEntry(scopedContent, parseStartIndex + 1);
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
