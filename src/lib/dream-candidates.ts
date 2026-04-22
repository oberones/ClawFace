import type { DreamPhaseConfigs, DreamStatusEntry, DreamStatusSnapshot } from "./shell-gateway-memory.ts";

export type DreamCandidateLane = "waiting" | "grounded" | "promoted";

export type DreamExplanationCue = {
  key: string;
  label: string;
};

export type DreamPhaseSummaryItem = {
  id: "light" | "deep" | "rem";
  label: string;
  detail: string;
  enabled: boolean;
};

export type DreamCandidate = {
  key: string;
  lane: DreamCandidateLane;
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
  originLabel: string;
  explanationCues: DreamExplanationCue[];
};

export type DreamLane = {
  key: DreamCandidateLane;
  label: string;
  count: number;
  items: DreamCandidate[];
  emptyCopy: string;
};

export type DreamOverview = {
  enabled: boolean;
  shortTermCount: number;
  groundedSignalCount: number;
  totalSignalCount: number;
  phaseSignalCount: number;
  promotedTotal: number;
  promotedToday: number;
  topCandidates: DreamCandidate[];
  phaseSummary: DreamPhaseSummaryItem[];
};

export type DreamCandidateModel = {
  overview: DreamOverview;
  lanes: Record<DreamCandidateLane, DreamLane>;
  candidatesByKey: Record<string, DreamCandidate>;
};

function pluralize(label: string, value: number): string {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function isoDateLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function compareIsoDescending(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return right.localeCompare(left);
}

function computeCandidateScore(entry: DreamStatusEntry, lane: DreamCandidateLane): number {
  const recencyBoost = entry.lastRecalledAt ? Math.max(0, Date.parse(entry.lastRecalledAt) || 0) / 1_000_000_000_000 : 0;
  return (
    entry.totalSignalCount * 100 +
    entry.phaseHitCount * 40 +
    entry.groundedCount * 25 +
    entry.recallCount * 16 +
    entry.dailyCount * 12 +
    entry.lightHits * 5 +
    entry.remHits * 8 +
    recencyBoost +
    (lane === "promoted" ? 60 : 0)
  );
}

function compareCandidates(left: DreamCandidate, right: DreamCandidate): number {
  const scoreDelta = computeCandidateScore(left, left.lane) - computeCandidateScore(right, right.lane);
  if (scoreDelta !== 0) {
    return scoreDelta > 0 ? -1 : 1;
  }
  const promotedDelta = compareIsoDescending(left.promotedAt, right.promotedAt);
  if (promotedDelta !== 0) {
    return promotedDelta;
  }
  const recalledDelta = compareIsoDescending(left.lastRecalledAt, right.lastRecalledAt);
  if (recalledDelta !== 0) {
    return recalledDelta;
  }
  return left.path.localeCompare(right.path);
}

function buildExplanationCues(entry: DreamStatusEntry, lane: DreamCandidateLane): DreamExplanationCue[] {
  const cues: DreamExplanationCue[] = [];
  if (entry.totalSignalCount > 0) {
    cues.push({ key: "signals", label: pluralize("visible signal", entry.totalSignalCount) });
  }
  if (entry.phaseHitCount > 0) {
    cues.push({ key: "phase", label: pluralize("phase hit", entry.phaseHitCount) });
  }
  if (entry.groundedCount > 0) {
    cues.push({ key: "grounded", label: `Grounded by ${pluralize("replay", entry.groundedCount)}` });
  }
  if (lane === "promoted") {
    cues.push({
      key: "promotion",
      label: entry.promotedAt ? `Promoted ${isoDateLabel(entry.promotedAt)}` : "Already promoted",
    });
  } else if (entry.recallCount > 0) {
    cues.push({ key: "recall", label: pluralize("recall", entry.recallCount) });
  }
  if (entry.dailyCount > 0) {
    cues.push({ key: "daily", label: pluralize("daily note hit", entry.dailyCount) });
  }
  return cues.slice(0, 4);
}

function buildOriginLabel(entry: DreamStatusEntry, lane: DreamCandidateLane): string {
  if (lane === "promoted") {
    return "Already promoted";
  }
  if (entry.groundedCount > 0 && entry.totalSignalCount > 0) {
    return "Grounded by replay and current signals";
  }
  if (entry.groundedCount > 0) {
    return "Grounded by historical replay";
  }
  if (entry.totalSignalCount > 0) {
    return "Heating up from current signals";
  }
  return "Waiting on stronger memory signals";
}

function buildCandidate(entry: DreamStatusEntry, lane: DreamCandidateLane): DreamCandidate {
  return {
    key: entry.key,
    lane,
    path: entry.path,
    startLine: entry.startLine,
    endLine: entry.endLine,
    snippet: entry.snippet,
    recallCount: entry.recallCount,
    dailyCount: entry.dailyCount,
    groundedCount: entry.groundedCount,
    totalSignalCount: entry.totalSignalCount,
    lightHits: entry.lightHits,
    remHits: entry.remHits,
    phaseHitCount: entry.phaseHitCount,
    promotedAt: entry.promotedAt,
    lastRecalledAt: entry.lastRecalledAt,
    originLabel: buildOriginLabel(entry, lane),
    explanationCues: buildExplanationCues(entry, lane),
  };
}

function buildLane(key: DreamCandidateLane, items: DreamCandidate[]): DreamLane {
  const label = key === "waiting" ? "Waiting" : key === "grounded" ? "Grounded" : "Promoted";
  const emptyCopy = key === "waiting"
    ? "No waiting memories are visible in this snapshot."
    : key === "grounded"
      ? "No replay-grounded memories are visible in this snapshot."
      : "No promoted memories are visible in this snapshot.";
  return {
    key,
    label,
    count: items.length,
    items,
    emptyCopy,
  };
}

function buildPhaseSummary(phases: DreamPhaseConfigs | null): DreamPhaseSummaryItem[] {
  if (!phases) {
    return [];
  }
  return ([
    ["light", "Light", phases.light],
    ["deep", "Deep", phases.deep],
    ["rem", "REM", phases.rem],
  ] as const).map(([id, label, phase]) => ({
    id,
    label,
    enabled: phase.enabled,
    detail: phase.enabled
      ? phase.nextRunAtMs
        ? `Enabled · cron ${phase.cron} · next run scheduled`
        : `Enabled · cron ${phase.cron}`
      : "Disabled",
  }));
}

export function pickDefaultDreamLane(lanes: Record<DreamCandidateLane, DreamLane>): DreamCandidateLane {
  if (lanes.waiting.count > 0) {
    return "waiting";
  }
  if (lanes.grounded.count > 0) {
    return "grounded";
  }
  return "promoted";
}

export function buildDreamCandidateModel(status: DreamStatusSnapshot): DreamCandidateModel {
  const candidatesByKey = new Map<string, DreamCandidate>();

  const waiting = status.shortTermEntries
    .filter((entry) => entry.groundedCount === 0)
    .map((entry) => buildCandidate(entry, "waiting"))
    .sort(compareCandidates);
  const grounded = status.shortTermEntries
    .filter((entry) => entry.groundedCount > 0)
    .map((entry) => buildCandidate(entry, "grounded"))
    .sort(compareCandidates);
  const promoted = status.promotedEntries
    .map((entry) => buildCandidate(entry, "promoted"))
    .sort(compareCandidates);

  for (const candidate of [...waiting, ...grounded, ...promoted]) {
    candidatesByKey.set(candidate.key, candidate);
  }

  const topCandidates = [...status.signalEntries]
    .map((entry) => {
      const lane: DreamCandidateLane =
        entry.promotedAt ? "promoted" : entry.groundedCount > 0 ? "grounded" : "waiting";
      return candidatesByKey.get(entry.key) ?? buildCandidate(entry, lane);
    })
    .filter((candidate, index, list) => list.findIndex((entry) => entry.key === candidate.key) === index)
    .sort(compareCandidates)
    .slice(0, 5);

  const lanes = {
    waiting: buildLane("waiting", waiting),
    grounded: buildLane("grounded", grounded),
    promoted: buildLane("promoted", promoted),
  } satisfies Record<DreamCandidateLane, DreamLane>;

  return {
    overview: {
      enabled: status.enabled,
      shortTermCount: status.shortTermCount,
      groundedSignalCount: status.groundedSignalCount,
      totalSignalCount: status.totalSignalCount,
      phaseSignalCount: status.phaseSignalCount,
      promotedTotal: status.promotedTotal,
      promotedToday: status.promotedToday,
      topCandidates,
      phaseSummary: buildPhaseSummary(status.phases),
    },
    lanes,
    candidatesByKey: Object.fromEntries(candidatesByKey.entries()),
  };
}
