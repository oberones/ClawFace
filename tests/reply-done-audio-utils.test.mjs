import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadReplyDoneAudioUtilsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(
    path.join(repoRoot, "src/components/settings-sections/reply-done-audio-utils.ts"),
  );
}

test("validateReplyDoneAudioFile rejects non-audio and oversized files", () => {
  const { validateReplyDoneAudioFile } = loadReplyDoneAudioUtilsModule();

  assert.equal(
    validateReplyDoneAudioFile({ type: "image/png", size: 12_000 }, 100_000),
    "Only audio files are supported.",
  );
  assert.equal(
    validateReplyDoneAudioFile({ type: "audio/mpeg", size: 430_081 }, 420 * 1024),
    "File too large. Max 420 KB.",
  );
  assert.equal(
    validateReplyDoneAudioFile({ type: "audio/mpeg", size: 12_000 }, 420 * 1024),
    null,
  );
});

test("normalizeReplyDoneAudioDataUrl accepts trimmed audio data URLs and rejects invalid payloads", () => {
  const { normalizeReplyDoneAudioDataUrl } = loadReplyDoneAudioUtilsModule();

  assert.equal(
    normalizeReplyDoneAudioDataUrl("  data:audio/mpeg;base64,AAAA  "),
    "data:audio/mpeg;base64,AAAA",
  );
  assert.equal(normalizeReplyDoneAudioDataUrl("data:text/plain;base64,AAAA"), null);
  assert.equal(normalizeReplyDoneAudioDataUrl("data:audio/mpeg,AAAA"), null);
  assert.equal(normalizeReplyDoneAudioDataUrl(null), null);
});

test("normalizeReplyDoneAudioFileName trims and caps saved file names", () => {
  const { normalizeReplyDoneAudioFileName } = loadReplyDoneAudioUtilsModule();

  assert.equal(normalizeReplyDoneAudioFileName("  chime.wav  "), "chime.wav");
  assert.equal(
    normalizeReplyDoneAudioFileName(` ${"x".repeat(140)}.wav `).length,
    120,
  );
});
