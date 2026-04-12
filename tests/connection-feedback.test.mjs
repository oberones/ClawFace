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

test("deriveConnectionFeedback keeps connected status quiet and busy status informative", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const connected = deriveConnectionFeedback({
    connectionStatus: "connected",
    disabledReason: null,
    composerRuntimeState: "ready",
  });
  assert.equal(connected.statusLabel, "Gateway connected");
  assert.equal(connected.statusDotClass, "connected");
  assert.equal(connected.composerNotice, null);

  const busy = deriveConnectionFeedback({
    connectionStatus: "connected",
    disabledReason: null,
    composerRuntimeState: "busy",
  });
  assert.equal(busy.composerNotice?.tone, "info");
  assert.equal(busy.composerNotice?.action, null);
  assert.match(busy.composerNotice?.message ?? "", /already in progress/i);
});

test("deriveConnectionFeedback offers settings recovery for disconnected and error states", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const disconnected = deriveConnectionFeedback({
    connectionStatus: "disconnected",
    disabledReason: null,
    composerRuntimeState: "offline",
  });
  assert.equal(disconnected.statusDotClass, "disconnected");
  assert.equal(disconnected.composerNotice?.action, "open-settings");
  assert.match(disconnected.composerNotice?.message ?? "", /update settings to reconnect/i);

  const errored = deriveConnectionFeedback({
    connectionStatus: "error",
    disabledReason: "Gateway refused the websocket handshake.",
    composerRuntimeState: "offline",
  });
  assert.equal(errored.statusDotClass, "warning");
  assert.equal(errored.composerNotice?.action, "open-settings");
  assert.equal(errored.composerNotice?.message, "Gateway refused the websocket handshake.");
});

test("deriveConnectionFeedback keeps pairing and connecting guidance non-actionable", () => {
  const { deriveConnectionFeedback } = loadConnectionFeedbackModule();

  const connecting = deriveConnectionFeedback({
    connectionStatus: "connecting",
    disabledReason: null,
    composerRuntimeState: "offline",
  });
  assert.equal(connecting.statusLabel, "Connecting to gateway…");
  assert.equal(connecting.statusDotClass, "connecting");
  assert.equal(connecting.composerNotice?.tone, "info");
  assert.equal(connecting.composerNotice?.action, null);

  const pairing = deriveConnectionFeedback({
    connectionStatus: "pairing-required",
    disabledReason: "Pairing required. Approve this device with openclaw devices approve.",
    composerRuntimeState: "offline",
  });
  assert.equal(pairing.statusDotClass, "warning");
  assert.equal(pairing.composerNotice?.tone, "warning");
  assert.equal(pairing.composerNotice?.action, null);
  assert.match(pairing.composerNotice?.message ?? "", /approve this device/i);
});
