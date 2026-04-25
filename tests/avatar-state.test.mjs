import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadAvatarStateModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/avatar-state.ts"));
}

function connectedSnapshot(overrides = {}) {
  return {
    connectionStatus: "connected",
    approvalNeeded: false,
    activeToolCount: 0,
    thinking: false,
    streaming: false,
    finalOutcome: "none",
    ...overrides,
  };
}

test("deriveAvatarState returns live runtime states and idle fallback", () => {
  const { deriveAvatarState } = loadAvatarStateModule();

  assert.equal(deriveAvatarState(connectedSnapshot()), "idle");
  assert.equal(deriveAvatarState(connectedSnapshot({ connectionStatus: "disconnected" })), "disconnected");
  assert.equal(deriveAvatarState(connectedSnapshot({ connectionStatus: "pairing-required" })), "disconnected");
  assert.equal(deriveAvatarState(connectedSnapshot({ approvalNeeded: true })), "approval-needed");
  assert.equal(deriveAvatarState(connectedSnapshot({ activeToolCount: 1 })), "tool-running");
  assert.equal(deriveAvatarState(connectedSnapshot({ thinking: true })), "thinking");
  assert.equal(deriveAvatarState(connectedSnapshot({ streaming: true })), "streaming");
});

test("deriveAvatarState applies live-state priority order", () => {
  const { deriveAvatarState } = loadAvatarStateModule();

  assert.equal(
    deriveAvatarState(connectedSnapshot({
      connectionStatus: "disconnected",
      approvalNeeded: true,
      activeToolCount: 2,
      thinking: true,
      streaming: true,
    })),
    "disconnected",
  );
  assert.equal(
    deriveAvatarState(connectedSnapshot({
      approvalNeeded: true,
      activeToolCount: 2,
      thinking: true,
      streaming: true,
    })),
    "approval-needed",
  );
  assert.equal(
    deriveAvatarState(connectedSnapshot({
      activeToolCount: 2,
      thinking: true,
      streaming: true,
    })),
    "tool-running",
  );
  assert.equal(
    deriveAvatarState(connectedSnapshot({
      thinking: true,
      streaming: true,
    })),
    "thinking",
  );
});

test("deriveAvatarState maps explicit final outcomes conservatively", () => {
  const { deriveAvatarState } = loadAvatarStateModule();

  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "success" })), "success");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "serious" })), "serious");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "caution" })), "caution");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "blocked" })), "warning");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "denied" })), "warning");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "error" })), "warning");
  assert.equal(deriveAvatarState(connectedSnapshot({ finalOutcome: "none" })), "idle");
});

test("deriveAvatarState keeps warning outcomes above normal moods", () => {
  const { deriveAvatarState } = loadAvatarStateModule();

  assert.equal(
    deriveAvatarState(connectedSnapshot({
      finalOutcome: "error",
      activeToolCount: 0,
      thinking: false,
      streaming: false,
    })),
    "warning",
  );
  assert.equal(
    deriveAvatarState(connectedSnapshot({
      connectionStatus: "error",
      finalOutcome: "success",
    })),
    "warning",
  );
});

test("deriveAvatarState normalizes invalid active tool counts", () => {
  const { deriveAvatarState } = loadAvatarStateModule();

  assert.equal(deriveAvatarState(connectedSnapshot({ activeToolCount: -1 })), "idle");
  assert.equal(deriveAvatarState(connectedSnapshot({ activeToolCount: Number.NaN })), "idle");
});

test("avatar state labels cover every state", () => {
  const { AVATAR_STATE_LABELS } = loadAvatarStateModule();
  const expectedStates = [
    "idle",
    "thinking",
    "streaming",
    "tool-running",
    "success",
    "serious",
    "caution",
    "warning",
    "approval-needed",
    "disconnected",
  ];

  assert.deepEqual(Object.keys(AVATAR_STATE_LABELS).sort(), expectedStates.sort());
  for (const state of expectedStates) {
    assert.equal(typeof AVATAR_STATE_LABELS[state], "string");
    assert.ok(AVATAR_STATE_LABELS[state].length > 0);
  }
});

test("deriveAvatarState remains independent of avatar profile selection", () => {
  const { deriveAvatarState } = loadAvatarStateModule();
  const baselineSnapshot = connectedSnapshot({
    activeToolCount: 1,
    thinking: true,
    streaming: true,
  });

  assert.equal(deriveAvatarState(baselineSnapshot), "tool-running");
  assert.equal(
    deriveAvatarState({
      ...baselineSnapshot,
      avatarProfileId: "clawface-prism-node",
    }),
    "tool-running",
  );
});
