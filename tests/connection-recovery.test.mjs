import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadConnectionRecoveryModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/connection-recovery.ts"));
}

test("shouldAnnounceConnectionRecovery only fires for post-connect recoveries", () => {
  const { shouldAnnounceConnectionRecovery } = loadConnectionRecoveryModule();

  assert.equal(shouldAnnounceConnectionRecovery("disconnected", false), false);
  assert.equal(shouldAnnounceConnectionRecovery("disconnected", true), false);
  assert.equal(shouldAnnounceConnectionRecovery("connected", true), false);
  assert.equal(shouldAnnounceConnectionRecovery("connecting", true), true);
  assert.equal(shouldAnnounceConnectionRecovery("error", true), true);
  assert.equal(shouldAnnounceConnectionRecovery("pairing-required", true), true);
});

test("buildConnectionRecoveryNotice distinguishes gateway recovery from session refresh", () => {
  const { buildConnectionRecoveryNotice } = loadConnectionRecoveryModule();

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "gateway-reconnected", hasActiveSession: false }),
    {
      tone: "success",
      title: "Gateway reconnected",
      message: "OpenClaw is connected again.",
    },
  );

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "gateway-reconnected", hasActiveSession: true }),
    {
      tone: "info",
      title: "Gateway reconnected",
      message: "Refreshing the current session now.",
    },
  );

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "session-refreshed", hasActiveSession: true }),
    {
      tone: "success",
      title: "Session refreshed",
      message: "The current session history was reloaded after reconnect.",
    },
  );
});

test("buildInterruptedRunSnapshot only tracks real in-flight work with a run id", () => {
  const { buildInterruptedRunSnapshot } = loadConnectionRecoveryModule();

  assert.equal(
    buildInterruptedRunSnapshot({
      sessionKey: "session-1",
      runId: null,
      thinking: true,
    }),
    null,
  );

  assert.equal(
    buildInterruptedRunSnapshot({
      sessionKey: "session-1",
      runId: "run-1",
      thinking: false,
      streamText: "",
      toolItems: [],
    }),
    null,
  );

  assert.deepEqual(
    buildInterruptedRunSnapshot({
      sessionKey: "session-1",
      runId: "run-1",
      thinking: true,
      streamText: "partial reply",
      toolItems: [
        { id: "tool-1", name: "image_generate", status: "update", outcome: "running", runId: "run-1" },
        { id: "tool-2", name: "image_generate", status: "update", outcome: "running", runId: "run-1" },
        { id: "tool-3", name: "search", status: "result", outcome: "succeeded", runId: "run-1" },
      ],
    }),
    {
      sessionKey: "session-1",
      runId: "run-1",
      hadStreamText: true,
      hadThinking: true,
      runningToolNames: ["image_generate"],
    },
  );
});

test("hasInterruptedRunResolved distinguishes finished output from unresolved reconnect gaps", () => {
  const {
    hasInterruptedRunResolved,
    buildInterruptedRunSessionBanner,
  } = loadConnectionRecoveryModule();

  const snapshot = {
    sessionKey: "session-1",
    runId: "run-1",
    hadStreamText: true,
    hadThinking: false,
    runningToolNames: ["image_generate"],
  };

  assert.equal(
    hasInterruptedRunResolved({
      snapshot,
      messages: [{ id: "assistant-1", role: "assistant", text: "done", timestamp: 1, runId: "run-1" }],
      toolItems: [],
    }),
    true,
  );

  assert.equal(
    hasInterruptedRunResolved({
      snapshot,
      messages: [],
      toolItems: [{ id: "tool-1", name: "image_generate", status: "result", outcome: "failed", runId: "run-1", startedAt: 1, updatedAt: 2 }],
    }),
    true,
  );

  assert.equal(
    hasInterruptedRunResolved({
      snapshot,
      messages: [{ id: "assistant-2", role: "assistant", text: "other", timestamp: 2, runId: "run-2" }],
      toolItems: [{ id: "tool-2", name: "image_generate", status: "update", outcome: "running", runId: "run-1", startedAt: 1, updatedAt: 2 }],
    }),
    false,
  );

  assert.deepEqual(buildInterruptedRunSessionBanner(snapshot), {
    tone: "warning",
    title: "Previous run interrupted",
    message:
      "The previous image_generate run did not resume automatically after reconnect. Refresh again if you expect delayed output, or resend the prompt.",
    action: "refresh-session",
  });
});
