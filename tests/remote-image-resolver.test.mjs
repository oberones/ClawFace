import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const { loadModule } = createTsModuleLoader();
const modulePath = path.resolve("src/hooks/useRemoteImageResolver.ts");
const {
  buildRemoteMediaRequestDedupeKey,
  shouldAcceptRemoteImageResponseSize,
} = loadModule(modulePath);

test("buildRemoteMediaRequestDedupeKey is stable across object key order", () => {
  const first = buildRemoteMediaRequestDedupeKey("media.read", {
    path: "/tmp/image.png",
    filePath: "/tmp/image.png",
  });
  const second = buildRemoteMediaRequestDedupeKey("media.read", {
    filePath: "/tmp/image.png",
    path: "/tmp/image.png",
  });

  assert.equal(first, second);
});

test("shouldAcceptRemoteImageResponseSize rejects oversized content-length or blob sizes", () => {
  assert.equal(shouldAcceptRemoteImageResponseSize("1024", null), true);
  assert.equal(shouldAcceptRemoteImageResponseSize(String(12 * 1024 * 1024), null), true);
  assert.equal(shouldAcceptRemoteImageResponseSize(String(12 * 1024 * 1024 + 1), null), false);
  assert.equal(shouldAcceptRemoteImageResponseSize(null, 12 * 1024 * 1024), true);
  assert.equal(shouldAcceptRemoteImageResponseSize(null, 12 * 1024 * 1024 + 1), false);
  assert.equal(shouldAcceptRemoteImageResponseSize("garbage", 2048), true);
});
