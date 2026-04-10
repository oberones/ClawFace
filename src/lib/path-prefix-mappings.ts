export type PathPrefixMapping = {
  sourcePrefix: string;
  targetPrefix: string;
};

export type ParsedPathPrefixMappings = {
  mappings: PathPrefixMapping[];
  invalidLines: string[];
};

let activePathPrefixMappings: PathPrefixMapping[] = [];
let activeHomeDirHint = "";

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function trimTrailingSlashes(value: string): string {
  const normalized = normalizeFsPath(stripWrappingQuotes(value)).trim();
  if (!normalized) {
    return "";
  }
  if (normalized === "/" || normalized === "~" || /^[A-Za-z]:\/$/.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/\/+$/g, "");
}

function expandHomePrefix(value: string, homeDir: string): string {
  const normalized = trimTrailingSlashes(value);
  const home = trimTrailingSlashes(homeDir);
  if (!normalized) {
    return "";
  }
  if (normalized === "~") {
    return home || normalized;
  }
  if (normalized.startsWith("~/")) {
    return home ? `${home}/${normalized.slice(2)}` : normalized;
  }
  return normalized;
}

function resolveHomeDirHint(explicitHomeDir?: string): string {
  const normalizedExplicit = trimTrailingSlashes(explicitHomeDir ?? "");
  if (normalizedExplicit) {
    return normalizedExplicit;
  }
  if (activeHomeDirHint) {
    return activeHomeDirHint;
  }
  const desktopHomeDir =
    typeof window !== "undefined" ? trimTrailingSlashes(window.desktopInfo?.homeDir ?? "") : "";
  return desktopHomeDir;
}

export function parsePathPrefixMappingsText(text: string): ParsedPathPrefixMappings {
  const mappings: PathPrefixMapping[] = [];
  const invalidLines: string[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const arrow = trimmed.includes("=>") ? "=>" : trimmed.includes("->") ? "->" : "";
    if (!arrow) {
      invalidLines.push(trimmed);
      continue;
    }
    const [rawSource, rawTarget] = trimmed.split(arrow, 2);
    const sourcePrefix = trimTrailingSlashes(rawSource ?? "");
    const targetPrefix = trimTrailingSlashes(rawTarget ?? "");
    if (!sourcePrefix || !targetPrefix) {
      invalidLines.push(trimmed);
      continue;
    }
    const dedupeKey = `${sourcePrefix}=>${targetPrefix}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    mappings.push({ sourcePrefix, targetPrefix });
  }

  mappings.sort((a, b) => b.sourcePrefix.length - a.sourcePrefix.length);
  return { mappings, invalidLines };
}

export function normalizePathPrefixMappingsText(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function setActivePathPrefixMappingsText(text: string, options?: { homeDir?: string }) {
  activePathPrefixMappings = parsePathPrefixMappingsText(text).mappings;
  const nextHomeDir = trimTrailingSlashes(options?.homeDir ?? "");
  if (nextHomeDir) {
    activeHomeDirHint = nextHomeDir;
  }
}

export function setActivePathPrefixMappingHomeDir(homeDir: string) {
  const normalized = trimTrailingSlashes(homeDir);
  if (normalized) {
    activeHomeDirHint = normalized;
  }
}

export function applyPathPrefixMappings(
  value: string,
  options?: { mappings?: PathPrefixMapping[]; homeDir?: string },
): string {
  const normalizedValue = normalizeFsPath(value).trim();
  if (!normalizedValue) {
    return "";
  }
  const homeDir = resolveHomeDirHint(options?.homeDir);
  const mappings = (options?.mappings ?? activePathPrefixMappings)
    .map((mapping) => ({
      sourcePrefix: expandHomePrefix(mapping.sourcePrefix, homeDir),
      targetPrefix: expandHomePrefix(mapping.targetPrefix, homeDir),
    }))
    .filter((mapping) => mapping.sourcePrefix && mapping.targetPrefix)
    .sort((a, b) => b.sourcePrefix.length - a.sourcePrefix.length);

  for (const mapping of mappings) {
    if (normalizedValue === mapping.sourcePrefix) {
      return mapping.targetPrefix;
    }
    if (normalizedValue.startsWith(`${mapping.sourcePrefix}/`)) {
      return `${mapping.targetPrefix}${normalizedValue.slice(mapping.sourcePrefix.length)}`;
    }
  }

  return normalizedValue;
}

