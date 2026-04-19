import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createClawFsProtocolHandler } = require(
  path.join(repoRoot, "electron/protocols/claw-fs.cjs"),
);

test("createClawFsProtocolHandler returns default roots when config is missing", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawface-clawfs-home-"));
  const handleClawFsRequest = createClawFsProtocolHandler({
    homeDir,
    getServerUrl: () => "",
  });

  const response = await handleClawFsRequest(new Request("claw-fs://fs/roots"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    roots: [
      {
        label: "Workspace",
        path: path.join(homeDir, ".openclaw", "workspace"),
      },
    ],
  });
});

test("createClawFsProtocolHandler proxies requests when a remote fs server is configured", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawface-clawfs-home-"));
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const handleClawFsRequest = createClawFsProtocolHandler({
      homeDir,
      getServerUrl: () => "http://127.0.0.1:4545/base/",
    });

    const response = await handleClawFsRequest(
      new Request("claw-fs://fs/list?path=%2Ftmp%2Fworkspace"),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(fetchCalls, [
      {
        url: "http://127.0.0.1:4545/base/__claw/fs/list?path=%2Ftmp%2Fworkspace",
        init: { method: "GET", headers: {} },
      },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
