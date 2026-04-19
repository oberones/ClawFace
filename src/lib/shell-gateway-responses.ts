import type {
  AgentsListResult,
  GatewaySessionRow,
  ModelsListResult,
  SessionsListResult,
  SessionsPreviewResult,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickTrimmedString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function pickNumberLike(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.trim().replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function normalizeSessionKind(value: string | null): GatewaySessionRow["kind"] {
  if (value === "direct" || value === "group" || value === "global") {
    return value;
  }
  return "unknown";
}

function normalizeSendPolicy(value: string | null): GatewaySessionRow["sendPolicy"] | undefined {
  return value === "allow" || value === "deny" ? value : undefined;
}

function normalizeResponseUsage(
  value: string | null,
): GatewaySessionRow["responseUsage"] | undefined {
  return value === "on" || value === "off" || value === "tokens" || value === "full" ? value : undefined;
}

function withOptionalString<T extends object>(
  target: T,
  key: string,
  value: string | null,
): T {
  if (!value) {
    return target;
  }
  return { ...target, [key]: value };
}

function withOptionalNumber<T extends object>(
  target: T,
  key: string,
  value: number | null,
): T {
  if (value === null) {
    return target;
  }
  return { ...target, [key]: value };
}

function normalizeGatewaySessionRow(raw: unknown): GatewaySessionRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const key = pickTrimmedString(raw, ["key"]);
  if (!key) {
    return null;
  }
  let row: GatewaySessionRow = {
    key,
    kind: normalizeSessionKind(pickTrimmedString(raw, ["kind"])),
    updatedAt: pickNumberLike(raw, ["updatedAt", "updated_at"]),
  };
  row = withOptionalString(row, "label", pickTrimmedString(raw, ["label"]));
  row = withOptionalString(row, "displayName", pickTrimmedString(raw, ["displayName", "display_name"]));
  row = withOptionalString(row, "derivedTitle", pickTrimmedString(raw, ["derivedTitle", "derived_title"]));
  row = withOptionalString(row, "lastMessagePreview", pickTrimmedString(raw, ["lastMessagePreview", "last_message_preview"]));
  row = withOptionalString(row, "channel", pickTrimmedString(raw, ["channel"]));
  row = withOptionalString(row, "subject", pickTrimmedString(raw, ["subject"]));
  row = withOptionalString(row, "groupChannel", pickTrimmedString(raw, ["groupChannel", "group_channel"]));
  row = withOptionalString(row, "space", pickTrimmedString(raw, ["space"]));
  row = withOptionalString(row, "chatType", pickTrimmedString(raw, ["chatType", "chat_type"]));
  row = withOptionalString(row, "sessionId", pickTrimmedString(raw, ["sessionId", "session_id"]));
  row = withOptionalString(row, "thinkingLevel", pickTrimmedString(raw, ["thinkingLevel", "thinking_level"]));
  row = withOptionalString(row, "verboseLevel", pickTrimmedString(raw, ["verboseLevel", "verbose_level"]));
  row = withOptionalString(row, "reasoningLevel", pickTrimmedString(raw, ["reasoningLevel", "reasoning_level"]));
  row = withOptionalString(row, "elevatedLevel", pickTrimmedString(raw, ["elevatedLevel", "elevated_level"]));
  row = withOptionalString(row, "modelProvider", pickTrimmedString(raw, ["modelProvider", "model_provider"]));
  row = withOptionalString(row, "model", pickTrimmedString(raw, ["model"]));
  row = withOptionalString(row, "lastChannel", pickTrimmedString(raw, ["lastChannel", "last_channel"]));
  row = withOptionalString(row, "lastTo", pickTrimmedString(raw, ["lastTo", "last_to"]));
  row = withOptionalString(row, "lastAccountId", pickTrimmedString(raw, ["lastAccountId", "last_account_id"]));
  row = withOptionalNumber(row, "inputTokens", pickNumberLike(raw, ["inputTokens", "input_tokens"]));
  row = withOptionalNumber(row, "outputTokens", pickNumberLike(raw, ["outputTokens", "output_tokens"]));
  row = withOptionalNumber(row, "totalTokens", pickNumberLike(raw, ["totalTokens", "total_tokens"]));
  row = withOptionalNumber(row, "contextTokens", pickNumberLike(raw, ["contextTokens", "context_tokens"]));
  const systemSent = pickBoolean(raw, ["systemSent", "system_sent"]);
  if (systemSent !== null) {
    row.systemSent = systemSent;
  }
  const abortedLastRun = pickBoolean(raw, ["abortedLastRun", "aborted_last_run"]);
  if (abortedLastRun !== null) {
    row.abortedLastRun = abortedLastRun;
  }
  const sendPolicy = normalizeSendPolicy(pickTrimmedString(raw, ["sendPolicy", "send_policy"]));
  if (sendPolicy) {
    row.sendPolicy = sendPolicy;
  }
  const responseUsage = normalizeResponseUsage(pickTrimmedString(raw, ["responseUsage", "response_usage"]));
  if (responseUsage) {
    row.responseUsage = responseUsage;
  }
  return row;
}

export function normalizeSessionsListResult(payload: unknown): SessionsListResult {
  const root = isRecord(payload) ? payload : {};
  const defaults = isRecord(root.defaults) ? root.defaults : {};
  const sessions = Array.isArray(root.sessions)
    ? root.sessions
      .map(normalizeGatewaySessionRow)
      .filter((row): row is GatewaySessionRow => row !== null)
    : [];
  return {
    ts: pickNumberLike(root, ["ts"]) ?? 0,
    path: pickTrimmedString(root, ["path"]) ?? "",
    count: pickNumberLike(root, ["count"]) ?? sessions.length,
    defaults: {
      modelProvider: pickTrimmedString(defaults, ["modelProvider", "model_provider"]),
      model: pickTrimmedString(defaults, ["model"]),
      contextTokens: pickNumberLike(defaults, ["contextTokens", "context_tokens"]),
    },
    sessions,
  };
}

export function normalizeSessionsPreviewResult(payload: unknown): SessionsPreviewResult {
  const root = isRecord(payload) ? payload : {};
  const previews = Array.isArray(root.previews)
    ? root.previews
      .map((preview) => {
        if (!isRecord(preview)) {
          return null;
        }
        const key = pickTrimmedString(preview, ["key"]);
        if (!key) {
          return null;
        }
        const items = Array.isArray(preview.items)
          ? preview.items
            .map((item) => {
              if (!isRecord(item)) {
                return null;
              }
              const text = pickTrimmedString(item, ["text"]);
              if (!text) {
                return null;
              }
              return {
                role: pickTrimmedString(item, ["role"]) ?? "unknown",
                text,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
          : [];
        return {
          key,
          status: pickTrimmedString(preview, ["status"]) ?? "",
          items,
        };
      })
      .filter((preview): preview is NonNullable<typeof preview> => preview !== null)
    : [];
  return {
    ts: pickNumberLike(root, ["ts"]) ?? 0,
    previews,
  };
}

export function normalizeAgentsListResult(payload: unknown): AgentsListResult {
  const root = isRecord(payload) ? payload : {};
  const agents = Array.isArray(root.agents)
    ? root.agents
      .map((agent) => {
        if (!isRecord(agent)) {
          return null;
        }
        const id = pickTrimmedString(agent, ["id"]);
        if (!id) {
          return null;
        }
        const identity = isRecord(agent.identity) ? agent.identity : null;
        return {
          id,
          ...(pickTrimmedString(agent, ["name"]) ? { name: pickTrimmedString(agent, ["name"]) ?? undefined } : {}),
          ...(identity
            ? {
                identity: {
                  ...(pickTrimmedString(identity, ["name"]) ? { name: pickTrimmedString(identity, ["name"]) ?? undefined } : {}),
                  ...(pickTrimmedString(identity, ["theme"]) ? { theme: pickTrimmedString(identity, ["theme"]) ?? undefined } : {}),
                  ...(pickTrimmedString(identity, ["emoji"]) ? { emoji: pickTrimmedString(identity, ["emoji"]) ?? undefined } : {}),
                  ...(pickTrimmedString(identity, ["avatar"]) ? { avatar: pickTrimmedString(identity, ["avatar"]) ?? undefined } : {}),
                  ...(pickTrimmedString(identity, ["avatarUrl", "avatar_url"]) ? { avatarUrl: pickTrimmedString(identity, ["avatarUrl", "avatar_url"]) ?? undefined } : {}),
                },
              }
            : {}),
        };
      })
      .filter((agent): agent is NonNullable<typeof agent> => agent !== null)
    : [];
  const scope = pickTrimmedString(root, ["scope"]);
  return {
    defaultId: pickTrimmedString(root, ["defaultId", "default_id"]) ?? "",
    mainKey: pickTrimmedString(root, ["mainKey", "main_key"]) ?? "",
    scope: scope === "per-sender" || scope === "global" ? scope : "global",
    agents,
  };
}

export function normalizeModelsListResult(payload: unknown): ModelsListResult {
  const root = isRecord(payload) ? payload : {};
  const models = Array.isArray(root.models)
    ? root.models
      .map((model) => {
        if (!isRecord(model)) {
          return null;
        }
        const id = pickTrimmedString(model, ["id"]);
        const provider = pickTrimmedString(model, ["provider"]);
        if (!id || !provider) {
          return null;
        }
        return {
          id,
          name: pickTrimmedString(model, ["name"]) ?? id,
          provider,
          ...(pickNumberLike(model, ["contextWindow", "context_window"]) !== null
            ? { contextWindow: pickNumberLike(model, ["contextWindow", "context_window"]) ?? undefined }
            : {}),
          ...(pickBoolean(model, ["available"]) !== null ? { available: pickBoolean(model, ["available"]) } : {}),
          ...(pickBoolean(model, ["local"]) !== null ? { local: pickBoolean(model, ["local"]) } : {}),
        };
      })
      .filter((model): model is NonNullable<typeof model> => model !== null)
    : [];
  return { models };
}
