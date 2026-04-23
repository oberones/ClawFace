import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return {
    timeline: loader.loadModule(path.join(repoRoot, "src/lib/dream-timeline.ts")),
    links: loader.loadModule(path.join(repoRoot, "src/lib/dream-timeline-links.ts")),
  };
}

function createCandidate(overrides = {}) {
  return {
    key: "candidate-1",
    lane: "grounded",
    path: "memory/2026-04-03.md",
    startLine: 4,
    endLine: 6,
    snippet: "Emma prefers shorter, lower-pressure check-ins.",
    recallCount: 2,
    dailyCount: 1,
    groundedCount: 1,
    totalSignalCount: 3,
    lightHits: 1,
    remHits: 1,
    phaseHitCount: 2,
    promotedAt: null,
    lastRecalledAt: "2026-04-22T09:00:00.000Z",
    originLabel: "Grounded by replay and current signals",
    explanationCues: [],
    ...overrides,
  };
}

test("attachDreamTimelineLinks adds diary and nearby related-context links for candidate-safe moments only", () => {
  const { links } = loadModule();

  const selectedCandidate = createCandidate();
  const decorated = links.attachDreamTimelineLinks({
    momentGroups: [
      {
        id: "replay:2026-04-22T09:00:00.000Z:candidate-1",
        kind: "replay",
        headline: "Replay touchpoint",
        summary: "Visible recall timing shows this memory was touched again around this point.",
        timestamp: "2026-04-22T09:00:00.000Z",
        phaseLabel: null,
        candidateRefs: [
          {
            candidateKey: "candidate-1",
            path: selectedCandidate.path,
            startLine: selectedCandidate.startLine,
            endLine: selectedCandidate.endLine,
            label: selectedCandidate.snippet,
            relationship: "direct",
            status: "grounded",
          },
        ],
        artifactLinks: [],
        sourceKinds: ["lastRecalledAt"],
        limitationNote: null,
      },
      {
        id: "promotion:2026-04-22T08:15:00.000Z:other",
        kind: "promotion",
        headline: "Promoted",
        summary: "Another memory promoted here.",
        timestamp: "2026-04-22T08:15:00.000Z",
        phaseLabel: null,
        candidateRefs: [
          {
            candidateKey: "other",
            path: "memory/other.md",
            startLine: 1,
            endLine: 2,
            label: "Other memory",
            relationship: "direct",
            status: "promoted",
          },
        ],
        artifactLinks: [],
        sourceKinds: ["promotedAt"],
        limitationNote: null,
      },
    ],
    diary: {
      found: true,
      path: "DREAMS.md",
      updatedAtMs: Date.parse("2026-04-22T10:00:00.000Z"),
      content: "## 2026-04-22\nEmma prefers shorter, lower-pressure check-ins.\n",
      entries: [
        {
          id: "2026-04-22:0",
          dateLabel: "2026-04-22",
          body: "Emma prefers shorter, lower-pressure check-ins.",
          paragraphs: ["Emma prefers shorter, lower-pressure check-ins."],
          sourceRange: { startLine: 1, endLine: 3 },
        },
      ],
      error: null,
    },
    diaryRelation: {
      status: "direct",
      entryId: "2026-04-22:0",
      matchedTerms: ["emma", "check-ins"],
      note: "Related from visible overlap.",
    },
    selectedDiaryEntry: {
      id: "2026-04-22:0",
      dateLabel: "2026-04-22",
      body: "Emma prefers shorter, lower-pressure check-ins.",
      paragraphs: ["Emma prefers shorter, lower-pressure check-ins."],
      sourceRange: { startLine: 1, endLine: 3 },
    },
    selectedCandidate,
    relatedContext: {
      status: "ready",
      insights: [
        {
          kind: "insight",
          pagePath: "imports/emma.md",
          title: "Emma communication preferences",
          summary: "Emma prefers shorter, lower-pressure check-ins.",
          topicLabel: "Emma",
          riskLevel: "low",
          matchedTerms: ["emma"],
          candidateSignals: ["shorter check-ins"],
        },
      ],
      palacePages: [
        {
          kind: "palace",
          pagePath: "palace/emma-checkins.md",
          title: "Low-pressure check-ins",
          pageKind: "concept",
          snippet: "Low-pressure check-ins help Emma stay engaged.",
          matchedTerms: ["check-ins"],
          claimCount: 1,
          questionCount: 0,
          contradictionCount: 0,
        },
      ],
      limitationNote: null,
      error: null,
    },
  });

  const candidateSafeLinks = decorated[0]?.artifactLinks ?? [];
  assert.ok(candidateSafeLinks.some((link) => link.kind === "diary-entry" && link.relationship === "direct"));
  assert.ok(candidateSafeLinks.some((link) => link.kind === "related-insight"));
  assert.ok(candidateSafeLinks.some((link) => link.kind === "related-palace"));

  const groupedLinks = decorated[1]?.artifactLinks ?? [];
  assert.ok(groupedLinks.some((link) => link.kind === "dream-candidate"));
  assert.ok(groupedLinks.every((link) => link.kind !== "related-insight" && link.kind !== "related-palace"));
});

test("attachDreamTimelineLinks adds limited diary fallback for diary-update moments", () => {
  const { links } = loadModule();

  const decorated = links.attachDreamTimelineLinks({
    momentGroups: [
      {
        id: "diary-update:1234",
        kind: "diary-update",
        headline: "Dream Diary update",
        summary: "Only file-level diary timing is visible.",
        timestamp: "2026-04-22T09:00:00.000Z",
        phaseLabel: null,
        candidateRefs: [],
        artifactLinks: [],
        sourceKinds: ["diaryUpdatedAt"],
        limitationNote: "Entry dates could not be parsed.",
      },
    ],
    diary: {
      found: true,
      path: "DREAMS.md",
      updatedAtMs: 1234,
      content: "Reflections without a date heading.",
      entries: [],
      error: null,
    },
    diaryRelation: null,
    selectedDiaryEntry: null,
    selectedCandidate: null,
    relatedContext: {
      status: "idle",
      insights: [],
      palacePages: [],
      limitationNote: null,
      error: null,
    },
  });

  assert.deepEqual(
    decorated[0]?.artifactLinks,
    [
      {
        kind: "diary-entry",
        targetId: null,
        label: "Open Dream Diary",
        detail: "Only file-level diary timing is visible from this snapshot.",
        relationship: "limited",
      },
    ],
  );
});
