import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/dream-related-context.ts"));
}

function createCandidate() {
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
  };
}

test("matchDreamRelatedContext returns ready matches for imported insights and memory palace pages", () => {
  const { matchDreamRelatedContext } = loadModule();

  const context = matchDreamRelatedContext({
    candidate: createCandidate(),
    importInsightsAvailability: "supported",
    palaceAvailability: "supported",
    importInsights: {
      sourceType: "chatgpt",
      totalItems: 1,
      totalClusters: 1,
      clusters: [
        {
          key: "topic/emma",
          label: "Emma",
          itemCount: 1,
          highRiskCount: 0,
          withheldCount: 0,
          preferenceSignalCount: 1,
          updatedAt: "2026-04-22T09:00:00.000Z",
          items: [
            {
              pagePath: "imports/emma.md",
              title: "Emma communication preferences",
              riskLevel: "low",
              riskReasons: [],
              labels: [],
              topicKey: "topic/emma",
              topicLabel: "Emma",
              digestStatus: "available",
              activeBranchMessages: 1,
              userMessageCount: 1,
              assistantMessageCount: 1,
              firstUserLine: null,
              lastUserLine: null,
              assistantOpener: null,
              summary: "Emma prefers shorter, lower-pressure check-ins.",
              candidateSignals: ["lower-pressure check-ins"],
              correctionSignals: [],
              preferenceSignals: ["shorter check-ins"],
              createdAt: null,
              updatedAt: null,
            },
          ],
        },
      ],
    },
    palace: {
      totalItems: 1,
      totalClaims: 1,
      totalQuestions: 0,
      totalContradictions: 0,
      clusters: [
        {
          key: "concept",
          label: "Concepts",
          itemCount: 1,
          claimCount: 1,
          questionCount: 0,
          contradictionCount: 0,
          updatedAt: "2026-04-22T09:00:00.000Z",
          items: [
            {
              pagePath: "palace/emma-checkins.md",
              title: "Low-pressure check-ins",
              kind: "concept",
              id: null,
              updatedAt: null,
              sourceType: null,
              claimCount: 1,
              questionCount: 0,
              contradictionCount: 0,
              claims: ["Lower-pressure check-ins help Emma stay engaged."],
              questions: [],
              contradictions: [],
              snippet: "Lower-pressure check-ins help Emma stay engaged.",
            },
          ],
        },
      ],
    },
  });

  assert.equal(context.status, "ready");
  assert.equal(context.insights.length, 1);
  assert.equal(context.palacePages.length, 1);
  assert.ok(context.insights[0]?.matchedTerms.length > 0);
});

test("matchDreamRelatedContext distinguishes unsupported from limited relationships", () => {
  const { matchDreamRelatedContext } = loadModule();

  const unsupported = matchDreamRelatedContext({
    candidate: createCandidate(),
    importInsightsAvailability: "unsupported",
    palaceAvailability: "unsupported",
    importInsights: null,
    palace: null,
  });
  assert.equal(unsupported.status, "unsupported");

  const limited = matchDreamRelatedContext({
    candidate: createCandidate(),
    importInsightsAvailability: "supported",
    palaceAvailability: "supported",
    importInsights: { sourceType: "chatgpt", totalItems: 0, totalClusters: 0, clusters: [] },
    palace: { totalItems: 0, totalClaims: 0, totalQuestions: 0, totalContradictions: 0, clusters: [] },
  });
  assert.equal(limited.status, "limited");
  assert.match(limited.limitationNote ?? "", /No strong/i);
});
