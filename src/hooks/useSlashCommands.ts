import { useCallback, useMemo, useState } from "react";
import { BASE_COMMANDS, type SlashCommand } from "../lib/slash-commands.ts";

type ModelItem = {
  id: string;
  name: string;
  provider: string;
};

export type SlashCommandSuggestion = SlashCommand & {
  value?: string;
};

export type UseSlashCommandsOptions = {
  draft: string;
  models: ModelItem[];
  onDraftChange: (value: string) => void;
};

const THINK_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function useSlashCommands(options: UseSlashCommandsOptions) {
  const [activeCommand, setActiveCommand] = useState(0);

  const showSlashMenu = options.draft.trim().startsWith("/");
  const commandQuery = options.draft.trim().replace(/^\//, "");
  const tokens = commandQuery.split(/\s+/).filter(Boolean);
  const commandName = tokens[0] ?? "";
  const commandArgs = tokens.slice(1).join(" ");

  const commandSuggestions = useMemo<SlashCommandSuggestion[]>(() => {
    if (!showSlashMenu) {
      return [];
    }
    const thinkCommand = commandName === "think" || commandName === "thinking" || commandName === "t";
    if (commandName && (commandName === "model" || thinkCommand)) {
      if (commandName === "model") {
        return options.models
          .filter((model) => `${model.provider}/${model.id}`.toLowerCase().includes(commandArgs.toLowerCase()))
          .slice(0, 8)
          .map((model) => ({
            name: "model",
            description: model.name,
            value: `${model.provider}/${model.id}`,
          }));
      }
      return THINK_LEVELS
        .filter((level) => level.startsWith(commandArgs.toLowerCase()))
        .map((level) => ({ name: commandName, description: "Thinking level", value: level }));
    }
    return BASE_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(commandName.toLowerCase()));
  }, [showSlashMenu, commandName, commandArgs, options.models]);

  const requiresArgs =
    commandName === "model" ||
    commandName === "think" ||
    commandName === "thinking" ||
    commandName === "t";

  const exactCommand = useMemo(
    () => BASE_COMMANDS.find((cmd) => cmd.name === commandName) ?? null,
    [commandName],
  );

  const applySuggestion = useCallback((suggestion: SlashCommandSuggestion) => {
    if (suggestion.value) {
      options.onDraftChange(`/${suggestion.name} ${suggestion.value} `);
    } else {
      options.onDraftChange(`/${suggestion.name} `);
    }
    setActiveCommand(0);
  }, [options]);

  const moveSelection = useCallback((delta: number) => {
    if (commandSuggestions.length === 0) {
      return;
    }
    setActiveCommand((prev) => (prev + delta + commandSuggestions.length) % commandSuggestions.length);
  }, [commandSuggestions.length]);

  const applyActiveSuggestion = useCallback(() => {
    const suggestion = commandSuggestions[activeCommand];
    if (!suggestion) {
      return false;
    }
    applySuggestion(suggestion);
    return true;
  }, [activeCommand, applySuggestion, commandSuggestions]);

  return {
    activeCommand,
    setActiveCommand,
    showSlashMenu,
    commandName,
    commandArgs,
    commandSuggestions,
    requiresArgs,
    exactCommand,
    applySuggestion,
    moveSelection,
    applyActiveSuggestion,
  };
}
