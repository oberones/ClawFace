import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { GatewayClient } from "../lib/gateway.ts";
import type { ConnectionStatus, SessionInfo } from "../lib/types.ts";
import type { GatewayConfigState } from "../lib/shell-gateway-config.ts";
import {
  normalizeDoctorMemoryDreamDiary,
  normalizeDoctorMemoryStatus,
  normalizeDreamMethodSummary,
  resolveDreamWorkspaceScope,
  type DreamDiarySource,
  type DreamWorkspaceScope,
} from "../lib/shell-gateway-memory.ts";
import {
  buildDreamDiaryTimelineSnapshot,
  canReturnToLatestDreamDiaryEntry,
  EMPTY_DREAM_DIARY_DOCUMENT,
  getDreamDiaryTimelineEntry,
  type DiaryTimelineEntry,
  type DreamDiaryTimelineRefreshState,
  type DreamDiaryTimelineSnapshot,
} from "../lib/dream-diary-timeline.ts";
import { parseDreamDiarySnapshot, type DreamDiaryDocument } from "../lib/dream-diary.ts";

export type DreamDiaryTimelineControllerModel = {
  snapshot: DreamDiaryTimelineSnapshot;
  refreshState: DreamDiaryTimelineRefreshState;
  selectedEntryId: string | null;
  selectedEntry: DiaryTimelineEntry | null;
  canReturnToLatest: boolean;
  onSelectEntry: (entryId: string) => void;
  onSelectLatest: () => void;
  onRefresh: () => void;
};

type UseDreamDiaryTimelineControllerParams = {
  open: boolean;
  connectionStatus: ConnectionStatus;
  selectedSessionKey: string | null;
  sessionInfo: SessionInfo;
  clientRef: MutableRefObject<GatewayClient | null>;
  gatewayMethodsRef: MutableRefObject<Set<string>>;
  gatewayConfigStateRef: MutableRefObject<GatewayConfigState | null>;
};

function buildScope(
  sessionInfo: SessionInfo,
  gatewayConfigStateRef: MutableRefObject<GatewayConfigState | null>,
): DreamWorkspaceScope {
  return resolveDreamWorkspaceScope({
    sessionAgentLabel: sessionInfo.agentLabel,
    configState: gatewayConfigStateRef.current,
  });
}

function createTimelineSnapshot(params: {
  document?: DreamDiaryDocument;
  scope: DreamWorkspaceScope;
  loadedAtMs?: number | null;
  selectedEntryId?: string | null;
  loading?: boolean;
  disabled?: boolean;
  unavailable?: boolean;
  note?: string | null;
  error?: string | null;
}): DreamDiaryTimelineSnapshot {
  return buildDreamDiaryTimelineSnapshot({
    document: params.document ?? EMPTY_DREAM_DIARY_DOCUMENT,
    workspaceScope: params.scope,
    loadedAtMs: params.loadedAtMs ?? null,
    selectedEntryId: params.selectedEntryId ?? null,
    loading: params.loading ?? false,
    disabled: params.disabled ?? false,
    unavailable: params.unavailable ?? false,
    note: params.note ?? null,
    error: params.error ?? null,
  });
}

function createErrorDiarySource(message: string | null): DreamDiarySource {
  return {
    found: false,
    path: "DREAMS.md",
    content: null,
    updatedAtMs: null,
    error: message,
  };
}

export function useDreamDiaryTimelineController(
  params: UseDreamDiaryTimelineControllerParams,
): DreamDiaryTimelineControllerModel {
  const [snapshot, setSnapshot] = useState<DreamDiaryTimelineSnapshot>(() =>
    createTimelineSnapshot({
      scope: buildScope(params.sessionInfo, params.gatewayConfigStateRef),
      unavailable: true,
      note: "Open Dreams to load the Dream Diary.",
    }),
  );
  const [refreshState, setRefreshState] = useState<DreamDiaryTimelineRefreshState>("idle");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const selectedEntryIdRef = useRef<string | null>(selectedEntryId);
  const selectedSessionKeyRef = useRef<string | null>(params.selectedSessionKey);
  const loadRequestSeqRef = useRef(0);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    selectedEntryIdRef.current = selectedEntryId;
  }, [selectedEntryId]);

  useEffect(() => {
    if (!selectedEntryId || snapshot.entriesById[selectedEntryId]) {
      return;
    }
    const nextEntryId = snapshot.selectedEntryId ?? snapshot.latestEntryId;
    if (nextEntryId !== selectedEntryId) {
      setSelectedEntryId(nextEntryId);
    }
  }, [selectedEntryId, snapshot.entriesById, snapshot.latestEntryId, snapshot.selectedEntryId]);

  useEffect(() => {
    if (selectedSessionKeyRef.current === params.selectedSessionKey) {
      return;
    }
    selectedSessionKeyRef.current = params.selectedSessionKey;
    selectedEntryIdRef.current = null;
    setSelectedEntryId(null);
  }, [params.selectedSessionKey]);

  const loadSnapshot = useCallback(async (mode: "auto" | "manual" = "auto") => {
    const scope = buildScope(params.sessionInfo, params.gatewayConfigStateRef);
    const methods = normalizeDreamMethodSummary(params.gatewayMethodsRef.current);
    const client = params.clientRef.current;

    if (!params.open) {
      loadRequestSeqRef.current += 1;
      return;
    }

    const existingSnapshot = snapshotRef.current;
    const existingDocument = {
      ...EMPTY_DREAM_DIARY_DOCUMENT,
      entries: Object.values(existingSnapshot.entriesById).map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        dateLabel: entry.dateLabel,
        body: entry.body,
        paragraphs: entry.paragraphs,
        sourceRange: entry.sourceRange,
      })),
      updatedAtMs: existingSnapshot.diaryUpdatedAtMs,
      found: Object.keys(existingSnapshot.entriesById).length > 0,
      content: Object.keys(existingSnapshot.entriesById).length > 0 ? "" : null,
    } satisfies DreamDiaryDocument;
    const hasExistingEntries = Object.keys(existingSnapshot.entriesById).length > 0;

    if (params.connectionStatus !== "connected" || !client) {
      loadRequestSeqRef.current += 1;
      const nextSnapshot = createTimelineSnapshot({
        document: existingDocument,
        scope,
        loadedAtMs: existingSnapshot.loadedAtMs,
        selectedEntryId: selectedEntryIdRef.current,
        unavailable: true,
        note: hasExistingEntries
          ? "Gateway unavailable. Showing the last readable Dream Diary snapshot."
          : "Gateway unavailable. Reconnect to load the Dream Diary.",
      });
      setSnapshot(nextSnapshot);
      setSelectedEntryId(nextSnapshot.selectedEntryId);
      setRefreshState(mode === "manual" ? "failed" : "idle");
      return;
    }

    if (methods.diary === "unsupported") {
      loadRequestSeqRef.current += 1;
      const nextSnapshot = createTimelineSnapshot({
        document: existingDocument,
        scope,
        loadedAtMs: existingSnapshot.loadedAtMs,
        selectedEntryId: selectedEntryIdRef.current,
        unavailable: true,
        note: hasExistingEntries
          ? "The Dream Diary is unavailable on this gateway. Showing the last readable snapshot."
          : "This gateway cannot provide the Dream Diary yet.",
      });
      setSnapshot(nextSnapshot);
      setSelectedEntryId(nextSnapshot.selectedEntryId);
      setRefreshState(mode === "manual" ? "failed" : "idle");
      return;
    }

    setRefreshState(hasExistingEntries ? "refreshing" : "loading");
    if (!hasExistingEntries) {
      setSnapshot(createTimelineSnapshot({
        scope,
        loading: true,
        note: "Loading the Dream Diary...",
      }));
    }

    loadRequestSeqRef.current += 1;
    const requestSeq = loadRequestSeqRef.current;

    let diarySource: DreamDiarySource | null = null;
    let diaryError: string | null = null;
    let disabled = false;

    try {
      const diaryPayload = await client.request("doctor.memory.dreamDiary", {});
      diarySource = normalizeDoctorMemoryDreamDiary(diaryPayload);
    } catch (error) {
      diaryError = error instanceof Error ? error.message : String(error);
      diarySource = createErrorDiarySource(diaryError);
    }

    if (methods.status === "supported") {
      try {
        const status = normalizeDoctorMemoryStatus(await client.request("doctor.memory.status", {}));
        disabled = status?.enabled === false;
      } catch {
        disabled = false;
      }
    }

    if (loadRequestSeqRef.current !== requestSeq) {
      return;
    }

    const diaryDocument = parseDreamDiarySnapshot(diarySource);
    const hasLoadedEntries = diaryDocument.entries.length > 0;
    const usingCachedDocument = Boolean(diaryError && !hasLoadedEntries && hasExistingEntries);
    const document = usingCachedDocument ? existingDocument : diaryDocument;
    const nextSnapshot = createTimelineSnapshot({
      document,
      scope,
      loadedAtMs: diaryError ? existingSnapshot.loadedAtMs : Date.now(),
      selectedEntryId: selectedEntryIdRef.current,
      disabled,
      unavailable: Boolean(diaryError && !hasLoadedEntries),
      note: usingCachedDocument
        ? "Could not refresh the Dream Diary. Showing the last readable snapshot."
        : null,
      error: diaryError,
    });

    setSnapshot(nextSnapshot);
    setSelectedEntryId(nextSnapshot.selectedEntryId);
    setRefreshState(diaryError ? "failed" : "idle");
  }, [
    params.clientRef,
    params.connectionStatus,
    params.gatewayConfigStateRef,
    params.gatewayMethodsRef,
    params.open,
    params.sessionInfo,
    params.selectedSessionKey,
  ]);

  useEffect(() => {
    if (!params.open) {
      loadRequestSeqRef.current += 1;
      setRefreshState("idle");
      return;
    }
    void loadSnapshot("auto");
  }, [loadSnapshot, params.open]);

  const selectedEntry = useMemo(() => {
    return getDreamDiaryTimelineEntry(snapshot, selectedEntryId ?? snapshot.selectedEntryId);
  }, [selectedEntryId, snapshot]);

  const handleSelectEntry = useCallback((entryId: string) => {
    if (snapshotRef.current.entriesById[entryId]) {
      setSelectedEntryId(entryId);
    }
  }, []);

  const handleSelectLatest = useCallback(() => {
    setSelectedEntryId(snapshotRef.current.latestEntryId);
  }, []);

  const canReturnToLatest = canReturnToLatestDreamDiaryEntry(snapshot, selectedEntryId);

  return {
    snapshot,
    refreshState,
    selectedEntryId: selectedEntry?.id ?? null,
    selectedEntry,
    canReturnToLatest,
    onSelectEntry: handleSelectEntry,
    onSelectLatest: handleSelectLatest,
    onRefresh: () => void loadSnapshot("manual"),
  };
}
