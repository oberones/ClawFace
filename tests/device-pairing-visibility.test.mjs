import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDevicePairingVisibilityModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/device-pairing-visibility.ts"));
}

test("normalizeDevicePairingVisibility sanitizes names and prioritizes pending status for the current device", () => {
  const { normalizeDevicePairingVisibility } = loadDevicePairingVisibilityModule();

  assert.deepEqual(
    normalizeDevicePairingVisibility(
      {
        pending: [
          {
            requestId: "request-2",
            deviceId: "device-beta",
            displayName: "[Wed 2026-04-13 09:15 UTC] Beta laptop",
            roles: ["operator"],
            scopes: ["operator.read", "operator.write"],
            ts: 200,
          },
          {
            requestId: "request-1",
            deviceId: "device-alpha",
            displayName: "Alpha tablet",
            role: "operator",
            scopes: ["operator.read"],
            isRepair: true,
            ts: 100,
          },
        ],
        paired: [
          {
            deviceId: "device-alpha",
            displayName: "Alpha tablet",
            roles: ["operator"],
            scopes: ["operator.read"],
            tokens: [{ role: "operator" }],
            approvedAtMs: 50,
          },
        ],
      },
      "device-alpha",
    ),
    {
      currentDeviceId: "device-alpha",
      currentDeviceStatus: "pending",
      currentDevicePendingRequest: {
        requestId: "request-1",
        deviceId: "device-alpha",
        displayName: "Alpha tablet",
        roles: ["operator"],
        scopes: ["operator.read"],
        remoteIp: null,
        isRepair: true,
        requestedAtMs: 100,
      },
      currentDevicePairedRecord: {
        deviceId: "device-alpha",
        displayName: "Alpha tablet",
        roles: ["operator"],
        scopes: ["operator.read"],
        remoteIp: null,
        tokenRoles: ["operator"],
        createdAtMs: null,
        approvedAtMs: 50,
      },
      pending: [
        {
          requestId: "request-2",
          deviceId: "device-beta",
          displayName: "Beta laptop",
          roles: ["operator"],
          scopes: ["operator.read", "operator.write"],
          remoteIp: null,
          isRepair: false,
          requestedAtMs: 200,
        },
        {
          requestId: "request-1",
          deviceId: "device-alpha",
          displayName: "Alpha tablet",
          roles: ["operator"],
          scopes: ["operator.read"],
          remoteIp: null,
          isRepair: true,
          requestedAtMs: 100,
        },
      ],
      paired: [
        {
          deviceId: "device-alpha",
          displayName: "Alpha tablet",
          roles: ["operator"],
          scopes: ["operator.read"],
          remoteIp: null,
          tokenRoles: ["operator"],
          createdAtMs: null,
          approvedAtMs: 50,
        },
      ],
    },
  );
});

test("normalizeDevicePairingVisibility sorts paired devices by approval time and reports unlisted current devices", () => {
  const { normalizeDevicePairingVisibility } = loadDevicePairingVisibilityModule();

  assert.deepEqual(
    normalizeDevicePairingVisibility(
      {
        paired: [
          {
            deviceId: "device-older",
            displayName: "Older device",
            roles: ["operator"],
            approvedAtMs: 10,
          },
          {
            deviceId: "device-newer",
            displayName: "Newer device",
            roles: ["operator"],
            approvedAtMs: 30,
            tokens: [{ role: "operator" }, { role: "operator" }, { role: "observer" }],
          },
        ],
      },
      "device-missing",
    ),
    {
      currentDeviceId: "device-missing",
      currentDeviceStatus: "unlisted",
      currentDevicePendingRequest: null,
      currentDevicePairedRecord: null,
      pending: [],
      paired: [
        {
          deviceId: "device-newer",
          displayName: "Newer device",
          roles: ["operator"],
          scopes: [],
          remoteIp: null,
          tokenRoles: ["operator", "observer"],
          createdAtMs: null,
          approvedAtMs: 30,
        },
        {
          deviceId: "device-older",
          displayName: "Older device",
          roles: ["operator"],
          scopes: [],
          remoteIp: null,
          tokenRoles: [],
          createdAtMs: null,
          approvedAtMs: 10,
        },
      ],
    },
  );
});

test("normalizeDevicePairingVisibility reports unavailable current device state when identity is missing", () => {
  const { normalizeDevicePairingVisibility } = loadDevicePairingVisibilityModule();

  assert.deepEqual(
    normalizeDevicePairingVisibility({ pending: [], paired: [] }, null),
    {
      currentDeviceId: null,
      currentDeviceStatus: "unavailable",
      currentDevicePendingRequest: null,
      currentDevicePairedRecord: null,
      pending: [],
      paired: [],
    },
  );
});
