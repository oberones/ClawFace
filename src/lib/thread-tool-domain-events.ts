import { extractText, isToolMessage } from "./message-extract.ts";
import { preferSpecificImagePathCandidates } from "./media-path-utils.ts";
import { inferImageMimeTypeFromPath } from "./remote-media-resolution.ts";
import type { ToolItem } from "./types.ts";

export type ToolUpdate = {
  id: string;
  name?: string;
  status?: ToolItem["status"];
  outcome?: ToolItem["outcome"];
  runId?: string;
  args?: unknown;
  output?: string;
  mediaPaths?: string[];
  errorMessage?: string;
  startedAt?: number;
  updatedAt?: number;
};

export type NormalizedChatEvent = {
  runId?: string;
  sessionKey?: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

export type NormalizedAgentEvent = {
  sessionKey: string | null;
  runId: string | null;
  stream: string;
  toolUpdates: ToolUpdate[];
  assistantReply: unknown;
  assistantText: string | null;
  lifecyclePhase: "start" | "end" | "error" | null;
  lifecycleErrorMessage: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function getBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value !== 0;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "yes" ||
        normalized === "done" ||
        normalized === "final" ||
        normalized === "complete" ||
        normalized === "completed"
      ) {
        return true;
      }
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
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

function formatToolOutput(value: unknown): string {
  const stripControlSequences = (input: string): string =>
    input
      .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return stripControlSequences(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return stripControlSequences(JSON.stringify(value, null, 2));
  } catch {
    return stripControlSequences(String(value));
  }
}

function normalizeToolStatus(raw: string | null | undefined): ToolItem["status"] {
  if (hasAnyStateToken(raw, [
    "result",
    "done",
    "end",
    "ended",
    "error",
    "fail",
    "failed",
    "failure",
    "ok",
    "success",
    "succeeded",
    "successful",
    "finish",
    "finished",
    "complete",
    "completed",
  ])) {
    return "result";
  }
  if (hasAnyStateToken(raw, ["start", "started", "begin", "began", "call", "called", "invoke", "invoked"])) {
    return "start";
  }
  return "update";
}

function normalizeToolOutcome(raw: string | null | undefined): ToolItem["outcome"] | null {
  if (!raw?.trim()) {
    return null;
  }
  if (hasAnyStateToken(raw, [
    "error",
    "errors",
    "fail",
    "failed",
    "failure",
    "denied",
    "timeout",
    "blocked",
    "abort",
    "aborted",
    "cancelled",
    "canceled",
  ])) {
    return "failed";
  }
  if (hasAnyStateToken(raw, [
    "result",
    "done",
    "end",
    "ended",
    "ok",
    "success",
    "succeeded",
    "successful",
    "finish",
    "finished",
    "complete",
    "completed",
  ])) {
    return "succeeded";
  }
  if (hasAnyStateToken(raw, [
    "start",
    "started",
    "begin",
    "began",
    "call",
    "called",
    "invoke",
    "invoked",
    "update",
    "updated",
    "delta",
    "progress",
    "running",
    "pending",
  ])) {
    return "running";
  }
  return null;
}

function tokenizeStateMarkers(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasAnyStateToken(raw: string | null | undefined, candidates: string[]): boolean {
  const tokens = tokenizeStateMarkers(raw);
  if (tokens.length === 0) {
    return false;
  }
  const tokenSet = new Set(tokens);
  return candidates.some((candidate) => tokenSet.has(candidate));
}

function looksLikeToolFailureText(value: string | null | undefined): boolean {
  const normalized = value?.toLowerCase() ?? "";
  return /\b(error|failed|exception|denied|not found|timeout)\b/.test(normalized);
}

function extractToolErrorMessage(source: Record<string, unknown>): string | null {
  const direct =
    getString(source, ["errorMessage", "error_message", "failureMessage", "failure_message", "reason"]) ??
    (typeof source.error === "string" && source.error.trim() ? source.error : null);
  if (direct) {
    return direct;
  }
  const nestedPaths = [
    ["error"],
    ["result", "error"],
    ["payload", "error"],
    ["data", "error"],
    ["response", "error"],
  ];
  for (const path of nestedPaths) {
    const nested = getNested(source, path);
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
    if (isRecord(nested)) {
      const nestedMessage = getString(nested, ["message", "error", "reason", "detail", "type"]);
      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }
  return null;
}

function resolveToolOutcome(params: {
  candidate: Record<string, unknown>;
  rawState?: string | null;
  coarseStatus: ToolItem["status"];
  output?: string;
}): Pick<ToolUpdate, "outcome" | "errorMessage"> {
  const { candidate, rawState, coarseStatus, output } = params;
  const explicitErrorMessage = extractToolErrorMessage(candidate);
  const explicitFailure =
    getBoolean(candidate, ["isError", "is_error", "failed", "isFailed", "hasError"]) === true;
  const explicitSuccess =
    getBoolean(candidate, ["ok", "success", "succeeded", "isSuccess", "isSuccessful"]) === true;
  const normalizedOutcome = normalizeToolOutcome(rawState);
  if (explicitErrorMessage || explicitFailure || normalizedOutcome === "failed") {
    return {
      outcome: "failed",
      errorMessage: explicitErrorMessage ?? undefined,
    };
  }
  if (explicitSuccess || normalizedOutcome === "succeeded") {
    return { outcome: "succeeded" };
  }
  if (coarseStatus === "result") {
    if (looksLikeToolFailureText(output)) {
      return { outcome: "failed" };
    }
    return { outcome: "succeeded" };
  }
  return { outcome: "running" };
}

function pickToolCallId(source: Record<string, unknown>): string | null {
  const explicit = getString(source, [
    "toolCallId",
    "tool_call_id",
    "toolUseId",
    "tool_use_id",
    "callId",
    "call_id",
  ]);
  if (explicit) {
    return explicit;
  }
  const genericId = getString(source, ["id"]);
  if (!genericId) {
    return null;
  }
  const hasToolName = Boolean(getString(source, ["name", "toolName", "tool_name", "tool"]));
  const hasPayload =
    source.args !== undefined ||
    source.arguments !== undefined ||
    source.input !== undefined ||
    source.result !== undefined ||
    source.output !== undefined ||
    source.partialResult !== undefined ||
    source.delta !== undefined;
  return hasToolName || hasPayload ? genericId : null;
}

function tryParseJsonRecord(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function collectObjectCandidates(input: unknown, maxDepth = 4): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const queue: Array<{ value: unknown; depth: number }> = [{ value: tryParseJsonRecord(input), depth: 0 }];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      continue;
    }
    const { value, depth } = next;
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      if (depth >= maxDepth) {
        continue;
      }
      for (const item of value) {
        queue.push({ value: tryParseJsonRecord(item), depth: depth + 1 });
      }
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    out.push(value);
    if (depth >= maxDepth) {
      continue;
    }
    for (const nested of Object.values(value)) {
      if (isRecord(nested) || Array.isArray(nested)) {
        queue.push({ value: tryParseJsonRecord(nested), depth: depth + 1 });
      }
    }
  }
  return out;
}

function hasToolHint(candidate: Record<string, unknown>): boolean {
  const type = getString(candidate, ["type", "event", "kind", "phase", "status", "state"])?.toLowerCase() ?? "";
  if (type.includes("tool") || type.includes("function")) {
    return true;
  }
  return (
    Object.keys(candidate).some((key) => key.toLowerCase().includes("tool")) ||
    Object.keys(candidate).some((key) => key.toLowerCase().includes("function"))
  );
}

function collectStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

function collectNestedStringValues(source: unknown, keys: string[]): string[] {
  if (!isRecord(source)) {
    return [];
  }
  const out: string[] = [];
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  let traversed = 0;
  const MAX_NODES = 160;

  while (queue.length > 0 && traversed < MAX_NODES) {
    const current = queue.shift();
    if (!current || seen.has(current) || !isRecord(current)) {
      continue;
    }
    seen.add(current);
    traversed += 1;

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKeys.has(normalizedKey)) {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed) {
            out.push(trimmed);
          }
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "string" && item.trim()) {
              out.push(item.trim());
            } else if (isRecord(item)) {
              queue.push(item);
            }
          }
        } else if (isRecord(value)) {
          queue.push(value);
        }
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isRecord(item)) {
            queue.push(item);
          }
        }
      } else if (isRecord(value)) {
        queue.push(value);
      }
    }
  }

  return out;
}

function extractToolMediaPaths(source: Record<string, unknown>): string[] {
  const details = isRecord(source.details) ? source.details : null;
  const media = isRecord(source.media) ? source.media : null;
  const nestedMediaCandidates = collectNestedStringValues(source, [
    "path",
    "paths",
    "mediaurl",
    "mediaurls",
    "url",
    "urls",
    "file",
    "filepath",
    "filePath",
    "uri",
    "src",
    "href",
  ]);
  const direct = collectStringArray(source.paths);
  const mediaUrls = media ? collectStringArray(media.mediaUrls) : [];
  const detailPaths = details ? collectStringArray(details.paths) : [];
  const detailMediaUrls = details && isRecord(details.media) ? collectStringArray(details.media.mediaUrls) : [];
  return preferSpecificImagePathCandidates(
    dedupeStrings([
      ...direct,
      ...mediaUrls,
      ...detailPaths,
      ...detailMediaUrls,
      ...nestedMediaCandidates,
    ]),
    (value) => Boolean(inferImageMimeTypeFromPath(value)),
  );
}

function dedupeToolUpdates(updates: ToolUpdate[]): ToolUpdate[] {
  const map = new Map<string, ToolUpdate>();
  for (const update of updates) {
    const prev = map.get(update.id);
    map.set(update.id, {
      ...prev,
      ...update,
      runId: update.runId ?? prev?.runId,
      args: update.args ?? prev?.args,
      output: update.output ?? prev?.output,
      mediaPaths: update.mediaPaths ?? prev?.mediaPaths,
      status: update.status ?? prev?.status ?? "update",
      outcome: update.outcome ??
        prev?.outcome ??
        ((update.status ?? prev?.status ?? "update") === "result" ? "succeeded" : "running"),
      errorMessage: update.errorMessage ?? prev?.errorMessage,
    });
  }
  return [...map.values()];
}

export function extractToolUpdatesFromAgent(
  payload: unknown,
  fallbackRunId?: string | null,
): ToolUpdate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
  const root = isRecord(payload.data) ? payload.data : payload;
  const payloadRunId =
    getString(payload, ["runId", "run_id"]) ??
    (isRecord(payload.data) ? getString(payload.data, ["runId", "run_id"]) : null) ??
    fallbackRunId ??
    undefined;
  const rootStream =
    getString(payload, ["stream", "channel", "topic"]) ??
    (isRecord(payload.data) ? getString(payload.data, ["stream", "channel", "topic"]) : null);
  const streamIsTool = Boolean(rootStream?.toLowerCase().includes("tool"));
  const updates: ToolUpdate[] = [];
  const candidates = collectObjectCandidates(root);
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const toolId = pickToolCallId(candidate);
    const fn = isRecord(candidate.function) ? candidate.function : {};
    const name =
      getString(candidate, ["name", "toolName", "tool_name", "tool"]) ??
      getString(fn, ["name"]) ??
      null;
    const args = candidate.args ?? candidate.arguments ?? candidate.input ?? fn.arguments;
    const extractedText = extractText(candidate)?.trim() ?? "";
    const mediaPaths = extractToolMediaPaths(candidate);
    const outputValue =
      candidate.partialResult ??
      candidate.delta ??
      candidate.result ??
      candidate.output ??
      candidate.response ??
      (extractedText ? extractedText : undefined);
    const hinted = hasToolHint(candidate);
    const looksLikeToolByPayload =
      (args !== undefined || outputValue !== undefined) && (Boolean(name) || Boolean(toolId));
    if (!(hinted || toolId || (streamIsTool && looksLikeToolByPayload))) {
      continue;
    }
    const id = toolId ?? (name ? `tool:${name}:${ts}:${i}` : null);
    if (!id) {
      continue;
    }
    const status = normalizeToolStatus(
      getString(candidate, ["phase", "status", "state", "event", "type"]),
    );
    const coarseStatus = outputValue !== undefined && status === "start" ? "update" : status;
    const normalizedOutput = outputValue !== undefined ? formatToolOutput(outputValue) : undefined;
    const outcome = resolveToolOutcome({
      candidate,
      rawState: getString(candidate, ["phase", "status", "state", "event", "type"]),
      coarseStatus,
      output: normalizedOutput,
    });
    updates.push({
      id,
      name: name ?? "tool",
      status: coarseStatus,
      outcome: outcome.outcome,
      runId: payloadRunId,
      args,
      output: normalizedOutput,
      mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
      errorMessage: outcome.errorMessage,
      startedAt: ts,
      updatedAt: Date.now(),
    });
  }
  return dedupeToolUpdates(updates);
}

export function extractToolUpdatesFromMessage(
  message: unknown,
  fallbackTimestamp?: number,
  fallbackRunId?: string | null,
): ToolUpdate[] {
  if (!isRecord(message)) {
    return [];
  }
  const ts =
    typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
      ? message.timestamp
      : fallbackTimestamp ?? Date.now();
  const runId = getString(message, ["runId", "run_id"]) ?? fallbackRunId ?? undefined;
  const updates: ToolUpdate[] = [];
  const content = message.content;
  if (Array.isArray(content)) {
    for (let i = 0; i < content.length; i += 1) {
      const part = content[i];
      if (!isRecord(part)) {
        continue;
      }
      const type = getString(part, ["type"])?.toLowerCase() ?? "";
      if (type === "tool_use" || type === "tooluse" || type === "tool_call" || type === "toolcall") {
        const id = pickToolCallId(part) ?? `tool:content:${ts}:${i}`;
        updates.push({
          id,
          name: getString(part, ["name", "toolName", "tool_name", "tool"]) ?? "tool",
          status: "start",
          outcome: "running",
          runId,
          args: part.input ?? part.args ?? part.arguments,
          startedAt: ts,
          updatedAt: ts,
        });
      }
      if (
        type === "tool_result" ||
        type === "toolresult" ||
        type === "tool_response" ||
        type === "function_result"
      ) {
        const id = pickToolCallId(part) ?? `tool:content:${ts}:${i}`;
        const output = formatToolOutput(part.content ?? part.result ?? part.output);
        const mediaPaths = extractToolMediaPaths(part);
        const outcome = resolveToolOutcome({
          candidate: part,
          rawState: getString(part, ["phase", "status", "state", "event", "type"]),
          coarseStatus: "result",
          output,
        });
        updates.push({
          id,
          name: getString(part, ["name", "toolName", "tool_name", "tool"]) ?? "tool",
          status: "result",
          outcome: outcome.outcome,
          runId,
          output,
          mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
          errorMessage: outcome.errorMessage,
          startedAt: ts,
          updatedAt: ts,
        });
      }
    }
  }
  const toolCalls = message.tool_calls;
  if (Array.isArray(toolCalls)) {
    for (let i = 0; i < toolCalls.length; i += 1) {
      const rawCall = toolCalls[i];
      if (!isRecord(rawCall)) {
        continue;
      }
      const fn = isRecord(rawCall.function) ? rawCall.function : {};
      const id = pickToolCallId(rawCall) ?? `tool:call:${ts}:${i}`;
      const name = getString(rawCall, ["name"]) ?? getString(fn, ["name"]) ?? "tool";
      updates.push({
        id,
        name,
        status: "start",
        outcome: "running",
        runId,
        args: rawCall.arguments ?? fn.arguments,
        startedAt: ts,
        updatedAt: ts,
      });
    }
  }
  const role = getString(message, ["role"])?.toLowerCase() ?? "";
  if (role === "tool" || role === "toolresult" || role === "tool_result" || role === "function") {
    const id = pickToolCallId(message) ?? `tool:role:${ts}`;
    const output = extractText(message) ?? formatToolOutput(message.result ?? message.output);
    const mediaPaths = extractToolMediaPaths(message);
    const outcome = resolveToolOutcome({
      candidate: message,
      rawState: getString(message, ["phase", "status", "state", "event", "type"]),
      coarseStatus: "result",
      output,
    });
    updates.push({
      id,
      name: getString(message, ["name", "toolName", "tool_name", "tool"]) ?? "tool",
      status: "result",
      outcome: outcome.outcome,
      runId,
      output,
      mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
      errorMessage: outcome.errorMessage,
      startedAt: ts,
      updatedAt: ts,
    });
  }
  if (updates.length > 0) {
    return dedupeToolUpdates(updates);
  }
  if (!isToolMessage(message)) {
    return [];
  }
  const id = pickToolCallId(message) ?? `tool:message:${ts}`;
  return [{
    id,
    name: getString(message, ["name", "toolName", "tool_name", "tool"]) ?? "tool",
    status: "update",
    outcome: "running",
    runId,
    output: extractText(message) ?? undefined,
    startedAt: ts,
    updatedAt: ts,
  }];
}

export function attachLifecycleErrorToToolItems(
  items: ToolItem[],
  params: { runId?: string | null; errorMessage?: string | null },
): ToolItem[] {
  const runId = params.runId?.trim();
  const errorMessage = params.errorMessage?.trim();
  if (!runId || !errorMessage || items.length === 0) {
    return items;
  }
  let targetIndex = -1;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (!item || item.runId !== runId || item.outcome !== "running") {
      continue;
    }
    targetIndex = i;
    break;
  }
  if (targetIndex < 0) {
    return items;
  }
  const target = items[targetIndex]!;
  const next = [...items];
  next[targetIndex] = {
    ...target,
    status: "result",
    outcome: "failed",
    errorMessage,
    updatedAt: Date.now(),
  };
  return next;
}

function normalizeChatState(raw: string | null | undefined): NormalizedChatEvent["state"] | null {
  const value = raw?.toLowerCase() ?? "";
  if (!value) {
    return null;
  }
  if (value.includes("delta") || value.includes("stream")) {
    return "delta";
  }
  if (value.includes("final") || value.includes("done") || value.includes("complete")) {
    return "final";
  }
  if (value.includes("abort")) {
    return "aborted";
  }
  if (value.includes("error") || value.includes("fail")) {
    return "error";
  }
  return null;
}

function extractAssistantTextFromAgentPayload(payload: Record<string, unknown>): string | null {
  const data = isRecord(payload.data) ? payload.data : null;
  const text =
    (data ? getString(data, ["text", "delta", "chunk", "partial"]) : null) ??
    getString(payload, ["text", "delta", "chunk", "partial"]);
  if (text && text.trim()) {
    return text;
  }
  if (data?.message !== undefined) {
    const fromMessage = extractText(data.message);
    if (fromMessage && fromMessage.trim()) {
      return fromMessage;
    }
  }
  return null;
}

export function collectReplyPayloadMediaUrls(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  const directMediaUrl = getString(value, ["mediaUrl", "mediaurl"]);
  return dedupeStrings(
    [
      ...collectStringArray(value.mediaUrls),
      ...collectStringArray(value.mediaurls),
      ...collectStringArray(value.media),
      ...(directMediaUrl ? [directMediaUrl] : []),
    ].filter(Boolean),
  );
}

export function hasReplyPayloadLikeContent(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  return Boolean(
    getString(value, ["text", "delta", "content", "output", "response"]) ||
    collectReplyPayloadMediaUrls(value).length > 0,
  );
}

export function coerceAssistantReplyMessage(value: unknown): unknown {
  if (!hasReplyPayloadLikeContent(value)) {
    return value;
  }
  const role = getString(value, ["role"]) ?? "assistant";
  return typeof value.role === "string" && value.role === role ? value : { ...value, role };
}

export function mergeAssistantReplyPayload(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const mergedMediaUrls = dedupeStrings([
    ...collectReplyPayloadMediaUrls(previous),
    ...collectReplyPayloadMediaUrls(next),
  ]);
  const previousText = previous && typeof previous.text === "string" ? previous.text : undefined;
  const previousDelta = previous && typeof previous.delta === "string" ? previous.delta : undefined;
  const nextText = typeof next.text === "string" ? next.text : undefined;
  const nextDelta = typeof next.delta === "string" ? next.delta : undefined;
  return {
    ...(previous ?? {}),
    ...next,
    role: getString(next, ["role"]) ?? getString(previous ?? {}, ["role"]) ?? "assistant",
    ...(nextText !== undefined || previousText !== undefined
      ? { text: nextText ?? previousText ?? "" }
      : {}),
    ...(nextDelta !== undefined || previousDelta !== undefined
      ? { delta: nextDelta ?? previousDelta ?? "" }
      : {}),
    ...(mergedMediaUrls.length > 0
      ? { mediaUrls: mergedMediaUrls, mediaUrl: mergedMediaUrls[0] }
      : {}),
  };
}

export function mergeAssistantReplyMessageCandidate(
  message: unknown,
  pending: Record<string, unknown> | null,
): unknown {
  if (!pending) {
    return coerceAssistantReplyMessage(message);
  }
  if (typeof message === "string") {
    return mergeAssistantReplyPayload(pending, { role: "assistant", text: message });
  }
  if (hasReplyPayloadLikeContent(message)) {
    return mergeAssistantReplyPayload(pending, message);
  }
  const extractedText = extractText(message);
  if (extractedText) {
    return mergeAssistantReplyPayload(
      pending,
      {
        role: isRecord(message) ? getString(message, ["role"]) ?? "assistant" : "assistant",
        text: extractedText,
      },
    );
  }
  return message ?? pending;
}

export function normalizeChatEventPayload(
  payload: unknown,
  eventHint?: string,
): NormalizedChatEvent | null {
  if (!isRecord(payload)) {
    return null;
  }
  const data = isRecord(payload.data) ? payload.data : {};
  const errorMessage =
    getString(payload, ["errorMessage"]) ??
    getString(data, ["errorMessage"]) ??
    (isRecord(payload.error)
      ? getString(payload.error, ["message", "error"])
      : getString(payload, ["error"])) ??
    undefined;
  const finalHint =
    getBoolean(payload, ["done", "isDone", "final", "isFinal", "completed", "isComplete"]) ??
    getBoolean(data, ["done", "isDone", "final", "isFinal", "completed", "isComplete"]) ??
    null;
  const abortedHint =
    getBoolean(payload, ["aborted", "isAborted", "cancelled", "canceled"]) ??
    getBoolean(data, ["aborted", "isAborted", "cancelled", "canceled"]) ??
    null;
  const hasDelta = payload.delta !== undefined || data.delta !== undefined;
  const hasMessage = payload.message !== undefined || data.message !== undefined;
  const hasReplyPayload =
    hasReplyPayloadLikeContent(payload.reply) ||
    hasReplyPayloadLikeContent(data.reply) ||
    hasReplyPayloadLikeContent(data) ||
    hasReplyPayloadLikeContent(payload);
  const state =
    normalizeChatState(getString(payload, ["state", "phase", "event"])) ??
    normalizeChatState(getString(data, ["state", "phase", "event"])) ??
    normalizeChatState(eventHint) ??
    (finalHint ? "final" : null) ??
    (abortedHint ? "aborted" : null) ??
    (errorMessage ? "error" : null) ??
    (hasDelta ? "delta" : null) ??
    (hasMessage || hasReplyPayload ? "final" : null);
  if (!state) {
    return null;
  }
  const runId = getString(payload, ["runId", "run_id"]) ?? getString(data, ["runId", "run_id"]) ?? undefined;
  const sessionKey =
    getString(payload, ["sessionKey", "session_key"]) ??
    getString(data, ["sessionKey", "session_key"]) ??
    undefined;
  const messageRaw =
    payload.message ??
    data.message ??
    payload.delta ??
    data.delta ??
    payload.content ??
    data.content ??
    payload.reply ??
    data.reply ??
    (hasReplyPayloadLikeContent(data) ? data : null) ??
    (hasReplyPayloadLikeContent(payload) ? payload : null);
  const message =
    typeof messageRaw === "string"
      ? { role: "assistant", content: messageRaw }
      : coerceAssistantReplyMessage(messageRaw);
  return { runId, sessionKey, state, message, errorMessage };
}

function normalizeLifecyclePhase(raw: string | null | undefined): "start" | "end" | "error" | null {
  if (!raw?.trim()) {
    return null;
  }
  if (hasAnyStateToken(raw, ["error", "fail", "failed", "failure"])) {
    return "error";
  }
  if (hasAnyStateToken(raw, ["end", "ended", "done", "finish", "finished", "complete", "completed"])) {
    return "end";
  }
  if (hasAnyStateToken(raw, ["start", "started", "begin", "began"])) {
    return "start";
  }
  return null;
}

function extractLifecycleErrorMessage(
  payload: Record<string, unknown>,
  data: Record<string, unknown> | null,
): string | null {
  return (data ? getString(data, ["errorMessage", "error", "reason"]) : null) ??
    getString(payload, ["errorMessage", "error"]);
}

export function normalizeAgentEventPayload(payload: unknown): NormalizedAgentEvent | null {
  if (!isRecord(payload)) {
    return null;
  }
  const data = isRecord(payload.data) ? payload.data : null;
  const sessionKey =
    getString(payload, ["sessionKey", "session_key"]) ??
    (data ? getString(data, ["sessionKey", "session_key"]) : null);
  const runId =
    getString(payload, ["runId", "run_id"]) ??
    (data ? getString(data, ["runId", "run_id"]) : null);
  const stream = (
    getString(payload, ["stream", "channel", "topic"]) ??
    (data ? getString(data, ["stream", "channel", "topic"]) : null) ??
    ""
  ).toLowerCase();
  const assistantReplyCandidate = data ?? payload;
  const lifecyclePhase = normalizeLifecyclePhase(
    data ? getString(data, ["phase", "status", "state", "event", "type"]) : null,
  );
  return {
    sessionKey: sessionKey ?? null,
    runId: runId ?? null,
    stream,
    toolUpdates: extractToolUpdatesFromAgent(payload, runId),
    assistantReply: coerceAssistantReplyMessage(assistantReplyCandidate),
    assistantText: extractAssistantTextFromAgentPayload(payload),
    lifecyclePhase,
    lifecycleErrorMessage: extractLifecycleErrorMessage(payload, data),
  };
}
