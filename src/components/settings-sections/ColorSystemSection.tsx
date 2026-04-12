import React from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import { ColorField, NumberField } from "./SettingsFieldControls.tsx";

type ColorSystemSectionProps = {
  uiSettings: UiSettings;
  onPatch: (next: Partial<UiSettings>) => void;
  onReset: () => void;
};

export function ColorSystemSection(props: ColorSystemSectionProps) {
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
      <div className="setting-fields">
        <NumberField
          label="Panel opacity"
          value={props.uiSettings.panelOpacity}
          min={75}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => props.onPatch({ panelOpacity: value })}
        />
        <NumberField
          label="Background pattern strength"
          value={props.uiSettings.backgroundPatternStrength}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => props.onPatch({ backgroundPatternStrength: value })}
        />

        <ColorField
          label="Accent"
          value={props.uiSettings.accentColor}
          onChange={(value) => props.onPatch({ accentColor: value })}
        />
        <ColorField
          label="Accent soft"
          value={props.uiSettings.accentSoftColor}
          onChange={(value) => props.onPatch({ accentSoftColor: value })}
        />
        <ColorField
          label="User bubble"
          value={props.uiSettings.userBubbleColor}
          onChange={(value) => props.onPatch({ userBubbleColor: value })}
        />
        <ColorField
          label="Assistant bubble"
          value={props.uiSettings.assistantBubbleColor}
          onChange={(value) => props.onPatch({ assistantBubbleColor: value })}
        />
      </div>
    </section>
  );
}
