import React from "react";
import {
  normalizeShortcutEventKey,
  normalizeShortcutKeyInput,
  type ShortcutCombo,
} from "./shortcut-settings-utils.ts";

type ShortcutKeyConfigFieldProps = {
  combo: ShortcutCombo;
  disabled?: boolean;
  ariaLabel: string;
  onChangeCombo: (next: ShortcutCombo) => void;
};

export function ShortcutKeyConfigField(props: ShortcutKeyConfigFieldProps) {
  return (
    <label className="field-inline shortcut-key-config">
      <span className="field-label">Key</span>
      <input
        value={props.combo.key.toUpperCase()}
        onChange={(e) => {
          const normalized = normalizeShortcutKeyInput(e.target.value);
          if (normalized) {
            props.onChangeCombo({ ...props.combo, key: normalized });
          }
        }}
        onKeyDown={(e) => {
          const normalized = normalizeShortcutEventKey(e.code, e.key);
          if (!normalized) {
            return;
          }
          e.preventDefault();
          props.onChangeCombo({ ...props.combo, key: normalized });
        }}
        className="ui-input compact shortcut-key-capture"
        disabled={props.disabled}
        maxLength={1}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        title="Focus and press a letter or number key"
        aria-label={props.ariaLabel}
      />
    </label>
  );
}

type ShortcutModifierEditorProps = {
  combo: ShortcutCombo;
  disabled?: boolean;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  onChangeCombo: (next: ShortcutCombo) => void;
};

export function ShortcutModifierEditor(props: ShortcutModifierEditorProps) {
  const patchCombo = (patch: Partial<ShortcutCombo>) => {
    props.onChangeCombo({ ...props.combo, ...patch });
  };

  return (
    <div className="shortcut-combo-editor">
      {typeof props.enabled === "boolean" && props.onEnabledChange ? (
        <label className="shortcut-modifier-toggle">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(e) => props.onEnabledChange?.(e.target.checked)}
          />
          Enabled
        </label>
      ) : null}
      <label className="shortcut-modifier-toggle">
        <input
          type="checkbox"
          checked={props.combo.meta}
          onChange={(e) => patchCombo({ meta: e.target.checked })}
          disabled={props.disabled}
        />
        Cmd
      </label>
      <label className="shortcut-modifier-toggle">
        <input
          type="checkbox"
          checked={props.combo.ctrl}
          onChange={(e) => patchCombo({ ctrl: e.target.checked })}
          disabled={props.disabled}
        />
        Control
      </label>
      <label className="shortcut-modifier-toggle">
        <input
          type="checkbox"
          checked={props.combo.alt}
          onChange={(e) => patchCombo({ alt: e.target.checked })}
          disabled={props.disabled}
        />
        Option
      </label>
      <label className="shortcut-modifier-toggle">
        <input
          type="checkbox"
          checked={props.combo.shift}
          onChange={(e) => patchCombo({ shift: e.target.checked })}
          disabled={props.disabled}
        />
        Shift
      </label>
    </div>
  );
}
