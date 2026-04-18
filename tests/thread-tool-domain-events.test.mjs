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

test("extractToolUpdatesFromAgent handles nested function payloads, failures, and non-finite timestamps", () => {
  const { extractToolUpdatesFromAgent } = loadThreadToolDomainEventsModule();

  const before = Date.now();
  const updates = extractToolUpdatesFromAgent({
    ts: Number.NaN,
    data: {
      stream: "tool",
      items: [
        {
          id: "tool-call-3",
          function: {
            name: "exec",
            arguments: { cmd: "ls -la" },
          },
          phase: "started",
        },
        {
          toolCallId: "tool-call-4",
          toolName: "exec",
          result: {
            error: {
              message: "permission denied",
            },
          },
          status: "error",
        },
      ],
    },
    runId: "run-5",
  });
  const after = Date.now();

  const started = updates.find((update) => update.status === "start" && update.name === "exec");
  assert.ok(started);
  assert.deepEqual(started.args, { cmd: "ls -la" });
  assert.equal(started.runId, "run-5");
  assert.equal(typeof started.startedAt, "number");
  assert.ok((started.startedAt ?? 0) >= before && (started.startedAt ?? 0) <= after);

  const failed = updates.find((update) => update.id === "tool-call-4");
  assert.ok(failed);
  assert.equal(failed.status, "result");
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.errorMessage, "permission denied");
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

test("attachLifecycleErrorToToolItems marks only the last running tool item for the run as failed", () => {
  const { attachLifecycleErrorToToolItems } = loadThreadToolDomainEventsModule();

  const items = [
    {
      id: "tool-1",
      name: "exec",
      status: "result",
      outcome: "succeeded",
      runId: "run-6",
      startedAt: 100,
      updatedAt: 110,
    },
    {
      id: "tool-2",
      name: "image_generate",
      status: "update",
      outcome: "running",
      runId: "run-6",
      startedAt: 120,
      updatedAt: 130,
    },
    {
      id: "tool-3",
      name: "exec",
      status: "update",
      outcome: "running",
      runId: "run-7",
      startedAt: 140,
      updatedAt: 150,
    },
  ];

  const next = attachLifecycleErrorToToolItems(items, {
    runId: "run-6",
    errorMessage: "Gateway disconnected",
  });

  assert.equal(next[1]?.status, "result");
  assert.equal(next[1]?.outcome, "failed");
  assert.equal(next[1]?.errorMessage, "Gateway disconnected");
  assert.equal(next[2]?.outcome, "running");

  const unchanged = attachLifecycleErrorToToolItems(items, {
    runId: "run-missing",
    errorMessage: "Ignored",
  });
  assert.equal(unchanged, items);
});
