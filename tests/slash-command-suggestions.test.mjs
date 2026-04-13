import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSlashCommandSuggestionsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/slash-command-suggestions.ts"));
}

test("getSlashCommandSuggestions exposes trustworthy subagent actions when typing /subagents", () => {
  const { getSlashCommandSuggestions } = loadSlashCommandSuggestionsModule();

  const suggestions = getSlashCommandSuggestions({
    draft: "/subagents ",
    models: [],
  });

  assert.deepEqual(
    suggestions.map((item) => [item.value, item.detail]),
    [
      ["list", "/subagents list"],
      ["kill", "/subagents kill <id|#|all>"],
      ["log", "/subagents log <id|#> [limit]"],
      ["info", "/subagents info <id|#>"],
      ["send", "/subagents send <id|#> <message>"],
      ["steer", "/subagents steer <id|#> <message>"],
      ["spawn", "/subagents spawn <agentId> <task>"],
    ],
  );
});

test("getSlashCommandSuggestions filters subagent actions by the partial action token", () => {
  const { getSlashCommandSuggestions } = loadSlashCommandSuggestionsModule();

  const suggestions = getSlashCommandSuggestions({
    draft: "/subagents s",
    models: [],
  });

  assert.deepEqual(
    suggestions.map((item) => item.value),
    ["send", "steer", "spawn"],
  );
});

test("getSlashCommandSuggestions keeps model suggestions working while showing provider/model details", () => {
  const { getSlashCommandSuggestions } = loadSlashCommandSuggestionsModule();

  const suggestions = getSlashCommandSuggestions({
    draft: "/model son",
    models: [
      { provider: "openai", id: "gpt-5-sonnet", name: "GPT-5 Sonnet" },
      { provider: "anthropic", id: "claude-3-opus", name: "Claude Opus" },
    ],
  });

  assert.deepEqual(suggestions, [
    {
      name: "model",
      description: "GPT-5 Sonnet",
      detail: "openai/gpt-5-sonnet",
      value: "openai/gpt-5-sonnet",
    },
  ]);
});

test("getSlashCommandSuggestions keeps thinking suggestions working for aliases and detail rendering", () => {
  const { getSlashCommandSuggestions } = loadSlashCommandSuggestionsModule();

  const suggestions = getSlashCommandSuggestions({
    draft: "/thinking h",
    models: [],
  });

  assert.deepEqual(suggestions, [
    {
      name: "thinking",
      description: "Thinking level",
      detail: "high",
      value: "high",
    },
  ]);
});
