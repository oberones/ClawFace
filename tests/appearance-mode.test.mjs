import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadAppearanceModeModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/appearance-mode.ts"));
}

test("normalizeAppearanceSettings migrates legacy colors into the light palette", () => {
  const {
    DARK_APPEARANCE_PALETTE,
    normalizeAppearanceSettings,
  } = loadAppearanceModeModule();

  const settings = normalizeAppearanceSettings({
    appearanceMode: "midnight",
    accentColor: "#123456",
    assistantBubbleColor: "#fefefe",
    markdownCodeBg: "not-a-color",
  });

  assert.equal(settings.appearanceMode, "light");
  assert.equal(settings.appearancePalettes.light.accentColor, "#123456");
  assert.equal(settings.appearancePalettes.light.assistantBubbleColor, "#fefefe");
  assert.equal(settings.appearancePalettes.light.markdownCodeBg, "#f4f4f5");
  assert.deepEqual(settings.appearancePalettes.dark, DARK_APPEARANCE_PALETTE);
});

test("normalizeAppearanceSettings keeps provided palettes but repairs invalid fields", () => {
  const {
    DARK_APPEARANCE_PALETTE,
    normalizeAppearanceSettings,
  } = loadAppearanceModeModule();

  const settings = normalizeAppearanceSettings({
    appearanceMode: "dark",
    appearancePalettes: {
      dark: {
        backgroundColor: "#010203",
        textColor: "bogus",
      },
    },
  });

  assert.equal(settings.appearanceMode, "dark");
  assert.equal(settings.appearancePalettes.dark.backgroundColor, "#010203");
  assert.equal(settings.appearancePalettes.dark.textColor, DARK_APPEARANCE_PALETTE.textColor);
});

test("setAppearanceMode and patchActiveAppearancePalette preserve inactive palettes", () => {
  const {
    DEFAULT_APPEARANCE_PALETTES,
    patchActiveAppearancePalette,
    setAppearanceMode,
  } = loadAppearanceModeModule();

  const original = {
    appearanceMode: "light",
    appearancePalettes: {
      light: { ...DEFAULT_APPEARANCE_PALETTES.light },
      dark: { ...DEFAULT_APPEARANCE_PALETTES.dark },
    },
    fontFamily: "Manrope",
  };

  const dark = setAppearanceMode(original, "dark");
  const patched = patchActiveAppearancePalette(dark, { accentColor: "#abcdef" });

  assert.equal(patched.fontFamily, "Manrope");
  assert.equal(patched.appearancePalettes.dark.accentColor, "#abcdef");
  assert.equal(patched.appearancePalettes.light.accentColor, DEFAULT_APPEARANCE_PALETTES.light.accentColor);
  assert.equal(original.appearancePalettes.dark.accentColor, DEFAULT_APPEARANCE_PALETTES.dark.accentColor);
});

test("active palette resets affect only the active section and mode", () => {
  const {
    DEFAULT_APPEARANCE_PALETTES,
    resetActiveAppearanceColorSystem,
    resetActiveAppearanceMarkdown,
  } = loadAppearanceModeModule();

  const settings = {
    appearanceMode: "dark",
    appearancePalettes: {
      light: {
        ...DEFAULT_APPEARANCE_PALETTES.light,
        accentColor: "#111111",
        markdownLinkColor: "#222222",
      },
      dark: {
        ...DEFAULT_APPEARANCE_PALETTES.dark,
        accentColor: "#333333",
        markdownLinkColor: "#444444",
      },
    },
  };

  const colorReset = resetActiveAppearanceColorSystem(settings);
  assert.equal(colorReset.appearancePalettes.dark.accentColor, DEFAULT_APPEARANCE_PALETTES.dark.accentColor);
  assert.equal(colorReset.appearancePalettes.dark.markdownLinkColor, "#444444");
  assert.equal(colorReset.appearancePalettes.light.accentColor, "#111111");

  const markdownReset = resetActiveAppearanceMarkdown(settings);
  assert.equal(markdownReset.appearancePalettes.dark.markdownLinkColor, DEFAULT_APPEARANCE_PALETTES.dark.markdownLinkColor);
  assert.equal(markdownReset.appearancePalettes.dark.accentColor, "#333333");
  assert.equal(markdownReset.appearancePalettes.light.markdownLinkColor, "#222222");
});

test("deriveAppearanceCssVariables maps active palette values to root tokens", () => {
  const {
    DEFAULT_APPEARANCE_PALETTES,
    deriveAppearanceCssVariables,
  } = loadAppearanceModeModule();

  const variables = deriveAppearanceCssVariables({
    appearanceMode: "dark",
    appearancePalettes: {
      light: { ...DEFAULT_APPEARANCE_PALETTES.light },
      dark: {
        ...DEFAULT_APPEARANCE_PALETTES.dark,
        backgroundColor: "#101010",
        textColor: "#eeeeee",
        markdownLinkColor: "#7dd3fc",
      },
    },
  });

  assert.equal(variables["--claw-bg"], "#101010");
  assert.equal(variables["--claw-text"], "#eeeeee");
  assert.equal(variables["--claw-md-link"], "#7dd3fc");
  assert.equal(variables["--claw-neutral-900"], "#eeeeee");
  assert.equal(variables["--frost-bg"], "#101010");
  assert.equal(variables["--frost-surface"], DEFAULT_APPEARANCE_PALETTES.dark.surfaceColor);
  assert.equal(
    variables["--frost-glass-bg"],
    `color-mix(in srgb, ${DEFAULT_APPEARANCE_PALETTES.dark.surfaceColor} 74%, transparent)`,
  );
  assert.equal(
    variables["--frost-warm-active"],
    `color-mix(in srgb, ${DEFAULT_APPEARANCE_PALETTES.dark.accentSoftColor} 88%, ${DEFAULT_APPEARANCE_PALETTES.dark.surfaceColor})`,
  );
});

test("getAppearanceModeToggleViewModel exposes labels and accessible action state", () => {
  const { getAppearanceModeToggleViewModel } = loadAppearanceModeModule();

  const dark = getAppearanceModeToggleViewModel("dark");
  assert.equal(dark.label, "Dark");
  assert.equal(dark.targetMode, "light");
  assert.equal(dark.pressed, true);
  assert.match(dark.ariaLabel, /Switch to light mode/);

  const light = getAppearanceModeToggleViewModel("light");
  assert.equal(light.label, "Light");
  assert.equal(light.targetMode, "dark");
  assert.equal(light.pressed, false);
  assert.match(light.ariaLabel, /Switch to dark mode/);
});
