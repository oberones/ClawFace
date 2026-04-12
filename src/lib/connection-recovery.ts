import type { ConnectionStatus } from "./types.ts";

export type ConnectionRecoveryNotice = {
  tone: "info" | "success";
  title: string;
  message: string;
};

export function shouldAnnounceConnectionRecovery(previousStatus: ConnectionStatus, hasConnectedBefore: boolean): boolean {
  return hasConnectedBefore && previousStatus !== "connected";
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
