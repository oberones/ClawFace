import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModules() {
  const loader = createTsModuleLoader();
  return {
    diary: loader.loadModule(path.join(repoRoot, "src/lib/dream-diary.ts")),
    timeline: loader.loadModule(path.join(repoRoot, "src/lib/dream-diary-timeline.ts")),
  };
}

const workspaceScope = {
  label: "Workspace snapshot · ClawFace",
  detail: "Dream data is workspace-scoped.",
  workspaceName: "ClawFace",
};

function parseDiary(content, updatedAtMs = 1234) {
  const { diary } = loadModules();
  return diary.parseDreamDiarySnapshot({
    found: true,
    path: "DREAMS.md",
    content,
    updatedAtMs,
    error: null,
  });
}

function buildSnapshot(document, options = {}) {
  const { timeline } = loadModules();
  return timeline.buildDreamDiaryTimelineSnapshot({
    document,
    workspaceScope,
    loadedAtMs: 2000,
    ...options,
  });
}

test("buildDreamDiaryTimelineSnapshot orders dated entries newest-first and selects the first displayed entry", () => {
  const document = parseDiary([
    "## 2026-04-21",
    "",
    "Older dream entry.",
    "",
    "## 2026-04-23",
    "",
    "Newest dream entry.",
    "",
    "## 2026-04-22",
    "",
    "Middle dream entry.",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const displayedIds = snapshot.groups.flatMap((group) => group.entryIds);

  assert.equal(snapshot.availability, "ready");
  assert.equal(snapshot.entriesById[displayedIds[0]]?.dateLabel, "2026-04-23");
  assert.equal(snapshot.entriesById[displayedIds[1]]?.dateLabel, "2026-04-22");
  assert.equal(snapshot.entriesById[displayedIds[2]]?.dateLabel, "2026-04-21");
  assert.equal(snapshot.latestEntryId, displayedIds[0]);
  assert.equal(snapshot.selectedEntryId, displayedIds[0]);
});

test("buildDreamDiaryTimelineSnapshot orders OpenClaw timestamped diary entries newest-first", () => {
  const document = parseDiary([
    "# Dream Diary",
    "",
    "<!-- openclaw:dreaming:diary:start -->",
    "---",
    "",
    "*April 11, 2026, 8:00 AM UTC*",
    "",
    "Older timestamped dream entry.",
    "",
    "---",
    "",
    "*April 11, 2026, 8:30 AM UTC*",
    "",
    "Newer timestamped dream entry.",
    "",
    "<!-- openclaw:dreaming:diary:end -->",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const displayedIds = snapshot.groups.flatMap((group) => group.entryIds);

  assert.equal(snapshot.availability, "ready");
  assert.equal(snapshot.entriesById[displayedIds[0]]?.dateLabel, "April 11, 2026, 8:30 AM UTC");
  assert.equal(snapshot.entriesById[displayedIds[1]]?.dateLabel, "April 11, 2026, 8:00 AM UTC");
  assert.equal(snapshot.latestEntryId, displayedIds[0]);
});

test("buildDreamDiaryTimelineSnapshot keeps repeated timestamp entries separately selectable", () => {
  const document = parseDiary([
    "# Dream Diary",
    "",
    "<!-- openclaw:dreaming:diary:start -->",
    "---",
    "",
    "*April 11, 2026, 8:00 AM UTC*",
    "",
    "First dream from this hour.",
    "",
    "---",
    "",
    "*April 11, 2026, 8:00 AM UTC*",
    "",
    "Second dream from this hour.",
    "",
    "<!-- openclaw:dreaming:diary:end -->",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const group = snapshot.groups[0];
  const firstEntry = snapshot.entriesById[group?.entryIds[0] ?? ""];
  const secondEntry = snapshot.entriesById[group?.entryIds[1] ?? ""];

  assert.equal(group?.label, "April 11, 2026, 8:00 AM UTC");
  assert.equal(group?.entryIds.length, 2);
  assert.equal(firstEntry?.occurrenceLabel, "Entry 1 of 2");
  assert.equal(secondEntry?.occurrenceLabel, "Entry 2 of 2");
  assert.match(firstEntry?.title ?? "", /Entry 1 of 2/);
  assert.match(secondEntry?.title ?? "", /Entry 2 of 2/);
  assert.equal(firstEntry?.paragraphs[0], "First dream from this hour.");
  assert.equal(secondEntry?.paragraphs[0], "Second dream from this hour.");
});

test("buildDreamDiaryTimelineSnapshot orders and separates OpenClaw at-form timestamp entries", () => {
  const document = parseDiary([
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
    "*April 23, 2026 at 4:00 AMUTC*",
    "",
    "Newer dream from the next hour.",
    "",
    "---",
    "",
    "*April 23, 2026 at 3:00 AM UTC*",
    "",
    "Second dream from this hour.",
    "",
    "<!-- openclaw:dreaming:diary:end -->",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const displayedIds = snapshot.groups.flatMap((group) => group.entryIds);
  const repeatedGroup = snapshot.groups.find((group) => group.label === "April 23, 2026 at 3:00 AM UTC");
  const firstRepeatedEntry = snapshot.entriesById[repeatedGroup?.entryIds[0] ?? ""];
  const secondRepeatedEntry = snapshot.entriesById[repeatedGroup?.entryIds[1] ?? ""];

  assert.equal(snapshot.availability, "ready");
  assert.equal(snapshot.entriesById[displayedIds[0]]?.dateLabel, "April 23, 2026 at 4:00 AM UTC");
  assert.equal(snapshot.entriesById[displayedIds[0]]?.paragraphs[0], "Newer dream from the next hour.");
  assert.equal(repeatedGroup?.entryIds.length, 2);
  assert.equal(firstRepeatedEntry?.occurrenceLabel, "Entry 1 of 2");
  assert.equal(secondRepeatedEntry?.occurrenceLabel, "Entry 2 of 2");
  assert.equal(firstRepeatedEntry?.paragraphs[0], "First dream from this hour.");
  assert.equal(secondRepeatedEntry?.paragraphs[0], "Second dream from this hour.");
});

test("buildDreamDiaryTimelineSnapshot preserves source order for heading-only and undated entries", () => {
  const document = parseDiary([
    "## First thread",
    "",
    "First heading-only entry.",
    "",
    "## Second thread",
    "",
    "Second heading-only entry.",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const displayedIds = snapshot.groups.flatMap((group) => group.entryIds);

  assert.equal(snapshot.availability, "limited");
  assert.equal(snapshot.entriesById[displayedIds[0]]?.title, "First thread");
  assert.equal(snapshot.entriesById[displayedIds[1]]?.title, "Second thread");
  assert.equal(snapshot.latestEntryId, displayedIds[0]);
});

test("buildDreamDiaryTimelineSnapshot keeps same-date entries in source order", () => {
  const document = parseDiary([
    "## 2026-04-22",
    "",
    "First same-day entry.",
    "",
    "## 2026-04-22",
    "",
    "Second same-day entry.",
  ].join("\n"));

  const snapshot = buildSnapshot(document);
  const group = snapshot.groups[0];

  assert.equal(group?.label, "2026-04-22");
  assert.equal(snapshot.entriesById[group?.entryIds[0] ?? ""]?.paragraphs[0], "First same-day entry.");
  assert.equal(snapshot.entriesById[group?.entryIds[1] ?? ""]?.paragraphs[0], "Second same-day entry.");
});

test("buildDreamDiaryTimelineSnapshot preserves selected entry across unchanged refreshes", () => {
  const document = parseDiary([
    "## 2026-04-22",
    "",
    "Newest entry.",
    "",
    "## 2026-04-21",
    "",
    "Older entry.",
  ].join("\n"));
  const initial = buildSnapshot(document);
  const olderId = initial.groups.flatMap((group) => group.entryIds)[1];

  const refreshed = buildSnapshot(document, { selectedEntryId: olderId });

  assert.equal(refreshed.selectedEntryId, olderId);
  assert.notEqual(refreshed.latestEntryId, olderId);
});

test("canReturnToLatestDreamDiaryEntry is only true when an older entry is selected", () => {
  const { timeline } = loadModules();
  const document = parseDiary([
    "## 2026-04-23",
    "",
    "Newest entry.",
    "",
    "## 2026-04-22",
    "",
    "Older entry.",
  ].join("\n"));
  const snapshot = buildSnapshot(document);
  const olderId = snapshot.groups.flatMap((group) => group.entryIds)[1];

  assert.equal(timeline.canReturnToLatestDreamDiaryEntry(snapshot, snapshot.latestEntryId), false);
  assert.equal(timeline.canReturnToLatestDreamDiaryEntry(snapshot, olderId), true);
});

test("buildDreamDiaryTimelineSnapshot treats updatedAtMs as freshness metadata only", () => {
  const document = parseDiary("Dream diary text without dated entry boundaries.", 9999);
  const snapshot = buildSnapshot(document);

  assert.equal(snapshot.availability, "limited");
  assert.equal(snapshot.diaryUpdatedAtMs, 9999);
  assert.equal(snapshot.groups[0]?.label, "Limited diary");
  assert.equal(snapshot.entriesById[snapshot.latestEntryId ?? ""]?.dateLabel, null);
});

test("buildDreamDiaryTimelineSnapshot distinguishes empty, disabled, unavailable, and disabled-with-content states", () => {
  const { timeline } = loadModules();
  const emptyDocument = {
    ...timeline.EMPTY_DREAM_DIARY_DOCUMENT,
    found: true,
  };
  const readableDocument = parseDiary("## 2026-04-22\n\nReadable existing entry.");

  const empty = buildSnapshot(emptyDocument);
  const disabledEmpty = buildSnapshot(emptyDocument, { disabled: true });
  const unavailable = buildSnapshot(emptyDocument, { unavailable: true, error: "Gateway unavailable" });
  const disabledReadable = buildSnapshot(readableDocument, { disabled: true });

  assert.equal(empty.availability, "empty");
  assert.equal(disabledEmpty.availability, "disabled");
  assert.equal(disabledEmpty.latestEntryId, null);
  assert.equal(unavailable.availability, "unavailable");
  assert.equal(disabledReadable.availability, "disabled");
  assert.ok(disabledReadable.latestEntryId);
  assert.match(disabledReadable.note ?? "", /still available to read/i);
});

test("DiaryEntryAttachment remains entry-scoped for future related memory support", () => {
  const document = parseDiary("## 2026-04-22\n\nReadable entry.");
  const snapshot = buildSnapshot(document);
  const entry = snapshot.entriesById[snapshot.latestEntryId ?? ""];

  assert.equal(entry?.attachmentAnchor, `diary-entry:${entry?.id}`);
});
