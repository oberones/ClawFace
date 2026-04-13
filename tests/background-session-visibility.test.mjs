import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadBackgroundSessionVisibilityModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/background-session-visibility.ts"));
}

test("deriveBackgroundSessionNotice ignores the selected session and returns null when no other session is working", () => {
  const { deriveBackgroundSessionNotice } = loadBackgroundSessionVisibilityModule();

  assert.equal(
    deriveBackgroundSessionNotice({
      selectedSessionKey: "current",
      sessions: [
        { key: "current", kind: "direct", label: "Current", updatedAt: null },
        { key: "idle", kind: "direct", label: "Idle", updatedAt: null },
      ],
      sessionActivity: {
        current: { working: true, unread: false },
        idle: { working: false, unread: true },
      },
    }),
    null,
  );
});

test("deriveBackgroundSessionNotice prefers session labels and describes a single background session", () => {
  const { deriveBackgroundSessionNotice } = loadBackgroundSessionVisibilityModule();

  assert.deepEqual(
    deriveBackgroundSessionNotice({
      selectedSessionKey: "current",
      sessions: [
        { key: "current", kind: "direct", label: "Current", updatedAt: null },
        { key: "analysis", kind: "direct", derivedTitle: "Long-running analysis", updatedAt: null },
      ],
      sessionActivity: {
        current: { working: false, unread: false },
        analysis: { working: true, unread: false },
      },
    }),
    {
      count: 1,
      sessionKeys: ["analysis"],
      title: "Background session still working",
      detail:
        "\"Long-running analysis\" is still running in the background. Check the sidebar to switch back when you're ready.",
    },
  );
});

test("deriveBackgroundSessionNotice keeps session order and summarizes multiple background sessions", () => {
  const { deriveBackgroundSessionNotice } = loadBackgroundSessionVisibilityModule();

  assert.deepEqual(
    deriveBackgroundSessionNotice({
      selectedSessionKey: "current",
      sessions: [
        { key: "current", kind: "direct", label: "Current", updatedAt: null },
        { key: "design", kind: "direct", label: "Design review", updatedAt: null },
        { key: "ops", kind: "direct", displayName: "Ops queue", updatedAt: null },
      ],
      sessionActivity: {
        design: { working: true, unread: false },
        ops: { working: true, unread: true },
        detached: { working: true, unread: false },
      },
    }),
    {
      count: 3,
      sessionKeys: ["design", "ops", "detached"],
      title: "3 background sessions still working",
      detail:
        "\"Design review\", \"Ops queue\", and 1 more session are still running in the background. Check the sidebar to switch between them.",
    },
  );
});
