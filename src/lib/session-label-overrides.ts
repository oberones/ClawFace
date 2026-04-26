import type { GatewaySessionRow } from "./types.ts";

export type SessionLabelOverride = {
  label: string;
  updatedAt: number;
};

export type SessionLabelOverrides = Record<string, SessionLabelOverride>;

export const SESSION_LABEL_MAX_LENGTH = 120;

export function normalizeSessionLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, SESSION_LABEL_MAX_LENGTH).trim();
}

function normalizeSessionOverrideKey(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSessionLabelOverrides(value: unknown): SessionLabelOverrides {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const next: SessionLabelOverrides = {};
  for (const [key, rawOverride] of Object.entries(record)) {
    const sessionKey = normalizeSessionOverrideKey(key);
    if (!sessionKey || !rawOverride || typeof rawOverride !== "object") {
      continue;
    }
    const override = rawOverride as Partial<SessionLabelOverride>;
    const label = normalizeSessionLabel(override.label);
    if (!label) {
      continue;
    }
    next[sessionKey] = {
      label,
      updatedAt: typeof override.updatedAt === "number" && Number.isFinite(override.updatedAt)
        ? override.updatedAt
        : 0,
    };
  }
  return next;
}

export function applySessionLabelOverride(
  row: GatewaySessionRow,
  overrides: SessionLabelOverrides,
): GatewaySessionRow {
  const override = overrides[row.key];
  if (!override || row.label === override.label) {
    return row;
  }
  return {
    ...row,
    label: override.label,
  };
}

export function applySessionLabelOverridesToRows(
  rows: GatewaySessionRow[],
  overrides: SessionLabelOverrides,
): GatewaySessionRow[] {
  let changed = false;
  const next = rows.map((row) => {
    const withOverride = applySessionLabelOverride(row, overrides);
    changed ||= withOverride !== row;
    return withOverride;
  });
  return changed ? next : rows;
}

export function applySessionLabelOverridesToRowRecord(
  rows: Record<string, GatewaySessionRow>,
  overrides: SessionLabelOverrides,
): Record<string, GatewaySessionRow> {
  let changed = false;
  const next: Record<string, GatewaySessionRow> = {};
  for (const [key, row] of Object.entries(rows)) {
    const withOverride = applySessionLabelOverride(row, overrides);
    changed ||= withOverride !== row;
    next[key] = withOverride;
  }
  return changed ? next : rows;
}

export function upsertSessionLabelOverride(
  overrides: SessionLabelOverrides,
  key: string,
  label: string,
  updatedAt = Date.now(),
): SessionLabelOverrides {
  const sessionKey = normalizeSessionOverrideKey(key);
  const normalizedLabel = normalizeSessionLabel(label);
  if (!sessionKey || !normalizedLabel) {
    return overrides;
  }
  const current = overrides[sessionKey];
  if (current?.label === normalizedLabel) {
    return overrides;
  }
  return {
    ...overrides,
    [sessionKey]: {
      label: normalizedLabel,
      updatedAt,
    },
  };
}

export function removeSessionLabelOverride(
  overrides: SessionLabelOverrides,
  key: string,
): SessionLabelOverrides {
  if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides;
  }
  const next = { ...overrides };
  delete next[key];
  return next;
}

export function moveSessionLabelOverride(
  overrides: SessionLabelOverrides,
  fromKey: string,
  toKey: string,
): SessionLabelOverrides {
  const override = overrides[fromKey];
  if (!override || !toKey || fromKey === toKey) {
    return overrides;
  }
  const next = { ...overrides };
  delete next[fromKey];
  next[toKey] = override;
  return next;
}
