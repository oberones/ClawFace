import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayResponsesModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-responses.ts"));
}

test("normalizeAgentsListResult filters invalid entries and preserves trimmed identity metadata", () => {
  const { normalizeAgentsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeAgentsListResult({
    default_id: "agent-main",
    main_key: "agent:main:main",
    scope: "per-sender",
    agents: [
      {
        id: "agent-main",
        name: " Main ",
        identity: {
          name: "Primary",
          emoji: "🦞",
          avatar_url: "https://example.com/avatar.png",
        },
      },
      {
        name: "missing-id",
      },
    ],
  });

  assert.equal(normalized.defaultId, "agent-main");
  assert.equal(normalized.mainKey, "agent:main:main");
  assert.equal(normalized.scope, "per-sender");
  assert.equal(normalized.agents.length, 1);
  assert.equal(normalized.agents[0]?.name, "Main");
  assert.equal(normalized.agents[0]?.identity?.avatarUrl, "https://example.com/avatar.png");
});

test("normalizeModelsListResult filters invalid models and normalizes optional flags", () => {
  const { normalizeModelsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeModelsListResult({
    models: [
      {
        id: "gpt-5.4",
        name: " GPT-5.4 ",
        provider: "openai",
        context_window: "200000",
        available: true,
      },
      {
        id: "missing-provider",
      },
    ],
  });

  assert.deepEqual(normalized.models, [
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      provider: "openai",
      contextWindow: 200000,
      available: true,
    },
  ]);
});

test("normalizeSessionsListResult filters invalid session rows and normalizes defaults", () => {
  const { normalizeSessionsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeSessionsListResult({
    ts: 1700,
    path: " /tmp/sessions.json ",
    defaults: {
      model_provider: "openai",
      model: "gpt-5.4",
      context_tokens: "200000",
    },
    sessions: [
      {
        key: "agent:main:main",
        kind: "direct",
        updated_at: "1800",
        last_message_preview: " Latest answer ",
        response_usage: "tokens",
      },
      [],
      {
        kind: "group",
      },
    ],
  });

  assert.equal(normalized.ts, 1700);
  assert.equal(normalized.path, "/tmp/sessions.json");
  assert.deepEqual(normalized.defaults, {
    modelProvider: "openai",
    model: "gpt-5.4",
    contextTokens: 200000,
  });
  assert.equal(normalized.sessions.length, 1);
  assert.equal(normalized.sessions[0]?.key, "agent:main:main");
  assert.equal(normalized.sessions[0]?.updatedAt, 1800);
  assert.equal(normalized.sessions[0]?.lastMessagePreview, "Latest answer");
  assert.equal(normalized.sessions[0]?.responseUsage, "tokens");
});

test("normalizeSessionsPreviewResult filters invalid previews and blank preview items", () => {
  const { normalizeSessionsPreviewResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeSessionsPreviewResult({
    ts: 1701,
    previews: [
      {
        key: "agent:main:main",
        status: " ready ",
        items: [
          { role: "assistant", text: " Hello " },
          { role: "assistant", text: "   " },
          "ignored",
        ],
      },
      {
        status: "missing-key",
      },
    ],
  });

  assert.equal(normalized.ts, 1701);
  assert.deepEqual(normalized.previews, [
    {
      key: "agent:main:main",
      status: "ready",
      items: [
        {
          role: "assistant",
          text: "Hello",
        },
      ],
    },
  ]);
});
