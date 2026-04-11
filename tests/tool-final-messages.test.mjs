import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadToolFinalMessagesModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/tool-final-messages.ts"));
}

test("collectToolFinalMessages preserves stream-first ordering when the committed stream message should be shown", () => {
  const { collectToolFinalMessages } = loadToolFinalMessagesModule();

  assert.deepEqual(
    collectToolFinalMessages({
      committedStreamMessage: "stream",
      includeCommittedStreamMessage: true,
      toolAttachmentMessage: "primary-attachment",
      toolAttachmentMessagesFromUpdates: ["update-1", "update-2"],
    }),
    ["stream", "primary-attachment", "update-1", "update-2"],
  );
});

test("collectToolFinalMessages omits the committed stream message when it should be suppressed", () => {
  const { collectToolFinalMessages } = loadToolFinalMessagesModule();

  assert.deepEqual(
    collectToolFinalMessages({
      committedStreamMessage: "stream",
      includeCommittedStreamMessage: false,
      toolAttachmentMessage: "primary-attachment",
      toolAttachmentMessagesFromUpdates: ["update-1"],
    }),
    ["primary-attachment", "update-1"],
  );
});

test("collectToolFinalMessages still returns update attachments when there is no primary tool attachment", () => {
  const { collectToolFinalMessages } = loadToolFinalMessagesModule();

  assert.deepEqual(
    collectToolFinalMessages({
      committedStreamMessage: null,
      includeCommittedStreamMessage: false,
      toolAttachmentMessage: null,
      toolAttachmentMessagesFromUpdates: ["update-1", "update-2"],
    }),
    ["update-1", "update-2"],
  );
});
