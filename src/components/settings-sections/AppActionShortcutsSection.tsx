import React from "react";
import {
  ShortcutKeyConfigField,
  ShortcutModifierEditor,
} from "./ShortcutSettingsShared.tsx";
import type { AppActionShortcutEntry } from "./SettingsSectionTypes.ts";
import type { AppActionShortcutId, ShortcutCombo } from "./shortcut-settings-utils.ts";

type AppActionShortcutsSectionProps = {
  appActionShortcuts: AppActionShortcutEntry[];
  models?: Array<{ id: string; name: string; provider: string }>;
  newSessionPreferredModel?: string;
  onNewSessionPreferredModelChange?: (model: string) => void;
  onChangeAppActionShortcut: (
    id: AppActionShortcutId,
    shortcut: {
      enabled: boolean;
      combo: ShortcutCombo;
    },
  ) => void;
};

export function AppActionShortcutsSection(props: AppActionShortcutsSectionProps) {
  return (
    <section className="setting-card setting-card-wide">
      <div className="setting-head">
        <h3 className="setting-title">App Action Shortcuts</h3>
      </div>
      <div className="setting-fields">
        <div className="field-block">
          <span className="field-label">Configure global shortcuts for built-in app actions.</span>
          <span className="field-label">
            Supports Cmd/Control/Option/Shift + letter or number.
          </span>
        </div>
        <div className="shortcut-scheme-list">
          {props.appActionShortcuts.map((entry) => {
            const updateShortcut = (next: { enabled: boolean; combo: ShortcutCombo }) => {
              props.onChangeAppActionShortcut(entry.id, next);
            };
            return (
              <div key={entry.id} className="shortcut-scheme-row">
                <div className="shortcut-scheme-summary">
                  <div className="shortcut-scheme-top">
                    <span className="shortcut-scheme-key">{entry.label}</span>
                    <ShortcutKeyConfigField
                      combo={entry.combo}
                      ariaLabel={`${entry.label} shortcut key`}
                      onChangeCombo={(combo) => updateShortcut({ enabled: entry.enabled, combo })}
                    />
                  </div>
                  <ShortcutModifierEditor
                    combo={entry.combo}
                    enabled={entry.enabled}
                    onEnabledChange={(enabled) => updateShortcut({ enabled, combo: entry.combo })}
                    onChangeCombo={(combo) => updateShortcut({ enabled: entry.enabled, combo })}
                  />
                  <span className="field-label">
                    {entry.enabled ? entry.shortcutLabel : `${entry.shortcutLabel} (disabled)`}
                  </span>
                  {entry.id === "newSession" && (
                    <label className="field-block" style={{ marginTop: 8 }}>
                      <span className="field-label">
                        Bound model (auto-applied on shortcut create)
                      </span>
                      <select
                        value={props.newSessionPreferredModel ?? ""}
                        onChange={(e) => props.onNewSessionPreferredModelChange?.(e.target.value)}
                        className="ui-input"
                        aria-label="Select model for new session shortcut"
                      >
                        <option value="">System default</option>
                        {(props.models ?? []).map((model) => {
                          const full = `${model.provider}/${model.id}`;
                          return (
                            <option key={full} value={full}>
                              {full}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
