export const SUBAGENT_ACTIONS: Array<{
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

export const SUBAGENT_USAGE_SUMMARY = `/subagents ${SUBAGENT_ACTIONS.map(({ action }) => action).join("|")}`;
export const SUBAGENT_COMMAND_DESCRIPTION = "Manage subagent runs";
