import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadThreadToolDomainEventsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/thread-tool-domain-events.ts"));
}

test("normalizeChatEventPayload turns reply payloads into final assistant messages", () => {
  const { normalizeChatEventPayload } = loadThreadToolDomainEventsModule();

  const parsed = normalizeChatEventPayload({
    data: {
      runId: "run-1",
      sessionKey: "agent:main:main",
      reply: {
        text: "Rendered image",
        mediaUrls: ["file:///tmp/example.png"],
      },
    },
  });

  assert.equal(parsed?.state, "final");
  assert.equal(parsed?.runId, "run-1");
  assert.equal(parsed?.sessionKey, "agent:main:main");
  assert.equal(parsed?.message?.role, "assistant");
  assert.equal(parsed?.message?.text, "Rendered image");
  assert.deepEqual(parsed?.message?.mediaUrls, ["file:///tmp/example.png"]);
});

test("normalizeAgentEventPayload extracts tool updates from tool stream payloads", () => {
  const { normalizeAgentEventPayload } = loadThreadToolDomainEventsModule();

  const parsed = normalizeAgentEventPayload({
    ts: 1700,
    runId: "run-2",
    sessionKey: "agent:main:main",
    stream: "tool",
    data: {
      toolCallId: "tool-call-1",
      toolName: "image_generate",
      args: { prompt: "a lighthouse at dusk" },
      status: "started",
    },
  });

  assert.equal(parsed?.stream, "tool");
  assert.equal(parsed?.runId, "run-2");
  assert.equal(parsed?.sessionKey, "agent:main:main");
  assert.equal(parsed?.toolUpdates.length, 1);
  assert.equal(parsed?.toolUpdates[0]?.id, "tool-call-1");
  assert.equal(parsed?.toolUpdates[0]?.name, "image_generate");
  assert.equal(parsed?.toolUpdates[0]?.status, "start");
  assert.deepEqual(parsed?.toolUpdates[0]?.args, { prompt: "a lighthouse at dusk" });
});

test("normalizeAgentEventPayload preserves assistant text and lifecycle error hints", () => {
  const { normalizeAgentEventPayload } = loadThreadToolDomainEventsModule();

  const assistant = normalizeAgentEventPayload({
    data: {
      runId: "run-3",
      sessionKey: "agent:main:main",
      stream: "assistant",
      message: {
        role: "assistant",
        content: "Still working on it",
      },
    },
  });

  assert.equal(assistant?.stream, "assistant");
  assert.equal(assistant?.assistantText, "Still working on it");

  const lifecycle = normalizeAgentEventPayload({
    data: {
      runId: "run-3",
      sessionKey: "agent:main:main",
      stream: "lifecycle",
      phase: "error",
      errorMessage: "Gateway disconnected mid-run.",
    },
  });

  assert.equal(lifecycle?.stream, "lifecycle");
  assert.equal(lifecycle?.lifecyclePhase, "error");
  assert.equal(lifecycle?.lifecycleErrorMessage, "Gateway disconnected mid-run.");
});

test("extractToolUpdatesFromMessage merges tool use and tool result entries by id", () => {
  const { extractToolUpdatesFromMessage } = loadThreadToolDomainEventsModule();

  const updates = extractToolUpdatesFromMessage({
    timestamp: 4200,
    runId: "run-4",
    content: [
      {
        type: "tool_use",
        id: "tool-call-2",
        name: "image_generate",
        input: { prompt: "a neon fox" },
      },
      {
        type: "tool_result",
        toolCallId: "tool-call-2",
        name: "image_generate",
        content: "Done",
        media: {
          mediaUrls: ["/Users/test/.openclaw/media/generated/example.png"],
        },
      },
    ],
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, "tool-call-2");
  assert.equal(updates[0]?.status, "result");
  assert.equal(updates[0]?.outcome, "succeeded");
  assert.equal(updates[0]?.runId, "run-4");
  assert.equal(updates[0]?.output, "Done");
  assert.deepEqual(updates[0]?.mediaPaths, ["/Users/test/.openclaw/media/generated/example.png"]);
});
