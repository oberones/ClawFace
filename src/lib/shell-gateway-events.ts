import {
  extractApprovalResolutionFromGatewayEvent,
  extractPendingApprovalFromGatewayEvent,
  type ApprovalResolution,
} from "./approval-events.ts";
import type { PendingApproval } from "./types.ts";

export type ApprovalGatewayEvent =
  | {
      kind: "approval-requested";
      approval: PendingApproval;
    }
  | {
      kind: "approval-resolved";
      resolution: ApprovalResolution;
    };

export type DevicePairingGatewayEvent =
  | {
      kind: "device-pair-requested";
    }
  | {
      kind: "device-pair-resolved";
      requestId: string | null;
    };

export type ShellGatewayEvent = ApprovalGatewayEvent | DevicePairingGatewayEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function normalizeApprovalGatewayEvent(
  eventName: string,
  payload: unknown,
): ApprovalGatewayEvent | null {
  if (eventName === "exec.approval.requested" || eventName === "plugin.approval.requested") {
    const approval = extractPendingApprovalFromGatewayEvent(eventName, payload);
    return approval ? { kind: "approval-requested", approval } : null;
  }
  if (eventName === "exec.approval.resolved" || eventName === "plugin.approval.resolved") {
    const resolution = extractApprovalResolutionFromGatewayEvent(eventName, payload);
    return resolution ? { kind: "approval-resolved", resolution } : null;
  }
  return null;
}

export function normalizeDevicePairingGatewayEvent(
  eventName: string,
  payload: unknown,
): DevicePairingGatewayEvent | null {
  if (eventName === "device.pair.requested") {
    return { kind: "device-pair-requested" };
  }
  if (eventName !== "device.pair.resolved") {
    return null;
  }
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};
  return {
    kind: "device-pair-resolved",
    requestId: getString(root, ["requestId", "request_id"]) ?? getString(data, ["requestId", "request_id"]),
  };
}

export function normalizeShellGatewayEvent(
  eventName: string,
  payload: unknown,
): ShellGatewayEvent | null {
  return normalizeApprovalGatewayEvent(eventName, payload) ?? normalizeDevicePairingGatewayEvent(eventName, payload);
}
