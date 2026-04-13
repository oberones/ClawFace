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

export type StatusBackgroundVisibility = {
  subagentsLine: string | null;
  taskLine: string | null;
};

export function extractStatusBackgroundVisibility(statusPayload: unknown): StatusBackgroundVisibility {
  const statusRoot: Record<string, unknown> =
    isRecord(statusPayload) && isRecord(statusPayload.status)
      ? statusPayload.status
      : isRecord(statusPayload)
        ? statusPayload
        : {};

  return {
    subagentsLine: pickString(statusRoot, ["subagentsLine", "subagents_line"]),
    taskLine: pickString(statusRoot, ["taskLine", "task_line"]),
  };
}
