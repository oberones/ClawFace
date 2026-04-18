import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayEventsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-events.ts"));
}

test("normalizeApprovalGatewayEvent turns requested approval payloads into domain events", () => {
  const { normalizeApprovalGatewayEvent } = loadShellGatewayEventsModule();

  const event = normalizeApprovalGatewayEvent("exec.approval.requested", {
    id: "approval-1",
    createdAtMs: 1700,
    request: {
      sessionKey: "agent:main:main",
      commandPreview: "python -m demo",
      allowedDecisions: ["allow-once", "deny"],
    },
  });

  assert.equal(event?.kind, "approval-requested");
  assert.equal(event?.approval.id, "approval-1");
  assert.equal(event?.approval.sessionKey, "agent:main:main");
  assert.deepEqual(event?.approval.allowedDecisions, ["allow-once", "deny"]);
  assert.equal(event?.approval.description, "python -m demo");
});

test("normalizeApprovalGatewayEvent turns resolved approval payloads into domain events", () => {
  const { normalizeApprovalGatewayEvent } = loadShellGatewayEventsModule();

  const event = normalizeApprovalGatewayEvent("plugin.approval.resolved", {
    id: "approval-2",
    decision: "allow-always",
    request: {
      session_key: "agent:secondary:main",
    },
  });

  assert.equal(event?.kind, "approval-resolved");
  assert.equal(event?.resolution.id, "approval-2");
  assert.equal(event?.resolution.sessionKey, "agent:secondary:main");
  assert.equal(event?.resolution.decision, "allow-always");
});

test("normalizeDevicePairingGatewayEvent normalizes requested and resolved pairing events", () => {
  const { normalizeDevicePairingGatewayEvent } = loadShellGatewayEventsModule();

  assert.deepEqual(
    normalizeDevicePairingGatewayEvent("device.pair.requested", {}),
    { kind: "device-pair-requested" },
  );

  assert.deepEqual(
    normalizeDevicePairingGatewayEvent("device.pair.resolved", {
      data: {
        request_id: "request-7",
      },
    }),
    {
      kind: "device-pair-resolved",
      requestId: "request-7",
    },
  );
});

test("normalizeShellGatewayEvent ignores unrelated gateway events", () => {
  const { normalizeShellGatewayEvent } = loadShellGatewayEventsModule();

  assert.equal(normalizeShellGatewayEvent("agent", { data: { stream: "assistant" } }), null);
});
