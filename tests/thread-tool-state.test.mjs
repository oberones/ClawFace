import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadThreadToolStateModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/thread-tool-state.ts"));
}

test("createEmptyThreadToolStateSnapshot returns the cleared thread/tool defaults", () => {
  const threadToolState = loadThreadToolStateModule();
  assert.deepEqual(threadToolState.createEmptyThreadToolStateSnapshot(), {
    messages: [],
    streamText: null,
    toolItems: [],
    thinking: false,
    chatRunId: null,
    thinkingLevel: null,
  });
});

test("cloneThreadToolStateSnapshot copies message and tool arrays without sharing references", () => {
  const threadToolState = loadThreadToolStateModule();
  const original = {
    messages: [{ id: "m1", role: "assistant", text: "hello", timestamp: 1 }],
    streamText: "stream",
    toolItems: [{ id: "t1", name: "exec", status: "start", outcome: "running", startedAt: 1, updatedAt: 1 }],
    thinking: true,
    chatRunId: "run-1",
    thinkingLevel: "high",
  };

  const clone = threadToolState.cloneThreadToolStateSnapshot(original);

  assert.deepEqual(clone, original);
  assert.notEqual(clone.messages, original.messages);
  assert.notEqual(clone.toolItems, original.toolItems);

  original.messages.push({ id: "m2", role: "assistant", text: "later", timestamp: 2 });
  original.toolItems.push({ id: "t2", name: "image_generate", status: "update", outcome: "running", startedAt: 2, updatedAt: 2 });

  assert.equal(clone.messages.length, 1);
  assert.equal(clone.toolItems.length, 1);
});
