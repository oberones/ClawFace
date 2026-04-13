import { useCallback, useMemo, useState } from "react";
import { BASE_COMMANDS } from "../lib/slash-commands.ts";
import {
  getSlashCommandSuggestions,
  type SlashCommandSuggestion,
} from "../lib/slash-command-suggestions.ts";

export type UseSlashCommandsOptions = {
  draft: string;
  models: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
  onDraftChange: (value: string) => void;
};

export function useSlashCommands(options: UseSlashCommandsOptions) {
  const [activeCommand, setActiveCommand] = useState(0);

  const showSlashMenu = options.draft.trim().startsWith("/");
  const commandQuery = options.draft.trim().replace(/^\//, "");
  const tokens = commandQuery.split(/\s+/).filter(Boolean);
  const commandName = tokens[0] ?? "";
  const commandArgs = tokens.slice(1).join(" ");

  const commandSuggestions = useMemo<SlashCommandSuggestion[]>(() => {
    return getSlashCommandSuggestions({
      draft: options.draft,
      models: options.models,
    });
  }, [options.draft, options.models]);

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
  }, [options.onDraftChange]);

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
