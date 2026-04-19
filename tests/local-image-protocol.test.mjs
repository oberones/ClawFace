import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const {
  createLocalImageTransport,
  resolveGatewayHttpBaseCandidates,
  hasRemoteGatewayCandidates,
} = require(path.join(repoRoot, "electron/protocols/local-image.cjs"));

test("resolveGatewayHttpBaseCandidates normalizes ws and nested gateway paths", () => {
  assert.deepEqual(resolveGatewayHttpBaseCandidates("wss://example.com/gateway/ws"), [
    "https://example.com/gateway/ws",
    "https://example.com/gateway",
    "https://example.com",
  ]);
});

test("hasRemoteGatewayCandidates distinguishes local and remote gateway hosts", () => {
  assert.equal(
    hasRemoteGatewayCandidates(["http://localhost:4545", "http://127.0.0.1:8787"]),
    false,
  );
  assert.equal(
    hasRemoteGatewayCandidates(["http://localhost:4545", "https://gateway.example.com/api"]),
    true,
  );
});

test("createLocalImageTransport reads a local image file through the desktop helper", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawface-local-image-home-"));
  const imagePath = path.join(homeDir, "sample.png");
  fs.writeFileSync(
    imagePath,
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wn0UAAAAASUVORK5CYII=", "base64"),
  );

  const transport = createLocalImageTransport({
    homeDir,
    localImageScheme: "claw-local-image",
    getGatewayBaseCandidates: () => [],
  });

  const result = await transport.readDesktopImageFile(imagePath);

  assert.equal(result.ok, true);
  assert.equal(result.path, imagePath);
  assert.equal(result.mimeType, "image/png");
  assert.match(result.dataUrl, /^data:image\/png;base64,/);
});
