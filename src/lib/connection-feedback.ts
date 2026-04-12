import type { ConnectionStatus } from "./types.ts";

export type ComposerRuntimeState = "offline" | "busy" | "ready";

export type ComposerConnectionNotice = {
  tone: "warning" | "info";
  message: string;
  action: "open-settings" | null;
};

export type ConnectionFeedback = {
  statusLabel: string;
  statusDotClass: "connected" | "connecting" | "warning" | "disconnected";
  composerNotice: ComposerConnectionNotice | null;
};

type ConnectionFeedbackParams = {
  connectionStatus: ConnectionStatus;
  disabledReason?: string | null;
  composerRuntimeState: ComposerRuntimeState;
};

export function deriveConnectionFeedback(params: ConnectionFeedbackParams): ConnectionFeedback {
  const statusLabel =
    params.connectionStatus === "connected"
      ? "Gateway connected"
      : params.connectionStatus === "connecting"
        ? "Connecting to gateway…"
        : params.connectionStatus === "pairing-required"
          ? "Gateway pairing required"
          : params.connectionStatus === "error"
            ? "Gateway connection error"
            : "Gateway disconnected";

  const statusDotClass =
    params.connectionStatus === "connected"
      ? "connected"
      : params.connectionStatus === "connecting"
        ? "connecting"
        : params.connectionStatus === "pairing-required"
          ? "warning"
          : params.connectionStatus === "error"
            ? "warning"
            : "disconnected";

  const composerNotice =
    params.connectionStatus === "connecting"
      ? {
          tone: "info" as const,
          message: params.disabledReason || "Connecting to the gateway…",
          action: null,
        }
      : params.connectionStatus === "pairing-required"
        ? {
            tone: "warning" as const,
            message: params.disabledReason || "Pairing required before sending messages.",
            action: null,
          }
        : params.connectionStatus === "error"
          ? {
              tone: "warning" as const,
              message: params.disabledReason || "Gateway connection error. Check settings and retry.",
              action: "open-settings" as const,
            }
          : params.connectionStatus === "disconnected"
            ? {
                tone: "warning" as const,
                message: params.disabledReason || "Gateway disconnected. Update settings to reconnect.",
                action: "open-settings" as const,
              }
            : params.composerRuntimeState === "busy"
              ? {
                  tone: "info" as const,
                  message:
                    "A run is already in progress. You can keep editing, but stop it or wait for it to finish before sending again.",
                  action: null,
                }
              : null;

  return {
    statusLabel,
    statusDotClass,
    composerNotice,
  };
}
