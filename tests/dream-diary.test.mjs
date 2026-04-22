import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/dream-diary.ts"));
}

function createCandidate(snippet) {
  return {
    key: "candidate-1",
    lane: "waiting",
    path: "memory/2026-04-03.md",
    startLine: 4,
    endLine: 6,
    snippet,
    recallCount: 2,
    dailyCount: 1,
    groundedCount: 0,
    totalSignalCount: 3,
    lightHits: 1,
    remHits: 1,
    phaseHitCount: 2,
    promotedAt: null,
    lastRecalledAt: "2026-04-22T09:00:00.000Z",
    originLabel: "Heating up from current signals",
    explanationCues: [],
  };
}

test("parseDreamDiarySnapshot splits diary content into readable entries", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "## 2026-04-22",
      "",
      "Emma prefers shorter, lower-pressure check-ins.",
      "",
      "## 2026-04-21",
      "",
      "Historical replay reinforced the same pattern.",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.dateLabel, "2026-04-22");
  assert.equal(document.entries[0]?.paragraphs[0], "Emma prefers shorter, lower-pressure check-ins.");
});

test("relateDreamDiaryToCandidate marks direct matches when visible text overlaps", () => {
  const { parseDreamDiarySnapshot, relateDreamDiaryToCandidate } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "## 2026-04-22",
      "",
      "Emma prefers shorter, lower-pressure check-ins and that preference kept resurfacing.",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  const relation = relateDreamDiaryToCandidate(
    document,
    createCandidate("Emma prefers shorter, lower-pressure check-ins."),
  );

  assert.equal(relation.status, "direct");
  assert.equal(relation.entryId, document.entries[0]?.id);
  assert.ok(relation.matchedTerms.length >= 2);
});

test("relateDreamDiaryToCandidate falls back to limited context when overlap is weak", () => {
  const { parseDreamDiarySnapshot, relateDreamDiaryToCandidate } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "## 2026-04-22",
      "",
      "The dreaming run focused on scheduling and follow-up cadence.",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  const relation = relateDreamDiaryToCandidate(
    document,
    createCandidate("Emma prefers shorter, lower-pressure check-ins."),
  );

  assert.equal(relation.status, "limited");
  assert.match(relation.note, /relationship detail is limited/i);
});
