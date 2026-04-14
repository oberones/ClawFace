import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDeviceCapabilitySummaryModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/device-capability-summary.ts"));
}

test("summarizeDeviceCapabilities expands operator admin into a full operator control summary", () => {
  const { summarizeDeviceCapabilities } = loadDeviceCapabilitySummaryModule();

  assert.deepEqual(
    summarizeDeviceCapabilities({
      roles: ["operator"],
      scopes: ["operator.admin"],
    }),
    {
      headline: "Full operator control",
      chips: [
        { key: "operator.admin", label: "Admin control", tone: "good" },
        { key: "operator.approvals", label: "Approvals", tone: "neutral" },
        { key: "operator.pairing", label: "Pairing", tone: "neutral" },
        { key: "operator.write", label: "Write access", tone: "neutral" },
        { key: "operator.read", label: "Read access", tone: "muted" },
      ],
      detail: null,
    },
  );
});

test("summarizeDeviceCapabilities promotes write to read and preserves custom scopes", () => {
  const { summarizeDeviceCapabilities } = loadDeviceCapabilitySummaryModule();

  assert.deepEqual(
    summarizeDeviceCapabilities({
      roles: ["operator", "node"],
      scopes: ["node.exec", "operator.write"],
    }),
    {
      headline: "Interactive operator access",
      chips: [
        { key: "operator.write", label: "Write access", tone: "neutral" },
        { key: "operator.read", label: "Read access", tone: "muted" },
        { key: "role:node", label: "Node role", tone: "muted" },
        { key: "custom-scopes", label: "1 custom scope", tone: "muted" },
      ],
      detail: "node.exec",
    },
  );
});

test("summarizeDeviceCapabilities falls back to read-only or custom access headlines", () => {
  const { summarizeDeviceCapabilities } = loadDeviceCapabilitySummaryModule();

  assert.deepEqual(
    summarizeDeviceCapabilities({
      roles: ["operator"],
      scopes: ["operator.read"],
    }),
    {
      headline: "Read-only visibility",
      chips: [
        { key: "operator.read", label: "Read access", tone: "muted" },
      ],
      detail: null,
    },
  );

  assert.deepEqual(
    summarizeDeviceCapabilities({
      roles: ["viewer"],
      scopes: ["camera.capture"],
    }),
    {
      headline: "Custom capability access",
      chips: [
        { key: "role:viewer", label: "Viewer role", tone: "muted" },
        { key: "custom-scopes", label: "1 custom scope", tone: "muted" },
      ],
      detail: "camera.capture",
    },
  );
});
