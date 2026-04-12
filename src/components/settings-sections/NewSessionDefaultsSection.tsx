import React from "react";

type NewSessionDefaultsSectionProps = {
  models?: Array<{ id: string; name: string; provider: string }>;
  newSessionPreferredModel?: string;
  onNewSessionPreferredModelChange?: (model: string) => void;
};

export function NewSessionDefaultsSection(props: NewSessionDefaultsSectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">New Session Defaults</h3>
      </div>
      <div className="setting-fields">
        <div className="field-block">
          <span className="field-label">
            Choose the model ClawFace should preselect for brand-new sessions.
          </span>
          <span className="field-label">
            This is used by both the New Session modal and the New Session app shortcut.
          </span>
        </div>
        <label className="field-block">
          <span className="field-label">Preferred model</span>
          <select
            value={props.newSessionPreferredModel ?? ""}
            onChange={(e) => props.onNewSessionPreferredModelChange?.(e.target.value)}
            className="ui-input"
            aria-label="Select preferred model for new sessions"
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
      </div>
    </section>
  );
}
