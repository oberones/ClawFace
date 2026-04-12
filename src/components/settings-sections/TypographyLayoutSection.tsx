import React from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import { NumberField } from "./SettingsFieldControls.tsx";

const FONT_OPTIONS = [
  "Plus Jakarta Sans",
  "Space Grotesk",
  "Manrope",
  "IBM Plex Sans",
  "Inter",
  "Segoe UI",
  "Roboto",
  "Arial",
];

type TypographyLayoutSectionProps = {
  uiSettings: UiSettings;
  onPatch: (next: Partial<UiSettings>) => void;
  onReset: () => void;
};

export function TypographyLayoutSection(props: TypographyLayoutSectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Typography & Layout</h3>
        <button
          type="button"
          onClick={props.onReset}
          className="ui-btn ui-btn-light section-reset-btn"
        >
          Reset Section
        </button>
      </div>
      <div className="setting-fields">
        <label className="field-block">
          <span className="field-label">Font family</span>
          <input
            value={props.uiSettings.fontFamily}
            onChange={(e) =>
              props.onPatch({ fontFamily: e.target.value.trim() || "Plus Jakarta Sans" })
            }
            list="clawui-fonts"
            className="ui-input"
            placeholder="e.g. Plus Jakarta Sans, Inter"
          />
          <datalist id="clawui-fonts">
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font} />
            ))}
          </datalist>
        </label>

        <NumberField
          label="Base font size"
          value={props.uiSettings.fontSize}
          min={10}
          max={32}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ fontSize: value })}
        />
        <NumberField
          label="Line height"
          value={props.uiSettings.lineHeight}
          min={1.1}
          max={2.8}
          step={0.01}
          onChange={(value) => props.onPatch({ lineHeight: value })}
        />
        <NumberField
          label="Content width"
          value={props.uiSettings.contentWidth}
          min={420}
          max={1400}
          step={10}
          suffix="px"
          onChange={(value) => props.onPatch({ contentWidth: value })}
        />
        <NumberField
          label="Sidebar width"
          value={props.uiSettings.sidebarWidth}
          min={220}
          max={420}
          step={2}
          suffix="px"
          onChange={(value) => props.onPatch({ sidebarWidth: value })}
        />
        <NumberField
          label="Sidebar font size"
          value={props.uiSettings.sidebarFontSize}
          min={10}
          max={18}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ sidebarFontSize: value })}
        />
        <NumberField
          label="Session indicator width"
          value={props.uiSettings.sessionIndicatorWidth}
          min={1}
          max={10}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ sessionIndicatorWidth: value })}
        />
        <NumberField
          label="Message gap"
          value={props.uiSettings.messageGap}
          min={8}
          max={30}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ messageGap: value })}
        />
        <NumberField
          label="Bubble radius"
          value={props.uiSettings.chatBubbleRadius}
          min={10}
          max={28}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ chatBubbleRadius: value })}
        />
      </div>
    </section>
  );
}
