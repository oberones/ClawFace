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

test("normalizeSessionsListResult sanitizes derived titles and previews that contain OpenClaw metadata", () => {
  const { normalizeSessionsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeSessionsListResult({
    sessions: [
      {
        key: "agent:main:main",
        kind: "direct",
        derived_title: 'Sender (untrusted metadata): ```json {"label":"bad"}',
        last_message_preview:
          'Conversation info (untrusted metadata): ```json\n{"sender":"Primary"}\n```\n[Wed 2026-04-13 09:15 UTC] Real preview',
      },
    ],
  });

  assert.equal(normalized.sessions[0]?.derivedTitle, undefined);
  assert.equal(normalized.sessions[0]?.lastMessagePreview, "Real preview");
});

test("normalizeSessionsListResult hides OpenClaw dream narrative sessions from the workstation session list", () => {
  const { normalizeSessionsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeSessionsListResult({
    count: 4,
    sessions: [
      {
        key: "agent:main:main",
        kind: "direct",
        updated_at: 1800,
        derived_title: "Daily work session",
      },
      {
        key: "agent:main:dreaming-narrative-light-c17d738737c1-1776913200144",
        kind: "direct",
        updated_at: 1900,
        derived_title: "Write a dream diary entry from these memory fragments",
      },
      {
        key: "agent:main:dreaming-narrative-rem-c17d738737c1-1776913200144",
        kind: "direct",
        updated_at: 2000,
        last_message_preview: "Tonight I kept finding the same small word under every stone.",
      },
      {
        key: "agent:main:codex-acp-review",
        kind: "direct",
        updated_at: 1700,
        derived_title: "Review branch feedback",
      },
    ],
  });

  assert.deepEqual(normalized.sessions.map((session) => session.key), [
    "agent:main:main",
    "agent:main:codex-acp-review",
  ]);
  assert.equal(normalized.count, 2);
});

test("mergeSessionRowsWithLocalState preserves an existing explicit label when a refreshed row omits it", () => {
  const { mergeSessionRowsWithLocalState } = loadShellGatewayResponsesModule();

  const merged = mergeSessionRowsWithLocalState(
    [
      {
        key: "agent:main:main",
        kind: "direct",
        label: "Pinned title",
        derivedTitle: "Pinned title",
        updatedAt: 10,
      },
    ],
    [
      {
        key: "agent:main:main",
        kind: "direct",
        derivedTitle: "Fresh derived title",
        updatedAt: 20,
      },
      {
        key: "agent:main:secondary",
        kind: "direct",
        label: "Fresh explicit title",
        updatedAt: 30,
      },
    ],
  );

  assert.deepEqual(merged, [
    {
      key: "agent:main:main",
      kind: "direct",
      label: "Pinned title",
      derivedTitle: "Fresh derived title",
      updatedAt: 20,
    },
    {
      key: "agent:main:secondary",
      kind: "direct",
      label: "Fresh explicit title",
      updatedAt: 30,
    },
  ]);
});

test("normalizeSessionsListResult does not coerce blank numeric strings to zero", () => {
  const { normalizeSessionsListResult } = loadShellGatewayResponsesModule();

  const normalized = normalizeSessionsListResult({
    defaults: {
      context_tokens: "   ",
    },
    sessions: [
      {
        key: "agent:main:main",
        updated_at: "  ",
        context_tokens: "",
      },
    ],
  });

  assert.equal(normalized.defaults.contextTokens, null);
  assert.equal(normalized.sessions[0]?.updatedAt, null);
  assert.equal(normalized.sessions[0]?.contextTokens, undefined);
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
