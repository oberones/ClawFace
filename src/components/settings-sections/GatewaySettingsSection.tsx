import React from "react";

type GatewaySettingsSectionProps = {
  gatewayUrl: string;
  token: string;
  password: string;
  fsServerUrl: string;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onFsServerUrlChange: (value: string) => void;
};

export function GatewaySettingsSection(props: GatewaySettingsSectionProps) {
  return (
    <section className="setting-card">
      <h3 className="setting-title">Gateway</h3>
      <div className="setting-fields">
        <label className="field-block">
          <span className="field-label">WebSocket URL</span>
          <input
            value={props.gatewayUrl}
            onChange={(e) => props.onGatewayUrlChange(e.target.value)}
            className="ui-input"
            placeholder="ws://127.0.0.1:18789"
          />
        </label>
        <label className="field-block">
          <span className="field-label">Token</span>
          <input
            value={props.token}
            onChange={(e) => props.onTokenChange(e.target.value)}
            className="ui-input"
            placeholder="gateway token"
          />
        </label>
        <label className="field-block">
          <span className="field-label">Password</span>
          <input
            value={props.password}
            onChange={(e) => props.onPasswordChange(e.target.value)}
            className="ui-input"
            type="password"
            placeholder="optional"
          />
        </label>
        <label className="field-block">
          <span className="field-label">File Server URL</span>
          <input
            value={props.fsServerUrl}
            onChange={(e) => props.onFsServerUrlChange(e.target.value)}
            className="ui-input"
            placeholder="http://192.168.1.100:3000"
          />
          <span className="field-hint">
            Base URL of the dev server for remote file access (leave empty for local)
          </span>
        </label>
      </div>
    </section>
  );
}
