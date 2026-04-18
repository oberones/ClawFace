import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadThreadToolEventRoutingModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/thread-tool-event-routing.ts"));
}

const exactSessionMatch = (left, right) => Boolean(left && right && left === right);

test("resolveChatEventDispatch routes non-active session events into the cached branch", () => {
  const threadToolEventRouting = loadThreadToolEventRoutingModule();

  const dispatch = threadToolEventRouting.resolveChatEventDispatch({
    state: "final",
    sessionKeyHint: null,
    runId: "run-2",
    activeSessionKey: "session-a",
    activeRunId: "run-1",
    sessionKeysMatch: exactSessionMatch,
    resolveSessionKey: () => "session-b",
  });

  assert.deepEqual(dispatch, {
    kind: "cached",
    state: "final",
    targetKey: "session-b",
  });
});

test("resolveChatEventDispatch keeps the active branch when the run matches the active session run", () => {
  const threadToolEventRouting = loadThreadToolEventRoutingModule();

  const dispatch = threadToolEventRouting.resolveChatEventDispatch({
    state: "delta",
    sessionKeyHint: null,
    runId: "run-1",
    activeSessionKey: "session-a",
    activeRunId: "run-1",
    sessionKeysMatch: exactSessionMatch,
    resolveSessionKey: () => "session-b",
  });

  assert.deepEqual(dispatch, {
    kind: "active",
    state: "delta",
    targetKey: null,
  });
});

test("resolveAgentEventDispatch routes background session events into the cached branch", () => {
  const threadToolEventRouting = loadThreadToolEventRoutingModule();

  const dispatch = threadToolEventRouting.resolveAgentEventDispatch({
    sessionKeyHint: "session-b",
    runId: "run-2",
    activeSessionKey: "session-a",
    activeRunId: "run-1",
    sessionKeysMatch: exactSessionMatch,
    resolveSessionKey: () => "session-b",
  });

  assert.deepEqual(dispatch, {
    kind: "cached",
    targetKey: "session-b",
  });
});

test("resolveAgentEventDispatch keeps same-run events active even if the resolved session differs", () => {
  const threadToolEventRouting = loadThreadToolEventRoutingModule();

  const dispatch = threadToolEventRouting.resolveAgentEventDispatch({
    sessionKeyHint: null,
    runId: "run-1",
    activeSessionKey: "session-a",
    activeRunId: "run-1",
    sessionKeysMatch: exactSessionMatch,
    resolveSessionKey: () => "session-b",
  });

  assert.deepEqual(dispatch, {
    kind: "active",
    targetKey: null,
  });
});
