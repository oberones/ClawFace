import React from "react";

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
};

type ToggleFieldProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function clampNumber(raw: string, fallback: number, min?: number, max?: number): number {
  if (!raw.trim()) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (typeof min === "number" && value < min) {
    return min;
  }
  if (typeof max === "number" && value > max) {
    return max;
  }
  return value;
}

export function NumberField(props: NumberFieldProps) {
  return (
    <label className="field-block">
      <span className="field-label">
        {props.label}: {props.value}
        {props.suffix ?? ""}
      </span>
      <div className="field-inline dual-inputs">
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className="ui-range"
        />
        <input
          type="number"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(e) =>
            props.onChange(clampNumber(e.target.value, props.value, props.min, props.max))
          }
          className="ui-input compact"
        />
      </div>
    </label>
  );
}

export function ToggleField(props: ToggleFieldProps) {
  return (
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function ColorField(props: ColorFieldProps) {
  const swatchValue = /^#([0-9a-f]{6})$/i.test(props.value) ? props.value : "#4d6fa5";
  return (
    <label className="field-block">
      <span className="field-label">{props.label}</span>
      <div className="field-inline color-field-row">
        <input
          type="color"
          value={swatchValue}
          onChange={(e) => props.onChange(e.target.value)}
          className="ui-color"
        />
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="ui-input compact"
          placeholder="#4d6fa5"
        />
      </div>
    </label>
  );
}
