import type {
  AgentsListResult,
  GatewaySessionRow,
  ModelsListResult,
  SessionsListResult,
  SessionsPreviewResult,
} from "./types.ts";
import { sanitizeSessionPresentationText } from "./message-extract.ts";

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
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = Number(trimmed.replace(/,/g, ""));
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

function isDreamNarrativeSessionKey(key: string): boolean {
  return /(?:^|:)dreaming-narrative-(?:light|rem|deep)-/i.test(key);
}

function normalizeGatewaySessionRow(raw: unknown): GatewaySessionRow | null {
  if (!isRecord(raw)) {
    return null;
  }
  const key = pickTrimmedString(raw, ["key"]);
  if (!key) {
    return null;
  }
  const row: GatewaySessionRow = {
    key,
    kind: normalizeSessionKind(pickTrimmedString(raw, ["kind"])),
    updatedAt: pickNumberLike(raw, ["updatedAt", "updated_at"]),
  };
  const label = pickTrimmedString(raw, ["label"]);
  if (label !== null) {
    row.label = label;
  }
  const displayName = sanitizeSessionPresentationText(
    pickTrimmedString(raw, ["displayName", "display_name"]) ?? "",
  );
  if (displayName) {
    row.displayName = displayName;
  }
  const derivedTitle = sanitizeSessionPresentationText(
    pickTrimmedString(raw, ["derivedTitle", "derived_title"]) ?? "",
  );
  if (derivedTitle) {
    row.derivedTitle = derivedTitle;
  }
  const lastMessagePreview = sanitizeSessionPresentationText(
    pickTrimmedString(raw, ["lastMessagePreview", "last_message_preview"]) ?? "",
  );
  if (lastMessagePreview) {
    row.lastMessagePreview = lastMessagePreview;
  }
  const channel = pickTrimmedString(raw, ["channel"]);
  if (channel !== null) {
    row.channel = channel;
  }
  const subject = pickTrimmedString(raw, ["subject"]);
  if (subject !== null) {
    row.subject = subject;
  }
  const groupChannel = pickTrimmedString(raw, ["groupChannel", "group_channel"]);
  if (groupChannel !== null) {
    row.groupChannel = groupChannel;
  }
  const space = pickTrimmedString(raw, ["space"]);
  if (space !== null) {
    row.space = space;
  }
  const chatType = pickTrimmedString(raw, ["chatType", "chat_type"]);
  if (chatType !== null) {
    row.chatType = chatType;
  }
  const sessionId = pickTrimmedString(raw, ["sessionId", "session_id"]);
  if (sessionId !== null) {
    row.sessionId = sessionId;
  }
  const thinkingLevel = pickTrimmedString(raw, ["thinkingLevel", "thinking_level"]);
  if (thinkingLevel !== null) {
    row.thinkingLevel = thinkingLevel;
  }
  const verboseLevel = pickTrimmedString(raw, ["verboseLevel", "verbose_level"]);
  if (verboseLevel !== null) {
    row.verboseLevel = verboseLevel;
  }
  const reasoningLevel = pickTrimmedString(raw, ["reasoningLevel", "reasoning_level"]);
  if (reasoningLevel !== null) {
    row.reasoningLevel = reasoningLevel;
  }
  const elevatedLevel = pickTrimmedString(raw, ["elevatedLevel", "elevated_level"]);
  if (elevatedLevel !== null) {
    row.elevatedLevel = elevatedLevel;
  }
  const modelProvider = pickTrimmedString(raw, ["modelProvider", "model_provider"]);
  if (modelProvider !== null) {
    row.modelProvider = modelProvider;
  }
  const model = pickTrimmedString(raw, ["model"]);
  if (model !== null) {
    row.model = model;
  }
  const lastChannel = pickTrimmedString(raw, ["lastChannel", "last_channel"]);
  if (lastChannel !== null) {
    row.lastChannel = lastChannel;
  }
  const lastTo = pickTrimmedString(raw, ["lastTo", "last_to"]);
  if (lastTo !== null) {
    row.lastTo = lastTo;
  }
  const lastAccountId = pickTrimmedString(raw, ["lastAccountId", "last_account_id"]);
  if (lastAccountId !== null) {
    row.lastAccountId = lastAccountId;
  }
  const inputTokens = pickNumberLike(raw, ["inputTokens", "input_tokens"]);
  if (inputTokens !== null) {
    row.inputTokens = inputTokens;
  }
  const outputTokens = pickNumberLike(raw, ["outputTokens", "output_tokens"]);
  if (outputTokens !== null) {
    row.outputTokens = outputTokens;
  }
  const totalTokens = pickNumberLike(raw, ["totalTokens", "total_tokens"]);
  if (totalTokens !== null) {
    row.totalTokens = totalTokens;
  }
  const contextTokens = pickNumberLike(raw, ["contextTokens", "context_tokens"]);
  if (contextTokens !== null) {
    row.contextTokens = contextTokens;
  }
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

export function mergeSessionRowsWithLocalState(
  previousRows: GatewaySessionRow[],
  incomingRows: GatewaySessionRow[],
): GatewaySessionRow[] {
  if (previousRows.length === 0 || incomingRows.length === 0) {
    return incomingRows;
  }
  const previousByKey = new Map(previousRows.map((row) => [row.key, row]));
  return incomingRows.map((row) => {
    const previous = previousByKey.get(row.key);
    if (!previous?.label || row.label) {
      return row;
    }
    return {
      ...row,
      label: previous.label,
    };
  });
}

export function normalizeSessionsListResult(payload: unknown): SessionsListResult {
  const root = isRecord(payload) ? payload : {};
  const defaults = isRecord(root.defaults) ? root.defaults : {};
  const sessions = Array.isArray(root.sessions)
    ? root.sessions
      .map(normalizeGatewaySessionRow)
      .filter((row): row is GatewaySessionRow => row !== null)
      .filter((row) => !isDreamNarrativeSessionKey(row.key))
    : [];
  return {
    ts: pickNumberLike(root, ["ts"]) ?? 0,
    path: pickTrimmedString(root, ["path"]) ?? "",
    count: sessions.length,
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
        const name = pickTrimmedString(agent, ["name"]);
        const identityName = identity ? pickTrimmedString(identity, ["name"]) : null;
        const identityTheme = identity ? pickTrimmedString(identity, ["theme"]) : null;
        const identityEmoji = identity ? pickTrimmedString(identity, ["emoji"]) : null;
        const identityAvatar = identity ? pickTrimmedString(identity, ["avatar"]) : null;
        const identityAvatarUrl = identity ? pickTrimmedString(identity, ["avatarUrl", "avatar_url"]) : null;
        const identityPayload =
          identity && (identityName || identityTheme || identityEmoji || identityAvatar || identityAvatarUrl)
            ? {
                ...(identityName ? { name: identityName } : {}),
                ...(identityTheme ? { theme: identityTheme } : {}),
                ...(identityEmoji ? { emoji: identityEmoji } : {}),
                ...(identityAvatar ? { avatar: identityAvatar } : {}),
                ...(identityAvatarUrl ? { avatarUrl: identityAvatarUrl } : {}),
              }
            : undefined;
        return {
          id,
          ...(name ? { name } : {}),
          ...(identityPayload ? { identity: identityPayload } : {}),
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
        const name = pickTrimmedString(model, ["name"]) ?? id;
        const contextWindow = pickNumberLike(model, ["contextWindow", "context_window"]);
        const available = pickBoolean(model, ["available"]);
        const local = pickBoolean(model, ["local"]);
        return {
          id,
          name,
          provider,
          ...(contextWindow !== null ? { contextWindow } : {}),
          ...(available !== null ? { available } : {}),
          ...(local !== null ? { local } : {}),
        };
      })
      .filter((model): model is NonNullable<typeof model> => model !== null)
    : [];
  return { models };
}
