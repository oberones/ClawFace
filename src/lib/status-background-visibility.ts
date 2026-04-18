import { extractGatewayStatusSnapshot } from "./shell-gateway-state.ts";

export type StatusBackgroundVisibility = {
  subagentsLine: string | null;
  taskLine: string | null;
};

export function extractStatusBackgroundVisibility(statusPayload: unknown): StatusBackgroundVisibility {
  const snapshot = extractGatewayStatusSnapshot(statusPayload);
  return {
    subagentsLine: snapshot.subagentsLine,
    taskLine: snapshot.taskLine,
  };
}
