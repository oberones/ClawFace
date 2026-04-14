import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDevicePairingActionsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/device-pairing-actions.ts"));
}

test("pickDevicePairingResolveMethod only returns advertised pairing action methods", () => {
  const { pickDevicePairingResolveMethod } = loadDevicePairingActionsModule();

  assert.equal(
    pickDevicePairingResolveMethod(["device.pair.list", "device.pair.approve"], "approve"),
    "device.pair.approve",
  );
  assert.equal(
    pickDevicePairingResolveMethod(["device.pair.list", "device.pair.approve"], "reject"),
    null,
  );
});

test("deriveDevicePairingActionSupport exposes approve and reject availability independently", () => {
  const { deriveDevicePairingActionSupport } = loadDevicePairingActionsModule();

  assert.deepEqual(
    deriveDevicePairingActionSupport(["device.pair.approve"]),
    {
      canApprovePendingRequests: true,
      canRejectPendingRequests: false,
    },
  );

  assert.deepEqual(
    deriveDevicePairingActionSupport(["device.pair.reject", "device.pair.approve"]),
    {
      canApprovePendingRequests: true,
      canRejectPendingRequests: true,
    },
  );
});
