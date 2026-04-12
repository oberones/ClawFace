import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadConnectionRecoveryModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/connection-recovery.ts"));
}

test("shouldAnnounceConnectionRecovery only fires for post-connect recoveries", () => {
  const { shouldAnnounceConnectionRecovery } = loadConnectionRecoveryModule();

  assert.equal(shouldAnnounceConnectionRecovery("disconnected", false), false);
  assert.equal(shouldAnnounceConnectionRecovery("disconnected", true), false);
  assert.equal(shouldAnnounceConnectionRecovery("connected", true), false);
  assert.equal(shouldAnnounceConnectionRecovery("connecting", true), true);
  assert.equal(shouldAnnounceConnectionRecovery("error", true), true);
  assert.equal(shouldAnnounceConnectionRecovery("pairing-required", true), true);
});

test("buildConnectionRecoveryNotice distinguishes gateway recovery from session refresh", () => {
  const { buildConnectionRecoveryNotice } = loadConnectionRecoveryModule();

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "gateway-reconnected", hasActiveSession: false }),
    {
      tone: "success",
      title: "Gateway reconnected",
      message: "OpenClaw is connected again.",
    },
  );

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "gateway-reconnected", hasActiveSession: true }),
    {
      tone: "info",
      title: "Gateway reconnected",
      message: "Refreshing the current session now.",
    },
  );

  assert.deepEqual(
    buildConnectionRecoveryNotice({ stage: "session-refreshed", hasActiveSession: true }),
    {
      tone: "success",
      title: "Session refreshed",
      message: "The current session history was reloaded after reconnect.",
    },
  );
});
