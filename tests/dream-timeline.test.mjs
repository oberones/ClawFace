import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/dream-timeline.ts"));
}

function createSnapshot(overrides = {}) {
  return {
    workspaceScope: {
      label: "Workspace snapshot · ClawFace",
      detail: "This timeline is workspace-scoped and derived from the current Dream Inspector snapshot.",
      workspaceName: "ClawFace",
    },
    loadedAtMs: Date.parse("2026-04-22T12:00:00.000Z"),
    availability: "ready",
    methods: {
      status: "supported",
      diary: "supported",
      importInsights: "supported",
      palace: "supported",
    },
    overview: {},
    candidatesByKey: {},
    lanes: {
      waiting: { key: "waiting", label: "Waiting", count: 0, items: [], emptyCopy: "" },
      grounded: { key: "grounded", label: "Grounded", count: 0, items: [], emptyCopy: "" },
      promoted: { key: "promoted", label: "Promoted", count: 0, items: [], emptyCopy: "" },
    },
    diary: {
      found: false,
      path: "DREAMS.md",
      updatedAtMs: null,
      content: null,
      entries: [],
      error: null,
    },
    note: null,
    error: null,
    ...overrides,
  };
}

function createCandidate(overrides = {}) {
  return {
    key: "candidate-1",
    lane: "waiting",
    path: "memory/2026-04-03.md",
    startLine: 4,
    endLine: 6,
    snippet: "Emma prefers shorter, lower-pressure check-ins.",
    recallCount: 2,
    dailyCount: 1,
    groundedCount: 0,
    totalSignalCount: 3,
    lightHits: 1,
    remHits: 1,
    phaseHitCount: 2,
    promotedAt: null,
    lastRecalledAt: null,
    originLabel: "Heating up from current signals",
    explanationCues: [],
    ...overrides,
  };
}

function createDiaryEntry(id, dateLabel, body) {
  return {
    id,
    dateLabel,
    body,
    paragraphs: [body],
    sourceRange: {
      startLine: 1,
      endLine: 3,
    },
  };
}

test("buildDreamTimelineSnapshot derives promotion, replay, and diary moments from visible evidence", () => {
  const { buildDreamTimelineSnapshot, filterTimelineMomentsForCandidate } = loadModule();

  const promoted = createCandidate({
    key: "promoted-1",
    lane: "promoted",
    snippet: "Lower-pressure check-ins improve Emma's follow-through.",
    promotedAt: "2026-04-22T08:15:00.000Z",
    lastRecalledAt: "2026-04-22T08:10:00.000Z",
  });
  const grounded = createCandidate({
    key: "grounded-1",
    lane: "grounded",
    snippet: "Historical replay reinforces Emma's low-pressure preference.",
    lastRecalledAt: "2026-04-21T12:00:00.000Z",
  });

  const timeline = buildDreamTimelineSnapshot(createSnapshot({
    candidatesByKey: {
      [promoted.key]: promoted,
      [grounded.key]: grounded,
    },
    diary: {
      found: true,
      path: "DREAMS.md",
      updatedAtMs: Date.parse("2026-04-22T07:00:00.000Z"),
      content: "## 2026-04-20\nEmma kept resurfacing.\n",
      entries: [createDiaryEntry("2026-04-20:0", "2026-04-20", "Emma kept resurfacing.")],
      error: null,
    },
  }));

  assert.equal(timeline.availability, "ready");
  assert.equal(timeline.momentGroups.length, 4);
  assert.equal(timeline.momentGroups[0]?.kind, "promotion");
  assert.equal(timeline.momentGroups[0]?.timestamp, "2026-04-22T08:15:00.000Z");
  assert.equal(timeline.range?.endAt, "2026-04-22T08:15:00.000Z");
  assert.equal(timeline.range?.startAt, "2026-04-20T12:00:00.000Z");
  assert.ok(timeline.range?.derivedFrom.includes("promotedAt"));
  assert.ok(timeline.range?.derivedFrom.includes("lastRecalledAt"));
  assert.ok(timeline.range?.derivedFrom.includes("diaryDate"));
  assert.deepEqual(
    filterTimelineMomentsForCandidate(timeline, "promoted-1").map((moment) => moment.kind),
    ["promotion", "replay"],
  );
});

test("buildDreamTimelineSnapshot keeps a true empty state when only snapshot freshness exists", () => {
  const { buildDreamTimelineSnapshot } = loadModule();

  const timeline = buildDreamTimelineSnapshot(createSnapshot({
    candidatesByKey: {
      "waiting-1": createCandidate(),
    },
  }));

  assert.equal(timeline.availability, "empty");
  assert.equal(timeline.momentGroups.length, 0);
  assert.match(timeline.note ?? "", /timestamped evidence/i);
});

test("buildDreamTimelineSnapshot maps disabled Dream Inspector state into disabled timeline state", () => {
  const { buildDreamTimelineSnapshot } = loadModule();

  const timeline = buildDreamTimelineSnapshot(createSnapshot({
    availability: "disabled",
    note: "Dreaming is currently disabled for this workspace.",
  }));

  assert.equal(timeline.availability, "disabled");
  assert.match(timeline.note ?? "", /Dreaming is off/i);
});

test("buildDreamTimelineSnapshot falls back to a limited diary-update moment when entry dates do not parse", () => {
  const { buildDreamTimelineSnapshot } = loadModule();

  const timeline = buildDreamTimelineSnapshot(createSnapshot({
    diary: {
      found: true,
      path: "DREAMS.md",
      updatedAtMs: Date.parse("2026-04-22T09:45:00.000Z"),
      content: "Reflections without a parseable date heading.",
      entries: [createDiaryEntry("entry:0", "Reflections", "Reflections without a parseable date heading.")],
      error: null,
    },
  }));

  assert.equal(timeline.availability, "partial");
  assert.equal(timeline.momentGroups.length, 1);
  assert.equal(timeline.momentGroups[0]?.kind, "diary-update");
  assert.ok(timeline.range?.derivedFrom.includes("diaryUpdatedAt"));
});
