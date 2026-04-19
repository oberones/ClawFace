import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadShellGatewayConfigModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/shell-gateway-config.ts"));
}

test("normalizeShellGatewayConfigState collects queue mode, provider labels, model keys, and heartbeat overrides", () => {
  const { normalizeShellGatewayConfigState, resolveProviderApiKeyLabel } = loadShellGatewayConfigModule();

  const normalized = normalizeShellGatewayConfigState({
    config: {
      queue: {
        mode: "drain",
      },
      models: {
        providers: {
          openai: {
            api_key: "${OPENAI_API_KEY}",
          },
        },
      },
      agents: {
        defaults: {
          heartbeat: {
            session: "ops",
          },
          models: {
            "openai/gpt-5.4": {
              alias: "fast",
            },
          },
          model: {
            primary: "fast",
            fallbacks: ["openai/gpt-4.1"],
          },
          imageModel: {
            primary: "image-main",
          },
        },
        list: [
          {
            id: "main",
            heartbeat: {
              session: "agent:main:review",
            },
          },
        ],
      },
      runtime: {
        workspaceDir: "/Users/oberon/.openclaw/workspace/ClawFace",
      },
    },
  });

  assert.equal(normalized.queueMode, "drain");
  assert.equal(
    resolveProviderApiKeyLabel(normalized, "openai"),
    "api-key configured (openai:default)",
  );
  assert.equal(normalized.runtimePathHints.homeDir, "/Users/oberon");
  assert.equal(
    normalized.runtimePathHints.workspaceDir,
    "/Users/oberon/.openclaw/workspace/ClawFace",
  );
  assert.equal(normalized.defaultHeartbeatSession, "ops");
  assert.equal(normalized.heartbeatSessionOverrides.main, "agent:main:review");
  assert.equal(normalized.configuredModelKeys.has("openai/gpt-5.4"), true);
  assert.equal(normalized.configuredModelKeys.has("fast"), true);
  assert.equal(normalized.configuredModelKeys.has("openai/gpt-4.1"), true);
  assert.equal(normalized.configuredModelKeys.has("image-main"), true);
});

test("resolvePrimarySessionKey honors agent-specific heartbeat overrides before defaults", () => {
  const { normalizeShellGatewayConfigState, resolvePrimarySessionKey } = loadShellGatewayConfigModule();

  const configState = normalizeShellGatewayConfigState({
    config: {
      agents: {
        defaults: {
          heartbeat: {
            session: "ops",
          },
        },
        list: [
          {
            id: "main",
            heartbeat: {
              session: "review",
            },
          },
        ],
      },
    },
  });

  assert.equal(
    resolvePrimarySessionKey(
      {
        defaultId: "main",
        mainKey: "main",
        scope: "per-sender",
        agents: [],
      },
      configState,
    ),
    "agent:main:review",
  );
});

test("normalizeShellGatewayConfigState derives runtime home from nested workspace-only hints", () => {
  const { normalizeShellGatewayConfigState } = loadShellGatewayConfigModule();

  const normalized = normalizeShellGatewayConfigState({
    config: {
      recent: [
        {
          workspace_path: "/Users/demo/.openclaw/workspace/project-a",
        },
      ],
    },
  });

  assert.deepEqual(normalized.runtimePathHints, {
    homeDir: "/Users/demo",
    workspaceDir: "/Users/demo/.openclaw/workspace/project-a",
  });
});
