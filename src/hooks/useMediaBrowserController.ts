import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMediaArtifactProvenanceFilterOptions,
  getMediaArtifactSessionFilterOptions,
  getVisibleMediaArtifacts,
  isMediaArtifactReusableInV1,
  type MediaArtifact,
  type MediaBrowserFilterState,
  type MediaBrowserFilterOption,
  type MediaBrowserSortDir,
  type MediaBrowserSortKey,
  type MediaPreviewState,
  type MediaSourceRoot,
} from "../lib/media-browser-items.ts";
import type { MediaBrowserSourceData } from "../lib/media-browser-sources.ts";
import type { MediaReuseRequest } from "../lib/media-browser-reference.ts";

export type MediaBrowserControllerParams = {
  sourceData: MediaBrowserSourceData;
  activeSessionKey?: string | null;
  initialRootKey?: string | null;
  initialArtifactId?: string | null;
  initialFilterState?: MediaBrowserFilterState;
  onReuseArtifact?: (artifact: MediaArtifact) => Promise<void> | void;
};

export type MediaPreviewSelection = {
  artifactId: string;
  resolvedArtifact: MediaArtifact;
  previewContentState: MediaPreviewState;
};

export type MediaBrowserControllerState = {
  roots: MediaSourceRoot[];
  activeRootKey: string;
  activeRoot: MediaSourceRoot | null;
  selectRoot: (rootKey: string) => void;
  filterState: MediaBrowserFilterState;
  sessionFilterOptions: MediaBrowserFilterOption[];
  provenanceFilterOptions: MediaBrowserFilterOption[];
  hasActiveFilters: boolean;
  setQuery: (query: string) => void;
  setSort: (sortKey: MediaBrowserSortKey, sortDir?: MediaBrowserSortDir) => void;
  setSessionFilter: (sessionKey: string | null) => void;
  setProvenanceFilter: (provenance: MediaBrowserFilterState["provenance"]) => void;
  clearFilters: () => void;
  visibleArtifacts: MediaArtifact[];
  selectedArtifactId: string | null;
  selectedArtifact: MediaArtifact | null;
  selectArtifact: (artifactId: string | null) => void;
  previewSelection: MediaPreviewSelection | null;
  reuseRequest: MediaReuseRequest | null;
  requestReuse: (artifactId?: string | null) => Promise<void>;
  clearReuseRequest: () => void;
};

const DEFAULT_ROOT_KEY = "all";
const DEFAULT_FILTER_STATE: MediaBrowserFilterState = {
  query: "",
  sortKey: "createdAt",
  sortDir: "desc",
  sessionKey: null,
  provenance: null,
};

function normalizeFilterState(
  filterState?: MediaBrowserFilterState,
): MediaBrowserFilterState {
  return {
    ...DEFAULT_FILTER_STATE,
    ...filterState,
  };
}

function getArtifactListForRoot(
  artifacts: readonly MediaArtifact[],
  activeRootKey: string,
) {
  if (activeRootKey === DEFAULT_ROOT_KEY) {
    return [...artifacts];
  }
  return artifacts.filter((artifact) => artifact.sourceKey === activeRootKey);
}

function resolveActiveRootKey(
  roots: readonly MediaSourceRoot[],
  requestedRootKey?: string | null,
) {
  if (requestedRootKey && roots.some((root) => root.key === requestedRootKey)) {
    return requestedRootKey;
  }
  if (roots.some((root) => root.key === DEFAULT_ROOT_KEY)) {
    return DEFAULT_ROOT_KEY;
  }
  return roots[0]?.key ?? DEFAULT_ROOT_KEY;
}

export function useMediaBrowserController(
  params: MediaBrowserControllerParams,
): MediaBrowserControllerState {
  const [activeRootKey, setActiveRootKey] = useState(() =>
    resolveActiveRootKey(params.sourceData.roots, params.initialRootKey),
  );
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    params.initialArtifactId ?? null,
  );
  const [filterState, setFilterState] = useState<MediaBrowserFilterState>(() =>
    normalizeFilterState(params.initialFilterState),
  );
  const [reuseRequest, setReuseRequest] = useState<MediaReuseRequest | null>(null);

  useEffect(() => {
    setActiveRootKey((current) => resolveActiveRootKey(params.sourceData.roots, current));
  }, [params.sourceData.roots]);

  const rootScopedArtifacts = useMemo(
    () => getArtifactListForRoot(params.sourceData.artifacts, activeRootKey),
    [activeRootKey, params.sourceData.artifacts],
  );

  const visibleArtifacts = useMemo(
    () => getVisibleMediaArtifacts(rootScopedArtifacts, filterState),
    [filterState, rootScopedArtifacts],
  );

  const sessionFilterOptions = useMemo(
    () => getMediaArtifactSessionFilterOptions(rootScopedArtifacts),
    [rootScopedArtifacts],
  );

  const provenanceFilterOptions = useMemo(
    () => getMediaArtifactProvenanceFilterOptions(rootScopedArtifacts),
    [rootScopedArtifacts],
  );

  const hasActiveFilters = Boolean(
    filterState.query ||
    filterState.sessionKey ||
    filterState.provenance,
  );

  useEffect(() => {
    setFilterState((current) => {
      const hasSessionFilter =
        !current.sessionKey ||
        sessionFilterOptions.some((option) => option.key === current.sessionKey);
      const hasProvenanceFilter =
        !current.provenance ||
        provenanceFilterOptions.some((option) => option.key === current.provenance);
      if (hasSessionFilter && hasProvenanceFilter) {
        return current;
      }
      return {
        ...current,
        sessionKey: hasSessionFilter ? current.sessionKey ?? null : null,
        provenance: hasProvenanceFilter ? current.provenance ?? null : null,
      };
    });
  }, [provenanceFilterOptions, sessionFilterOptions]);

  useEffect(() => {
    if (visibleArtifacts.length === 0) {
      setSelectedArtifactId(null);
      return;
    }
    if (
      selectedArtifactId &&
      visibleArtifacts.some((artifact) => artifact.id === selectedArtifactId)
    ) {
      return;
    }
    setSelectedArtifactId(visibleArtifacts[0]?.id ?? null);
  }, [selectedArtifactId, visibleArtifacts]);

  const activeRoot = useMemo(
    () => params.sourceData.roots.find((root) => root.key === activeRootKey) ?? null,
    [activeRootKey, params.sourceData.roots],
  );

  const selectedArtifact = useMemo(
    () =>
      selectedArtifactId
        ? visibleArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null
        : null,
    [selectedArtifactId, visibleArtifacts],
  );

  const previewSelection = useMemo<MediaPreviewSelection | null>(() => {
    if (!selectedArtifact) {
      return null;
    }
    return {
      artifactId: selectedArtifact.id,
      resolvedArtifact: selectedArtifact,
      previewContentState: selectedArtifact.previewState,
    };
  }, [selectedArtifact]);

  const selectRoot = useCallback((rootKey: string) => {
    setActiveRootKey(rootKey);
  }, []);

  const setQuery = useCallback((query: string) => {
    setFilterState((current) => ({ ...current, query }));
  }, []);

  const setSort = useCallback((sortKey: MediaBrowserSortKey, sortDir?: MediaBrowserSortDir) => {
    setFilterState((current) => ({
      ...current,
      sortKey,
      sortDir: sortDir ?? current.sortDir ?? DEFAULT_FILTER_STATE.sortDir,
    }));
  }, []);

  const setSessionFilter = useCallback((sessionKey: string | null) => {
    setFilterState((current) => ({ ...current, sessionKey }));
  }, []);

  const setProvenanceFilter = useCallback((provenance: MediaBrowserFilterState["provenance"]) => {
    setFilterState((current) => ({ ...current, provenance: provenance ?? null }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTER_STATE);
  }, []);

  const selectArtifact = useCallback((artifactId: string | null) => {
    setSelectedArtifactId(artifactId);
  }, []);

  const requestReuse = useCallback(async (artifactId?: string | null) => {
    const targetArtifact =
      (artifactId ? visibleArtifacts.find((artifact) => artifact.id === artifactId) : null) ??
      selectedArtifact;

    if (!targetArtifact) {
      setReuseRequest(null);
      return;
    }

    if (!params.activeSessionKey) {
      setReuseRequest({
        artifactId: targetArtifact.id,
        chatReference: targetArtifact.chatReference,
        sessionKey: null,
        status: "failed",
      });
      return;
    }

    if (!isMediaArtifactReusableInV1(targetArtifact)) {
      setReuseRequest({
        artifactId: targetArtifact.id,
        chatReference: targetArtifact.chatReference,
        sessionKey: params.activeSessionKey,
        status: "failed",
      });
      return;
    }

    setReuseRequest({
      artifactId: targetArtifact.id,
      chatReference: targetArtifact.chatReference,
      sessionKey: params.activeSessionKey,
      status: "inserting",
    });

    try {
      await params.onReuseArtifact?.(targetArtifact);
      setReuseRequest({
        artifactId: targetArtifact.id,
        chatReference: targetArtifact.chatReference,
        sessionKey: params.activeSessionKey,
        status: "inserted",
      });
    } catch {
      setReuseRequest({
        artifactId: targetArtifact.id,
        chatReference: targetArtifact.chatReference,
        sessionKey: params.activeSessionKey,
        status: "failed",
      });
    }
  }, [params.activeSessionKey, params.onReuseArtifact, selectedArtifact, visibleArtifacts]);

  const clearReuseRequest = useCallback(() => {
    setReuseRequest(null);
  }, []);

  return {
    roots: params.sourceData.roots,
    activeRootKey,
    activeRoot,
    selectRoot,
    filterState,
    sessionFilterOptions,
    provenanceFilterOptions,
    hasActiveFilters,
    setQuery,
    setSort,
    setSessionFilter,
    setProvenanceFilter,
    clearFilters,
    visibleArtifacts,
    selectedArtifactId,
    selectedArtifact,
    selectArtifact,
    previewSelection,
    reuseRequest,
    requestReuse,
    clearReuseRequest,
  };
}
