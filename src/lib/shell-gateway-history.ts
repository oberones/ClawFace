import type { ChatMessage } from "./types.ts";
import { extractToolUpdatesFromMessage, type ToolUpdate } from "./thread-tool-domain-events.ts";

export type NormalizedShellGatewayHistory = {
  rawCount: number;
  thinkingLevel: string | null;
  messages: ChatMessage[];
  toolUpdates: ToolUpdate[];
};

type NormalizeShellGatewayHistoryParams = {
  fallbackNow?: number;
  toChatMessage: (raw: unknown, fallbackTimestamp: number) => ChatMessage | null;
  buildToolAttachmentMessages: (toolUpdates: ToolUpdate[]) => ChatMessage[];
  buildMessageDedupeKey: (message: ChatMessage) => string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeShellGatewayHistory(
  payload: unknown,
  params: NormalizeShellGatewayHistoryParams,
): NormalizedShellGatewayHistory {
  const root = isRecord(payload) ? payload : {};
  const rawMessages = Array.isArray(root.messages) ? root.messages : [];
  const messages: ChatMessage[] = [];
  const toolUpdates: ToolUpdate[] = [];
  const seenContentKeys = new Set<string>();
  // Preserve gateway ordering even when older history rows lack timestamps by
  // assigning a monotonically increasing fallback timestamp.
  let lastTs = (params.fallbackNow ?? Date.now()) - Math.max(1, rawMessages.length);

  for (const raw of rawMessages) {
    const rawTs =
      isRecord(raw) && typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : null;
    const inferredTs = rawTs ?? (lastTs + 1);
    lastTs = inferredTs;

    const nextToolUpdates = extractToolUpdatesFromMessage(raw, inferredTs);
    if (nextToolUpdates.length > 0) {
      toolUpdates.push(...nextToolUpdates);
      // Tool-only rows become lightweight attachment messages so historical
      // media stays visible even if the assistant text row was separate.
      for (const message of params.buildToolAttachmentMessages(nextToolUpdates)) {
        const contentKey = params.buildMessageDedupeKey(message);
        if (seenContentKeys.has(contentKey)) {
          continue;
        }
        seenContentKeys.add(contentKey);
        messages.push(message);
      }
    }

    const parsed = params.toChatMessage(raw, inferredTs);
    if (!parsed) {
      continue;
    }
    const contentKey = params.buildMessageDedupeKey(parsed);
    if (seenContentKeys.has(contentKey)) {
      continue;
    }
    seenContentKeys.add(contentKey);
    messages.push(parsed);
  }

  return {
    rawCount: rawMessages.length,
    thinkingLevel: typeof root.thinkingLevel === "string" ? root.thinkingLevel : null,
    messages,
    toolUpdates,
  };
}
