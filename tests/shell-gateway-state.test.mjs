import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayStateModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-state.ts"));
}

test("normalizeGatewayHelloState filters methods and falls back to the default payload budget", () => {
  const { normalizeGatewayHelloState } = loadShellGatewayStateModule();

  const normalized = normalizeGatewayHelloState({
    type: "hello-ok",
    protocol: 3,
    server: {
      version: "1.2.3",
      commit: "abc123",
    },
    features: {
      methods: ["sessions.list", 42, "chat.send"],
    },
    policy: {},
  }, 2_000_000);

  assert.deepEqual(Array.from(normalized.methods), ["sessions.list", "chat.send"]);
  assert.equal(normalized.serverVersion, "1.2.3");
  assert.equal(normalized.serverCommit, "abc123");
  assert.equal(normalized.maxPayloadBytes, 2_000_000);
});

test("normalizeGatewayCloseState distinguishes pairing-required from reconnecting and generic disconnects", () => {
  const { normalizeGatewayCloseState } = loadShellGatewayStateModule();

  assert.deepEqual(
    normalizeGatewayCloseState({ code: 4001, reason: "Pairing required for this device" }, false),
    {
      status: "pairing-required",
      reason: "Pairing required for this device",
      note: "Pairing required. Approve this device in the gateway.",
    },
  );

  assert.deepEqual(
    normalizeGatewayCloseState({ code: 1006, reason: "" }, false),
    {
      status: "connecting",
      reason: null,
      note: "Connection lost. Reconnecting…",
    },
  );

  assert.deepEqual(
    normalizeGatewayCloseState({ code: 1000, reason: "" }, true),
    {
      status: "disconnected",
      reason: null,
      note: "Disconnected (1000).",
    },
  );

  assert.deepEqual(
    normalizeGatewayCloseState({ code: 1006, reason: "" }, true),
    {
      status: "disconnected",
      reason: null,
      note: "Disconnected (1006). Handshake failed. Check Gateway URL/path or Origin allowlist.",
    },
  );
});

test("extractGatewayStatusSnapshot unwraps nested status payloads and preserves background lines", () => {
  const { extractGatewayStatusSnapshot } = loadShellGatewayStateModule();

  const snapshot = extractGatewayStatusSnapshot({
    status: {
      subagents_line: "2 subagents running",
      taskLine: "1 active task",
      sessions: {
        defaults: { model: "gpt-5.4" },
        recent: [
          { key: "agent:main:main", model: "gpt-5.4", updatedAt: 1700 },
          "ignored",
        ],
      },
    },
  });

  assert.equal(snapshot.subagentsLine, "2 subagents running");
  assert.equal(snapshot.taskLine, "1 active task");
  assert.deepEqual(snapshot.defaults, { model: "gpt-5.4" });
  assert.equal(snapshot.recent.length, 1);
  assert.equal(snapshot.recent[0]?.key, "agent:main:main");
});
