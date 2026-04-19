import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const {
  registerDesktopProtocolSchemes,
  registerDesktopProtocolHandlers,
} = require(path.join(repoRoot, "electron/protocols/register-desktop-protocols.cjs"));

test("registerDesktopProtocolSchemes registers the privileged desktop schemes", () => {
  const calls = [];
  const protocol = {
    registerSchemesAsPrivileged(value) {
      calls.push(value);
    },
  };

  registerDesktopProtocolSchemes({
    protocol,
    localImageScheme: "claw-local-image",
    fsScheme: "claw-fs",
  });

  assert.deepEqual(calls, [[
    {
      scheme: "claw-local-image",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "claw-fs",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]]);
});

test("registerDesktopProtocolHandlers binds both desktop protocol handlers", () => {
  const calls = [];
  const localImageHandler = () => {};
  const fsHandler = () => {};
  const protocol = {
    handle(scheme, handler) {
      calls.push({ scheme, handler });
    },
  };

  registerDesktopProtocolHandlers({
    protocol,
    localImageScheme: "claw-local-image",
    fsScheme: "claw-fs",
    handleLocalImageRequest: localImageHandler,
    handleFsRequest: fsHandler,
  });

  assert.deepEqual(calls, [
    { scheme: "claw-local-image", handler: localImageHandler },
    { scheme: "claw-fs", handler: fsHandler },
  ]);
});
