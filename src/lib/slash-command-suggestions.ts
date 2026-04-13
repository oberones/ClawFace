import { BASE_COMMANDS, type SlashCommand } from "./slash-commands.ts";

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

const THINK_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

const SUBAGENT_ACTIONS: Array<{
  action: string;
  description: string;
  usage: string;
}> = [
  { action: "list", description: "Show active subagent runs", usage: "/subagents list" },
  { action: "kill", description: "Stop one or more subagent runs", usage: "/subagents kill <id|#|all>" },
  { action: "log", description: "Show recent output from a subagent run", usage: "/subagents log <id|#> [limit]" },
  { action: "info", description: "Show detailed status for a subagent run", usage: "/subagents info <id|#>" },
  { action: "send", description: "Send a follow-up message to a subagent run", usage: "/subagents send <id|#> <message>" },
  { action: "steer", description: "Steer a subagent run with a corrective message", usage: "/subagents steer <id|#> <message>" },
  { action: "spawn", description: "Spawn a new subagent for this session", usage: "/subagents spawn <agentId> <task>" },
];

export function getSlashCommandSuggestions(
  params: GetSlashCommandSuggestionsParams,
): SlashCommandSuggestion[] {
  const showSlashMenu = params.draft.trim().startsWith("/");
  if (!showSlashMenu) {
    return [];
  }

  const commandQuery = params.draft.trim().replace(/^\//, "");
  const tokens = commandQuery.split(/\s+/).filter(Boolean);
  const commandName = tokens[0] ?? "";
  const commandArgs = tokens.slice(1).join(" ");
  const thinkCommand = commandName === "think" || commandName === "thinking" || commandName === "t";

  if (commandName === "model") {
    return params.models
      .filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(commandArgs.toLowerCase()))
      .slice(0, 8)
      .map((model) => ({
        name: "model",
        description: model.name,
        detail: `${model.provider}/${model.id}`,
        value: `${model.provider}/${model.id}`,
      }));
  }

  if (thinkCommand) {
    return THINK_LEVELS
      .filter((level) => level.startsWith(commandArgs.toLowerCase()))
      .map((level) => ({
        name: commandName,
        description: "Thinking level",
        detail: level,
        value: level,
      }));
  }

  if (commandName === "subagents") {
    const subagentQuery = commandArgs.trim().toLowerCase().split(/\s+/)[0] ?? "";
    return SUBAGENT_ACTIONS
      .filter((item) => item.action.startsWith(subagentQuery))
      .map((item) => ({
        name: "subagents",
        description: item.description,
        detail: item.usage,
        value: item.action,
      }));
  }

  return BASE_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(commandName.toLowerCase()));
}
