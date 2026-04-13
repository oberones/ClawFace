import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStatusBackgroundVisibilityModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/status-background-visibility.ts"));
}

test("extractStatusBackgroundVisibility reads nested status lines from the gateway status payload", () => {
  const { extractStatusBackgroundVisibility } = loadStatusBackgroundVisibilityModule();

  assert.deepEqual(
    extractStatusBackgroundVisibility({
      status: {
        subagentsLine: "🤖 Subagents: 2 active",
        taskLine: "📋 Tasks: 1 active · 3 total",
      },
    }),
    {
      subagentsLine: "🤖 Subagents: 2 active",
      taskLine: "📋 Tasks: 1 active · 3 total",
    },
  );
});

test("extractStatusBackgroundVisibility falls back to top-level snake_case fields and tolerates missing values", () => {
  const { extractStatusBackgroundVisibility } = loadStatusBackgroundVisibilityModule();

  assert.deepEqual(
    extractStatusBackgroundVisibility({
      subagents_line: "🤖 Subagents: 1 active",
    }),
    {
      subagentsLine: "🤖 Subagents: 1 active",
      taskLine: null,
    },
  );

  assert.deepEqual(extractStatusBackgroundVisibility(null), {
    subagentsLine: null,
    taskLine: null,
  });
});
