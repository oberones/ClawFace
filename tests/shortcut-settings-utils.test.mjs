import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShortcutSettingsUtilsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(
    path.join(repoRoot, "src/components/settings-sections/shortcut-settings-utils.ts"),
  );
}

test("normalizeShortcutKeyInput accepts letters and numbers and rejects other keys", () => {
  const { normalizeShortcutKeyInput } = loadShortcutSettingsUtilsModule();

  assert.equal(normalizeShortcutKeyInput("A"), "a");
  assert.equal(normalizeShortcutKeyInput(" 7 "), "7");
  assert.equal(normalizeShortcutKeyInput("/"), null);
  assert.equal(normalizeShortcutKeyInput(""), null);
});

test("normalizeShortcutEventKey prefers code-based keyboard mappings", () => {
  const { normalizeShortcutEventKey } = loadShortcutSettingsUtilsModule();

  assert.equal(normalizeShortcutEventKey("KeyA", "x"), "a");
  assert.equal(normalizeShortcutEventKey("Digit3", "%"), "3");
  assert.equal(normalizeShortcutEventKey("Numpad7", "Home"), "7");
  assert.equal(normalizeShortcutEventKey("Slash", "/"), null);
});

test("formatThinkingLabel returns Off for empty input and capitalizes known values", () => {
  const { formatThinkingLabel } = loadShortcutSettingsUtilsModule();

  assert.equal(formatThinkingLabel(""), "Off");
  assert.equal(formatThinkingLabel("medium"), "Medium");
  assert.equal(formatThinkingLabel(" HIGH "), "High");
});
