import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadMediaHydrationModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/media-hydration.ts"));
}

test("toolMayProduceMedia detects explicit media paths, media-oriented tool names, and image outputs", () => {
  const { toolMayProduceMedia } = loadMediaHydrationModule();

  assert.equal(toolMayProduceMedia({ mediaPaths: ["/tmp/image.png"] }), true);
  assert.equal(toolMayProduceMedia({ name: "image_generate" }), true);
  assert.equal(toolMayProduceMedia({ output: "Saved to MEDIA:/tmp/monkey.png" }), true);
  assert.equal(toolMayProduceMedia({ name: "bash", output: "done" }), false);
});

test("runMayStillProduceMedia combines pending tool hints, prior tool hints, and cached assistant reply media", () => {
  const { runMayStillProduceMedia } = loadMediaHydrationModule();

  assert.equal(
    runMayStillProduceMedia({
      pendingToolUpdates: [{ name: "image_generate" }],
      priorToolItems: [],
      pendingAssistantReplyMediaCount: 0,
    }),
    true,
  );
  assert.equal(
    runMayStillProduceMedia({
      pendingToolUpdates: [],
      priorToolItems: [{ output: "Saved file monkey.png" }],
      pendingAssistantReplyMediaCount: 0,
    }),
    true,
  );
  assert.equal(
    runMayStillProduceMedia({
      pendingToolUpdates: [],
      priorToolItems: [],
      pendingAssistantReplyMediaCount: 2,
    }),
    true,
  );
  assert.equal(
    runMayStillProduceMedia({
      pendingToolUpdates: [],
      priorToolItems: [],
      pendingAssistantReplyMediaCount: 0,
    }),
    false,
  );
});

test("decideFinalizedRunHydration clears once a finalized run already has a committed attachment", () => {
  const { decideFinalizedRunHydration } = loadMediaHydrationModule();

  assert.equal(
    decideFinalizedRunHydration({
      hasFinalAssistantMessage: true,
      hasRenderableAttachment: false,
      hasCommittedAttachment: true,
      hasCommittedMessage: true,
      expectsMedia: true,
    }),
    "clear",
  );
});

test("decideFinalizedRunHydration schedules hydration when the final message is text-only but media is still expected", () => {
  const { decideFinalizedRunHydration } = loadMediaHydrationModule();

  assert.equal(
    decideFinalizedRunHydration({
      hasFinalAssistantMessage: true,
      hasRenderableAttachment: false,
      hasCommittedAttachment: false,
      hasCommittedMessage: true,
      expectsMedia: true,
    }),
    "schedule",
  );
});

test("decideFinalizedRunHydration reloads history when the finalized run produced no local message and may still have media", () => {
  const { decideFinalizedRunHydration } = loadMediaHydrationModule();

  assert.equal(
    decideFinalizedRunHydration({
      hasFinalAssistantMessage: false,
      hasRenderableAttachment: false,
      hasCommittedAttachment: false,
      hasCommittedMessage: false,
      expectsMedia: true,
    }),
    "reload",
  );
});

test("decideFinalizedRunHydration clears when the finalized run has a committed text message and no remaining media expectation", () => {
  const { decideFinalizedRunHydration } = loadMediaHydrationModule();

  assert.equal(
    decideFinalizedRunHydration({
      hasFinalAssistantMessage: false,
      hasRenderableAttachment: false,
      hasCommittedAttachment: false,
      hasCommittedMessage: true,
      expectsMedia: false,
    }),
    "clear",
  );
});

test("decideScheduledHistoryHydrationTick waits while the active run is still streaming or thinking", () => {
  const { decideScheduledHistoryHydrationTick } = loadMediaHydrationModule();

  assert.deepEqual(
    decideScheduledHistoryHydrationTick({
      isStillScheduled: true,
      isFinalAttempt: false,
      hasCommittedAttachment: false,
      isCurrentClient: true,
      isCurrentSession: true,
      activeRunId: "run-1",
      targetRunId: "run-1",
      thinking: true,
      hasActiveStreamText: false,
      hasPendingAssistantReply: false,
      isHistoryLoadInFlight: false,
    }),
    { clearScheduled: false, loadHistory: false },
  );
});

test("decideScheduledHistoryHydrationTick loads history when the delayed retry is still valid and idle", () => {
  const { decideScheduledHistoryHydrationTick } = loadMediaHydrationModule();

  assert.deepEqual(
    decideScheduledHistoryHydrationTick({
      isStillScheduled: true,
      isFinalAttempt: false,
      hasCommittedAttachment: false,
      isCurrentClient: true,
      isCurrentSession: true,
      activeRunId: "run-1",
      targetRunId: "run-1",
      thinking: false,
      hasActiveStreamText: false,
      hasPendingAssistantReply: false,
      isHistoryLoadInFlight: false,
    }),
    { clearScheduled: false, loadHistory: true },
  );
});

test("decideScheduledHistoryHydrationTick clears and skips on the last attempt when the run is no longer eligible", () => {
  const { decideScheduledHistoryHydrationTick } = loadMediaHydrationModule();

  assert.deepEqual(
    decideScheduledHistoryHydrationTick({
      isStillScheduled: true,
      isFinalAttempt: true,
      hasCommittedAttachment: false,
      isCurrentClient: true,
      isCurrentSession: false,
      activeRunId: null,
      targetRunId: "run-1",
      thinking: false,
      hasActiveStreamText: false,
      hasPendingAssistantReply: false,
      isHistoryLoadInFlight: false,
    }),
    { clearScheduled: true, loadHistory: false },
  );
});

test("decideScheduledHistoryHydrationTick clears and skips once an attachment has already landed", () => {
  const { decideScheduledHistoryHydrationTick } = loadMediaHydrationModule();

  assert.deepEqual(
    decideScheduledHistoryHydrationTick({
      isStillScheduled: true,
      isFinalAttempt: false,
      hasCommittedAttachment: true,
      isCurrentClient: true,
      isCurrentSession: true,
      activeRunId: null,
      targetRunId: "run-1",
      thinking: false,
      hasActiveStreamText: false,
      hasPendingAssistantReply: false,
      isHistoryLoadInFlight: false,
    }),
    { clearScheduled: true, loadHistory: false },
  );
});
