import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadFinalAssistantMessageModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/final-assistant-message.ts"));
}

test("shouldCommitFinalAssistantMessage commits attachment-only final messages", () => {
  const { shouldCommitFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.equal(
    shouldCommitFinalAssistantMessage({
      hasRenderableText: false,
      hasRenderableAttachment: true,
      shouldSkipText: true,
    }),
    true,
  );
});

test("shouldCommitFinalAssistantMessage preserves text-plus-attachment finals even if the text itself would be skipped", () => {
  const { shouldCommitFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.equal(
    shouldCommitFinalAssistantMessage({
      hasRenderableText: true,
      hasRenderableAttachment: true,
      shouldSkipText: true,
    }),
    true,
  );
});

test("shouldCommitFinalAssistantMessage skips text-only duplicates", () => {
  const { shouldCommitFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.equal(
    shouldCommitFinalAssistantMessage({
      hasRenderableText: true,
      hasRenderableAttachment: false,
      shouldSkipText: true,
    }),
    false,
  );
});

test("shouldCommitFinalAssistantMessage commits text-only finals when the text is new", () => {
  const { shouldCommitFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.equal(
    shouldCommitFinalAssistantMessage({
      hasRenderableText: true,
      hasRenderableAttachment: false,
      shouldSkipText: false,
    }),
    true,
  );
});
