import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { GatewayClient } from "../lib/gateway.ts";
import type { ConnectionStatus, SessionInfo } from "../lib/types.ts";
import type { GatewayConfigState } from "../lib/shell-gateway-config.ts";
import {
  normalizeDoctorMemoryDreamDiary,
  normalizeDoctorMemoryStatus,
  normalizeDreamMethodSummary,
  normalizeWikiImportInsights,
  normalizeWikiMemoryPalace,
  resolveDreamWorkspaceScope,
  type DreamDiarySource,
  type DreamMethodSummary,
  type DreamStatusSnapshot,
  type DreamWikiImportInsights,
  type DreamWikiMemoryPalace,
  type DreamWorkspaceScope,
} from "../lib/shell-gateway-memory.ts";
import {
  buildDreamCandidateModel,
  pickDefaultDreamLane,
  type DreamCandidate,
  type DreamCandidateLane,
  type DreamLane,
  type DreamOverview,
} from "../lib/dream-candidates.ts";
import {
  getDreamDiaryEntryById,
  parseDreamDiarySnapshot,
  relateDreamDiaryToCandidate,
  type DreamDiaryDocument,
  type DreamDiaryEntry,
  type DreamDiaryRelation,
} from "../lib/dream-diary.ts";
import { matchDreamRelatedContext, type DreamRelatedContext } from "../lib/dream-related-context.ts";

const EMPTY_DIARY: DreamDiaryDocument = {
  found: false,
  path: "DREAMS.md",
  updatedAtMs: null,
  content: null,
  entries: [],
  error: null,
};

function createEmptyLanes(): Record<DreamCandidateLane, DreamLane> {
  return {
    waiting: {
      key: "waiting",
      label: "Waiting",
      count: 0,
      items: [],
      emptyCopy: "No waiting memories are visible in this snapshot.",
    },
    grounded: {
      key: "grounded",
      label: "Grounded",
      count: 0,
      items: [],
      emptyCopy: "No replay-grounded memories are visible in this snapshot.",
    },
    promoted: {
      key: "promoted",
      label: "Promoted",
      count: 0,
      items: [],
      emptyCopy: "No promoted memories are visible in this snapshot.",
    },
  };
}

function createEmptyOverview(): DreamOverview {
  return {
    enabled: false,
    shortTermCount: 0,
    groundedSignalCount: 0,
    totalSignalCount: 0,
    phaseSignalCount: 0,
    promotedTotal: 0,
    promotedToday: 0,
    topCandidates: [],
    phaseSummary: [],
  };
}

function createEmptyRelatedContext(): DreamRelatedContext {
  return {
    status: "idle",
    insights: [],
    palacePages: [],
    limitationNote: null,
    error: null,
  };
}

function buildScope(
  sessionInfo: SessionInfo,
  gatewayConfigStateRef: MutableRefObject<GatewayConfigState | null>,
): DreamWorkspaceScope {
  return resolveDreamWorkspaceScope({
    sessionAgentLabel: sessionInfo.agentLabel,
    configState: gatewayConfigStateRef.current,
  });
}

export type DreamInspectorAvailability = "loading" | "ready" | "empty" | "disabled" | "unavailable" | "partial";

export type DreamInspectorSnapshot = {
  workspaceScope: DreamWorkspaceScope;
  loadedAtMs: number | null;
  availability: DreamInspectorAvailability;
  methods: DreamMethodSummary;
  overview: DreamOverview;
  candidatesByKey: Record<string, DreamCandidate>;
  lanes: Record<DreamCandidateLane, DreamLane>;
  diary: DreamDiaryDocument;
  note: string | null;
  error: string | null;
};

export type DreamInspectorRefreshState = "idle" | "loading" | "refreshing" | "failed";

export type DreamInspectorControllerModel = {
  snapshot: DreamInspectorSnapshot;
  refreshState: DreamInspectorRefreshState;
  activeLane: DreamCandidateLane;
  selectedCandidate: DreamCandidate | null;
  selectedDiaryEntry: DreamDiaryEntry | null;
  diaryRelation: DreamDiaryRelation | null;
  relatedContext: DreamRelatedContext;
  onSelectLane: (lane: DreamCandidateLane) => void;
  onSelectCandidate: (candidateKey: string) => void;
  onSelectDiaryEntry: (entryId: string) => void;
  onRefresh: () => void;
};

type RelatedCatalogState = {
  status: "idle" | "loading" | "ready" | "unsupported" | "error";
  importInsights: DreamWikiImportInsights | null;
  palace: DreamWikiMemoryPalace | null;
  importInsightsError: string | null;
  palaceError: string | null;
};

type UseDreamInspectorControllerParams = {
  open: boolean;
  connectionStatus: ConnectionStatus;
  selectedSessionKey: string | null;
  sessionInfo: SessionInfo;
  clientRef: MutableRefObject<GatewayClient | null>;
  gatewayMethodsRef: MutableRefObject<Set<string>>;
  gatewayConfigStateRef: MutableRefObject<GatewayConfigState | null>;
};

function createIdleRelatedCatalog(): RelatedCatalogState {
  return {
    status: "idle",
    importInsights: null,
    palace: null,
    importInsightsError: null,
    palaceError: null,
  };
}

function createSnapshot(params: {
  scope: DreamWorkspaceScope;
  methods: DreamMethodSummary;
  availability: DreamInspectorAvailability;
  loadedAtMs?: number | null;
  overview?: DreamOverview;
  candidatesByKey?: Record<string, DreamCandidate>;
  lanes?: Record<DreamCandidateLane, DreamLane>;
  diary?: DreamDiaryDocument;
  note?: string | null;
  error?: string | null;
}): DreamInspectorSnapshot {
  return {
    workspaceScope: params.scope,
    loadedAtMs: params.loadedAtMs ?? null,
    availability: params.availability,
    methods: params.methods,
    overview: params.overview ?? createEmptyOverview(),
    candidatesByKey: params.candidatesByKey ?? {},
    lanes: params.lanes ?? createEmptyLanes(),
    diary: params.diary ?? EMPTY_DIARY,
    note: params.note ?? null,
    error: params.error ?? null,
  };
}

function hasVisibleDreamData(status: DreamStatusSnapshot, diary: DreamDiaryDocument): boolean {
  return (
    status.shortTermEntries.length > 0 ||
    status.promotedEntries.length > 0 ||
    status.signalEntries.length > 0 ||
    diary.entries.length > 0
  );
}

export function useDreamInspectorController(
  params: UseDreamInspectorControllerParams,
): DreamInspectorControllerModel {
  const [snapshot, setSnapshot] = useState<DreamInspectorSnapshot>(() =>
    createSnapshot({
      scope: buildScope(params.sessionInfo, params.gatewayConfigStateRef),
      methods: normalizeDreamMethodSummary(params.gatewayMethodsRef.current),
      availability: "unavailable",
      note: "Open Dream Inspector to load a workspace snapshot.",
    }),
  );
  const [refreshState, setRefreshState] = useState<DreamInspectorRefreshState>("idle");
  const [activeLane, setActiveLane] = useState<DreamCandidateLane>("waiting");
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [selectedDiaryEntryId, setSelectedDiaryEntryId] = useState<string | null>(null);
  const [relatedCatalog, setRelatedCatalog] = useState<RelatedCatalogState>(createIdleRelatedCatalog);
  const snapshotRef = useRef(snapshot);
  const selectedCandidateKeyRef = useRef<string | null>(selectedCandidateKey);
  const loadRequestSeqRef = useRef(0);
  const relatedRequestSeqRef = useRef(0);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    selectedCandidateKeyRef.current = selectedCandidateKey;
  }, [selectedCandidateKey]);

  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateKey) {
      return null;
    }
    return snapshot.candidatesByKey[selectedCandidateKey] ?? null;
  }, [selectedCandidateKey, snapshot.candidatesByKey]);

  const diaryRelation = useMemo<DreamDiaryRelation | null>(() => {
    if (!selectedCandidate) {
      return null;
    }
    return relateDreamDiaryToCandidate(snapshot.diary, selectedCandidate);
  }, [selectedCandidate, snapshot.diary]);

  useEffect(() => {
    const entryIds = new Set(snapshot.diary.entries.map((entry) => entry.id));
    if (selectedDiaryEntryId && entryIds.has(selectedDiaryEntryId)) {
      return;
    }
    const nextEntryId = diaryRelation?.entryId ?? snapshot.diary.entries[0]?.id ?? null;
    if (nextEntryId !== selectedDiaryEntryId) {
      setSelectedDiaryEntryId(nextEntryId);
    }
  }, [diaryRelation, selectedDiaryEntryId, snapshot.diary.entries]);

  const selectedDiaryEntry = useMemo(() => {
    return getDreamDiaryEntryById(snapshot.diary, selectedDiaryEntryId);
  }, [selectedDiaryEntryId, snapshot.diary]);

  const relatedContext = useMemo(() => {
    if (!selectedCandidate) {
      return createEmptyRelatedContext();
    }
    return matchDreamRelatedContext({
      candidate: selectedCandidate,
      importInsights: relatedCatalog.importInsights,
      palace: relatedCatalog.palace,
      importInsightsAvailability: snapshot.methods.importInsights,
      palaceAvailability: snapshot.methods.palace,
      importInsightsError: relatedCatalog.importInsightsError,
      palaceError: relatedCatalog.palaceError,
      loading: relatedCatalog.status === "loading",
    });
  }, [relatedCatalog, selectedCandidate, snapshot.methods.importInsights, snapshot.methods.palace]);

  const loadSnapshot = useCallback(async (mode: "auto" | "manual" = "auto") => {
    const scope = buildScope(params.sessionInfo, params.gatewayConfigStateRef);
    const methods = normalizeDreamMethodSummary(params.gatewayMethodsRef.current);
    const client = params.clientRef.current;
    if (!params.open) {
      loadRequestSeqRef.current += 1;
      return;
    }

    const existingSnapshot = snapshotRef.current;
    const hasExistingData = existingSnapshot.loadedAtMs !== null;

    if (params.connectionStatus !== "connected" || !client) {
      loadRequestSeqRef.current += 1;
      relatedRequestSeqRef.current += 1;
      setSnapshot(
        createSnapshot({
          scope,
          methods,
          availability: "unavailable",
          loadedAtMs: existingSnapshot.loadedAtMs,
          overview: existingSnapshot.overview,
          candidatesByKey: existingSnapshot.candidatesByKey,
          lanes: existingSnapshot.lanes,
          diary: existingSnapshot.diary,
          note: "Gateway unavailable. Reconnect to load Dream Visibility.",
          error: null,
        }),
      );
      setRefreshState(mode === "manual" ? "failed" : "idle");
      return;
    }

    if (methods.status !== "supported") {
      loadRequestSeqRef.current += 1;
      relatedRequestSeqRef.current += 1;
      setSnapshot(
        createSnapshot({
          scope,
          methods,
          availability: "unavailable",
          loadedAtMs: existingSnapshot.loadedAtMs,
          overview: existingSnapshot.overview,
          candidatesByKey: existingSnapshot.candidatesByKey,
          lanes: existingSnapshot.lanes,
          diary: existingSnapshot.diary,
          note: "This gateway does not advertise doctor.memory.status for Dream Visibility.",
        }),
      );
      setRefreshState(mode === "manual" ? "failed" : "idle");
      return;
    }

    setRelatedCatalog(createIdleRelatedCatalog());
    setRefreshState(hasExistingData ? "refreshing" : "loading");
    if (!hasExistingData) {
      setSnapshot(
        createSnapshot({
          scope,
          methods,
          availability: "loading",
          note: "Loading a workspace dream snapshot…",
        }),
      );
    }

    loadRequestSeqRef.current += 1;
    const requestSeq = loadRequestSeqRef.current;

    let diarySource: DreamDiarySource | null = null;
    let diaryError: string | null = null;

    try {
      const statusPayload = await client.request("doctor.memory.status", {});
      if (methods.diary === "supported") {
        try {
          diarySource = normalizeDoctorMemoryDreamDiary(await client.request("doctor.memory.dreamDiary", {}));
        } catch (error) {
          diaryError = error instanceof Error ? error.message : String(error);
          diarySource = {
            found: false,
            path: "DREAMS.md",
            content: null,
            updatedAtMs: null,
            error: diaryError,
          };
        }
      } else {
        diaryError =
          methods.diary === "unsupported"
            ? "Dream Diary is not advertised by this gateway."
            : null;
        diarySource = {
          found: false,
          path: "DREAMS.md",
          content: null,
          updatedAtMs: null,
          error: diaryError,
        };
      }

      if (loadRequestSeqRef.current !== requestSeq) {
        return;
      }

      const status = normalizeDoctorMemoryStatus(statusPayload);
      if (!status) {
        setSnapshot(
          createSnapshot({
            scope,
            methods,
            availability: "unavailable",
            note: "Dream Visibility could not normalize doctor.memory.status from this gateway.",
          }),
        );
        setRefreshState("failed");
        return;
      }

      const diaryDocument = parseDreamDiarySnapshot(diarySource);
      const candidateModel = buildDreamCandidateModel(status);

      let availability: DreamInspectorAvailability;
      let note: string | null = null;
      if (!status.enabled) {
        availability = "disabled";
        note = "Dreaming is currently disabled for this workspace. Use the existing OpenClaw control surface to change configuration.";
      } else if (!hasVisibleDreamData(status, diaryDocument)) {
        availability = "empty";
        note = "No dream artifacts are visible yet for this workspace.";
      } else if (diaryDocument.error) {
        availability = "partial";
        note = diaryDocument.error;
      } else {
        availability = "ready";
      }

      const nextSelectedCandidateKey =
        selectedCandidateKeyRef.current &&
        candidateModel.candidatesByKey[selectedCandidateKeyRef.current]
          ? selectedCandidateKeyRef.current
          : candidateModel.overview.topCandidates[0]?.key ??
            candidateModel.lanes[pickDefaultDreamLane(candidateModel.lanes)].items[0]?.key ??
            null;

      const nextActiveLane =
        nextSelectedCandidateKey && candidateModel.candidatesByKey[nextSelectedCandidateKey]
          ? candidateModel.candidatesByKey[nextSelectedCandidateKey].lane
          : pickDefaultDreamLane(candidateModel.lanes);

      setActiveLane(nextActiveLane);
      setSelectedCandidateKey(nextSelectedCandidateKey);
      setSelectedDiaryEntryId(null);
      setSnapshot(
        createSnapshot({
          scope,
          methods,
          availability,
          loadedAtMs: Date.now(),
          overview: candidateModel.overview,
          candidatesByKey: candidateModel.candidatesByKey,
          lanes: candidateModel.lanes,
          diary: diaryDocument,
          note,
          error: null,
        }),
      );
      setRefreshState("idle");
    } catch (error) {
      if (loadRequestSeqRef.current !== requestSeq) {
        return;
      }
      setSnapshot(
        createSnapshot({
          scope,
          methods,
          availability: "unavailable",
          loadedAtMs: existingSnapshot.loadedAtMs,
          overview: existingSnapshot.overview,
          candidatesByKey: existingSnapshot.candidatesByKey,
          lanes: existingSnapshot.lanes,
          diary: existingSnapshot.diary,
          note: "Dream Visibility could not load the current snapshot from the gateway.",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      setRefreshState("failed");
    }
  }, [
    params.clientRef,
    params.connectionStatus,
    params.gatewayConfigStateRef,
    params.gatewayMethodsRef,
    params.open,
    params.selectedSessionKey,
    params.sessionInfo,
  ]);

  useEffect(() => {
    if (!params.open) {
      loadRequestSeqRef.current += 1;
      relatedRequestSeqRef.current += 1;
      setRefreshState("idle");
      setRelatedCatalog(createIdleRelatedCatalog());
      return;
    }
    void loadSnapshot("auto");
  }, [loadSnapshot, params.open, params.selectedSessionKey, params.sessionInfo.agentId]);

  useEffect(() => {
    if (!params.open || !selectedCandidate) {
      return;
    }
    if (relatedCatalog.status !== "idle") {
      return;
    }
    const supportsImportInsights = snapshot.methods.importInsights === "supported";
    const supportsPalace = snapshot.methods.palace === "supported";
    if (!supportsImportInsights && !supportsPalace) {
      setRelatedCatalog({
        status: "unsupported",
        importInsights: null,
        palace: null,
        importInsightsError: null,
        palaceError: null,
      });
      return;
    }
    const client = params.clientRef.current;
    if (!client || params.connectionStatus !== "connected") {
      setRelatedCatalog({
        status: "error",
        importInsights: null,
        palace: null,
        importInsightsError: "Gateway unavailable while loading related context.",
        palaceError: null,
      });
      return;
    }
    relatedRequestSeqRef.current += 1;
    const requestSeq = relatedRequestSeqRef.current;
    setRelatedCatalog({
      status: "loading",
      importInsights: null,
      palace: null,
      importInsightsError: null,
      palaceError: null,
    });
    void Promise.allSettled([
      supportsImportInsights ? client.request("wiki.importInsights", {}) : Promise.resolve(null),
      supportsPalace ? client.request("wiki.palace", {}) : Promise.resolve(null),
    ]).then((results) => {
      if (relatedRequestSeqRef.current !== requestSeq) {
        return;
      }
      const importInsightsResult = results[0];
      const palaceResult = results[1];
      const importInsights =
        importInsightsResult && importInsightsResult.status === "fulfilled" && importInsightsResult.value
          ? normalizeWikiImportInsights(importInsightsResult.value)
          : null;
      const palace =
        palaceResult && palaceResult.status === "fulfilled" && palaceResult.value
          ? normalizeWikiMemoryPalace(palaceResult.value)
          : null;
      const importInsightsError =
        importInsightsResult && importInsightsResult.status === "rejected"
          ? importInsightsResult.reason instanceof Error
            ? importInsightsResult.reason.message
            : String(importInsightsResult.reason)
          : null;
      const palaceError =
        palaceResult && palaceResult.status === "rejected"
          ? palaceResult.reason instanceof Error
            ? palaceResult.reason.message
            : String(palaceResult.reason)
          : null;

      setRelatedCatalog({
        status: importInsightsError || palaceError ? "error" : "ready",
        importInsights,
        palace,
        importInsightsError,
        palaceError,
      });
    });
  }, [
    params.clientRef,
    params.connectionStatus,
    params.open,
    relatedCatalog.status,
    selectedCandidate,
    snapshot.methods.importInsights,
    snapshot.methods.palace,
  ]);

  const handleSelectCandidate = useCallback((candidateKey: string) => {
    setSelectedCandidateKey(candidateKey);
    const selectedCandidate = snapshotRef.current.candidatesByKey[candidateKey];
    if (selectedCandidate) {
      setActiveLane(selectedCandidate.lane);
    }
  }, []);

  const handleSelectLane = useCallback((lane: DreamCandidateLane) => {
    setActiveLane(lane);
    const activeItems = snapshotRef.current.lanes[lane].items;
    if (activeItems.length === 0) {
      setSelectedCandidateKey(null);
      return;
    }
    const existingSelected = selectedCandidateKeyRef.current;
    if (existingSelected && activeItems.some((candidate) => candidate.key === existingSelected)) {
      return;
    }
    setSelectedCandidateKey(activeItems[0]?.key ?? null);
  }, []);

  const handleRefresh = useCallback(() => {
    void loadSnapshot("manual");
  }, [loadSnapshot]);

  return {
    snapshot,
    refreshState,
    activeLane,
    selectedCandidate,
    selectedDiaryEntry,
    diaryRelation,
    relatedContext,
    onSelectLane: handleSelectLane,
    onSelectCandidate: handleSelectCandidate,
    onSelectDiaryEntry: setSelectedDiaryEntryId,
    onRefresh: handleRefresh,
  };
}
