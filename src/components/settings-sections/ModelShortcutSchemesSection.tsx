import React from "react";
import {
  ShortcutKeyConfigField,
  ShortcutModifierEditor,
} from "./ShortcutSettingsShared.tsx";
import type { ModelShortcutSchemeEntry } from "./SettingsSectionTypes.ts";
import {
  formatShortcutUpdatedAt,
  formatThinkingLabel,
  type ShortcutCombo,
} from "./shortcut-settings-utils.ts";

type ModelShortcutSchemesSectionProps = {
  modelShortcutSchemes: ModelShortcutSchemeEntry[];
  currentModelForShortcut: string;
  currentThinkingForShortcut: string;
  onSaveModelShortcutScheme: (slot: number) => void;
  onApplyModelShortcutScheme: (slot: number) => void;
  onChangeModelShortcutSchemeCombo: (slot: number, combo: ShortcutCombo) => void;
  onDeleteModelShortcutScheme: (slot: number) => void;
};

export function ModelShortcutSchemesSection(props: ModelShortcutSchemesSectionProps) {
  const canSaveModelShortcutScheme = props.currentModelForShortcut.trim().length > 0;

  return (
    <section className="setting-card setting-card-wide">
      <div className="setting-head">
        <h3 className="setting-title">Model Shortcut Schemes</h3>
      </div>
      <div className="setting-fields">
        <div className="field-block">
          <span className="field-label">Current model + thinking combination</span>
          <span className="field-label shortcut-current-line">
            {canSaveModelShortcutScheme
              ? `${props.currentModelForShortcut} · thinking ${formatThinkingLabel(props.currentThinkingForShortcut)}`
              : "No active model found in current session yet."}
          </span>
          <span className="field-label">
            Keep up to 5 schemes. Each scheme supports Cmd/Control/Option/Shift + letter or
            number.
          </span>
        </div>
        <div className="shortcut-scheme-list">
          {props.modelShortcutSchemes.map((entry) => {
            const scheme = entry.scheme;
            return (
              <div key={entry.slot} className="shortcut-scheme-row">
                <div className="shortcut-scheme-summary">
                  <div className="shortcut-scheme-top">
                    <span className="shortcut-scheme-key">{entry.shortcutLabel}</span>
                    <ShortcutKeyConfigField
                      combo={entry.combo}
                      disabled={!scheme}
                      ariaLabel={`Shortcut key for slot ${entry.slot}`}
                      onChangeCombo={(combo) => props.onChangeModelShortcutSchemeCombo(entry.slot, combo)}
                    />
                  </div>
                  <ShortcutModifierEditor
                    combo={entry.combo}
                    disabled={!scheme}
                    onChangeCombo={(combo) => props.onChangeModelShortcutSchemeCombo(entry.slot, combo)}
                  />
                  {scheme ? (
                    <div className="shortcut-scheme-copy">
                      <span className="shortcut-scheme-model">{scheme.model}</span>
                      <span className="field-label">
                        Thinking: {formatThinkingLabel(scheme.thinkingLevel)} · Saved{" "}
                        {formatShortcutUpdatedAt(scheme.updatedAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="field-label">No scheme saved for this slot.</span>
                  )}
                </div>
                <div className="scheme-actions shortcut-scheme-actions">
                  <button
                    type="button"
                    onClick={() => props.onSaveModelShortcutScheme(entry.slot)}
                    className="ui-btn ui-btn-primary"
                    disabled={!canSaveModelShortcutScheme}
                  >
                    Save Current
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onApplyModelShortcutScheme(entry.slot)}
                    className="ui-btn ui-btn-light"
                    disabled={!scheme}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDeleteModelShortcutScheme(entry.slot)}
                    className="ui-btn ui-btn-light"
                    disabled={!scheme}
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
