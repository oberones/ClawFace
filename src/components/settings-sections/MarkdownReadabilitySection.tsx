import React from "react";
import type { AppearanceMode, AppearancePalette } from "../../lib/appearance-mode.ts";
import { ColorField } from "./SettingsFieldControls.tsx";

type MarkdownReadabilitySectionProps = {
  appearanceMode: AppearanceMode;
  palette: AppearancePalette;
  onPatch: (next: Partial<AppearancePalette>) => void;
  onReset: () => void;
};

/** Edits markdown colors for the active appearance mode only. */
export function MarkdownReadabilitySection(props: MarkdownReadabilitySectionProps) {
  const modeLabel = props.appearanceMode === "dark" ? "dark" : "light";
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
      <p className="setting-helper-text">Editing {modeLabel} markdown colors.</p>
      <div className="setting-fields">
        <ColorField
          label="Heading color"
          value={props.palette.markdownHeadingColor}
          onChange={(value) => props.onPatch({ markdownHeadingColor: value })}
        />
        <ColorField
          label="Link color"
          value={props.palette.markdownLinkColor}
          onChange={(value) => props.onPatch({ markdownLinkColor: value })}
        />
        <ColorField
          label="Bold text color"
          value={props.palette.markdownBoldColor}
          onChange={(value) => props.onPatch({ markdownBoldColor: value })}
        />
        <ColorField
          label="Italic text color"
          value={props.palette.markdownItalicColor}
          onChange={(value) => props.onPatch({ markdownItalicColor: value })}
        />
        <ColorField
          label="Code background"
          value={props.palette.markdownCodeBg}
          onChange={(value) => props.onPatch({ markdownCodeBg: value })}
        />
        <ColorField
          label="Code text"
          value={props.palette.markdownCodeText}
          onChange={(value) => props.onPatch({ markdownCodeText: value })}
        />
        <ColorField
          label="Quote background"
          value={props.palette.markdownQuoteBg}
          onChange={(value) => props.onPatch({ markdownQuoteBg: value })}
        />
        <ColorField
          label="Quote border"
          value={props.palette.markdownQuoteBorderColor}
          onChange={(value) => props.onPatch({ markdownQuoteBorderColor: value })}
        />
      </div>
    </section>
  );
}
