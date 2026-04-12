import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadRuntimeControlsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/runtime-controls.ts"));
}

test("THINKING_LEVEL_CHOICES and THINKING_LEVEL_COMMAND_USAGE stay aligned", () => {
  const { THINKING_LEVEL_CHOICES, THINKING_LEVEL_COMMAND_USAGE } = loadRuntimeControlsModule();

  assert.deepEqual([...THINKING_LEVEL_CHOICES], [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ]);
  assert.equal(THINKING_LEVEL_COMMAND_USAGE, THINKING_LEVEL_CHOICES.join("|"));
});

test("runtime control normalization keeps thinking and model values predictable", () => {
  const { normalizeThinkingValue, normalizeModelKey } = loadRuntimeControlsModule();

  assert.equal(normalizeThinkingValue(" HIGH "), "high");
  assert.equal(normalizeThinkingValue(""), "off");
  assert.equal(normalizeThinkingValue(null), "off");
  assert.equal(normalizeModelKey(" Provider/Model "), "provider/model");
});
