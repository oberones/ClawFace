import React from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import type { AppearanceMode, AppearancePalette } from "../../lib/appearance-mode.ts";
import { ColorField, NumberField } from "./SettingsFieldControls.tsx";

type ColorSystemSectionProps = {
  appearanceMode: AppearanceMode;
  palette: AppearancePalette;
  uiSettings: UiSettings;
  onSettingsPatch: (next: Partial<UiSettings>) => void;
  onPalettePatch: (next: Partial<AppearancePalette>) => void;
  onReset: () => void;
};

/** Renders global visual controls plus active-mode palette controls in one settings card. */
export function ColorSystemSection(props: ColorSystemSectionProps) {
  const modeLabel = props.appearanceMode === "dark" ? "dark" : "light";
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Color System</h3>
        <button
          type="button"
          onClick={props.onReset}
          className="ui-btn ui-btn-light section-reset-btn"
        >
          Reset Section
        </button>
      </div>
      <p className="setting-helper-text">Editing {modeLabel} colors. Other mode colors are preserved.</p>
      <div className="setting-fields">
        <NumberField
          label="Panel opacity"
          value={props.uiSettings.panelOpacity}
          min={75}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => props.onSettingsPatch({ panelOpacity: value })}
        />
        <NumberField
          label="Background pattern strength"
          value={props.uiSettings.backgroundPatternStrength}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => props.onSettingsPatch({ backgroundPatternStrength: value })}
        />

        <ColorField
          label="Background"
          value={props.palette.backgroundColor}
          onChange={(value) => props.onPalettePatch({ backgroundColor: value })}
        />
        <ColorField
          label="Elevated background"
          value={props.palette.backgroundElevatedColor}
          onChange={(value) => props.onPalettePatch({ backgroundElevatedColor: value })}
        />
        <ColorField
          label="Surface"
          value={props.palette.surfaceColor}
          onChange={(value) => props.onPalettePatch({ surfaceColor: value })}
        />
        <ColorField
          label="Border"
          value={props.palette.borderColor}
          onChange={(value) => props.onPalettePatch({ borderColor: value })}
        />
        <ColorField
          label="Strong border"
          value={props.palette.borderStrongColor}
          onChange={(value) => props.onPalettePatch({ borderStrongColor: value })}
        />
        <ColorField
          label="Primary text"
          value={props.palette.textColor}
          onChange={(value) => props.onPalettePatch({ textColor: value })}
        />
        <ColorField
          label="Secondary text"
          value={props.palette.textSoftColor}
          onChange={(value) => props.onPalettePatch({ textSoftColor: value })}
        />
        <ColorField
          label="Muted text"
          value={props.palette.textMutedColor}
          onChange={(value) => props.onPalettePatch({ textMutedColor: value })}
        />
        <ColorField
          label="Accent"
          value={props.palette.accentColor}
          onChange={(value) => props.onPalettePatch({ accentColor: value })}
        />
        <ColorField
          label="Accent soft"
          value={props.palette.accentSoftColor}
          onChange={(value) => props.onPalettePatch({ accentSoftColor: value })}
        />
        <ColorField
          label="User bubble"
          value={props.palette.userBubbleColor}
          onChange={(value) => props.onPalettePatch({ userBubbleColor: value })}
        />
        <ColorField
          label="Assistant bubble"
          value={props.palette.assistantBubbleColor}
          onChange={(value) => props.onPalettePatch({ assistantBubbleColor: value })}
        />
      </div>
    </section>
  );
}
