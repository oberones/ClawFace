import type { ConnectionStatus } from "./types.ts";
import type { InterruptedRunSessionBanner } from "./connection-recovery.ts";

export type ComposerRuntimeState = "offline" | "busy" | "ready";

export type ComposerConnectionNotice = {
  tone: "warning" | "info";
  message: string;
  action: "open-settings" | null;
};

export type SessionRecoveryBanner = {
  tone: "warning" | "info";
  title: string;
  message: string;
  action: "open-settings" | "refresh-session" | null;
};

export type ConnectionFeedback = {
  statusLabel: string;
  statusDotClass: "connected" | "connecting" | "warning" | "disconnected";
  composerNotice: ComposerConnectionNotice | null;
  sessionBanner: SessionRecoveryBanner | null;
};

type ConnectionFeedbackParams = {
  connectionStatus: ConnectionStatus;
  hasActiveSession: boolean;
  disabledReason?: string | null;
  composerRuntimeState: ComposerRuntimeState;
  interruptedRunBanner?: InterruptedRunSessionBanner | null;
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

  let sessionBanner: SessionRecoveryBanner | null = null;
  if (params.hasActiveSession) {
    switch (params.connectionStatus) {
      case "connected":
        sessionBanner = params.interruptedRunBanner ?? null;
        break;
      case "connecting":
        sessionBanner = {
          tone: "info",
          title: "Reconnecting to gateway",
          message:
            "Keeping this session visible while the gateway reconnects. New events and history refresh will resume automatically.",
          action: null,
        };
        break;
      case "pairing-required":
        sessionBanner = {
          tone: "warning",
          title: "Pairing required",
          message: params.disabledReason || "This session is paused until this device is approved by the gateway.",
          action: null,
        };
        break;
      case "error":
        sessionBanner = {
          tone: "warning",
          title: "Session paused",
          message:
            params.disabledReason ||
            "The gateway connection failed. This session stays visible, but sending and history refresh are paused until the connection recovers.",
          action: "open-settings",
        };
        break;
      case "disconnected":
        sessionBanner = {
          tone: "warning",
          title: "Gateway disconnected",
          message:
            params.disabledReason ||
            "This session stays visible, but sending and history refresh are paused until the gateway reconnects.",
          action: "open-settings",
        };
        break;
      default:
        sessionBanner = null;
        break;
    }
  }

  return {
    statusLabel,
    statusDotClass,
    composerNotice,
    sessionBanner,
  };
}
