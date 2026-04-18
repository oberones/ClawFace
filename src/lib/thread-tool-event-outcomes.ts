export type ActiveThreadToolRunSyncOutcome =
  | { kind: "continue" }
  | { kind: "switch-run"; runId: string }
  | { kind: "ignore" }
  | { kind: "reload-history" };

export function resolveActiveThreadToolRunSync(params: {
  activeRunId: string | null | undefined;
  incomingRunId: string | null | undefined;
  thinking: boolean;
  onMismatchWithoutThinking: "ignore" | "reload-history";
}): ActiveThreadToolRunSyncOutcome {
  const activeRunId = params.activeRunId?.trim() ?? "";
  const incomingRunId = params.incomingRunId?.trim() ?? "";

  if (!activeRunId || !incomingRunId || activeRunId === incomingRunId) {
    return { kind: "continue" };
  }

  if (params.thinking) {
    return { kind: "switch-run", runId: incomingRunId };
  }

  return {
    kind: params.onMismatchWithoutThinking,
  };
}

export type ThreadToolDeltaOutcome =
  | { kind: "tool-updates" }
  | { kind: "assistant-text"; text: string }
  | { kind: "ignore" };

export function resolveThreadToolDeltaOutcome(params: {
  toolUpdateCount: number;
  isToolMessage: boolean;
  extractedText: string | null | undefined;
}): ThreadToolDeltaOutcome {
  if (params.toolUpdateCount > 0) {
    return { kind: "tool-updates" };
  }
  if (params.isToolMessage) {
    return { kind: "ignore" };
  }
  const extractedText = params.extractedText?.trim() ?? "";
  if (!extractedText) {
    return { kind: "ignore" };
  }
  return {
    kind: "assistant-text",
    text: extractedText,
  };
}

export type ThreadToolFinalOutcome =
  | { kind: "tool-final-with-committed-stream" }
  | { kind: "tool-final-with-attachments" }
  | { kind: "assistant-final" };

export function resolveThreadToolFinalOutcome(params: {
  isToolFinal: boolean;
  hasCommittedStreamMessage: boolean;
  toolFinalMessageCount: number;
}): ThreadToolFinalOutcome {
  if (!params.isToolFinal) {
    return { kind: "assistant-final" };
  }
  if (params.hasCommittedStreamMessage) {
    return { kind: "tool-final-with-committed-stream" };
  }
  if (params.toolFinalMessageCount > 0) {
    return { kind: "tool-final-with-attachments" };
  }
  return { kind: "assistant-final" };
}

export function resolveThreadToolLifecycleOutcome(
  phase: "start" | "end" | "error" | null,
): "ignore" | "end" | "error" {
  if (phase === "end" || phase === "error") {
    return phase;
  }
  return "ignore";
}
