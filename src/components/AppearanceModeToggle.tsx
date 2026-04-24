import React from "react";
import type { AppearanceMode } from "../lib/appearance-mode.ts";
import { getAppearanceModeToggleViewModel } from "../lib/appearance-mode.ts";

type AppearanceModeToggleProps = {
  mode: AppearanceMode;
  onToggle: () => void;
  className?: string;
};

/** Renders the shell-level mode switch without owning appearance persistence. */
export function AppearanceModeToggle(props: AppearanceModeToggleProps) {
  const viewModel = getAppearanceModeToggleViewModel(props.mode);
  const className = [
    "ui-btn",
    "ui-btn-light",
    "appearance-mode-toggle",
    `is-${viewModel.mode}`,
    props.className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={props.onToggle}
      aria-pressed={viewModel.pressed}
      aria-label={viewModel.ariaLabel}
      title={viewModel.ariaLabel}
    >
      <span className="appearance-mode-toggle-orb" aria-hidden="true" />
      <span className="appearance-mode-toggle-label">{viewModel.label}</span>
    </button>
  );
}
