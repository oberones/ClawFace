export type ShortcutCombo = {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

export type AppActionShortcutId = "toggleSidebar" | "newSession" | "toggleFiles";

export function normalizeShortcutKeyInput(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const key = normalized.slice(-1);
  return /^[a-z0-9]$/.test(key) ? key : null;
}

export function normalizeShortcutEventKey(code: string, key: string): string | null {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }
  return normalizeShortcutKeyInput(key);
}

export function formatThinkingLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "Off";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatShortcutUpdatedAt(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "recently";
  }
}
