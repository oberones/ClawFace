import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadConnectionFeedbackModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/connection-feedback.ts"));
}

test("deriveGatewayStatusIndicator returns compact presentation state for every gateway status", () => {
  const { deriveGatewayStatusIndicator } = loadConnectionFeedbackModule();

  assert.deepEqual(deriveGatewayStatusIndicator("connected"), {
    statusLabel: "Gateway connected",
    statusDotClass: "connected",
  });
  assert.deepEqual(deriveGatewayStatusIndicator("connecting"), {
    statusLabel: "Connecting to gateway…",
    statusDotClass: "connecting",
  });
  assert.deepEqual(deriveGatewayStatusIndicator("pairing-required"), {
    statusLabel: "Gateway pairing required",
    statusDotClass: "warning",
  });
  assert.deepEqual(deriveGatewayStatusIndicator("error"), {
    statusLabel: "Gateway connection error",
    statusDotClass: "warning",
  });
  assert.deepEqual(deriveGatewayStatusIndicator("disconnected"), {
    statusLabel: "Gateway disconnected",
    statusDotClass: "disconnected",
  });
});

test("deriveConnectionFeedback keeps connected status quiet and busy status informative", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const connected = deriveConnectionFeedback({
    connectionStatus: "connected",
    hasActiveSession: false,
    disabledReason: null,
    composerRuntimeState: "ready",
  });
  assert.equal(connected.statusLabel, "Gateway connected");
  assert.equal(connected.statusDotClass, "connected");
  assert.equal(connected.composerNotice, null);
  assert.equal(connected.sessionBanner, null);

  const busy = deriveConnectionFeedback({
    connectionStatus: "connected",
    hasActiveSession: true,
    disabledReason: null,
    composerRuntimeState: "busy",
  });
  assert.equal(busy.composerNotice?.tone, "info");
  assert.equal(busy.composerNotice?.action, null);
  assert.match(busy.composerNotice?.message ?? "", /already in progress/i);
  assert.equal(busy.sessionBanner, null);

  const interrupted = deriveConnectionFeedback({
    connectionStatus: "connected",
    hasActiveSession: true,
    disabledReason: null,
    composerRuntimeState: "ready",
    interruptedRunBanner: {
      tone: "warning",
      title: "Previous run interrupted",
      message: "Refresh again if you expect delayed output, or resend the prompt.",
      action: "refresh-session",
    },
  });
  assert.equal(interrupted.composerNotice, null);
  assert.equal(interrupted.sessionBanner?.action, "refresh-session");
  assert.equal(interrupted.sessionBanner?.title, "Previous run interrupted");
});

test("deriveConnectionFeedback offers settings recovery for disconnected and error states", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const disconnected = deriveConnectionFeedback({
    connectionStatus: "disconnected",
    hasActiveSession: true,
    disabledReason: null,
    composerRuntimeState: "offline",
  });
  assert.equal(disconnected.statusDotClass, "disconnected");
  assert.equal(disconnected.composerNotice?.action, "open-settings");
  assert.match(disconnected.composerNotice?.message ?? "", /update settings to reconnect/i);
  assert.equal(disconnected.sessionBanner?.action, "open-settings");
  assert.match(disconnected.sessionBanner?.message ?? "", /session stays visible/i);

  const errored = deriveConnectionFeedback({
    connectionStatus: "error",
    hasActiveSession: true,
    disabledReason: "Gateway refused the websocket handshake.",
    composerRuntimeState: "offline",
  });
  assert.equal(errored.statusDotClass, "warning");
  assert.equal(errored.composerNotice?.action, "open-settings");
  assert.equal(errored.composerNotice?.message, "Gateway refused the websocket handshake.");
  assert.equal(errored.sessionBanner?.action, "open-settings");
  assert.equal(errored.sessionBanner?.title, "Session paused");
});

test("deriveConnectionFeedback keeps connecting guidance quiet and pairing guidance actionable", () => {
  const { deriveConnectionFeedback, PAIRING_APPROVAL_COMMAND } = loadConnectionFeedbackModule();

  const connecting = deriveConnectionFeedback({
    connectionStatus: "connecting",
    hasActiveSession: true,
    disabledReason: null,
    composerRuntimeState: "offline",
  });
  assert.equal(connecting.statusLabel, "Connecting to gateway…");
  assert.equal(connecting.statusDotClass, "connecting");
  assert.equal(connecting.composerNotice?.tone, "info");
  assert.equal(connecting.composerNotice?.action, null);
  assert.equal(connecting.sessionBanner?.tone, "info");
  assert.equal(connecting.sessionBanner?.action, null);
  assert.match(connecting.sessionBanner?.title ?? "", /Reconnecting/i);

  const pairing = deriveConnectionFeedback({
    connectionStatus: "pairing-required",
    hasActiveSession: true,
    disabledReason: "Pairing required. Approve this device with openclaw devices approve.",
    composerRuntimeState: "offline",
  });
  assert.equal(pairing.statusDotClass, "warning");
  assert.equal(pairing.composerNotice?.tone, "warning");
  assert.equal(pairing.composerNotice?.action, "copy-pairing-command");
  assert.match(pairing.composerNotice?.message ?? "", /approve this device/i);
  assert.equal(pairing.approvalBanner?.action, "copy-pairing-command");
  assert.match(pairing.approvalBanner?.title ?? "", /Pairing approval required/i);
  assert.match(pairing.approvalBanner?.message ?? "", new RegExp(PAIRING_APPROVAL_COMMAND));
  assert.equal(pairing.sessionBanner, null);
});

test("deriveConnectionFeedback only shows the continuity banner when there is an active session", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const disconnectedWithoutSession = deriveConnectionFeedback({
    connectionStatus: "disconnected",
    hasActiveSession: false,
    disabledReason: null,
    composerRuntimeState: "offline",
  });

  assert.equal(disconnectedWithoutSession.composerNotice?.action, "open-settings");
  assert.equal(disconnectedWithoutSession.sessionBanner, null);

  const pairingWithoutSession = deriveConnectionFeedback({
    connectionStatus: "pairing-required",
    hasActiveSession: false,
    disabledReason: null,
    composerRuntimeState: "offline",
  });

  assert.equal(pairingWithoutSession.sessionBanner, null);
  assert.equal(pairingWithoutSession.approvalBanner?.action, "copy-pairing-command");
  assert.match(pairingWithoutSession.approvalBanner?.message ?? "", /openclaw devices approve/i);
});
