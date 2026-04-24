export type AppearanceMode = "light" | "dark";

export type AppearancePalette = {
  backgroundColor: string;
  backgroundElevatedColor: string;
  surfaceColor: string;
  borderColor: string;
  borderStrongColor: string;
  textColor: string;
  textSoftColor: string;
  textMutedColor: string;
  accentColor: string;
  accentSoftColor: string;
  userBubbleColor: string;
  assistantBubbleColor: string;
  markdownHeadingColor: string;
  markdownLinkColor: string;
  markdownBoldColor: string;
  markdownItalicColor: string;
  markdownCodeBg: string;
  markdownCodeText: string;
  markdownQuoteBg: string;
  markdownQuoteBorderColor: string;
};

export type AppearancePalettes = {
  light: AppearancePalette;
  dark: AppearancePalette;
};

export type AppearanceSettings = {
  appearanceMode: AppearanceMode;
  appearancePalettes: AppearancePalettes;
};

export type AppearanceModeToggleViewModel = {
  mode: AppearanceMode;
  targetMode: AppearanceMode;
  label: string;
  ariaLabel: string;
  pressed: boolean;
};

export const LIGHT_APPEARANCE_PALETTE: AppearancePalette = {
  backgroundColor: "#edf3f9",
  backgroundElevatedColor: "#f6f9fd",
  surfaceColor: "#ffffff",
  borderColor: "#d6e0ec",
  borderStrongColor: "#c2d0de",
  textColor: "#18181b",
  textSoftColor: "#3f3f46",
  textMutedColor: "#71717a",
  accentColor: "#18181b",
  accentSoftColor: "#f4f4f5",
  userBubbleColor: "#f4f4f5",
  assistantBubbleColor: "#ffffff",
  markdownHeadingColor: "#18181b",
  markdownLinkColor: "#18181b",
  markdownBoldColor: "#111827",
  markdownItalicColor: "#3f3f46",
  markdownCodeBg: "#f4f4f5",
  markdownCodeText: "#18181b",
  markdownQuoteBg: "#fafafa",
  markdownQuoteBorderColor: "#d4d4d8",
};

export const DARK_APPEARANCE_PALETTE: AppearancePalette = {
  backgroundColor: "#0f172a",
  backgroundElevatedColor: "#111827",
  surfaceColor: "#182235",
  borderColor: "#334155",
  borderStrongColor: "#475569",
  textColor: "#f8fafc",
  textSoftColor: "#cbd5e1",
  textMutedColor: "#94a3b8",
  accentColor: "#60a5fa",
  accentSoftColor: "#172554",
  userBubbleColor: "#263245",
  assistantBubbleColor: "#151f31",
  markdownHeadingColor: "#f8fafc",
  markdownLinkColor: "#bfdbfe",
  markdownBoldColor: "#ffffff",
  markdownItalicColor: "#cbd5e1",
  markdownCodeBg: "#0b1120",
  markdownCodeText: "#e2e8f0",
  markdownQuoteBg: "#111827",
  markdownQuoteBorderColor: "#64748b",
};

export const DEFAULT_APPEARANCE_PALETTES: AppearancePalettes = {
  light: LIGHT_APPEARANCE_PALETTE,
  dark: DARK_APPEARANCE_PALETTE,
};

const COLOR_SETTING_KEYS = [
  "backgroundColor",
  "backgroundElevatedColor",
  "surfaceColor",
  "borderColor",
  "borderStrongColor",
  "textColor",
  "textSoftColor",
  "textMutedColor",
  "accentColor",
  "accentSoftColor",
  "userBubbleColor",
  "assistantBubbleColor",
  "markdownHeadingColor",
  "markdownLinkColor",
  "markdownBoldColor",
  "markdownItalicColor",
  "markdownCodeBg",
  "markdownCodeText",
  "markdownQuoteBg",
  "markdownQuoteBorderColor",
] as const satisfies readonly (keyof AppearancePalette)[];

const COLOR_SYSTEM_PALETTE_KEYS = [
  "backgroundColor",
  "backgroundElevatedColor",
  "surfaceColor",
  "borderColor",
  "borderStrongColor",
  "textColor",
  "textSoftColor",
  "textMutedColor",
  "accentColor",
  "accentSoftColor",
  "userBubbleColor",
  "assistantBubbleColor",
] as const satisfies readonly (keyof AppearancePalette)[];

const MARKDOWN_PALETTE_KEYS = [
  "markdownHeadingColor",
  "markdownLinkColor",
  "markdownBoldColor",
  "markdownItalicColor",
  "markdownCodeBg",
  "markdownCodeText",
  "markdownQuoteBg",
  "markdownQuoteBorderColor",
] as const satisfies readonly (keyof AppearancePalette)[];

/** Returns a plain object record when localStorage JSON is object-shaped. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Accepts CSS color values from legacy settings while rejecting arbitrary strings. */
export function normalizeAppearanceColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed);
  const isRgb = /^rgba?\(\s*[-\d.%\s,]+\)$/i.test(trimmed);
  const isHsl = /^hsla?\(\s*[-\d.%\s,]+\)$/i.test(trimmed);
  return isHex || isRgb || isHsl ? trimmed : fallback;
}

/** Normalizes persisted mode values so old or malformed settings safely fall back to light. */
export function normalizeAppearanceMode(value: unknown): AppearanceMode {
  return value === "dark" ? "dark" : "light";
}

/** Builds the light-mode fallback palette from pre-appearance top-level color settings. */
function buildLegacyLightPaletteFallback(source: Record<string, unknown> | null): AppearancePalette {
  if (!source) {
    return { ...LIGHT_APPEARANCE_PALETTE };
  }
  const fallback = { ...LIGHT_APPEARANCE_PALETTE };
  for (const key of COLOR_SETTING_KEYS) {
    fallback[key] = normalizeAppearanceColor(source[key], fallback[key]);
  }
  return fallback;
}

/** Normalizes one palette, filling missing or invalid fields from the supplied fallback. */
export function normalizeAppearancePalette(
  value: unknown,
  fallback: AppearancePalette,
): AppearancePalette {
  const source = asRecord(value);
  const next = { ...fallback };
  if (!source) {
    return next;
  }
  for (const key of COLOR_SETTING_KEYS) {
    next[key] = normalizeAppearanceColor(source[key], fallback[key]);
  }
  return next;
}

/** Migrates legacy color settings into a complete two-mode appearance settings shape. */
export function normalizeAppearanceSettings(value: unknown): AppearanceSettings {
  const source = asRecord(value);
  const palettesSource = asRecord(source?.appearancePalettes);
  const lightFallback = buildLegacyLightPaletteFallback(source);
  return {
    appearanceMode: normalizeAppearanceMode(source?.appearanceMode),
    appearancePalettes: {
      light: normalizeAppearancePalette(palettesSource?.light, lightFallback),
      dark: normalizeAppearancePalette(palettesSource?.dark, DARK_APPEARANCE_PALETTE),
    },
  };
}

/** Reads the palette currently applied to the workstation. */
export function getActiveAppearancePalette(settings: AppearanceSettings): AppearancePalette {
  return settings.appearancePalettes[settings.appearanceMode] ?? LIGHT_APPEARANCE_PALETTE;
}

/** Switches modes without copying colors between light and dark palettes. */
export function setAppearanceMode<T extends AppearanceSettings>(
  settings: T,
  mode: AppearanceMode,
): T {
  return {
    ...settings,
    appearanceMode: normalizeAppearanceMode(mode),
  };
}

/** Patches only the active palette and keeps in-progress color text editable. */
export function patchActiveAppearancePalette<T extends AppearanceSettings>(
  settings: T,
  patch: Partial<AppearancePalette>,
): T {
  const activeMode = settings.appearanceMode;
  const current = getActiveAppearancePalette(settings);
  const nextPalette = { ...current };
  for (const key of COLOR_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const nextValue = patch[key];
      if (typeof nextValue === "string") {
        nextPalette[key] = nextValue;
      }
    }
  }
  return {
    ...settings,
    appearancePalettes: {
      ...settings.appearancePalettes,
      [activeMode]: nextPalette,
    },
  };
}

/** Resets shell, accent, and bubble colors for the active mode only. */
export function resetActiveAppearanceColorSystem<T extends AppearanceSettings>(settings: T): T {
  const defaults = DEFAULT_APPEARANCE_PALETTES[settings.appearanceMode];
  const patch: Partial<AppearancePalette> = {};
  for (const key of COLOR_SYSTEM_PALETTE_KEYS) {
    patch[key] = defaults[key];
  }
  return patchActiveAppearancePalette(settings, patch);
}

/** Resets markdown readability colors for the active mode only. */
export function resetActiveAppearanceMarkdown<T extends AppearanceSettings>(settings: T): T {
  const defaults = DEFAULT_APPEARANCE_PALETTES[settings.appearanceMode];
  const patch: Partial<AppearancePalette> = {};
  for (const key of MARKDOWN_PALETTE_KEYS) {
    patch[key] = defaults[key];
  }
  return patchActiveAppearancePalette(settings, patch);
}

/** Filters unfinished color drafts before values are applied to CSS custom properties. */
function getSafeActiveAppearancePalette(settings: AppearanceSettings): AppearancePalette {
  const mode = normalizeAppearanceMode(settings.appearanceMode);
  const palette = getActiveAppearancePalette(settings);
  const fallback = DEFAULT_APPEARANCE_PALETTES[mode];
  const safePalette = { ...fallback };
  for (const key of COLOR_SETTING_KEYS) {
    safePalette[key] = normalizeAppearanceColor(palette[key], fallback[key]);
  }
  return safePalette;
}

/** Maps the active palette to root CSS variables in one testable place. */
export function deriveAppearanceCssVariables(settings: AppearanceSettings): Record<string, string> {
  const palette = getSafeActiveAppearancePalette(settings);
  return {
    "--claw-bg": palette.backgroundColor,
    "--claw-bg-elevated": palette.backgroundElevatedColor,
    "--claw-surface": palette.surfaceColor,
    "--claw-border": palette.borderColor,
    "--claw-border-strong": palette.borderStrongColor,
    "--claw-text": palette.textColor,
    "--claw-text-soft": palette.textSoftColor,
    "--claw-text-muted": palette.textMutedColor,
    "--claw-accent": palette.accentColor,
    "--claw-accent-soft": palette.accentSoftColor,
    "--claw-user-bubble": palette.userBubbleColor,
    "--claw-assistant-bubble": palette.assistantBubbleColor,
    "--claw-md-heading": palette.markdownHeadingColor,
    "--claw-md-link": palette.markdownLinkColor,
    "--claw-md-strong": palette.markdownBoldColor,
    "--claw-md-em": palette.markdownItalicColor,
    "--claw-md-code-bg": palette.markdownCodeBg,
    "--claw-md-code-text": palette.markdownCodeText,
    "--claw-md-quote-bg": palette.markdownQuoteBg,
    "--claw-md-quote-border": palette.markdownQuoteBorderColor,
    "--claw-neutral-0": palette.surfaceColor,
    "--claw-neutral-25": palette.backgroundElevatedColor,
    "--claw-neutral-50": palette.backgroundElevatedColor,
    "--claw-neutral-100": palette.accentSoftColor,
    "--claw-neutral-200": palette.borderColor,
    "--claw-neutral-300": palette.borderStrongColor,
    "--claw-neutral-400": palette.textMutedColor,
    "--claw-neutral-500": palette.textMutedColor,
    "--claw-neutral-700": palette.textSoftColor,
    "--claw-neutral-900": palette.textColor,
    "--frost-bg": palette.backgroundColor,
    "--frost-surface": palette.surfaceColor,
    "--frost-border": palette.borderColor,
    "--frost-border-strong": palette.borderStrongColor,
    "--frost-warm": `color-mix(in srgb, ${palette.accentSoftColor} 72%, ${palette.surfaceColor})`,
    "--frost-warm-hover": `color-mix(in srgb, ${palette.accentSoftColor} 58%, ${palette.surfaceColor})`,
    "--frost-warm-active": `color-mix(in srgb, ${palette.accentSoftColor} 88%, ${palette.surfaceColor})`,
    "--frost-warm-border": `color-mix(in srgb, ${palette.accentColor} 46%, ${palette.borderColor})`,
    "--frost-warm-glow": `color-mix(in srgb, ${palette.accentColor} 26%, transparent)`,
    "--frost-glass-bg": `color-mix(in srgb, ${palette.surfaceColor} 74%, transparent)`,
    "--frost-glass-border": `color-mix(in srgb, ${palette.borderColor} 68%, transparent)`,
    "--frost-menu-bg": palette.surfaceColor,
  };
}

/** Produces the compact labels and accessible state used by the shell toggle. */
export function getAppearanceModeToggleViewModel(
  value: AppearanceMode,
): AppearanceModeToggleViewModel {
  const mode = normalizeAppearanceMode(value);
  const targetMode: AppearanceMode = mode === "dark" ? "light" : "dark";
  const currentLabel = mode === "dark" ? "Dark" : "Light";
  const targetLabel = targetMode === "dark" ? "dark" : "light";
  return {
    mode,
    targetMode,
    label: currentLabel,
    ariaLabel: `Appearance mode: ${currentLabel}. Switch to ${targetLabel} mode.`,
    pressed: mode === "dark",
  };
}
