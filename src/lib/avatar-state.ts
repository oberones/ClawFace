import type { ConnectionStatus } from "./types.ts";

export type AvatarState =
  | "idle"
  | "thinking"
  | "streaming"
  | "tool-running"
  | "success"
  | "serious"
  | "caution"
  | "warning"
  | "approval-needed"
  | "disconnected";

export type AvatarFinalOutcome =
  | "success"
  | "serious"
  | "caution"
  | "blocked"
  | "denied"
  | "error"
  | "none";

export type AvatarSignalSnapshot = {
  connectionStatus: ConnectionStatus;
  approvalNeeded?: boolean;
  activeToolCount?: number;
  thinking?: boolean;
  streaming?: boolean;
  finalOutcome?: AvatarFinalOutcome;
};

export const AVATAR_STATE_LABELS: Record<AvatarState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  streaming: "Responding",
  "tool-running": "Tool running",
  success: "Response complete",
  serious: "Serious response",
  caution: "Cautionary response",
  warning: "Blocked or warning",
  "approval-needed": "Approval needed",
  disconnected: "Disconnected or pairing required",
};

const WARNING_OUTCOMES = new Set<AvatarFinalOutcome>(["blocked", "denied", "error"]);

function normalizeActiveToolCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function deriveAvatarState(snapshot: AvatarSignalSnapshot): AvatarState {
  if (
    snapshot.connectionStatus === "disconnected" ||
    snapshot.connectionStatus === "pairing-required"
  ) {
    return "disconnected";
  }

  if (snapshot.approvalNeeded) {
    return "approval-needed";
  }

  const finalOutcome = snapshot.finalOutcome ?? "none";
  if (snapshot.connectionStatus === "error" || WARNING_OUTCOMES.has(finalOutcome)) {
    return "warning";
  }

  if (normalizeActiveToolCount(snapshot.activeToolCount) > 0) {
    return "tool-running";
  }

  if (snapshot.thinking) {
    return "thinking";
  }

  if (snapshot.streaming) {
    return "streaming";
  }

  if (finalOutcome === "caution") {
    return "caution";
  }

  if (finalOutcome === "serious") {
    return "serious";
  }

  if (finalOutcome === "success") {
    return "success";
  }

  return "idle";
}

// Future OpenClaw-provided status metadata should enter through AvatarSignalSnapshot,
// not by coupling rendering assets to gateway payload shapes.
