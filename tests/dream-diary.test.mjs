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

test("parseDreamDiarySnapshot ignores internal dream artifacts in managed diary content", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "# Dream Diary",
      "",
      "## 2026-04-24",
      "",
      "This status-like section is outside the managed diary and should not render.",
      "",
      "<!-- openclaw:dreaming:diary:start -->",
      "---",
      "",
      "*April 25, 2026 at 3:00 AM UTC*",
      "",
      "User: System: [2026-04-24 13:22:27 UTC] Gateway restart config-apply ok (config.apply) System: Run: openclaw doctor --non-interactive Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, say nothing needs attention.",
      "",
      "---",
      "",
      "*April 25, 2026 at 3:00 AM UTC*",
      "",
      "User: Hey can you run openclaw doctor again and report any issues?",
      "",
      "---",
      "",
      "*April 25, 2026 at 3:00 AM UTC*",
      "",
      "Possible Lasting Truths: No strong candidate truths surfaced.",
      "",
      "---",
      "",
      "*April 25, 2026 at 3:00 AM UTC*",
      "",
      "Reflections: Theme: `assistant` kept surfacing across 120 memories.; confidence: 0.89; evidence: memory/2026-04-11.md:328-331, memory/2026-04-12.md:373-376; note: reflection",
      "",
      "---",
      "",
      "*April 25, 2026 at 3:00 AM UTC*",
      "",
      "The dream watched the workspace settle after the restart. No new requests pulled it away from the quiet heartbeat.",
      "",
      "<!-- openclaw:dreaming:diary:end -->",
      "",
      "## 2026-04-26",
      "",
      "This trailing section is outside the managed diary and should not render either.",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 1);
  assert.equal(document.entries[0]?.dateLabel, "April 25, 2026 at 3:00 AM UTC");
  assert.deepEqual(document.entries[0]?.paragraphs, [
    "The dream watched the workspace settle after the restart. No new requests pulled it away from the quiet heartbeat.",
  ]);
});

test("parseDreamDiarySnapshot preserves legacy diary entries that begin with role labels", () => {
  const { parseDreamDiarySnapshot } = loadModule();

  const document = parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content: [
      "## April 26, 2026 at 3:00 AM UTC",
      "",
      "User: The dream kept the transcript framing because this old diary was hand-authored.",
      "",
      "## April 26, 2026 at 4:00 AM UTC",
      "",
      "Assistant: A second legacy entry still belongs in the diary reader.",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 2);
  assert.equal(document.entries[0]?.dateLabel, "April 26, 2026 at 3:00 AM UTC");
  assert.deepEqual(document.entries[0]?.paragraphs, [
    "User: The dream kept the transcript framing because this old diary was hand-authored.",
  ]);
  assert.equal(document.entries[1]?.dateLabel, "April 26, 2026 at 4:00 AM UTC");
  assert.deepEqual(document.entries[1]?.paragraphs, [
    "Assistant: A second legacy entry still belongs in the diary reader.",
  ]);
});

test("parseDreamDiarySnapshot returns no fallback entry when managed diary contains only artifacts", () => {
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
      "*April 26, 2026 at 3:00 AM UTC*",
      "",
      "User: Hey can you run openclaw doctor again and report any issues?",
      "",
      "---",
      "",
      "*April 26, 2026 at 3:00 AM UTC*",
      "",
      "Reflections: Theme: `assistant` kept surfacing across 120 memories.; confidence: 0.89; evidence: memory/2026-04-11.md:328-331; note: reflection",
      "",
      "<!-- openclaw:dreaming:diary:end -->",
    ].join("\n"),
    updatedAtMs: 1234,
    error: null,
  });

  assert.equal(document.entries.length, 0);
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
