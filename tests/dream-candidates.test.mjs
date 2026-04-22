import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/dream-candidates.ts"));
}

function createStatus() {
  return {
    enabled: true,
    timezone: "America/New_York",
    verboseLogging: false,
    storageMode: "inline",
    separateReports: false,
    shortTermCount: 3,
    recallSignalCount: 3,
    dailySignalCount: 2,
    groundedSignalCount: 1,
    totalSignalCount: 6,
    phaseSignalCount: 7,
    lightPhaseHitCount: 2,
    remPhaseHitCount: 5,
    promotedTotal: 2,
    promotedToday: 1,
    storePath: null,
    phaseSignalPath: null,
    storeError: null,
    phaseSignalError: null,
    shortTermEntries: [
      {
        key: "waiting-1",
        path: "memory/2026-04-03.md",
        startLine: 4,
        endLine: 6,
        snippet: "Emma prefers shorter check-ins.",
        recallCount: 2,
        dailyCount: 1,
        groundedCount: 0,
        totalSignalCount: 3,
        lightHits: 1,
        remHits: 1,
        phaseHitCount: 2,
        promotedAt: null,
        lastRecalledAt: "2026-04-22T09:00:00.000Z",
      },
      {
        key: "grounded-1",
        path: "memory/2026-04-04.md",
        startLine: 10,
        endLine: 12,
        snippet: "Historical replay reinforces Emma's low-pressure preference.",
        recallCount: 1,
        dailyCount: 0,
        groundedCount: 2,
        totalSignalCount: 2,
        lightHits: 0,
        remHits: 2,
        phaseHitCount: 2,
        promotedAt: null,
        lastRecalledAt: "2026-04-21T12:00:00.000Z",
      },
    ],
    signalEntries: [
      {
        key: "waiting-1",
        path: "memory/2026-04-03.md",
        startLine: 4,
        endLine: 6,
        snippet: "Emma prefers shorter check-ins.",
        recallCount: 2,
        dailyCount: 1,
        groundedCount: 0,
        totalSignalCount: 3,
        lightHits: 1,
        remHits: 1,
        phaseHitCount: 2,
        promotedAt: null,
        lastRecalledAt: "2026-04-22T09:00:00.000Z",
      },
      {
        key: "grounded-1",
        path: "memory/2026-04-04.md",
        startLine: 10,
        endLine: 12,
        snippet: "Historical replay reinforces Emma's low-pressure preference.",
        recallCount: 1,
        dailyCount: 0,
        groundedCount: 2,
        totalSignalCount: 2,
        lightHits: 0,
        remHits: 2,
        phaseHitCount: 2,
        promotedAt: null,
        lastRecalledAt: "2026-04-21T12:00:00.000Z",
      },
    ],
    promotedEntries: [
      {
        key: "promoted-1",
        path: "memory/2026-04-01.md",
        startLine: 3,
        endLine: 5,
        snippet: "Lower-pressure check-ins improve Emma's follow-through.",
        recallCount: 4,
        dailyCount: 2,
        groundedCount: 1,
        totalSignalCount: 5,
        lightHits: 2,
        remHits: 3,
        phaseHitCount: 5,
        promotedAt: "2026-04-22T08:15:00.000Z",
        lastRecalledAt: "2026-04-22T08:10:00.000Z",
      },
    ],
    phases: {
      light: { enabled: true, cron: "0 */6 * * *", managedCronPresent: true, nextRunAtMs: null, lookbackDays: 5, limit: 10, minScore: null, minRecallCount: 0, minUniqueQueries: 0, recencyHalfLifeDays: 0, maxAgeDays: null, minPatternStrength: null },
      deep: { enabled: true, cron: "0 */4 * * *", managedCronPresent: true, nextRunAtMs: null, lookbackDays: 0, limit: 10, minScore: 0.5, minRecallCount: 2, minUniqueQueries: 2, recencyHalfLifeDays: 21, maxAgeDays: null, minPatternStrength: null },
      rem: { enabled: true, cron: "0 */8 * * *", managedCronPresent: false, nextRunAtMs: null, lookbackDays: 5, limit: 8, minScore: null, minRecallCount: 0, minUniqueQueries: 0, recencyHalfLifeDays: 0, maxAgeDays: null, minPatternStrength: 0.25 },
    },
  };
}

test("buildDreamCandidateModel derives waiting, grounded, and promoted lanes", () => {
  const { buildDreamCandidateModel, pickDefaultDreamLane } = loadModule();

  const model = buildDreamCandidateModel(createStatus());

  assert.equal(model.lanes.waiting.count, 1);
  assert.equal(model.lanes.grounded.count, 1);
  assert.equal(model.lanes.promoted.count, 1);
  assert.equal(model.lanes.grounded.items[0]?.originLabel, "Grounded by replay and current signals");
  assert.equal(pickDefaultDreamLane(model.lanes), "waiting");
});

test("buildDreamCandidateModel ranks strongest items and explains why they are sticking from visible cues only", () => {
  const { buildDreamCandidateModel } = loadModule();

  const model = buildDreamCandidateModel(createStatus());
  const topCandidate = model.overview.topCandidates[0];

  assert.equal(topCandidate?.key, "waiting-1");
  assert.ok(topCandidate?.explanationCues.some((cue) => cue.label.includes("visible signal")));
  assert.ok(topCandidate?.explanationCues.some((cue) => cue.label.includes("phase hit")));
  assert.ok(topCandidate?.explanationCues.some((cue) => cue.label.includes("recall")));
});

test("buildDreamCandidateModel keeps signal-only top candidates selectable via the canonical candidate map", () => {
  const { buildDreamCandidateModel } = loadModule();

  const status = createStatus();
  status.signalEntries.unshift({
    key: "signal-only-1",
    path: "memory/2026-04-05.md",
    startLine: 20,
    endLine: 22,
    snippet: "A high-signal insight survives aggregate trimming.",
    recallCount: 3,
    dailyCount: 2,
    groundedCount: 0,
    totalSignalCount: 5,
    lightHits: 2,
    remHits: 1,
    phaseHitCount: 3,
    promotedAt: null,
    lastRecalledAt: "2026-04-22T10:00:00.000Z",
  });

  const model = buildDreamCandidateModel(status);

  assert.equal(model.overview.topCandidates[0]?.key, "signal-only-1");
  assert.equal(model.candidatesByKey["signal-only-1"]?.snippet, "A high-signal insight survives aggregate trimming.");
  assert.equal(model.candidatesByKey["signal-only-1"]?.lane, "waiting");
});
