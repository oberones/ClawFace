import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-memory.ts"));
}

test("normalizeDreamMethodSummary derives support for dream and wiki methods", () => {
  const { normalizeDreamMethodSummary } = loadModule();

  assert.deepEqual(
    normalizeDreamMethodSummary([
      "doctor.memory.status",
      "doctor.memory.dreamDiary",
      "wiki.importInsights",
    ]),
    {
      status: "supported",
      diary: "supported",
      importInsights: "supported",
      palace: "unsupported",
    },
  );
});

test("resolveDreamWorkspaceScope keeps the inspector honest about workspace scope", () => {
  const { resolveDreamWorkspaceScope } = loadModule();

  const scope = resolveDreamWorkspaceScope({
    sessionAgentLabel: "Main agent",
    configState: {
      configuredModelKeys: new Set(),
      queueMode: "collect",
      runtimePathHints: {
        homeDir: "/Users/oberon",
        workspaceDir: "/Users/oberon/.openclaw/workspace/ClawFace",
      },
      providerApiKeyLabels: {},
      defaultHeartbeatSession: null,
      heartbeatSessionOverrides: {},
    },
  });

  assert.equal(scope.label, "Workspace snapshot · ClawFace");
  assert.match(scope.detail, /workspace-scoped/i);
});

test("normalizeDoctorMemoryStatus unwraps dreaming payloads and preserves dream entries", () => {
  const { normalizeDoctorMemoryStatus } = loadModule();

  const normalized = normalizeDoctorMemoryStatus({
    dreaming: {
      enabled: true,
      timezone: "America/New_York",
      shortTermCount: 2,
      groundedSignalCount: 1,
      totalSignalCount: 4,
      phaseSignalCount: 5,
      promotedTotal: 3,
      promotedToday: 1,
      shortTermEntries: [
        {
          key: "memory/2026-04-03.md:4:6",
          path: "memory/2026-04-03.md",
          startLine: 4,
          endLine: 6,
          snippet: "Emma prefers shorter, lower-pressure check-ins.",
          recallCount: 2,
          dailyCount: 1,
          groundedCount: 0,
          totalSignalCount: 3,
          lightHits: 2,
          remHits: 1,
          phaseHitCount: 3,
          lastRecalledAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      signalEntries: [
        {
          key: "memory/2026-04-03.md:4:6",
          path: "memory/2026-04-03.md",
          startLine: 4,
          endLine: 6,
          snippet: "Emma prefers shorter, lower-pressure check-ins.",
          totalSignalCount: 3,
          phaseHitCount: 3,
        },
      ],
      promotedEntries: [
        {
          key: "memory/2026-04-02.md:10:12",
          path: "memory/2026-04-02.md",
          startLine: 10,
          endLine: 12,
          snippet: "Lower-pressure check-ins help keep Emma engaged.",
          totalSignalCount: 5,
          phaseHitCount: 4,
          promotedAt: "2026-04-22T08:15:00.000Z",
        },
      ],
      phases: {
        light: {
          enabled: true,
          cron: "0 */6 * * *",
          managedCronPresent: true,
          lookbackDays: 5,
          limit: 10,
        },
        deep: {
          enabled: true,
          cron: "0 */4 * * *",
          managedCronPresent: true,
          limit: 12,
          minScore: 0.4,
          minRecallCount: 2,
          minUniqueQueries: 2,
          recencyHalfLifeDays: 21,
        },
        rem: {
          enabled: true,
          cron: "0 */8 * * *",
          managedCronPresent: false,
          lookbackDays: 5,
          limit: 8,
          minPatternStrength: 0.25,
        },
      },
    },
  });

  assert.equal(normalized?.enabled, true);
  assert.equal(normalized?.shortTermEntries.length, 1);
  assert.equal(normalized?.promotedEntries[0]?.promotedAt, "2026-04-22T08:15:00.000Z");
  assert.equal(normalized?.phases?.deep.minRecallCount, 2);
});

test("normalizeDoctorMemoryDreamDiary and wiki payloads preserve optional companion data", () => {
  const {
    normalizeDoctorMemoryDreamDiary,
    normalizeWikiImportInsights,
    normalizeWikiMemoryPalace,
  } = loadModule();

  const diary = normalizeDoctorMemoryDreamDiary({
    found: true,
    path: "DREAMS.md",
    content: "## 2026-04-22\nEmma preferences kept resurfacing.",
    updatedAtMs: 1234,
  });

  const insights = normalizeWikiImportInsights({
    clusters: [
      {
        key: "topic/emma",
        label: "Emma",
        items: [
          {
            pagePath: "imports/emma.md",
            title: "Emma communication preferences",
            riskLevel: "low",
            topicKey: "topic/emma",
            topicLabel: "Emma",
            digestStatus: "available",
            summary: "Emma prefers concise and low-pressure check-ins.",
            candidateSignals: ["concise check-ins"],
          },
        ],
      },
    ],
  });

  const palace = normalizeWikiMemoryPalace({
    clusters: [
      {
        key: "concept",
        label: "Concepts",
        items: [
          {
            pagePath: "palace/emma-checkins.md",
            title: "Low-pressure check-ins",
            kind: "concept",
            claimCount: 2,
            questionCount: 1,
            contradictionCount: 0,
            claims: ["Lower-pressure check-ins improve follow-through."],
          },
        ],
      },
    ],
  });

  assert.equal(diary.found, true);
  assert.equal(diary.updatedAtMs, 1234);
  assert.equal(insights.totalItems, 1);
  assert.equal(insights.clusters[0]?.items[0]?.title, "Emma communication preferences");
  assert.equal(palace.totalClaims, 2);
  assert.equal(palace.clusters[0]?.items[0]?.kind, "concept");
});
