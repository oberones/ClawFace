import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadGatewayConnectionTestModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/gateway-connection-test.ts"));
}

test("validateGatewayConnectionTestUrl rejects blank and non-websocket URLs", () => {
  const { validateGatewayConnectionTestUrl } = loadGatewayConnectionTestModule();

  assert.deepEqual(validateGatewayConnectionTestUrl(" ", 10), {
    status: "failure",
    summary: "Gateway URL is required",
    description: "Enter a WebSocket URL before testing the connection.",
    testedAt: 10,
  });
  assert.deepEqual(validateGatewayConnectionTestUrl("http://127.0.0.1:18789", 11), {
    status: "failure",
    summary: "Invalid WebSocket URL",
    description: "Use a ws:// or wss:// Gateway URL.",
    testedAt: 11,
  });
  assert.equal(validateGatewayConnectionTestUrl("ws://127.0.0.1:18789", 12), null);
});

test("buildGatewayConnectionTestFailureFromClose summarizes pairing and auth failures", () => {
  const { buildGatewayConnectionTestFailureFromClose } = loadGatewayConnectionTestModule();

  assert.deepEqual(
    buildGatewayConnectionTestFailureFromClose(
      { code: 4001, reason: "Pairing required for this device" },
      20,
    ),
    {
      status: "failure",
      summary: "Pairing approval required",
      description: "The Gateway is reachable, but this device needs to be approved before ClawFace can connect.",
      testedAt: 20,
    },
  );

  assert.deepEqual(
    buildGatewayConnectionTestFailureFromClose(
      { code: 4008, reason: "connect failed", error: { code: "AUTH_FAILED", message: "bad token" } },
      21,
    ),
    {
      status: "failure",
      summary: "Authentication failed",
      description: "bad token",
      testedAt: 21,
    },
  );
});

test("runGatewayConnectionTest resolves success and stops the temporary client", async () => {
  const { runGatewayConnectionTest } = loadGatewayConnectionTestModule();
  let stopped = false;
  let clientOptions = null;

  class SuccessClient {
    constructor(options) {
      this.options = options;
      clientOptions = options;
    }

    start() {
      this.options.onHello({
        type: "hello-ok",
        protocol: 3,
        server: { version: "1.2.3", host: "workstation" },
      });
    }

    stop() {
      stopped = true;
    }
  }

  const result = await runGatewayConnectionTest({
    gatewayUrl: "ws://127.0.0.1:18789",
    clientConstructor: SuccessClient,
    now: () => 30,
  });

  assert.deepEqual(result, {
    status: "success",
    summary: "Connection succeeded",
    description: "The Gateway accepted the WebSocket connection and completed the OpenClaw handshake (protocol 3, server 1.2.3, host workstation).",
    testedAt: 30,
  });
  assert.equal(stopped, true);
  assert.equal(clientOptions.clientName, "openclaw-control-ui");
  assert.equal(clientOptions.mode, "webchat");
  assert.equal(clientOptions.persistDeviceAuth, false);
});

test("runGatewayConnectionTest times out and stops a hanging temporary client", async () => {
  const { runGatewayConnectionTest } = loadGatewayConnectionTestModule();
  let timeoutCallback = null;
  let stopped = false;

  class HangingClient {
    start() {}
    stop() {
      stopped = true;
    }
  }

  const resultPromise = runGatewayConnectionTest({
    gatewayUrl: "ws://127.0.0.1:18789",
    clientConstructor: HangingClient,
    timeoutMs: 3000,
    now: () => 40,
    setTimeoutFn: (callback) => {
      timeoutCallback = callback;
      return 1;
    },
    clearTimeoutFn: () => {},
  });

  assert.equal(typeof timeoutCallback, "function");
  timeoutCallback();

  assert.deepEqual(await resultPromise, {
    status: "failure",
    summary: "Connection timed out",
    description: "No Gateway handshake completed within 3 seconds. Check the server address, firewall, and network route.",
    testedAt: 40,
  });
  assert.equal(stopped, true);
});
