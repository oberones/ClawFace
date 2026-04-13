import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadMessageExtractModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/message-extract.ts"));
}

test("extractMessageRunId preserves top-level and nested run ids from history-like payloads", () => {
  const { extractMessageRunId } = loadMessageExtractModule();

  assert.equal(extractMessageRunId({ runId: "run-top-level" }), "run-top-level");
  assert.equal(extractMessageRunId({ run_id: "run_snake_case" }), "run_snake_case");
  assert.equal(extractMessageRunId({ data: { runId: "run-nested" } }), "run-nested");
  assert.equal(extractMessageRunId({ data: { run_id: "run_nested_snake" } }), "run_nested_snake");
  assert.equal(extractMessageRunId({ runId: "   " }), null);
  assert.equal(extractMessageRunId(null), null);
});
