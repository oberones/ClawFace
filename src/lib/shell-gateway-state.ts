import type { ConnectionStatus } from "./types.ts";
import type { GatewayCloseInfo, GatewayHelloOk } from "./gateway.ts";

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

export type NormalizedGatewayHelloState = {
  methods: Set<string>;
  serverVersion: string | null;
  serverCommit: string | null;
  maxPayloadBytes: number;
};

export type NormalizedGatewayCloseState = {
  status: ConnectionStatus;
  reason: string | null;
  note: string;
};

export type GatewayStatusSnapshot = {
  statusRoot: Record<string, unknown>;
  defaults: Record<string, unknown> | null;
  recent: Record<string, unknown>[];
  subagentsLine: string | null;
  taskLine: string | null;
};

export function normalizeGatewayHelloState(
  hello: GatewayHelloOk,
  defaultMaxPayloadBytes: number,
): NormalizedGatewayHelloState {
  return {
    methods: new Set(
      Array.isArray(hello.features?.methods)
        ? hello.features.methods.filter((item): item is string => typeof item === "string")
        : [],
    ),
    serverVersion: typeof hello.server?.version === "string" ? hello.server.version : null,
    serverCommit: typeof hello.server?.commit === "string" ? hello.server.commit : null,
    maxPayloadBytes:
      typeof hello.policy?.maxPayload === "number" && Number.isFinite(hello.policy.maxPayload)
        ? hello.policy.maxPayload
        : defaultMaxPayloadBytes,
  };
}

export function normalizeGatewayCloseState(
  info: GatewayCloseInfo,
  clientWasExplicitlyClosed: boolean,
): NormalizedGatewayCloseState {
  const reason = info.reason?.trim() ?? "";
  if (reason.toLowerCase().includes("pairing")) {
    return {
      status: "pairing-required",
      reason,
      note: "Pairing required. Approve this device in the gateway.",
    };
  }
  const hint =
    !reason && info.code === 1006
      ? "Handshake failed. Check Gateway URL/path or Origin allowlist."
      : "";
  const status: ConnectionStatus =
    !clientWasExplicitlyClosed && info.code !== 1000 ? "connecting" : reason ? "error" : "disconnected";
  return {
    status,
    reason: reason || null,
    note:
      status === "connecting"
        ? "Connection lost. Reconnecting…"
        : reason
          ? `Disconnected (${info.code}): ${reason}`
          : `Disconnected (${info.code}). ${hint}`.trim(),
  };
}

export function extractGatewayStatusSnapshot(statusPayload: unknown): GatewayStatusSnapshot {
  const statusRoot: Record<string, unknown> =
    isRecord(statusPayload) && isRecord(statusPayload.status)
      ? statusPayload.status
      : isRecord(statusPayload)
        ? statusPayload
        : {};
  const sessionsRoot = isRecord(statusRoot.sessions) ? statusRoot.sessions : null;
  return {
    statusRoot,
    defaults: sessionsRoot && isRecord(sessionsRoot.defaults) ? sessionsRoot.defaults : null,
    recent:
      sessionsRoot && Array.isArray(sessionsRoot.recent)
        ? sessionsRoot.recent.filter(isRecord)
        : [],
    subagentsLine: getString(statusRoot, ["subagentsLine", "subagents_line"]),
    taskLine: getString(statusRoot, ["taskLine", "task_line"]),
  };
}
