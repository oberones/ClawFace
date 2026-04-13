import type { ChatMessage, ConnectionStatus, ToolItem } from "./types.ts";

const RECOVERABLE_CONNECTION_STATUSES = new Set<ConnectionStatus>([
  "connecting",
  "error",
  "pairing-required",
]);

export type ConnectionRecoveryNotice = {
  tone: "info" | "success";
  title: string;
  message: string;
};

export type InterruptedRunSnapshot = {
  sessionKey: string;
  runId: string;
  hadStreamText: boolean;
  hadThinking: boolean;
  runningToolNames: string[];
};

export type InterruptedRunSessionBanner = {
  tone: "warning";
  title: string;
  message: string;
  action: "refresh-session";
};

export function shouldAnnounceConnectionRecovery(previousStatus: ConnectionStatus, hasConnectedBefore: boolean): boolean {
  return hasConnectedBefore && RECOVERABLE_CONNECTION_STATUSES.has(previousStatus);
}

export function buildInterruptedRunSnapshot(params: {
  sessionKey?: string | null;
  runId?: string | null;
  streamText?: string | null;
  thinking?: boolean;
  toolItems?: ToolItem[];
}): InterruptedRunSnapshot | null {
  const sessionKey = params.sessionKey?.trim();
  const runId = params.runId?.trim();
  if (!sessionKey || !runId) {
    return null;
  }
  const hadStreamText = Boolean(params.streamText?.trim());
  const hadThinking = Boolean(params.thinking);
  const runningToolNames = Array.from(
    new Set(
      (params.toolItems ?? [])
        .filter((item) => !item.runId || item.runId === runId)
        .filter((item) => item.status !== "result")
        .map((item) => item.name.trim())
        .filter(Boolean),
    ),
  );
  if (!hadStreamText && !hadThinking && runningToolNames.length === 0) {
    return null;
  }
  return {
    sessionKey,
    runId,
    hadStreamText,
    hadThinking,
    runningToolNames,
  };
}

export function hasInterruptedRunResolved(params: {
  snapshot: InterruptedRunSnapshot;
  messages: ChatMessage[];
  toolItems: ToolItem[];
}): boolean {
  return (
    params.messages.some(
      (message) => message.role === "assistant" && message.runId === params.snapshot.runId,
    ) ||
    params.toolItems.some(
      (toolItem) => toolItem.runId === params.snapshot.runId && toolItem.status === "result",
    )
  );
}

export function buildInterruptedRunSessionBanner(
  snapshot: InterruptedRunSnapshot,
): InterruptedRunSessionBanner {
  const toolHint = snapshot.runningToolNames.length === 1
    ? `The previous ${snapshot.runningToolNames[0]} run did not resume automatically after reconnect.`
    : "The previous in-flight run did not resume automatically after reconnect.";
  return {
    tone: "warning",
    title: "Previous run interrupted",
    message: `${toolHint} Refresh again if you expect delayed output, or resend the prompt.`,
    action: "refresh-session",
  };
}

export function buildConnectionRecoveryNotice(params: {
  stage: "gateway-reconnected" | "session-refreshed";
  hasActiveSession?: boolean;
}): ConnectionRecoveryNotice {
  if (params.stage === "session-refreshed") {
    return {
      tone: "success",
      title: "Session refreshed",
      message: "The current session history was reloaded after reconnect.",
    };
  }

  if (params.hasActiveSession) {
    return {
      tone: "info",
      title: "Gateway reconnected",
      message: "Refreshing the current session now.",
    };
  }

  return {
    tone: "success",
    title: "Gateway reconnected",
    message: "OpenClaw is connected again.",
  };
}
