import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadThreadToolEventOutcomesModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/thread-tool-event-outcomes.ts"));
}

test("resolveActiveThreadToolRunSync switches runs while thinking but reloads otherwise when requested", () => {
  const outcomes = loadThreadToolEventOutcomesModule();

  assert.deepEqual(outcomes.resolveActiveThreadToolRunSync({
    activeRunId: "run-a",
    incomingRunId: "run-b",
    thinking: true,
    onMismatchWithoutThinking: "reload-history",
  }), { kind: "switch-run", runId: "run-b" });

  assert.deepEqual(outcomes.resolveActiveThreadToolRunSync({
    activeRunId: "run-a",
    incomingRunId: "run-b",
    thinking: false,
    onMismatchWithoutThinking: "reload-history",
  }), { kind: "reload-history" });

  assert.deepEqual(outcomes.resolveActiveThreadToolRunSync({
    activeRunId: "run-a",
    incomingRunId: "run-b",
    thinking: false,
    onMismatchWithoutThinking: "ignore",
  }), { kind: "ignore" });
});

test("resolveThreadToolDeltaOutcome prefers tool updates and otherwise keeps only real assistant text", () => {
  const outcomes = loadThreadToolEventOutcomesModule();

  assert.deepEqual(outcomes.resolveThreadToolDeltaOutcome({
    toolUpdateCount: 2,
    isToolMessage: true,
    extractedText: "ignored",
  }), { kind: "tool-updates" });

  assert.deepEqual(outcomes.resolveThreadToolDeltaOutcome({
    toolUpdateCount: 0,
    isToolMessage: true,
    extractedText: "tool only",
  }), { kind: "ignore" });

  assert.deepEqual(outcomes.resolveThreadToolDeltaOutcome({
    toolUpdateCount: 0,
    isToolMessage: false,
    extractedText: "  hello world  ",
  }), { kind: "assistant-text", text: "hello world" });

  assert.deepEqual(outcomes.resolveThreadToolDeltaOutcome({
    toolUpdateCount: 0,
    isToolMessage: false,
    extractedText: "   ",
  }), { kind: "ignore" });
});

test("resolveThreadToolFinalOutcome separates tool-final branches from assistant finals", () => {
  const outcomes = loadThreadToolEventOutcomesModule();

  assert.deepEqual(outcomes.resolveThreadToolFinalOutcome({
    isToolFinal: true,
    hasCommittedStreamMessage: true,
    toolFinalMessageCount: 3,
  }), { kind: "tool-final-with-committed-stream" });

  assert.deepEqual(outcomes.resolveThreadToolFinalOutcome({
    isToolFinal: true,
    hasCommittedStreamMessage: false,
    toolFinalMessageCount: 2,
  }), { kind: "tool-final-with-attachments" });

  assert.deepEqual(outcomes.resolveThreadToolFinalOutcome({
    isToolFinal: false,
    hasCommittedStreamMessage: false,
    toolFinalMessageCount: 0,
  }), { kind: "assistant-final" });
});

test("resolveThreadToolLifecycleOutcome only handles terminal lifecycle phases", () => {
  const outcomes = loadThreadToolEventOutcomesModule();

  assert.equal(outcomes.resolveThreadToolLifecycleOutcome("start"), "ignore");
  assert.equal(outcomes.resolveThreadToolLifecycleOutcome("end"), "end");
  assert.equal(outcomes.resolveThreadToolLifecycleOutcome("error"), "error");
  assert.equal(outcomes.resolveThreadToolLifecycleOutcome(null), "ignore");
});
