export type MediaKind = "image" | "audio" | "video" | "pdf" | "file";

export type MediaPreviewState = "ready" | "loading" | "unsupported" | "error";

export type MediaArtifactProvenanceKind = "generated" | "uploaded" | "session-linked" | "tool-derived" | "unknown";

export type MediaArtifactRenderRef = Readonly<Record<string, unknown>>;

export type DraftMediaReference = {
  kind: "media-reference";
  artifactId: string;
  displayName: string;
  sourceKey: string;
  sourceLabel: string;
  renderRef: MediaArtifactRenderRef;
};

export type MediaArtifact = {
  id: string;
  kind: MediaKind;
  displayName: string;
  sourceKey: string;
  sourceLabel: string;
  sessionKey?: string | null;
  runId?: string | null;
  createdAt?: number | null;
  previewState: MediaPreviewState;
  renderRef: MediaArtifactRenderRef;
  chatReference: DraftMediaReference;
  provenance?: {
    kind: MediaArtifactProvenanceKind;
    label?: string | null;
  } | null;
};

export type MediaSourceRoot = {
  key: string;
  label: string;
  count?: number | null;
  supportsFilter?: boolean;
};

export type MediaBrowserSortKey = "name" | "createdAt";
export type MediaBrowserSortDir = "asc" | "desc";

export type MediaBrowserFilterState = {
  query?: string;
  sortKey?: MediaBrowserSortKey;
  sortDir?: MediaBrowserSortDir;
  sessionKey?: string | null;
  provenance?: MediaArtifactProvenanceKind | null;
};

export type MediaBrowserFilterOption = {
  key: string;
  label: string;
  count: number;
};

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbers(left: number | null | undefined, right: number | null | undefined) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

export function getMediaArtifactStableKey(artifact: Pick<MediaArtifact, "id">) {
  return artifact.id.trim();
}

export function getMediaArtifactDedupeKey(artifact: Pick<MediaArtifact, "id" | "kind">) {
  return `${artifact.kind}:${getMediaArtifactStableKey(artifact)}`;
}

export function getMediaArtifactSessionLabel(
  artifact: Pick<MediaArtifact, "provenance" | "sessionKey">,
): string | null {
  const label = artifact.provenance?.label?.trim();
  if (label) {
    return label;
  }
  const sessionKey = artifact.sessionKey?.trim();
  return sessionKey || null;
}

export function getMediaArtifactProvenanceLabel(
  artifact: Pick<MediaArtifact, "sourceLabel" | "provenance">,
): string {
  if (artifact.provenance?.kind === "generated") {
    return "Generated";
  }
  if (artifact.provenance?.kind === "uploaded") {
    return "Uploaded";
  }
  if (artifact.provenance?.kind === "session-linked") {
    return "Session-linked";
  }
  return artifact.sourceLabel;
}

export function dedupeMediaArtifacts(artifacts: readonly MediaArtifact[]) {
  const seen = new Set<string>();
  const deduped: MediaArtifact[] = [];
  for (const artifact of artifacts) {
    const key = getMediaArtifactDedupeKey(artifact);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(artifact);
  }
  return deduped;
}

export function getMediaArtifactPreviewStateForV1(artifact: Pick<MediaArtifact, "kind" | "previewState">): MediaPreviewState {
  if (artifact.kind !== "image") {
    return "unsupported";
  }
  return artifact.previewState;
}

export function isMediaArtifactReusableInV1(artifact: Pick<MediaArtifact, "kind">) {
  return artifact.kind === "image";
}

export function sortMediaArtifacts(
  artifacts: readonly MediaArtifact[],
  sortKey: MediaBrowserSortKey = "createdAt",
  sortDir: MediaBrowserSortDir = "desc",
) {
  const sorted = [...artifacts].sort((left, right) => {
    const result =
      sortKey === "name"
        ? compareStrings(left.displayName, right.displayName)
        : compareNumbers(left.createdAt, right.createdAt) || compareStrings(left.displayName, right.displayName);
    return sortDir === "asc" ? result : -result;
  });
  return sorted;
}

export function filterMediaArtifacts(
  artifacts: readonly MediaArtifact[],
  filterState: MediaBrowserFilterState = {},
) {
  const query = filterState.query?.trim().toLowerCase() ?? "";
  return artifacts.filter((artifact) => {
    if (filterState.sessionKey && artifact.sessionKey !== filterState.sessionKey) {
      return false;
    }
    if (filterState.provenance && artifact.provenance?.kind !== filterState.provenance) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystacks = [
      artifact.displayName,
      artifact.sourceLabel,
      artifact.sessionKey ?? "",
      artifact.provenance?.label ?? "",
      artifact.provenance?.kind ?? "",
    ];
    return haystacks.some((value) => value.toLowerCase().includes(query));
  });
}

export function getMediaArtifactSessionFilterOptions(artifacts: readonly MediaArtifact[]) {
  const counts = new Map<string, MediaBrowserFilterOption>();
  for (const artifact of artifacts) {
    const sessionKey = artifact.sessionKey?.trim();
    if (!sessionKey) {
      continue;
    }
    const label = getMediaArtifactSessionLabel(artifact) ?? sessionKey;
    const existing = counts.get(sessionKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(sessionKey, {
      key: sessionKey,
      label,
      count: 1,
    });
  }
  return Array.from(counts.values()).sort((left, right) =>
    compareStrings(left.label, right.label) || compareStrings(left.key, right.key),
  );
}

export function getMediaArtifactProvenanceFilterOptions(artifacts: readonly MediaArtifact[]) {
  const counts = new Map<MediaArtifactProvenanceKind, MediaBrowserFilterOption>();
  for (const artifact of artifacts) {
    const provenanceKey = artifact.provenance?.kind ?? null;
    if (!provenanceKey) {
      continue;
    }
    const existing = counts.get(provenanceKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(provenanceKey, {
      key: provenanceKey,
      label: getMediaArtifactProvenanceLabel(artifact),
      count: 1,
    });
  }
  return Array.from(counts.values()).sort((left, right) => compareStrings(left.label, right.label));
}

export function getVisibleMediaArtifacts(
  artifacts: readonly MediaArtifact[],
  filterState: MediaBrowserFilterState = {},
) {
  return sortMediaArtifacts(
    filterMediaArtifacts(artifacts, filterState),
    filterState.sortKey,
    filterState.sortDir,
  );
}
