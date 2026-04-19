export type NormalizedChatSendResult = {
  runId: string | null;
};

export type NormalizedSessionsResetResult = {
  key: string | null;
};

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

export function normalizeChatSendResult(payload: unknown): NormalizedChatSendResult {
  const root = isRecord(payload) ? payload : {};
  return {
    runId: pickTrimmedString(root, ["runId", "run_id"]),
  };
}

export function normalizeSessionsResetResult(payload: unknown): NormalizedSessionsResetResult {
  const root = isRecord(payload) ? payload : {};
  return {
    key: pickTrimmedString(root, ["key"]),
  };
}
