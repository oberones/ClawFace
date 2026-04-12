import React from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import { ColorField } from "./SettingsFieldControls.tsx";

type MarkdownReadabilitySectionProps = {
  uiSettings: UiSettings;
  onPatch: (next: Partial<UiSettings>) => void;
  onReset: () => void;
};

export function MarkdownReadabilitySection(props: MarkdownReadabilitySectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Markdown Readability</h3>
        <button
          type="button"
          onClick={props.onReset}
          className="ui-btn ui-btn-light section-reset-btn"
        >
          Reset Section
        </button>
      </div>
      <div className="setting-fields">
        <ColorField
          label="Heading color"
          value={props.uiSettings.markdownHeadingColor}
          onChange={(value) => props.onPatch({ markdownHeadingColor: value })}
        />
        <ColorField
          label="Link color"
          value={props.uiSettings.markdownLinkColor}
          onChange={(value) => props.onPatch({ markdownLinkColor: value })}
        />
        <ColorField
          label="Bold text color"
          value={props.uiSettings.markdownBoldColor}
          onChange={(value) => props.onPatch({ markdownBoldColor: value })}
        />
        <ColorField
          label="Italic text color"
          value={props.uiSettings.markdownItalicColor}
          onChange={(value) => props.onPatch({ markdownItalicColor: value })}
        />
        <ColorField
          label="Code background"
          value={props.uiSettings.markdownCodeBg}
          onChange={(value) => props.onPatch({ markdownCodeBg: value })}
        />
        <ColorField
          label="Code text"
          value={props.uiSettings.markdownCodeText}
          onChange={(value) => props.onPatch({ markdownCodeText: value })}
        />
        <ColorField
          label="Quote background"
          value={props.uiSettings.markdownQuoteBg}
          onChange={(value) => props.onPatch({ markdownQuoteBg: value })}
        />
        <ColorField
          label="Quote border"
          value={props.uiSettings.markdownQuoteBorderColor}
          onChange={(value) => props.onPatch({ markdownQuoteBorderColor: value })}
        />
      </div>
    </section>
  );
}
