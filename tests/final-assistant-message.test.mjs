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

test("shouldCommitFinalAssistantMessage skips empty final messages when neither text nor attachments are renderable", () => {
  const { shouldCommitFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.equal(
    shouldCommitFinalAssistantMessage({
      hasRenderableText: false,
      hasRenderableAttachment: false,
      shouldSkipText: false,
    }),
    false,
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

test("resolveFinalAssistantMessage schedules hydration for text-only finals when media is still expected", () => {
  const { resolveFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.deepEqual(
    resolveFinalAssistantMessage({
      message: {
        text: "Here you go",
        attachments: [],
      },
      hasCommittedAttachment: false,
      expectsMedia: true,
      shouldSkipText: false,
    }),
    {
      hasRenderableText: true,
      hasRenderableAttachment: false,
      shouldCommitMessage: true,
      hydrationDecision: "schedule",
    },
  );
});

test("resolveFinalAssistantMessage clears hydration and still commits attachment-bearing finals even when the text itself would be skipped", () => {
  const { resolveFinalAssistantMessage } = loadFinalAssistantMessageModule();

  assert.deepEqual(
    resolveFinalAssistantMessage({
      message: {
        text: "duplicate text",
        attachments: [{ kind: "image", source: "monkey.png" }],
      },
      hasCommittedAttachment: false,
      expectsMedia: true,
      shouldSkipText: true,
    }),
    {
      hasRenderableText: true,
      hasRenderableAttachment: true,
      shouldCommitMessage: true,
      hydrationDecision: "clear",
    },
  );
});

test("resolveActiveFinalAssistantEvent schedules delayed hydration when the live final has no assistant message yet", () => {
  const { resolveActiveFinalAssistantEvent } = loadFinalAssistantMessageModule();

  assert.deepEqual(
    resolveActiveFinalAssistantEvent({
      message: null,
      hasCommittedAttachment: false,
      expectsMedia: true,
      shouldSkipText: true,
    }),
    {
      kind: "schedule-history-hydration",
    },
  );
});

test("resolveActiveFinalAssistantEvent commits attachment-bearing finals instead of scheduling delayed hydration", () => {
  const { resolveActiveFinalAssistantEvent } = loadFinalAssistantMessageModule();

  assert.deepEqual(
    resolveActiveFinalAssistantEvent({
      message: {
        text: "duplicate text",
        attachments: [{ id: "1", name: "monkey.png", size: 1, type: "image/png", dataUrl: "", isImage: true }],
      },
      hasCommittedAttachment: false,
      expectsMedia: true,
      shouldSkipText: true,
    }),
    {
      kind: "final-assistant-message",
      hasRenderableText: true,
      hasRenderableAttachment: true,
      shouldCommitMessage: true,
      hydrationDecision: "clear",
    },
  );
});
