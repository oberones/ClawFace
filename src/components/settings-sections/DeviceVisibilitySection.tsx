import React from "react";
import type { ConnectionStatus } from "../../lib/types.ts";
import type { DevicePairingVisibility } from "../../lib/device-pairing-visibility.ts";
import { summarizeDeviceCapabilities } from "../../lib/device-capability-summary.ts";

type DeviceVisibilitySectionProps = {
  connectionStatus: ConnectionStatus;
  currentDeviceId: string | null;
  devicePairingVisibility: DevicePairingVisibility | null;
  devicePairingSupported: boolean;
  devicePairingLoading: boolean;
  devicePairingError: string | null;
  devicePairingLastUpdatedAt: number | null;
  onRefreshDevicePairingVisibility: () => void;
};

const PENDING_PREVIEW_LIMIT = 3;
const PAIRED_PREVIEW_LIMIT = 4;

function formatDeviceStatusLabel(status: DevicePairingVisibility["currentDeviceStatus"]): string {
  switch (status) {
    case "pending":
      return "Pending approval";
    case "paired":
      return "Paired";
    case "unlisted":
      return "Not listed";
    default:
      return "Unavailable";
  }
}

function formatDeviceStatusTone(status: DevicePairingVisibility["currentDeviceStatus"]): string {
  switch (status) {
    case "pending":
      return "warning";
    case "paired":
      return "good";
    case "unlisted":
      return "neutral";
    default:
      return "muted";
  }
}

function summarizeList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatLastUpdated(lastUpdatedAtMs: number | null): string | null {
  if (!(typeof lastUpdatedAtMs === "number" && Number.isFinite(lastUpdatedAtMs))) {
    return null;
  }
  return new Date(lastUpdatedAtMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildCurrentDeviceHint(props: DeviceVisibilitySectionProps): string {
  const snapshot = props.devicePairingVisibility;
  if (!props.currentDeviceId) {
    return "ClawFace could not load a local device identity in this runtime.";
  }
  if (props.connectionStatus !== "connected") {
    return "Reconnect to refresh the current gateway's pairing index.";
  }
  if (!props.devicePairingSupported) {
    return "This gateway does not advertise device.pair.list yet.";
  }
  if (!snapshot) {
    return props.devicePairingLoading
      ? "Loading the current gateway pairing index…"
      : "Refresh to inspect the current gateway pairing index.";
  }
  if (snapshot.currentDeviceStatus === "pending") {
    return snapshot.currentDevicePendingRequest?.isRepair
      ? "This device has a repair approval pending."
      : "This device is waiting for pairing approval.";
  }
  if (snapshot.currentDeviceStatus === "paired") {
    return "This device already appears in the current gateway pairing index.";
  }
  return "This device does not appear in the current gateway pairing index yet.";
}

export function DeviceVisibilitySection(props: DeviceVisibilitySectionProps) {
  const snapshot = props.devicePairingVisibility;
  const currentStatus = snapshot?.currentDeviceStatus ?? "unavailable";
  const currentStatusLabel = formatDeviceStatusLabel(currentStatus);
  const currentStatusTone = formatDeviceStatusTone(currentStatus);
  const lastUpdatedLabel = formatLastUpdated(props.devicePairingLastUpdatedAt);
  const previewPending = snapshot?.pending.slice(0, PENDING_PREVIEW_LIMIT) ?? [];
  const previewPaired = snapshot?.paired.slice(0, PAIRED_PREVIEW_LIMIT) ?? [];
  const currentCapabilitySource = snapshot?.currentDevicePendingRequest ?? snapshot?.currentDevicePairedRecord ?? null;
  const currentCapabilitySummary = currentCapabilitySource
    ? summarizeDeviceCapabilities({
      roles: currentCapabilitySource.roles,
      scopes: currentCapabilitySource.scopes,
    })
    : null;

  return (
    <section className="setting-card setting-card-wide">
      <div className="setting-head">
        <h3 className="setting-title">Devices & Pairing</h3>
        <button
          type="button"
          className="ui-btn ui-btn-light section-reset-btn"
          onClick={props.onRefreshDevicePairingVisibility}
          disabled={props.connectionStatus !== "connected" || !props.devicePairingSupported || props.devicePairingLoading}
        >
          {props.devicePairingLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="setting-fields">
        <div className="field-block">
          <span className="field-label">
            Read-only visibility into the current gateway's device pairing index.
          </span>
          <span className="field-hint">
            This first slice is intentionally lightweight: it shows the current device, pending approvals,
            and paired devices without turning Settings into a full device manager.
          </span>
        </div>

        <div className="device-visibility-summary-grid">
          <div className="device-visibility-summary-card">
            <div className="device-visibility-summary-top">
              <span className="field-label">This device</span>
              <span className={`device-visibility-status-chip ${currentStatusTone}`}>
                {currentStatusLabel}
              </span>
            </div>
            <code className="device-visibility-device-id">
              {props.currentDeviceId ?? "Unavailable in this runtime"}
            </code>
            {currentCapabilitySummary ? (
              <>
                <strong className="device-visibility-capability-headline">
                  {currentCapabilitySummary.headline}
                </strong>
                <div className="device-visibility-capability-list">
                  {currentCapabilitySummary.chips.map((chip) => (
                    <span
                      key={chip.key}
                      className={`device-visibility-status-chip ${chip.tone}`}
                      title={chip.label}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
                {currentCapabilitySummary.detail ? (
                  <span className="field-hint">
                    Extra scopes: {currentCapabilitySummary.detail}
                  </span>
                ) : null}
              </>
            ) : null}
            <span className="field-hint">{buildCurrentDeviceHint(props)}</span>
          </div>

          <div className="device-visibility-summary-card">
            <div className="device-visibility-summary-top">
              <span className="field-label">Gateway pairing index</span>
              {lastUpdatedLabel ? <span className="field-hint">Updated {lastUpdatedLabel}</span> : null}
            </div>
            <div className="device-visibility-count-line">
              <strong>{snapshot?.pending.length ?? 0}</strong>
              <span>pending</span>
            </div>
            <div className="device-visibility-count-line">
              <strong>{snapshot?.paired.length ?? 0}</strong>
              <span>paired</span>
            </div>
            <span className="field-hint">
              {props.connectionStatus === "connected"
                ? props.devicePairingSupported
                  ? "This list refreshes when pairing requests or resolutions arrive."
                  : "This gateway does not advertise device.pair.list yet."
                : "Reconnect to refresh the gateway pairing index."}
            </span>
          </div>
        </div>

        {props.devicePairingError ? (
          <div className="device-visibility-note warning">{props.devicePairingError}</div>
        ) : null}

        <div className="device-visibility-columns">
          <div className="device-visibility-column">
            <div className="device-visibility-column-head">
              <span className="field-label">Pending approvals</span>
              <span className="field-hint">{snapshot?.pending.length ?? 0} total</span>
            </div>
            {previewPending.length > 0 ? (
              <div className="device-visibility-list">
                {previewPending.map((request) => (
                  (() => {
                    const summary = summarizeDeviceCapabilities({
                      roles: request.roles,
                      scopes: request.scopes,
                    });
                    return (
                      <article
                        key={request.requestId}
                        className={`device-visibility-row${request.deviceId === props.currentDeviceId ? " is-current" : ""}`}
                      >
                        <div className="device-visibility-row-top">
                          <strong>{request.displayName}</strong>
                          {request.isRepair ? (
                            <span className="device-visibility-status-chip warning">Repair</span>
                          ) : null}
                        </div>
                        <code className="device-visibility-device-id">{request.deviceId}</code>
                        <strong className="device-visibility-capability-headline">{summary.headline}</strong>
                        <div className="device-visibility-capability-list">
                          {summary.chips.map((chip) => (
                            <span key={chip.key} className={`device-visibility-status-chip ${chip.tone}`}>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        {summary.detail ? (
                          <span className="field-hint">Extra scopes: {summary.detail}</span>
                        ) : null}
                      </article>
                    );
                  })()
                ))}
                {snapshot && snapshot.pending.length > previewPending.length ? (
                  <span className="field-hint">
                    Showing {previewPending.length} of {snapshot.pending.length} pending device requests.
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="device-visibility-note">No pending device approvals.</div>
            )}
          </div>

          <div className="device-visibility-column">
            <div className="device-visibility-column-head">
              <span className="field-label">Paired devices</span>
              <span className="field-hint">{snapshot?.paired.length ?? 0} total</span>
            </div>
            {previewPaired.length > 0 ? (
              <div className="device-visibility-list">
                {previewPaired.map((device) => (
                  (() => {
                    const summary = summarizeDeviceCapabilities({
                      roles: device.roles,
                      scopes: device.scopes,
                    });
                    return (
                      <article
                        key={device.deviceId}
                        className={`device-visibility-row${device.deviceId === props.currentDeviceId ? " is-current" : ""}`}
                      >
                        <div className="device-visibility-row-top">
                          <strong>{device.displayName}</strong>
                          {device.deviceId === props.currentDeviceId ? (
                            <span className="device-visibility-status-chip good">This device</span>
                          ) : null}
                        </div>
                        <code className="device-visibility-device-id">{device.deviceId}</code>
                        <strong className="device-visibility-capability-headline">{summary.headline}</strong>
                        <div className="device-visibility-capability-list">
                          {summary.chips.map((chip) => (
                            <span key={chip.key} className={`device-visibility-status-chip ${chip.tone}`}>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        {summary.detail ? (
                          <span className="field-hint">Extra scopes: {summary.detail}</span>
                        ) : null}
                        <span className="field-hint">Token roles: {summarizeList(device.tokenRoles)}</span>
                      </article>
                    );
                  })()
                ))}
                {snapshot && snapshot.paired.length > previewPaired.length ? (
                  <span className="field-hint">
                    Showing {previewPaired.length} of {snapshot.paired.length} paired devices.
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="device-visibility-note">No paired devices reported by this gateway yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
