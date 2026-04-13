import type { ConnectionStatus } from "./types.ts";
import type { InterruptedRunSessionBanner } from "./connection-recovery.ts";

export type ComposerRuntimeState = "offline" | "busy" | "ready";
export const PAIRING_APPROVAL_COMMAND = "openclaw devices approve";

export type ComposerConnectionNotice = {
  tone: "warning" | "info";
  message: string;
  action: "open-settings" | "copy-pairing-command" | null;
};

export type SessionRecoveryBanner = {
  tone: "warning" | "info";
  title: string;
  message: string;
  action: "open-settings" | "refresh-session" | null;
};

export type ApprovalShellBanner = {
  tone: "warning";
  title: string;
  message: string;
  action: "copy-pairing-command" | null;
};

export type ConnectionFeedback = {
  statusLabel: string;
  statusDotClass: "connected" | "connecting" | "warning" | "disconnected";
  composerNotice: ComposerConnectionNotice | null;
  approvalBanner: ApprovalShellBanner | null;
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
  const pairingMessage =
    params.disabledReason || `Pairing required. Approve this device with ${PAIRING_APPROVAL_COMMAND}.`;

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
            message: pairingMessage,
            action: "copy-pairing-command" as const,
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

  const approvalBanner =
    params.connectionStatus === "pairing-required"
      ? {
          tone: "warning" as const,
          title: "Pairing approval required",
          message: pairingMessage,
          action: "copy-pairing-command" as const,
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
        sessionBanner = null;
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
    approvalBanner,
    sessionBanner,
  };
}
