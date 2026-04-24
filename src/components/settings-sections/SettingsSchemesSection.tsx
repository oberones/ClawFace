import React from "react";
import type { UiSettingsSchemeSummary } from "./SettingsSectionTypes.ts";

type SettingsSchemesSectionProps = {
  activeUiSettingsSchemeId: string;
  builtinSchemeId: string;
  schemeNameDraft: string;
  uiSettingsSchemes: UiSettingsSchemeSummary[];
  onSchemeNameDraftChange: (value: string) => void;
  onApplyUiSettingsScheme: (schemeId: string) => void;
  onSaveUiSettingsScheme: (name: string) => void;
  onOverwriteUiSettingsScheme: (schemeId: string) => void;
  onDeleteUiSettingsScheme: (schemeId: string) => void;
};

/** Renders saved UI schemes and explains their appearance-mode scope. */
export function SettingsSchemesSection(props: SettingsSchemesSectionProps) {
  const canOverwriteOrDeleteScheme = props.activeUiSettingsSchemeId !== props.builtinSchemeId;
  const canSaveScheme = props.schemeNameDraft.trim().length > 0;

  const handleSaveScheme = () => {
    const nextName = props.schemeNameDraft.trim();
    if (!nextName) {
      return;
    }
    props.onSaveUiSettingsScheme(nextName);
    props.onSchemeNameDraftChange("");
  };

  return (
    <section className="setting-card setting-card-wide">
      <div className="setting-head">
        <h3 className="setting-title">Settings Schemes</h3>
      </div>
      <p className="setting-helper-text">Schemes include appearance mode and both light/dark color palettes.</p>
      <div className="setting-fields">
        <label className="field-block">
          <span className="field-label">Apply saved scheme</span>
          <select
            value={props.activeUiSettingsSchemeId}
            onChange={(e) => props.onApplyUiSettingsScheme(e.target.value)}
            className="ui-input scheme-select"
          >
            <option value={props.builtinSchemeId}>Default</option>
            {props.uiSettingsSchemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </select>
        </label>
        <div className="scheme-save-row">
          <label className="field-block">
            <span className="field-label">Save current settings as new scheme</span>
            <input
              value={props.schemeNameDraft}
              onChange={(e) => props.onSchemeNameDraftChange(e.target.value)}
              className="ui-input"
              placeholder="e.g. Focus mode"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveScheme}
            className="ui-btn ui-btn-primary"
            disabled={!canSaveScheme}
          >
            Save New
          </button>
        </div>
        <div className="scheme-actions">
          <button
            type="button"
            onClick={() => props.onOverwriteUiSettingsScheme(props.activeUiSettingsSchemeId)}
            className="ui-btn ui-btn-light"
            disabled={!canOverwriteOrDeleteScheme}
          >
            Overwrite Selected
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canOverwriteOrDeleteScheme) {
                return;
              }
              const target = props.uiSettingsSchemes.find(
                (scheme) => scheme.id === props.activeUiSettingsSchemeId,
              );
              const confirmed = window.confirm(
                `Delete settings scheme "${target?.name ?? "selected"}"?`,
              );
              if (confirmed) {
                props.onDeleteUiSettingsScheme(props.activeUiSettingsSchemeId);
              }
            }}
            className="ui-btn ui-btn-light"
            disabled={!canOverwriteOrDeleteScheme}
          >
            Delete Selected
          </button>
        </div>
      </div>
    </section>
  );
}
