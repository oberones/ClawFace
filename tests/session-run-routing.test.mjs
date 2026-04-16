import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const { loadModule } = createTsModuleLoader();
const modulePath = path.resolve("src/lib/session-run-routing.ts");
const { resolveEventSessionKey } = loadModule(modulePath);

test("resolveEventSessionKey prefers an explicit session key hint", () => {
  const resolved = resolveEventSessionKey({
    sessionKeyHint: "agent:main:ui:target",
    runId: "run-123",
    selectedSessionKey: "agent:main:ui:selected",
    activeRunId: "run-123",
    cachedRuns: [{ sessionKey: "agent:main:ui:cached", runId: "run-123" }],
  });

  assert.equal(resolved, "agent:main:ui:target");
});

test("resolveEventSessionKey falls back to the selected session when the active run matches", () => {
  const resolved = resolveEventSessionKey({
    runId: "run-123",
    selectedSessionKey: "agent:main:ui:selected",
    activeRunId: "run-123",
    cachedRuns: [{ sessionKey: "agent:main:ui:cached", runId: "run-123" }],
  });

  assert.equal(resolved, "agent:main:ui:selected");
});

test("resolveEventSessionKey falls back to cached run ownership when sessionKey is absent", () => {
  const resolved = resolveEventSessionKey({
    runId: "run-image",
    selectedSessionKey: "agent:main:ui:selected",
    activeRunId: "run-other",
    cachedRuns: [
      { sessionKey: "agent:main:ui:alpha", runId: "run-alpha" },
      { sessionKey: "agent:main:ui:image", runId: "run-image" },
    ],
  });

  assert.equal(resolved, "agent:main:ui:image");
});

test("resolveEventSessionKey returns null when neither hint nor run ownership is known", () => {
  const resolved = resolveEventSessionKey({
    runId: "run-missing",
    selectedSessionKey: "agent:main:ui:selected",
    activeRunId: "run-other",
    cachedRuns: [{ sessionKey: "agent:main:ui:alpha", runId: "run-alpha" }],
  });

  assert.equal(resolved, null);
});
