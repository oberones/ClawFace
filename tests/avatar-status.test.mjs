import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadAvatarStatusModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/hooks/useAvatarStatus.ts"));
}

function message(id, role = "assistant") {
  return {
    id,
    role,
    text: role === "assistant" ? "Done" : "Prompt",
    timestamp: 1,
  };
}

function tool(id, outcome, status = "result") {
  return {
    id,
    name: "shell",
    status,
    outcome,
    startedAt: 1,
    updatedAt: 2,
  };
}

test("transient assistant success ignores history hydration", () => {
  const { shouldShowTransientAssistantSuccess } = loadAvatarStatusModule();
  assert.equal(
    shouldShowTransientAssistantSuccess({
      messages: [message("historical-assistant")],
      previousMessageIds: new Set(),
      hadLiveActivity: false,
      liveActivityActive: false,
    }),
    false,
  );
});

test("transient assistant success requires completed live activity", () => {
  const { shouldShowTransientAssistantSuccess } = loadAvatarStatusModule();
  assert.equal(
    shouldShowTransientAssistantSuccess({
      messages: [message("user-1", "user"), message("assistant-1")],
      previousMessageIds: new Set(["user-1"]),
      hadLiveActivity: true,
      liveActivityActive: false,
    }),
    true,
  );
  assert.equal(
    shouldShowTransientAssistantSuccess({
      messages: [message("user-1", "user"), message("assistant-1")],
      previousMessageIds: new Set(["user-1"]),
      hadLiveActivity: true,
      liveActivityActive: true,
    }),
    false,
  );
});

test("transient tool failure ignores historical failed tools", () => {
  const { hasKnownToolFailureTransition } = loadAvatarStatusModule();
  assert.equal(
    hasKnownToolFailureTransition([tool("historical-failure", "failed")], new Map()),
    false,
  );
});

test("transient tool failure requires a known tool to transition to failed", () => {
  const { hasKnownToolFailureTransition } = loadAvatarStatusModule();
  assert.equal(
    hasKnownToolFailureTransition(
      [tool("live-tool", "failed")],
      new Map([["live-tool", "running"]]),
    ),
    true,
  );
  assert.equal(
    hasKnownToolFailureTransition(
      [tool("already-failed", "failed")],
      new Map([["already-failed", "failed"]]),
    ),
    false,
  );
});
