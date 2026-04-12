export const THINKING_LEVEL_CHOICES = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export const THINKING_LEVEL_COMMAND_USAGE = THINKING_LEVEL_CHOICES.join("|");

export function normalizeThinkingValue(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || "off";
}

export function normalizeModelKey(value: string): string {
  return value.trim().toLowerCase();
}
