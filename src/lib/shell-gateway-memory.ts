import type { GatewayConfigState } from "./shell-gateway-config.ts";

const DEFAULT_DREAM_DIARY_PATH = "DREAMS.md";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFiniteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function normalizeFiniteTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStorageMode(value: unknown): DreamStatusSnapshot["storageMode"] {
  return value === "inline" || value === "separate" || value === "both" ? value : "inline";
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizePhaseConfig(record: Record<string, unknown> | null): DreamPhaseConfig {
  return {
    enabled: normalizeBoolean(record?.enabled, false),
    cron: normalizeTrimmedString(record?.cron) ?? "",
    managedCronPresent: normalizeBoolean(record?.managedCronPresent, false),
    nextRunAtMs:
      typeof record?.nextRunAtMs === "number" && Number.isFinite(record.nextRunAtMs)
        ? record.nextRunAtMs
        : null,
    lookbackDays: normalizeFiniteInt(record?.lookbackDays, 0),
    limit: normalizeFiniteInt(record?.limit, 0),
    minScore:
      typeof record?.minScore === "number" && Number.isFinite(record.minScore) ? record.minScore : null,
    minRecallCount: normalizeFiniteInt(record?.minRecallCount, 0),
    minUniqueQueries: normalizeFiniteInt(record?.minUniqueQueries, 0),
    recencyHalfLifeDays: normalizeFiniteInt(record?.recencyHalfLifeDays, 0),
    maxAgeDays:
      typeof record?.maxAgeDays === "number" && Number.isFinite(record.maxAgeDays)
        ? Math.max(0, Math.floor(record.maxAgeDays))
        : null,
    minPatternStrength:
      typeof record?.minPatternStrength === "number" && Number.isFinite(record.minPatternStrength)
        ? record.minPatternStrength
        : null,
  };
}

function normalizeDreamStatusEntry(raw: unknown): DreamStatusEntry | null {
  const record = isRecord(raw) ? raw : null;
  const path = normalizeTrimmedString(record?.path);
  const snippet = normalizeTrimmedString(record?.snippet);
  if (!path || !snippet) {
    return null;
  }
  const startLine = normalizeFiniteInt(record?.startLine, 0);
  const endLine = normalizeFiniteInt(record?.endLine, startLine);
  const explicitKey = normalizeTrimmedString(record?.key);
  return {
    key: explicitKey ?? `${path}:${startLine}:${endLine}`,
    path,
    startLine,
    endLine,
    snippet,
    recallCount: normalizeFiniteInt(record?.recallCount, 0),
    dailyCount: normalizeFiniteInt(record?.dailyCount, 0),
    groundedCount: normalizeFiniteInt(record?.groundedCount, 0),
    totalSignalCount: normalizeFiniteInt(record?.totalSignalCount, 0),
    lightHits: normalizeFiniteInt(record?.lightHits, 0),
    remHits: normalizeFiniteInt(record?.remHits, 0),
    phaseHitCount: normalizeFiniteInt(record?.phaseHitCount, 0),
    promotedAt: normalizeTrimmedString(record?.promotedAt),
    lastRecalledAt: normalizeTrimmedString(record?.lastRecalledAt),
  };
}

function normalizeDreamStatusEntries(raw: unknown): DreamStatusEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => normalizeDreamStatusEntry(entry))
    .filter((entry): entry is DreamStatusEntry => entry !== null);
}

function normalizeWikiImportInsightItem(raw: unknown): DreamWikiInsightItem | null {
  const record = isRecord(raw) ? raw : null;
  const pagePath = normalizeTrimmedString(record?.pagePath);
  const title = normalizeTrimmedString(record?.title);
  if (!pagePath || !title) {
    return null;
  }
  const riskLevel =
    record?.riskLevel === "low" ||
    record?.riskLevel === "medium" ||
    record?.riskLevel === "high" ||
    record?.riskLevel === "unknown"
      ? record.riskLevel
      : "unknown";
  const digestStatus = record?.digestStatus === "available" || record?.digestStatus === "withheld"
    ? record.digestStatus
    : "available";
  return {
    pagePath,
    title,
    riskLevel,
    riskReasons: normalizeStringArray(record?.riskReasons),
    labels: normalizeStringArray(record?.labels),
    topicKey: normalizeTrimmedString(record?.topicKey) ?? "topic/other",
    topicLabel: normalizeTrimmedString(record?.topicLabel) ?? "Other",
    digestStatus,
    activeBranchMessages: normalizeFiniteInt(record?.activeBranchMessages, 0),
    userMessageCount: normalizeFiniteInt(record?.userMessageCount, 0),
    assistantMessageCount: normalizeFiniteInt(record?.assistantMessageCount, 0),
    firstUserLine: normalizeTrimmedString(record?.firstUserLine),
    lastUserLine: normalizeTrimmedString(record?.lastUserLine),
    assistantOpener: normalizeTrimmedString(record?.assistantOpener),
    summary: normalizeTrimmedString(record?.summary) ?? "",
    candidateSignals: normalizeStringArray(record?.candidateSignals),
    correctionSignals: normalizeStringArray(record?.correctionSignals),
    preferenceSignals: normalizeStringArray(record?.preferenceSignals),
    createdAt: normalizeTrimmedString(record?.createdAt),
    updatedAt: normalizeTrimmedString(record?.updatedAt),
  };
}

function normalizeWikiImportInsightCluster(raw: unknown): DreamWikiInsightCluster | null {
  const record = isRecord(raw) ? raw : null;
  const key = normalizeTrimmedString(record?.key);
  const label = normalizeTrimmedString(record?.label);
  if (!key || !label) {
    return null;
  }
  const items = Array.isArray(record?.items)
    ? record.items
        .map((entry) => normalizeWikiImportInsightItem(entry))
        .filter((entry): entry is DreamWikiInsightItem => entry !== null)
    : [];
  return {
    key,
    label,
    itemCount: normalizeFiniteInt(record?.itemCount, items.length),
    highRiskCount: normalizeFiniteInt(
      record?.highRiskCount,
      items.filter((item) => item.riskLevel === "high").length,
    ),
    withheldCount: normalizeFiniteInt(
      record?.withheldCount,
      items.filter((item) => item.digestStatus === "withheld").length,
    ),
    preferenceSignalCount: normalizeFiniteInt(
      record?.preferenceSignalCount,
      items.reduce((sum, item) => sum + item.preferenceSignals.length, 0),
    ),
    updatedAt: normalizeTrimmedString(record?.updatedAt),
    items,
  };
}

function normalizeWikiPageKind(value: unknown): DreamWikiPalaceItem["kind"] | null {
  return value === "entity" ||
    value === "concept" ||
    value === "source" ||
    value === "synthesis" ||
    value === "report"
    ? value
    : null;
}

function normalizeWikiMemoryPalaceItem(raw: unknown): DreamWikiPalaceItem | null {
  const record = isRecord(raw) ? raw : null;
  const pagePath = normalizeTrimmedString(record?.pagePath);
  const title = normalizeTrimmedString(record?.title);
  const kind = normalizeWikiPageKind(record?.kind);
  if (!pagePath || !title || !kind) {
    return null;
  }
  return {
    pagePath,
    title,
    kind,
    id: normalizeTrimmedString(record?.id),
    updatedAt: normalizeTrimmedString(record?.updatedAt),
    sourceType: normalizeTrimmedString(record?.sourceType),
    claimCount: normalizeFiniteInt(record?.claimCount, 0),
    questionCount: normalizeFiniteInt(record?.questionCount, 0),
    contradictionCount: normalizeFiniteInt(record?.contradictionCount, 0),
    claims: normalizeStringArray(record?.claims),
    questions: normalizeStringArray(record?.questions),
    contradictions: normalizeStringArray(record?.contradictions),
    snippet: normalizeTrimmedString(record?.snippet),
  };
}

function normalizeWikiMemoryPalaceCluster(raw: unknown): DreamWikiPalaceCluster | null {
  const record = isRecord(raw) ? raw : null;
  const key = normalizeWikiPageKind(record?.key);
  const label = normalizeTrimmedString(record?.label);
  if (!key || !label) {
    return null;
  }
  const items = Array.isArray(record?.items)
    ? record.items
        .map((entry) => normalizeWikiMemoryPalaceItem(entry))
        .filter((entry): entry is DreamWikiPalaceItem => entry !== null)
    : [];
  return {
    key,
    label,
    itemCount: normalizeFiniteInt(record?.itemCount, items.length),
    claimCount: normalizeFiniteInt(
      record?.claimCount,
      items.reduce((sum, item) => sum + item.claimCount, 0),
    ),
    questionCount: normalizeFiniteInt(
      record?.questionCount,
      items.reduce((sum, item) => sum + item.questionCount, 0),
    ),
    contradictionCount: normalizeFiniteInt(
      record?.contradictionCount,
      items.reduce((sum, item) => sum + item.contradictionCount, 0),
    ),
    updatedAt: normalizeTrimmedString(record?.updatedAt),
    items,
  };
}

function toMethodSet(methods: Iterable<string> | null | undefined): Set<string> | null {
  if (!methods) {
    return null;
  }
  const values = [...methods].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return new Set(values);
}

function pickMethodAvailability(
  methodSet: Set<string> | null,
  method: string,
): DreamMethodAvailability {
  if (!methodSet) {
    return "unknown";
  }
  return methodSet.has(method) ? "supported" : "unsupported";
}

function normalizeWorkspaceName(workspaceDir: string | null | undefined): string | null {
  const value = normalizeTrimmedString(workspaceDir);
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

export type DreamMethodAvailability = "supported" | "unsupported" | "unknown";

export type DreamMethodSummary = {
  status: DreamMethodAvailability;
  diary: DreamMethodAvailability;
  importInsights: DreamMethodAvailability;
  palace: DreamMethodAvailability;
};

export type DreamPhaseConfig = {
  enabled: boolean;
  cron: string;
  managedCronPresent: boolean;
  nextRunAtMs: number | null;
  lookbackDays: number;
  limit: number;
  minScore: number | null;
  minRecallCount: number;
  minUniqueQueries: number;
  recencyHalfLifeDays: number;
  maxAgeDays: number | null;
  minPatternStrength: number | null;
};

export type DreamPhaseConfigs = {
  light: DreamPhaseConfig;
  deep: DreamPhaseConfig;
  rem: DreamPhaseConfig;
};

export type DreamStatusEntry = {
  key: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  recallCount: number;
  dailyCount: number;
  groundedCount: number;
  totalSignalCount: number;
  lightHits: number;
  remHits: number;
  phaseHitCount: number;
  promotedAt: string | null;
  lastRecalledAt: string | null;
};

export type DreamStatusSnapshot = {
  enabled: boolean;
  timezone: string | null;
  verboseLogging: boolean;
  storageMode: "inline" | "separate" | "both";
  separateReports: boolean;
  shortTermCount: number;
  recallSignalCount: number;
  dailySignalCount: number;
  groundedSignalCount: number;
  totalSignalCount: number;
  phaseSignalCount: number;
  lightPhaseHitCount: number;
  remPhaseHitCount: number;
  promotedTotal: number;
  promotedToday: number;
  storePath: string | null;
  phaseSignalPath: string | null;
  storeError: string | null;
  phaseSignalError: string | null;
  shortTermEntries: DreamStatusEntry[];
  signalEntries: DreamStatusEntry[];
  promotedEntries: DreamStatusEntry[];
  phases: DreamPhaseConfigs | null;
};

export type DreamDiarySource = {
  found: boolean;
  path: string;
  content: string | null;
  updatedAtMs: number | null;
  error: string | null;
};

export type DreamWorkspaceScope = {
  label: string;
  detail: string;
  workspaceName: string | null;
};

export type DreamWikiInsightItem = {
  pagePath: string;
  title: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  riskReasons: string[];
  labels: string[];
  topicKey: string;
  topicLabel: string;
  digestStatus: "available" | "withheld";
  activeBranchMessages: number;
  userMessageCount: number;
  assistantMessageCount: number;
  firstUserLine: string | null;
  lastUserLine: string | null;
  assistantOpener: string | null;
  summary: string;
  candidateSignals: string[];
  correctionSignals: string[];
  preferenceSignals: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type DreamWikiInsightCluster = {
  key: string;
  label: string;
  itemCount: number;
  highRiskCount: number;
  withheldCount: number;
  preferenceSignalCount: number;
  updatedAt: string | null;
  items: DreamWikiInsightItem[];
};

export type DreamWikiImportInsights = {
  sourceType: "chatgpt";
  totalItems: number;
  totalClusters: number;
  clusters: DreamWikiInsightCluster[];
};

export type DreamWikiPalaceItem = {
  pagePath: string;
  title: string;
  kind: "entity" | "concept" | "source" | "synthesis" | "report";
  id: string | null;
  updatedAt: string | null;
  sourceType: string | null;
  claimCount: number;
  questionCount: number;
  contradictionCount: number;
  claims: string[];
  questions: string[];
  contradictions: string[];
  snippet: string | null;
};

export type DreamWikiPalaceCluster = {
  key: DreamWikiPalaceItem["kind"];
  label: string;
  itemCount: number;
  claimCount: number;
  questionCount: number;
  contradictionCount: number;
  updatedAt: string | null;
  items: DreamWikiPalaceItem[];
};

export type DreamWikiMemoryPalace = {
  totalItems: number;
  totalClaims: number;
  totalQuestions: number;
  totalContradictions: number;
  clusters: DreamWikiPalaceCluster[];
};

export function normalizeDreamMethodSummary(methods: Iterable<string> | null | undefined): DreamMethodSummary {
  const methodSet = toMethodSet(methods);
  return {
    status: pickMethodAvailability(methodSet, "doctor.memory.status"),
    diary: pickMethodAvailability(methodSet, "doctor.memory.dreamDiary"),
    importInsights: pickMethodAvailability(methodSet, "wiki.importInsights"),
    palace: pickMethodAvailability(methodSet, "wiki.palace"),
  };
}

export function resolveDreamWorkspaceScope(params: {
  sessionAgentLabel: string;
  configState: GatewayConfigState | null | undefined;
}): DreamWorkspaceScope {
  const workspaceName = normalizeWorkspaceName(params.configState?.runtimePathHints.workspaceDir ?? null);
  const label = workspaceName ? `Workspace snapshot · ${workspaceName}` : "Workspace snapshot";
  return {
    label,
    detail: `Opened from ${params.sessionAgentLabel}. Dream data is workspace-scoped unless OpenClaw explicitly says otherwise.`,
    workspaceName,
  };
}

export function normalizeDoctorMemoryStatus(raw: unknown): DreamStatusSnapshot | null {
  const root = isRecord(raw) && isRecord(raw.dreaming) ? raw.dreaming : isRecord(raw) ? raw : null;
  if (!root) {
    return null;
  }
  const phasesRecord = isRecord(root.phases) ? root.phases : null;
  const lightRecord = isRecord(phasesRecord?.light) ? phasesRecord.light : null;
  const deepRecord = isRecord(phasesRecord?.deep) ? phasesRecord.deep : null;
  const remRecord = isRecord(phasesRecord?.rem) ? phasesRecord.rem : null;
  return {
    enabled: normalizeBoolean(root.enabled, false),
    timezone: normalizeTrimmedString(root.timezone),
    verboseLogging: normalizeBoolean(root.verboseLogging, false),
    storageMode: normalizeStorageMode(root.storageMode),
    separateReports: normalizeBoolean(root.separateReports, false),
    shortTermCount: normalizeFiniteInt(root.shortTermCount, 0),
    recallSignalCount: normalizeFiniteInt(root.recallSignalCount, 0),
    dailySignalCount: normalizeFiniteInt(root.dailySignalCount, 0),
    groundedSignalCount: normalizeFiniteInt(root.groundedSignalCount, 0),
    totalSignalCount: normalizeFiniteInt(root.totalSignalCount, 0),
    phaseSignalCount: normalizeFiniteInt(root.phaseSignalCount, 0),
    lightPhaseHitCount: normalizeFiniteInt(root.lightPhaseHitCount, 0),
    remPhaseHitCount: normalizeFiniteInt(root.remPhaseHitCount, 0),
    promotedTotal: normalizeFiniteInt(root.promotedTotal, 0),
    promotedToday: normalizeFiniteInt(root.promotedToday, 0),
    storePath: normalizeTrimmedString(root.storePath),
    phaseSignalPath: normalizeTrimmedString(root.phaseSignalPath),
    storeError: normalizeTrimmedString(root.storeError),
    phaseSignalError: normalizeTrimmedString(root.phaseSignalError),
    shortTermEntries: normalizeDreamStatusEntries(root.shortTermEntries),
    signalEntries: normalizeDreamStatusEntries(root.signalEntries),
    promotedEntries: normalizeDreamStatusEntries(root.promotedEntries),
    phases:
      lightRecord && deepRecord && remRecord
        ? {
            light: normalizePhaseConfig(lightRecord),
            deep: normalizePhaseConfig(deepRecord),
            rem: normalizePhaseConfig(remRecord),
          }
        : null,
  };
}

export function normalizeDoctorMemoryDreamDiary(raw: unknown): DreamDiarySource {
  const record = isRecord(raw) ? raw : null;
  const found = record?.found === true;
  return {
    found,
    path: normalizeTrimmedString(record?.path) ?? DEFAULT_DREAM_DIARY_PATH,
    content: found ? (typeof record?.content === "string" ? record.content : "") : null,
    updatedAtMs: normalizeFiniteTimestamp(record?.updatedAtMs),
    error: null,
  };
}

export function normalizeWikiImportInsights(raw: unknown): DreamWikiImportInsights {
  const record = isRecord(raw) ? raw : null;
  const clusters = Array.isArray(record?.clusters)
    ? record.clusters
        .map((entry) => normalizeWikiImportInsightCluster(entry))
        .filter((entry): entry is DreamWikiInsightCluster => entry !== null)
    : [];
  return {
    sourceType: "chatgpt",
    totalItems: normalizeFiniteInt(
      record?.totalItems,
      clusters.reduce((sum, cluster) => sum + cluster.itemCount, 0),
    ),
    totalClusters: normalizeFiniteInt(record?.totalClusters, clusters.length),
    clusters,
  };
}

export function normalizeWikiMemoryPalace(raw: unknown): DreamWikiMemoryPalace {
  const record = isRecord(raw) ? raw : null;
  const clusters = Array.isArray(record?.clusters)
    ? record.clusters
        .map((entry) => normalizeWikiMemoryPalaceCluster(entry))
        .filter((entry): entry is DreamWikiPalaceCluster => entry !== null)
    : [];
  return {
    totalItems: normalizeFiniteInt(
      record?.totalItems,
      clusters.reduce((sum, cluster) => sum + cluster.itemCount, 0),
    ),
    totalClaims: normalizeFiniteInt(
      record?.totalClaims,
      clusters.reduce((sum, cluster) => sum + cluster.claimCount, 0),
    ),
    totalQuestions: normalizeFiniteInt(
      record?.totalQuestions,
      clusters.reduce((sum, cluster) => sum + cluster.questionCount, 0),
    ),
    totalContradictions: normalizeFiniteInt(
      record?.totalContradictions,
      clusters.reduce((sum, cluster) => sum + cluster.contradictionCount, 0),
    ),
    clusters,
  };
}
