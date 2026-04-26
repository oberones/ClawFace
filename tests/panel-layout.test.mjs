import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPanelLayoutModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/panel-layout.ts"));
}

test("clampPanelWidth keeps panel widths inside configured bounds", () => {
  const { clampPanelWidth } = loadPanelLayoutModule();

  assert.equal(clampPanelWidth(180, 220, 420), 220);
  assert.equal(clampPanelWidth(320, 220, 420), 320);
  assert.equal(clampPanelWidth(520, 220, 420), 420);
  assert.equal(clampPanelWidth(Number.NaN, 220, 420), 220);
});

test("resolvePanelResizeWidth maps horizontal drag direction to the owned panel", () => {
  const { resolvePanelResizeWidth } = loadPanelLayoutModule();

  assert.equal(
    resolvePanelResizeWidth({
      initialWidth: 300,
      deltaX: 24,
      direction: "increase-right",
      min: 220,
      max: 420,
    }),
    324,
  );
  assert.equal(
    resolvePanelResizeWidth({
      initialWidth: 520,
      deltaX: -24,
      direction: "increase-left",
      min: 360,
      max: 680,
    }),
    544,
  );
});

test("resolvePanelResizeKeyboardWidth supports regular and large arrow steps", () => {
  const { resolvePanelResizeKeyboardWidth } = loadPanelLayoutModule();

  assert.equal(
    resolvePanelResizeKeyboardWidth({
      currentWidth: 300,
      key: "ArrowRight",
      shiftKey: false,
      direction: "increase-right",
      min: 220,
      max: 420,
    }),
    310,
  );
  assert.equal(
    resolvePanelResizeKeyboardWidth({
      currentWidth: 520,
      key: "ArrowLeft",
      shiftKey: true,
      direction: "increase-left",
      min: 360,
      max: 680,
    }),
    560,
  );
  assert.equal(
    resolvePanelResizeKeyboardWidth({
      currentWidth: 520,
      key: "Home",
      shiftKey: false,
      direction: "increase-left",
      min: 360,
      max: 680,
    }),
    null,
  );
});
