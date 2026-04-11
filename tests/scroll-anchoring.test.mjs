import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadScrollAnchoringModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/scroll-anchoring.ts"));
}

function createAnimationFrameHarness() {
  let nextHandle = 1;
  const callbacks = new Map();
  const canceled = [];

  return {
    requestFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      canceled.push(handle);
      callbacks.delete(handle);
    },
    flush(handle) {
      const callback = callbacks.get(handle);
      assert.ok(callback, `expected pending frame ${handle}`);
      callbacks.delete(handle);
      callback(0);
    },
    getPendingHandles() {
      return [...callbacks.keys()];
    },
    getCanceledHandles() {
      return [...canceled];
    },
  };
}

test("createBottomPinScheduler pins to bottom when a delayed attachment resize lands and auto-scroll is enabled", () => {
  const { createBottomPinScheduler } = loadScrollAnchoringModule();
  const frames = createAnimationFrameHarness();
  let pinCount = 0;

  const scheduler = createBottomPinScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    shouldPin: () => true,
    pinToBottom: () => {
      pinCount += 1;
    },
  });

  scheduler.schedule();
  const [pendingHandle] = frames.getPendingHandles();
  frames.flush(pendingHandle);

  assert.equal(pinCount, 1);
});

test("createBottomPinScheduler coalesces repeated resize events before paint", () => {
  const { createBottomPinScheduler } = loadScrollAnchoringModule();
  const frames = createAnimationFrameHarness();
  let pinCount = 0;

  const scheduler = createBottomPinScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    shouldPin: () => true,
    pinToBottom: () => {
      pinCount += 1;
    },
  });

  scheduler.schedule();
  scheduler.schedule();

  assert.deepEqual(frames.getCanceledHandles(), [1]);
  assert.deepEqual(frames.getPendingHandles(), [2]);

  frames.flush(2);

  assert.equal(pinCount, 1);
});

test("createBottomPinScheduler skips pinning when auto-scroll is no longer enabled by the time the frame runs", () => {
  const { createBottomPinScheduler } = loadScrollAnchoringModule();
  const frames = createAnimationFrameHarness();
  let autoScrollEnabled = true;
  let pinCount = 0;

  const scheduler = createBottomPinScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    shouldPin: () => autoScrollEnabled,
    pinToBottom: () => {
      pinCount += 1;
    },
  });

  scheduler.schedule();
  autoScrollEnabled = false;
  const [pendingHandle] = frames.getPendingHandles();
  frames.flush(pendingHandle);

  assert.equal(pinCount, 0);
});

test("createBottomPinScheduler cancels pending work on dispose", () => {
  const { createBottomPinScheduler } = loadScrollAnchoringModule();
  const frames = createAnimationFrameHarness();
  let pinCount = 0;

  const scheduler = createBottomPinScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    shouldPin: () => true,
    pinToBottom: () => {
      pinCount += 1;
    },
  });

  scheduler.schedule();
  scheduler.dispose();

  assert.deepEqual(frames.getCanceledHandles(), [1]);
  assert.deepEqual(frames.getPendingHandles(), []);
  assert.equal(pinCount, 0);
});
