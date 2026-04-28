import React from "react";
import type { GatewayConnectionTestState } from "../../lib/gateway-connection-test.ts";

type GatewaySettingsSectionProps = {
  gatewayUrl: string;
  token: string;
  password: string;
  connectionTest: GatewayConnectionTestState;
  fsServerUrl: string;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTestConnection: () => void;
  onFsServerUrlChange: (value: string) => void;
};

export function GatewaySettingsSection(props: GatewaySettingsSectionProps) {
  const isTesting = props.connectionTest.status === "testing";
  const canTest = props.gatewayUrl.trim().length > 0 && !isTesting;

  return (
    <section className="setting-card">
      <h3 className="setting-title">Gateway</h3>
      <div className="setting-fields">
        <label className="field-block">
          <span className="field-label">WebSocket URL</span>
          <span className="gateway-test-row">
            <input
              value={props.gatewayUrl}
              onChange={(e) => props.onGatewayUrlChange(e.target.value)}
              className="ui-input"
              placeholder="ws://127.0.0.1:18789"
            />
            <button
              type="button"
              className="ui-btn ui-btn-light gateway-test-button"
              onClick={props.onTestConnection}
              disabled={!canTest}
            >
              {isTesting ? "Testing..." : "Test"}
            </button>
          </span>
        </label>
        {props.connectionTest.status === "success" || props.connectionTest.status === "failure" ? (
          <div
            className={`gateway-test-result is-${props.connectionTest.status}`}
            role="status"
            aria-live="polite"
          >
            <span className="gateway-test-result-icon" aria-hidden="true">
              {props.connectionTest.status === "success" ? "✓" : "X"}
            </span>
            <span className="gateway-test-result-copy">
              <span className="gateway-test-result-summary">
                {props.connectionTest.summary}
              </span>
              <span className="gateway-test-result-description">
                {props.connectionTest.description}
              </span>
            </span>
          </div>
        ) : null}
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
