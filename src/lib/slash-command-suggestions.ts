import { BASE_COMMANDS, type SlashCommand } from "./slash-commands.ts";
import { THINKING_LEVEL_CHOICES } from "./runtime-controls.ts";
import { SUBAGENT_ACTIONS } from "./subagent-slash-commands.ts";

export type SlashCommandSuggestion = SlashCommand & {
  value?: string;
  detail?: string;
};

type ModelItem = {
  id: string;
  name: string;
  provider: string;
};

type GetSlashCommandSuggestionsParams = {
  draft: string;
  models: ModelItem[];
};

export type ParsedSlashDraft = {
  showSlashMenu: boolean;
  commandQuery: string;
  tokens: string[];
  commandName: string;
  commandNameLower: string;
  commandArgs: string;
  commandArgsLower: string;
};

export function parseSlashDraft(draft: string): ParsedSlashDraft {
  const trimmedDraft = draft.trim();
  const showSlashMenu = trimmedDraft.startsWith("/");
  const commandQuery = showSlashMenu ? trimmedDraft.replace(/^\//, "") : "";
  const tokens = commandQuery.split(/\s+/).filter(Boolean);
  const commandName = tokens[0] ?? "";
  const commandArgs = tokens.slice(1).join(" ");
  return {
    showSlashMenu,
    commandQuery,
    tokens,
    commandName,
    commandNameLower: commandName.toLowerCase(),
    commandArgs,
    commandArgsLower: commandArgs.toLowerCase(),
  };
}

export function getSlashCommandSuggestions(
  params: GetSlashCommandSuggestionsParams,
): SlashCommandSuggestion[] {
  const parsed = parseSlashDraft(params.draft);
  if (!parsed.showSlashMenu) {
    return [];
  }
  const thinkCommand =
    parsed.commandNameLower === "think" ||
    parsed.commandNameLower === "thinking" ||
    parsed.commandNameLower === "t";

  if (parsed.commandNameLower === "model") {
    return params.models
      .filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(parsed.commandArgsLower))
      .slice(0, 8)
      .map((model) => ({
        name: "model",
        description: model.name,
        detail: `${model.provider}/${model.id}`,
        value: `${model.provider}/${model.id}`,
      }));
  }

  if (thinkCommand) {
    return THINKING_LEVEL_CHOICES
      .filter((level) => level.startsWith(parsed.commandArgsLower))
      .map((level) => ({
        name: parsed.commandName,
        description: "Thinking level",
        detail: level,
        value: level,
      }));
  }

  if (parsed.commandNameLower === "subagents") {
    const subagentQuery = parsed.commandArgsLower.split(/\s+/)[0] ?? "";
    return SUBAGENT_ACTIONS
      .filter((item) => item.action.startsWith(subagentQuery))
      .map((item) => ({
        name: "subagents",
        description: item.description,
        detail: item.usage,
        value: item.action,
      }));
  }

  return BASE_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(parsed.commandNameLower));
}
