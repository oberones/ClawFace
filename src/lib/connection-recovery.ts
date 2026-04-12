import type { ConnectionStatus } from "./types.ts";

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

export function shouldAnnounceConnectionRecovery(previousStatus: ConnectionStatus, hasConnectedBefore: boolean): boolean {
  return hasConnectedBefore && RECOVERABLE_CONNECTION_STATUSES.has(previousStatus);
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
