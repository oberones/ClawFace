import { sanitizeUserText } from "./message-extract.ts";

export type PendingDevicePairRequest = {
  requestId: string;
  deviceId: string;
  displayName: string;
  roles: string[];
  scopes: string[];
  remoteIp: string | null;
  isRepair: boolean;
  requestedAtMs: number | null;
};

export type PairedDeviceRecord = {
  deviceId: string;
  displayName: string;
  roles: string[];
  scopes: string[];
  remoteIp: string | null;
  tokenRoles: string[];
  createdAtMs: number | null;
  approvedAtMs: number | null;
};

export type DevicePairingVisibility = {
  currentDeviceId: string | null;
  currentDeviceStatus: "unavailable" | "pending" | "paired" | "unlisted";
  currentDevicePendingRequest: PendingDevicePairRequest | null;
  currentDevicePairedRecord: PairedDeviceRecord | null;
  pending: PendingDevicePairRequest[];
  paired: PairedDeviceRecord[];
};

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

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function pickStringArray(source: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    const raw = source[key];
    if (!Array.isArray(raw)) {
      continue;
    }
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) {
        values.push(entry.trim());
      }
    }
  }
  return values;
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

function sanitizeDisplayName(value: string | null, fallback: string): string {
  const cleaned = sanitizeUserText(value ?? "").trim();
  return cleaned || fallback;
}

function resolveRoles(source: Record<string, unknown>): string[] {
  return dedupeStrings([
    ...pickStringArray(source, ["roles"]),
    ...(pickString(source, ["role"]) ? [pickString(source, ["role"]) as string] : []),
  ]);
}

function resolveTokenRoles(source: Record<string, unknown>): string[] {
  const raw = source.tokens;
  if (!Array.isArray(raw)) {
    return [];
  }
  return dedupeStrings(
    raw
      .map((entry) => (isRecord(entry) ? pickString(entry, ["role"]) : null))
      .filter((value): value is string => Boolean(value)),
  );
}

export function normalizeDevicePairingVisibility(
  payload: unknown,
  currentDeviceId: string | null,
): DevicePairingVisibility {
  const root = isRecord(payload) ? payload : {};
  const pending = Array.isArray(root.pending)
    ? root.pending
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        const requestId = pickString(entry, ["requestId", "request_id"]);
        const deviceId = pickString(entry, ["deviceId", "device_id"]);
        if (!(requestId && deviceId)) {
          return null;
        }
        return {
          requestId,
          deviceId,
          displayName: sanitizeDisplayName(pickString(entry, ["displayName", "display_name"]), deviceId),
          roles: resolveRoles(entry),
          scopes: dedupeStrings(pickStringArray(entry, ["scopes"])),
          remoteIp: pickString(entry, ["remoteIp", "remote_ip"]),
          isRepair: entry.isRepair === true,
          requestedAtMs: pickNumber(entry, ["ts", "createdAtMs", "created_at_ms"]),
        } satisfies PendingDevicePairRequest;
      })
      .filter((entry): entry is PendingDevicePairRequest => Boolean(entry))
      .sort((a, b) => {
        const byTime = (b.requestedAtMs ?? 0) - (a.requestedAtMs ?? 0);
        if (byTime !== 0) {
          return byTime;
        }
        return a.deviceId.localeCompare(b.deviceId);
      })
    : [];

  const paired = Array.isArray(root.paired)
    ? root.paired
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        const deviceId = pickString(entry, ["deviceId", "device_id"]);
        if (!deviceId) {
          return null;
        }
        return {
          deviceId,
          displayName: sanitizeDisplayName(pickString(entry, ["displayName", "display_name"]), deviceId),
          roles: resolveRoles(entry),
          scopes: dedupeStrings(pickStringArray(entry, ["scopes"])),
          remoteIp: pickString(entry, ["remoteIp", "remote_ip"]),
          tokenRoles: resolveTokenRoles(entry),
          createdAtMs: pickNumber(entry, ["createdAtMs", "created_at_ms"]),
          approvedAtMs: pickNumber(entry, ["approvedAtMs", "approved_at_ms"]),
        } satisfies PairedDeviceRecord;
      })
      .filter((entry): entry is PairedDeviceRecord => Boolean(entry))
      .sort((a, b) => {
        const byApprovedAt = (b.approvedAtMs ?? 0) - (a.approvedAtMs ?? 0);
        if (byApprovedAt !== 0) {
          return byApprovedAt;
        }
        const byCreatedAt = (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }
        return a.deviceId.localeCompare(b.deviceId);
      })
    : [];

  const currentDevicePendingRequest =
    currentDeviceId ? pending.find((entry) => entry.deviceId === currentDeviceId) ?? null : null;
  const currentDevicePairedRecord =
    currentDeviceId ? paired.find((entry) => entry.deviceId === currentDeviceId) ?? null : null;

  let currentDeviceStatus: DevicePairingVisibility["currentDeviceStatus"] = "unavailable";
  if (currentDeviceId) {
    currentDeviceStatus = currentDevicePendingRequest
      ? "pending"
      : currentDevicePairedRecord
        ? "paired"
        : "unlisted";
  }

  return {
    currentDeviceId,
    currentDeviceStatus,
    currentDevicePendingRequest,
    currentDevicePairedRecord,
    pending,
    paired,
  };
}
