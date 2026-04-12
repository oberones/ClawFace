import React from "react";
import {
  ShortcutKeyConfigField,
  ShortcutModifierEditor,
} from "./ShortcutSettingsShared.tsx";
import type { AgentSessionShortcutSchemeEntry } from "./SettingsSectionTypes.ts";
import {
  formatShortcutUpdatedAt,
  type ShortcutCombo,
} from "./shortcut-settings-utils.ts";

type AgentSessionShortcutsSectionProps = {
  agentSessionShortcutSchemes: AgentSessionShortcutSchemeEntry[];
  currentAgentIdForShortcut: string;
  currentAgentLabelForShortcut: string;
  onSaveAgentSessionShortcutScheme: (slot: number) => void;
  onApplyAgentSessionShortcutScheme: (slot: number) => void;
  onChangeAgentSessionShortcutSchemeCombo: (slot: number, combo: ShortcutCombo) => void;
  onDeleteAgentSessionShortcutScheme: (slot: number) => void;
};

export function AgentSessionShortcutsSection(props: AgentSessionShortcutsSectionProps) {
  return (
    <section className="setting-card setting-card-wide">
      <div className="setting-head">
        <h3 className="setting-title">Agent Session Shortcuts</h3>
      </div>
      <div className="setting-fields">
        <div className="field-block">
          <span className="field-label">Current agent</span>
          <span className="field-label shortcut-current-line">
            {props.currentAgentIdForShortcut
              ? `${props.currentAgentLabelForShortcut} (${props.currentAgentIdForShortcut})`
              : "No active agent found in current session yet."}
          </span>
          <span className="field-label">
            Keep up to 5 shortcuts. Each shortcut creates a new session with the bound agent.
            Supports Cmd/Control/Option/Shift + letter or number.
          </span>
        </div>
        <div className="shortcut-scheme-list">
          {props.agentSessionShortcutSchemes.map((entry) => {
            const scheme = entry.scheme;
            return (
              <div key={entry.slot} className="shortcut-scheme-row">
                <div className="shortcut-scheme-summary">
                  <div className="shortcut-scheme-top">
                    <span className="shortcut-scheme-key">{entry.shortcutLabel}</span>
                    <ShortcutKeyConfigField
                      combo={entry.combo}
                      disabled={!scheme}
                      ariaLabel={`Agent shortcut key for slot ${entry.slot}`}
                      onChangeCombo={(combo) =>
                        props.onChangeAgentSessionShortcutSchemeCombo(entry.slot, combo)
                      }
                    />
                  </div>
                  <ShortcutModifierEditor
                    combo={entry.combo}
                    disabled={!scheme}
                    onChangeCombo={(combo) =>
                      props.onChangeAgentSessionShortcutSchemeCombo(entry.slot, combo)
                    }
                  />
                  {scheme ? (
                    <div className="shortcut-scheme-copy">
                      <span className="shortcut-scheme-model">{scheme.agentLabel}</span>
                      <span className="field-label">
                        Agent: {scheme.agentId} · Saved {formatShortcutUpdatedAt(scheme.updatedAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="field-label">No agent shortcut saved for this slot.</span>
                  )}
                </div>
                <div className="scheme-actions shortcut-scheme-actions">
                  <button
                    type="button"
                    onClick={() => props.onSaveAgentSessionShortcutScheme(entry.slot)}
                    className="ui-btn ui-btn-primary"
                    disabled={!props.currentAgentIdForShortcut}
                  >
                    Save Current
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onApplyAgentSessionShortcutScheme(entry.slot)}
                    className="ui-btn ui-btn-light"
                    disabled={!scheme}
                  >
                    Create Session
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDeleteAgentSessionShortcutScheme(entry.slot)}
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
