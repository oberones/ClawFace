const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg)\b/i;
const MARKDOWN_LINK_RE = /!\[[^\]]*]\(([^)]+)\)|\[[^\]]*]\(([^)]+)\)/g;

function stripMatchingWrappers(value: string): string {
  let next = value.trim();
  const wrappers: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["`", "`"],
    ["<", ">"],
  ];
  for (const [left, right] of wrappers) {
    if (next.startsWith(left) && next.endsWith(right) && next.length >= 2) {
      next = next.slice(1, -1).trim();
    }
  }
  return next.trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;!?]+$/g, "").trim();
}

function normalizeImageCandidate(value: string): string {
  return stripTrailingPunctuation(stripMatchingWrappers(value));
}

function looksLikeImagePath(value: string): boolean {
  const normalized = normalizeImageCandidate(value);
  if (!normalized) {
    return false;
  }
  const noQuery = normalized.split("?")[0]?.split("#")[0]?.trim() ?? "";
  return IMAGE_EXT_RE.test(noQuery);
}

function parseMarkdownDestination(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("<")) {
    const closing = trimmed.indexOf(">");
    if (closing > 0) {
      return trimmed.slice(1, closing).trim();
    }
  }
  return (trimmed.split(/\s+/)[0] ?? "").trim();
}

function candidateSpecificityScore(value: string): number {
  const trimmed = normalizeImageCandidate(value);
  const normalized = trimmed.replace(/\\/g, "/");
  let score = 0;
  if (/^(https?:|file:|blob:)/i.test(trimmed)) {
    score += 100;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("~/")) {
    score += 90;
  }
  if (
    normalized.startsWith(".openclaw/") ||
    normalized.startsWith("openclaw/") ||
    normalized.includes("/.openclaw/")
  ) {
    score += 80;
  }
  if (normalized.includes("/")) {
    score += 60;
  }
  if (/[?#]/.test(trimmed)) {
    score += 10;
  }
  score += Math.min(trimmed.length, 120);
  return score;
}

function collectImagePathCandidates(value: string): string[] {
  const source = value.trim();
  if (!source) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const next = normalizeImageCandidate(raw);
    if (!next || seen.has(next) || !looksLikeImagePath(next)) {
      return;
    }
    seen.add(next);
    out.push(next);
  };

  push(source);

  for (const match of source.matchAll(MARKDOWN_LINK_RE)) {
    const destination = parseMarkdownDestination(match[1] ?? match[2] ?? "");
    if (destination) {
      push(destination);
    }
  }

  for (const token of source.match(/[^\s"'`<>()\[\]]+/g) ?? []) {
    push(token);
  }

  return out;
}

export function isSpecificImagePathCandidate(value: string): boolean {
  const trimmed = normalizeImageCandidate(value);
  const normalized = trimmed.replace(/\\/g, "/");
  return (
    /^(https?:|file:|blob:)/i.test(trimmed) ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~/") ||
    normalized.startsWith(".openclaw/") ||
    normalized.startsWith("openclaw/") ||
    normalized.includes("/.openclaw/") ||
    normalized.includes("/")
  );
}

export function normalizeMediaPathCandidate(value: string): string {
  const direct = normalizeImageCandidate(value);
  const candidates = collectImagePathCandidates(value);
  if (candidates.length === 0) {
    return direct;
  }
  return [...candidates].sort((a, b) => {
    const scoreDelta = candidateSpecificityScore(b) - candidateSpecificityScore(a);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return b.length - a.length;
  })[0] ?? direct;
}

export function preferSpecificImagePathCandidates(
  values: string[],
  isImagePath: (value: string) => boolean,
): string[] {
  const normalized = values
    .map((value) => normalizeMediaPathCandidate(value))
    .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)
    .filter((value) => isImagePath(value));
  const hasSpecific = normalized.some((value) => isSpecificImagePathCandidate(value));
  return hasSpecific ? normalized.filter((value) => isSpecificImagePathCandidate(value)) : normalized;
}
