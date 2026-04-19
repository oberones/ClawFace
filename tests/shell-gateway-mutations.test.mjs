import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayMutationsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-mutations.ts"));
}

test("normalizeChatSendResult preserves trimmed run ids and ignores invalid payloads", () => {
  const { normalizeChatSendResult } = loadShellGatewayMutationsModule();

  assert.deepEqual(
    normalizeChatSendResult({
      run_id: " run-123 ",
    }),
    {
      runId: "run-123",
    },
  );

  assert.deepEqual(
    normalizeChatSendResult({
      runId: "   ",
    }),
    {
      runId: null,
    },
  );

  assert.deepEqual(normalizeChatSendResult(null), { runId: null });
});

test("normalizeSessionsResetResult preserves trimmed keys and ignores invalid payloads", () => {
  const { normalizeSessionsResetResult } = loadShellGatewayMutationsModule();

  assert.deepEqual(
    normalizeSessionsResetResult({
      key: " agent:main:main ",
    }),
    {
      key: "agent:main:main",
    },
  );

  assert.deepEqual(
    normalizeSessionsResetResult({
      key: "",
    }),
    {
      key: null,
    },
  );

  assert.deepEqual(normalizeSessionsResetResult(undefined), { key: null });
});
