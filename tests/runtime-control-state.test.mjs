import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadRuntimeControlStateModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/runtime-control-state.ts"));
}

test("buildSessionRuntimePatchDecision trims model input and normalizes thinking levels", () => {
  const { buildSessionRuntimePatchDecision } = loadRuntimeControlStateModule();

  assert.deepEqual(
    buildSessionRuntimePatchDecision({
      model: " provider/model ",
      thinkingLevel: " HIGH ",
    }),
    {
      patch: {
        model: "provider/model",
        thinkingLevel: "high",
      },
      nextModel: "provider/model",
      nextThinkingLevel: "high",
      refreshModels: true,
      shouldPatch: true,
    },
  );
});

test("buildSessionRuntimePatchDecision supports clearing thinking without implying a model refresh", () => {
  const { buildSessionRuntimePatchDecision } = loadRuntimeControlStateModule();

  assert.deepEqual(
    buildSessionRuntimePatchDecision({
      thinkingLevel: null,
    }),
    {
      patch: {
        thinkingLevel: null,
      },
      nextModel: undefined,
      nextThinkingLevel: null,
      refreshModels: false,
      shouldPatch: true,
    },
  );
});

test("buildSessionRuntimePatchDecision returns an empty no-op decision when no runtime patch values are provided", () => {
  const { buildSessionRuntimePatchDecision } = loadRuntimeControlStateModule();

  assert.deepEqual(buildSessionRuntimePatchDecision({}), {
    patch: {},
    nextModel: undefined,
    nextThinkingLevel: undefined,
    refreshModels: false,
    shouldPatch: false,
  });
});

test("applyModelRuntimeOverride sets explicit models and clears default or blank overrides", () => {
  const { applyModelRuntimeOverride } = loadRuntimeControlStateModule();

  assert.deepEqual(
    applyModelRuntimeOverride({ "session-1": "old/model" }, "session-1", "new/model"),
    { "session-1": "new/model" },
  );
  assert.deepEqual(
    applyModelRuntimeOverride({ "session-1": "old/model", other: "other/model" }, "session-1", "default"),
    { other: "other/model" },
  );
  assert.deepEqual(
    applyModelRuntimeOverride({ "session-1": "old/model", other: "other/model" }, "session-1", ""),
    { other: "other/model" },
  );
});

test("applyModelRuntimeOverride leaves the map untouched when no model update is needed", () => {
  const { applyModelRuntimeOverride } = loadRuntimeControlStateModule();

  const existing = { "session-1": "same/model" };
  assert.strictEqual(applyModelRuntimeOverride(existing, "session-1", undefined), existing);
  assert.strictEqual(applyModelRuntimeOverride(existing, "session-1", "same/model"), existing);
});

test("applyThinkingRuntimeOverride sets explicit thinking levels and clears null overrides", () => {
  const { applyThinkingRuntimeOverride } = loadRuntimeControlStateModule();

  assert.deepEqual(
    applyThinkingRuntimeOverride({ "session-1": "low" }, "session-1", "high"),
    { "session-1": "high" },
  );
  assert.deepEqual(
    applyThinkingRuntimeOverride({ "session-1": "low", other: "medium" }, "session-1", null),
    { other: "medium" },
  );
});

test("applyThinkingRuntimeOverride leaves the map untouched when no thinking update is needed", () => {
  const { applyThinkingRuntimeOverride } = loadRuntimeControlStateModule();

  const existing = { "session-1": "medium" };
  assert.strictEqual(applyThinkingRuntimeOverride(existing, "session-1", undefined), existing);
  assert.strictEqual(applyThinkingRuntimeOverride(existing, "session-1", "medium"), existing);
});
