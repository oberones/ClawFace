import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSessionLabelOverridesModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/session-label-overrides.ts"));
}

test("normalizeSessionLabel trims, collapses whitespace, and rejects non-strings", () => {
  const { normalizeSessionLabel } = loadSessionLabelOverridesModule();

  assert.equal(normalizeSessionLabel("  Sprint\n\nplanning\tchat  "), "Sprint planning chat");
  assert.equal(normalizeSessionLabel(null), "");
  assert.equal(normalizeSessionLabel("   "), "");
});

test("normalizeSessionLabelOverrides keeps only keyed non-empty labels", () => {
  const { normalizeSessionLabelOverrides } = loadSessionLabelOverridesModule();

  assert.deepEqual(
    normalizeSessionLabelOverrides({
      " agent:main:ui:chat ": { label: " Friendly name ", updatedAt: 42 },
      "agent:main:ui:blank": { label: "" },
      "agent:main:ui:bad": null,
    }),
    {
      "agent:main:ui:chat": { label: "Friendly name", updatedAt: 42 },
    },
  );
});

test("applySessionLabelOverridesToRows lets ClawFace labels override imported session names", () => {
  const { applySessionLabelOverridesToRows } = loadSessionLabelOverridesModule();

  const rows = [
    {
      key: "agent:main:ui:imported",
      kind: "direct",
      label: "agent-main-ui-imported-1234",
      derivedTitle: "Strange imported name",
      updatedAt: 10,
    },
    {
      key: "agent:main:ui:plain",
      kind: "direct",
      derivedTitle: "Backend title",
      updatedAt: 20,
    },
  ];

  assert.deepEqual(
    applySessionLabelOverridesToRows(rows, {
      "agent:main:ui:imported": { label: "Project follow-up", updatedAt: 30 },
    }),
    [
      {
        key: "agent:main:ui:imported",
        kind: "direct",
        label: "Project follow-up",
        derivedTitle: "Strange imported name",
        updatedAt: 10,
      },
      {
        key: "agent:main:ui:plain",
        kind: "direct",
        derivedTitle: "Backend title",
        updatedAt: 20,
      },
    ],
  );
});

test("session label override helpers upsert, move, and remove by session key", () => {
  const {
    moveSessionLabelOverride,
    removeSessionLabelOverride,
    upsertSessionLabelOverride,
  } = loadSessionLabelOverridesModule();

  const created = upsertSessionLabelOverride({}, "old-key", "Original title", 10);
  assert.deepEqual(created, { "old-key": { label: "Original title", updatedAt: 10 } });

  const moved = moveSessionLabelOverride(created, "old-key", "new-key");
  assert.deepEqual(moved, { "new-key": { label: "Original title", updatedAt: 10 } });

  assert.deepEqual(removeSessionLabelOverride(moved, "new-key"), {});
});
