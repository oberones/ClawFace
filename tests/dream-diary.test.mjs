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

test("parseDreamDiarySnapshot splits dated diary content into readable entries", () => {
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
  assert.equal(document.entries[0]?.kind, "dated");
  assert.equal(document.entries[0]?.dateLabel, "2026-04-22");
  assert.equal(document.entries[0]?.paragraphs[0], "Emma prefers shorter, lower-pressure check-ins.");
});

test("parseDreamDiarySnapshot splits OpenClaw managed diary timestamps into entries", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "# Dream Diary",
      "",
      "<!-- openclaw:dreaming:diary:start -->",
      "---",
      "",
      "*April 11, 2026, 8:00 AM UTC*",
      "",
      "The server room smelled like rain.",
      "",
      "---",
      "",
      "*April 11, 2026, 8:30 AM UTC*",
      "",
      "<!-- transient comment -->",
      "",
      "A fresh signal arrived after the cleanup started.",
      "",
      "<!-- openclaw:dreaming:diary:end -->",
      "",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.kind, "dated");
  assert.equal(document.entries[0]?.dateLabel, "April 11, 2026, 8:00 AM UTC");
  assert.deepEqual(document.entries[0]?.paragraphs, ["The server room smelled like rain."]);
  assert.equal(document.entries[1]?.kind, "dated");
  assert.equal(document.entries[1]?.dateLabel, "April 11, 2026, 8:30 AM UTC");
  assert.deepEqual(document.entries[1]?.paragraphs, ["A fresh signal arrived after the cleanup started."]);
});

test("parseDreamDiarySnapshot splits OpenClaw at-form diary timestamps into separate entries", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "# Dream Diary",
      "",
      "<!-- openclaw:dreaming:diary:start -->",
      "---",
      "",
      "*April 23, 2026 at 3:00 AM UTC*",
      "",
      "First dream from this hour.",
      "",
      "---",
      "",
      "*April 23, 2026 at 3:00 AMUTC*",
      "",
      "Second dream from this hour.",
      "",
      "<!-- openclaw:dreaming:diary:end -->",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.kind, "dated");
  assert.equal(document.entries[0]?.dateLabel, "April 23, 2026 at 3:00 AM UTC");
  assert.deepEqual(document.entries[0]?.paragraphs, ["First dream from this hour."]);
  assert.equal(document.entries[1]?.kind, "dated");
  assert.equal(document.entries[1]?.dateLabel, "April 23, 2026 at 3:00 AM UTC");
  assert.deepEqual(document.entries[1]?.paragraphs, ["Second dream from this hour."]);
});

test("parseDreamDiarySnapshot preserves backfill diary dates as individual entries", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "# Dream Diary",
      "",
      "<!-- openclaw:dreaming:diary:start -->",
      "*January 1, 2026*",
      "",
      "<!-- openclaw:dreaming:backfill-entry day=2026-01-01 source=memory/2026-01-01.md -->",
      "",
      "What Happened",
      "",
      "1. First pass.",
      "",
      "*January 2, 2026*",
      "",
      "<!-- openclaw:dreaming:backfill-entry day=2026-01-02 source=memory/2026-01-02.md -->",
      "",
      "Reflections",
      "",
      "1. Second pass.",
      "",
      "<!-- openclaw:dreaming:diary:end -->",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.dateLabel, "January 1, 2026");
  assert.equal(document.entries[0]?.paragraphs.includes("1. First pass."), true);
  assert.equal(document.entries[1]?.dateLabel, "January 2, 2026");
  assert.equal(document.entries[1]?.paragraphs.includes("1. Second pass."), true);
});

test("parseDreamDiarySnapshot preserves heading-only entries without inventing dates", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "## Memory drift",
      "",
      "The dream kept circling back to lower-pressure check-ins.",
      "",
      "## Follow-up tone",
      "",
      "A quieter cadence remained the strongest narrative thread.",
    ].join("\n"),
    updatedAtMs: 4321,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.kind, "heading");
  assert.equal(document.entries[0]?.dateLabel, "Memory drift");
  assert.equal(document.entries[1]?.kind, "heading");
  assert.equal(document.updatedAtMs, 4321);
});

test("parseDreamDiarySnapshot falls back to a limited readable entry for unstructured content", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "The dream diary exists, but this content has no clear dated heading.",
      "",
      "It should remain readable instead of disappearing.",
    ].join("\n"),
    updatedAtMs: 9876,
    error: null,
  });

  assert.equal(document.entries.length, 1);
  assert.equal(document.entries[0]?.kind, "limited");
  assert.equal(document.entries[0]?.dateLabel, null);
  assert.deepEqual(document.entries[0]?.paragraphs, [
    "The dream diary exists, but this content has no clear dated heading.",
    "It should remain readable instead of disappearing.",
  ]);
});

test("parseDreamDiarySnapshot returns empty entries when diary content is unavailable", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: false,
    path: "DREAMS.md",
    content: null,
    updatedAtMs: 1111,
    error: "not found",
  });

  assert.equal(document.found, false);
  assert.equal(document.entries.length, 0);
  assert.equal(document.error, "not found");
});
