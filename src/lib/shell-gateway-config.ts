import type { AgentsListResult } from "./types.ts";
import { normalizeModelKey } from "./runtime-controls.ts";

const WORKSPACE_MARKER = "/.openclaw/workspace";

export type GatewayConfigState = {
  configuredModelKeys: Set<string>;
  queueMode: string;
  runtimePathHints: {
    homeDir: string | null;
    workspaceDir: string | null;
  };
  providerApiKeyLabels: Record<string, string>;
  defaultHeartbeatSession: string | null;
  heartbeatSessionOverrides: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function getNested(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function getNestedString(source: unknown, path: string[]): string | null {
  const value = getNested(source, path);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getConfigRoot(configSnapshot: unknown): Record<string, unknown> | null {
  if (!isRecord(configSnapshot)) {
    return null;
  }
  return isRecord(configSnapshot.config) ? configSnapshot.config : configSnapshot;
}

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimTrailingSlashes(value: string): string {
  const normalized = normalizeFsPath(value).trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/g, "");
}

function deriveHomeFromWorkspacePath(workspacePath: string): string {
  const normalized = trimTrailingSlashes(workspacePath).toLowerCase();
  const markerIndex = normalized.indexOf(WORKSPACE_MARKER);
  if (markerIndex <= 0) {
    return "";
  }
  return trimTrailingSlashes(workspacePath).slice(0, markerIndex);
}

function isAbsoluteFsPath(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("~/")
  );
}

function formatApiKeySnippet(apiKey: string): string {
  const compact = apiKey.replace(/\s+/g, "");
  if (!compact) {
    return "unknown";
  }
  if (compact.includes("${")) {
    return "configured";
  }
  const edge = compact.length >= 12 ? 6 : 4;
  return `${compact.slice(0, edge)}…${compact.slice(-edge)}`;
}

function collectProviderApiKeyLabels(configRoot: Record<string, unknown> | null): Record<string, string> {
  if (!configRoot) {
    return {};
  }
  const providers = getNested(configRoot, ["models", "providers"]);
  if (!isRecord(providers)) {
    return {};
  }
  const next: Record<string, string> = {};
  for (const [providerId, entry] of Object.entries(providers)) {
    if (!isRecord(entry)) {
      continue;
    }
    const apiKey = getString(entry, ["apiKey", "api_key"]);
    if (!apiKey) {
      continue;
    }
    next[providerId.trim().toLowerCase()] = `api-key ${formatApiKeySnippet(apiKey)} (${providerId}:default)`;
  }
  return next;
}

function resolveQueueMode(configRoot: Record<string, unknown> | null): string {
  if (!configRoot) {
    return "collect";
  }
  return (
    getNestedString(configRoot, ["queue", "mode"]) ??
    getNestedString(configRoot, ["session", "queue", "mode"]) ??
    getNestedString(configRoot, ["agents", "defaults", "queue", "mode"]) ??
    "collect"
  );
}

function collectConfiguredModelKeys(configRoot: Record<string, unknown> | null): Set<string> {
  const keys = new Set<string>();
  if (!configRoot) {
    return keys;
  }
  const aliasToModelKey = new Map<string, string>();
  const agents = isRecord(configRoot.agents) ? configRoot.agents : null;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : null;
  if (defaults && isRecord(defaults.models)) {
    for (const [key, value] of Object.entries(defaults.models)) {
      const normalizedKey = normalizeModelKey(key);
      if (normalizedKey) {
        keys.add(normalizedKey);
      }
      if (!isRecord(value)) {
        continue;
      }
      const alias = typeof value.alias === "string" ? normalizeModelKey(value.alias) : "";
      if (alias && normalizedKey) {
        aliasToModelKey.set(alias, normalizedKey);
      }
    }
  }

  const addModelValue = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const normalized = normalizeModelKey(trimmed);
    keys.add(normalized);
    const mapped = aliasToModelKey.get(normalized);
    if (mapped) {
      keys.add(mapped);
    }
  };

  const addModelList = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    for (const item of value) {
      addModelValue(item);
    }
  };

  const defaultModel = defaults && isRecord(defaults.model) ? defaults.model : null;
  if (defaultModel) {
    addModelValue(defaultModel.primary);
    addModelList(defaultModel.fallbacks);
  }
  const defaultImageModel = defaults && isRecord(defaults.imageModel) ? defaults.imageModel : null;
  if (defaultImageModel) {
    addModelValue(defaultImageModel.primary);
    addModelList(defaultImageModel.fallbacks);
  }

  return keys;
}

function collectRuntimePathHints(snapshot: unknown): GatewayConfigState["runtimePathHints"] {
  if (!isRecord(snapshot)) {
    return { homeDir: null, workspaceDir: null };
  }
  const queue: Array<{ value: unknown; keyPath: string; depth: number }> = [
    { value: snapshot, keyPath: "", depth: 0 },
  ];
  let nodes = 0;
  const MAX_NODES = 600;
  const MAX_DEPTH = 7;
  let workspaceCandidate = "";
  let homeCandidate = "";

  while (queue.length > 0 && nodes < MAX_NODES) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    nodes += 1;
    const { value, keyPath, depth } = current;
    if (typeof value === "string") {
      const trimmed = trimTrailingSlashes(value);
      if (!trimmed) {
        continue;
      }
      const lowerValue = trimmed.toLowerCase();
      const lowerKey = keyPath.toLowerCase();
      const isAbsoluteLike = isAbsoluteFsPath(trimmed);
      if (!isAbsoluteLike) {
        continue;
      }
      if (!workspaceCandidate && (lowerKey.includes("workspace") || lowerValue.includes(WORKSPACE_MARKER))) {
        workspaceCandidate = trimmed;
      }
      if (!homeCandidate && lowerKey.includes("home")) {
        homeCandidate = trimmed;
      }
      continue;
    }
    if (depth >= MAX_DEPTH) {
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        queue.push({ value: value[index], keyPath: `${keyPath}[${index}]`, depth: depth + 1 });
      }
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    for (const [key, nested] of Object.entries(value)) {
      const nextKeyPath = keyPath ? `${keyPath}.${key}` : key;
      queue.push({ value: nested, keyPath: nextKeyPath, depth: depth + 1 });
    }
  }

  const derivedHome = workspaceCandidate ? deriveHomeFromWorkspacePath(workspaceCandidate) : "";
  return {
    homeDir: homeCandidate || derivedHome || null,
    workspaceDir: workspaceCandidate || null,
  };
}

function collectHeartbeatSessionState(configRoot: Record<string, unknown> | null): Pick<
  GatewayConfigState,
  "defaultHeartbeatSession" | "heartbeatSessionOverrides"
> {
  if (!configRoot) {
    return {
      defaultHeartbeatSession: null,
      heartbeatSessionOverrides: {},
    };
  }
  const agentsConfig = isRecord(configRoot.agents) ? configRoot.agents : null;
  const defaults = agentsConfig && isRecord(agentsConfig.defaults) ? agentsConfig.defaults : null;
  const defaultHeartbeatSession =
    defaults ? getNestedString(defaults, ["heartbeat", "session"])?.trim().toLowerCase() ?? null : null;
  const heartbeatSessionOverrides: Record<string, string> = {};
  const list = agentsConfig && Array.isArray(agentsConfig.list) ? agentsConfig.list : [];
  for (const entry of list) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = getString(entry, ["id"])?.trim().toLowerCase();
    const session = getNestedString(entry, ["heartbeat", "session"])?.trim().toLowerCase() ?? "";
    if (!id || !session) {
      continue;
    }
    heartbeatSessionOverrides[id] = session;
  }
  return {
    defaultHeartbeatSession,
    heartbeatSessionOverrides,
  };
}

function resolveHeartbeatSessionOverride(
  configState: GatewayConfigState | null | undefined,
  defaultAgentId: string,
): string | null {
  if (!configState) {
    return null;
  }
  const agentId = defaultAgentId.trim().toLowerCase();
  if (!agentId) {
    return configState.defaultHeartbeatSession;
  }
  return configState.heartbeatSessionOverrides[agentId] ?? configState.defaultHeartbeatSession;
}

export function normalizeShellGatewayConfigState(payload: unknown): GatewayConfigState {
  const configRoot = getConfigRoot(payload);
  const heartbeatState = collectHeartbeatSessionState(configRoot);
  return {
    configuredModelKeys: collectConfiguredModelKeys(configRoot),
    queueMode: resolveQueueMode(configRoot),
    runtimePathHints: collectRuntimePathHints(payload),
    providerApiKeyLabels: collectProviderApiKeyLabels(configRoot),
    defaultHeartbeatSession: heartbeatState.defaultHeartbeatSession,
    heartbeatSessionOverrides: heartbeatState.heartbeatSessionOverrides,
  };
}

export function resolveProviderApiKeyLabel(
  configState: GatewayConfigState | null | undefined,
  providerRaw: string | null,
): string | null {
  const provider = providerRaw?.trim().toLowerCase();
  if (!provider || !configState) {
    return null;
  }
  return configState.providerApiKeyLabels[provider] ?? null;
}

export function resolvePrimarySessionKey(
  agents: AgentsListResult | null,
  configState?: GatewayConfigState | null,
): string {
  if (agents?.scope === "global") {
    return "global";
  }
  const agentId = (agents?.defaultId ?? "main").trim().toLowerCase() || "main";
  const mainKey = (agents?.mainKey ?? "main").trim().toLowerCase() || "main";
  const override = resolveHeartbeatSessionOverride(configState, agentId);
  if (!override || override === "main" || override === "global") {
    return `agent:${agentId}:${mainKey}`;
  }
  if (override.startsWith("agent:")) {
    return override;
  }
  if (override.startsWith("global")) {
    return "global";
  }
  const overrideKey = override.replace(/^:+|:+$/g, "");
  if (!overrideKey) {
    return `agent:${agentId}:${mainKey}`;
  }
  return `agent:${agentId}:${overrideKey}`;
}
