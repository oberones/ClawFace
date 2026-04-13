import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadApprovalEventsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/approval-events.ts"));
}

test("extractPendingApprovalFromGatewayEvent normalizes exec approvals", () => {
  const { extractPendingApprovalFromGatewayEvent } = loadApprovalEventsModule();

  const approval = extractPendingApprovalFromGatewayEvent("exec.approval.requested", {
    id: "approval-1",
    createdAtMs: 101,
    expiresAtMs: 202,
    request: {
      sessionKey: "session-1",
      commandPreview: "npm run build",
      host: "workspace.local",
      agentId: "agent-1",
      toolCallId: "tool-1",
      allowedDecisions: [" allow-once ", "deny", "allow-once", "invalid"],
    },
  });

  assert.deepEqual(approval, {
    id: "approval-1",
    kind: "exec",
    sessionKey: "session-1",
    approvalSlug: null,
    title: "Command approval requested",
    description: "npm run build (workspace.local)",
    command: "npm run build",
    host: "workspace.local",
    agentId: "agent-1",
    toolCallId: "tool-1",
    allowedDecisions: ["allow-once", "deny"],
    createdAtMs: 101,
    expiresAtMs: 202,
  });
});

test("extractPendingApprovalFromGatewayEvent falls back to exec-safe decisions when allowed decisions are absent", () => {
  const { extractPendingApprovalFromGatewayEvent } = loadApprovalEventsModule();

  const approval = extractPendingApprovalFromGatewayEvent("exec.approval.requested", {
    id: "approval-missing-decisions",
    request: {
      sessionKey: "session-1",
      commandPreview: "npm test",
      allowedDecisions: [],
    },
  });

  assert.deepEqual(approval?.allowedDecisions, ["allow-once", "deny"]);
});

test("extractPendingApprovalFromGatewayEvent defaults plugin approvals to the standard decision set", () => {
  const { extractPendingApprovalFromGatewayEvent } = loadApprovalEventsModule();

  const approval = extractPendingApprovalFromGatewayEvent("plugin.approval.requested", {
    id: "approval-2",
    approvalSlug: "plugin-install",
    request: {
      sessionKey: "session-2",
      title: "Plugin install approval requested",
      description: "Install the acme plugin from the marketplace.",
    },
  });

  assert.deepEqual(approval, {
    id: "approval-2",
    kind: "plugin",
    sessionKey: "session-2",
    approvalSlug: "plugin-install",
    title: "Plugin install approval requested",
    description: "Install the acme plugin from the marketplace.",
    command: null,
    host: null,
    agentId: null,
    toolCallId: null,
    allowedDecisions: ["allow-once", "allow-always", "deny"],
    createdAtMs: null,
    expiresAtMs: null,
  });
});

test("approval event helpers upsert, resolve, and select methods predictably", () => {
  const {
    extractApprovalResolutionFromGatewayEvent,
    formatApprovalDecisionLabel,
    pickApprovalResolveMethod,
    removeResolvedApprovalBySession,
    upsertPendingApprovalBySession,
  } = loadApprovalEventsModule();

  const first = {
    id: "approval-a",
    kind: "exec",
    sessionKey: "session-1",
    title: "First",
    description: "First description",
    allowedDecisions: ["allow-once", "deny"],
    createdAtMs: 200,
  };
  const second = {
    id: "approval-b",
    kind: "plugin",
    sessionKey: "session-1",
    title: "Second",
    description: "Second description",
    allowedDecisions: ["allow-once", "allow-always", "deny"],
    createdAtMs: 100,
  };

  let approvalsBySession = {};
  approvalsBySession = upsertPendingApprovalBySession(approvalsBySession, first);
  approvalsBySession = upsertPendingApprovalBySession(approvalsBySession, second);

  assert.deepEqual(approvalsBySession, {
    "session-1": [second, first],
  });

  const resolution = extractApprovalResolutionFromGatewayEvent("plugin.approval.resolved", {
    id: "approval-b",
    decision: "allow-always",
    request: {
      sessionKey: "session-1",
    },
  });

  assert.deepEqual(resolution, {
    id: "approval-b",
    kind: "plugin",
    sessionKey: "session-1",
    decision: "allow-always",
  });

  assert.deepEqual(removeResolvedApprovalBySession(approvalsBySession, resolution), {
    "session-1": [first],
  });

  assert.equal(
    pickApprovalResolveMethod(new Set(["exec.approval.resolve", "chat.send"]), "exec"),
    "exec.approval.resolve",
  );
  assert.equal(
    pickApprovalResolveMethod(new Set(["exec.approval.resolve", "chat.send"]), "plugin"),
    null,
  );
  assert.equal(formatApprovalDecisionLabel("allow-always"), "Allow Always");
});
