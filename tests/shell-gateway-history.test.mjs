import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayHistoryModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-history.ts"));
}

test("normalizeShellGatewayHistory infers timestamps, preserves thinking level, and accumulates tool updates", () => {
  const { normalizeShellGatewayHistory } = loadShellGatewayHistoryModule();
  const observedTimestamps = [];

  const normalized = normalizeShellGatewayHistory(
    {
      thinkingLevel: "high",
      messages: [
        {
          role: "assistant",
          content: "Hello from history",
        },
        {
          timestamp: 2500,
          runId: "run-1",
          content: [
            {
              type: "tool_use",
              id: "tool-call-1",
              name: "image_generate",
              input: { prompt: "sunrise over water" },
            },
            {
              type: "tool_result",
              toolCallId: "tool-call-1",
              name: "image_generate",
              content: "Done",
              media: {
                mediaUrls: ["/Users/test/.openclaw/media/generated/example.png"],
              },
            },
          ],
        },
      ],
    },
    {
      fallbackNow: 5000,
      toChatMessage: (raw, fallbackTimestamp) => {
        observedTimestamps.push(fallbackTimestamp);
        if (raw && typeof raw === "object" && "role" in raw) {
          return {
            id: `msg-${fallbackTimestamp}`,
            role: "assistant",
            text: "Hello from history",
            timestamp: fallbackTimestamp,
          };
        }
        return null;
      },
      buildToolAttachmentMessages: (toolUpdates) =>
        toolUpdates.map((update) => ({
          id: `tool-${update.id}`,
          role: "assistant",
          text: update.output ?? "",
          timestamp: update.updatedAt ?? 0,
        })),
      buildMessageDedupeKey: (message) => `${message.role}:${message.text}:${message.timestamp}`,
    },
  );

  assert.equal(normalized.rawCount, 2);
  assert.equal(normalized.thinkingLevel, "high");
  assert.deepEqual(observedTimestamps, [4999, 2500]);
  assert.equal(normalized.toolUpdates.length, 1);
  assert.equal(normalized.toolUpdates[0]?.id, "tool-call-1");
  assert.equal(normalized.toolUpdates[0]?.output, "Done");
  assert.equal(normalized.messages.length, 2);
  assert.equal(normalized.messages[0]?.text, "Hello from history");
  assert.equal(normalized.messages[1]?.text, "Done");
});

test("normalizeShellGatewayHistory dedupes tool attachment messages against parsed history messages", () => {
  const { normalizeShellGatewayHistory } = loadShellGatewayHistoryModule();

  const normalized = normalizeShellGatewayHistory(
    {
      messages: [
        {
          timestamp: 1700,
          runId: "run-2",
          content: [
            {
              type: "tool_use",
              id: "tool-call-2",
              name: "image_generate",
              input: { prompt: "forest trail" },
            },
            {
              type: "tool_result",
              toolCallId: "tool-call-2",
              name: "image_generate",
              content: "Rendered image",
            },
          ],
        },
      ],
    },
    {
      toChatMessage: (_raw, fallbackTimestamp) => ({
        id: "parsed-tool-result",
        role: "assistant",
        text: "Rendered image",
        timestamp: fallbackTimestamp,
      }),
      buildToolAttachmentMessages: (toolUpdates) =>
        toolUpdates.map((update) => ({
          id: `tool-${update.id}`,
          role: "assistant",
          text: update.output ?? "",
          timestamp: update.updatedAt ?? 0,
        })),
      buildMessageDedupeKey: (message) => `${message.role}:${message.text}:${message.timestamp}`,
    },
  );

  assert.equal(normalized.toolUpdates.length, 1);
  assert.equal(normalized.messages.length, 1);
  assert.equal(normalized.messages[0]?.text, "Rendered image");
});
