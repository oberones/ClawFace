import type { ApprovalDecision, ApprovalKind, PendingApproval } from "./types.ts";

const DEFAULT_PLUGIN_APPROVAL_DECISIONS: ApprovalDecision[] = [
  "allow-once",
  "allow-always",
  "deny",
];
const DEFAULT_EXEC_APPROVAL_DECISIONS: ApprovalDecision[] = [
  "allow-once",
  "deny",
];

export type ApprovalResolution = {
  id: string;
  kind: ApprovalKind;
  sessionKey: string | null;
  decision: ApprovalDecision | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickStringArray(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const entries = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (entries.length > 0) {
      return entries;
    }
  }
  return [];
}

function parseApprovalKind(eventName: string): ApprovalKind | null {
  if (eventName === "exec.approval.requested" || eventName === "exec.approval.resolved") {
    return "exec";
  }
  if (eventName === "plugin.approval.requested" || eventName === "plugin.approval.resolved") {
    return "plugin";
  }
  return null;
}

function normalizeApprovalDecision(value: string | null | undefined): ApprovalDecision | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "allow-once" || normalized === "allow-always" || normalized === "deny") {
    return normalized;
  }
  return null;
}

function dedupeDecisions(decisions: ApprovalDecision[]): ApprovalDecision[] {
  return decisions.filter((decision, index, all) => all.indexOf(decision) === index);
}

function formatExecApprovalDescription(request: Record<string, unknown>): string {
  const command =
    pickString(request, ["commandPreview", "commandText", "command"]) ??
    "(command unavailable)";
  const host = pickString(request, ["host"]);
  return host ? `${command} (${host})` : command;
}

export function extractPendingApprovalFromGatewayEvent(
  eventName: string,
  payload: unknown,
): PendingApproval | null {
  const kind = parseApprovalKind(eventName);
  if (!kind || !eventName.endsWith(".requested") || !isRecord(payload)) {
    return null;
  }
  const request = isRecord(payload.request) ? payload.request : {};
  const id = pickString(payload, ["id"]);
  if (!id) {
    return null;
  }
  const sessionKey = pickString(request, ["sessionKey", "session_key"]);
  const title =
    kind === "plugin"
      ? pickString(request, ["title"]) ?? "Plugin approval requested"
      : "Command approval requested";
  const description =
    kind === "plugin"
      ? pickString(request, ["description"]) ?? "This plugin action requires approval."
      : formatExecApprovalDescription(request);
  const allowedDecisions =
    kind === "exec"
      ? dedupeDecisions(
          pickStringArray(request, ["allowedDecisions", "allowed_decisions"])
            .map((value) => normalizeApprovalDecision(value))
            .filter((value): value is ApprovalDecision => value !== null),
        )
      : DEFAULT_PLUGIN_APPROVAL_DECISIONS;
  const fallbackDecisions =
    kind === "exec"
      ? DEFAULT_EXEC_APPROVAL_DECISIONS
      : DEFAULT_PLUGIN_APPROVAL_DECISIONS;

  return {
    id,
    kind,
    sessionKey,
    approvalSlug: pickString(payload, ["approvalSlug", "approval_slug"]),
    title,
    description,
    command: kind === "exec" ? pickString(request, ["commandPreview", "commandText", "command"]) : null,
    host: kind === "exec" ? pickString(request, ["host"]) : null,
    agentId: pickString(request, ["agentId", "agent_id"]),
    toolCallId: pickString(request, ["toolCallId", "tool_call_id"]),
    allowedDecisions: allowedDecisions.length > 0 ? allowedDecisions : fallbackDecisions,
    createdAtMs:
      typeof payload.createdAtMs === "number" && Number.isFinite(payload.createdAtMs)
        ? payload.createdAtMs
        : null,
    expiresAtMs:
      typeof payload.expiresAtMs === "number" && Number.isFinite(payload.expiresAtMs)
        ? payload.expiresAtMs
        : null,
  };
}

export function extractApprovalResolutionFromGatewayEvent(
  eventName: string,
  payload: unknown,
): ApprovalResolution | null {
  const kind = parseApprovalKind(eventName);
  if (!kind || !eventName.endsWith(".resolved") || !isRecord(payload)) {
    return null;
  }
  const request = isRecord(payload.request) ? payload.request : {};
  const id = pickString(payload, ["id"]);
  if (!id) {
    return null;
  }
  return {
    id,
    kind,
    sessionKey: pickString(request, ["sessionKey", "session_key"]),
    decision: normalizeApprovalDecision(pickString(payload, ["decision"])),
  };
}

export function upsertPendingApprovalBySession(
  prev: Record<string, PendingApproval[]>,
  nextApproval: PendingApproval,
): Record<string, PendingApproval[]> {
  const sessionKey = nextApproval.sessionKey?.trim();
  if (!sessionKey) {
    return prev;
  }
  const current = prev[sessionKey] ?? [];
  const filtered = current.filter((approval) => approval.id !== nextApproval.id);
  const nextList = [...filtered, nextApproval].sort((a, b) => {
    const aTs = a.createdAtMs ?? 0;
    const bTs = b.createdAtMs ?? 0;
    if (aTs !== bTs) {
      return aTs - bTs;
    }
    return a.id.localeCompare(b.id);
  });
  return {
    ...prev,
    [sessionKey]: nextList,
  };
}

export function removeResolvedApprovalBySession(
  prev: Record<string, PendingApproval[]>,
  resolution: ApprovalResolution,
): Record<string, PendingApproval[]> {
  let changed = false;
  const next: Record<string, PendingApproval[]> = {};
  for (const [sessionKey, approvals] of Object.entries(prev)) {
    const filtered = approvals.filter((approval) => approval.id !== resolution.id);
    if (filtered.length !== approvals.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      next[sessionKey] = filtered;
    } else if (filtered.length !== approvals.length) {
      changed = true;
    } else if (approvals.length > 0) {
      next[sessionKey] = approvals;
    }
  }
  return changed ? next : prev;
}

export function pickApprovalResolveMethod(
  methods: Iterable<string>,
  kind: ApprovalKind,
): string | null {
  const methodSet = new Set(Array.from(methods));
  const method = kind === "plugin" ? "plugin.approval.resolve" : "exec.approval.resolve";
  return methodSet.has(method) ? method : null;
}

export function formatApprovalDecisionLabel(decision: ApprovalDecision): string {
  if (decision === "allow-once") {
    return "Allow Once";
  }
  if (decision === "allow-always") {
    return "Allow Always";
  }
  return "Deny";
}
