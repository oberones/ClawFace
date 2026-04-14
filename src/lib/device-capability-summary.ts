export type DeviceCapabilityChipTone = "good" | "neutral" | "muted";

export type DeviceCapabilityChip = {
  key: string;
  label: string;
  tone: DeviceCapabilityChipTone;
};

export type DeviceCapabilitySummary = {
  headline: string;
  chips: DeviceCapabilityChip[];
  detail: string | null;
};

type SummarizeDeviceCapabilitiesParams = {
  roles: string[];
  scopes: string[];
};

const OPERATOR_CAPABILITY_ORDER = [
  "operator.admin",
  "operator.approvals",
  "operator.pairing",
  "operator.write",
  "operator.read",
] as const;
const KNOWN_OPERATOR_SCOPES = new Set<string>(OPERATOR_CAPABILITY_ORDER);

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

function normalizeScopes(scopes: string[]): string[] {
  const out = new Set(
    scopes
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
  if (out.has("operator.admin")) {
    out.add("operator.read");
    out.add("operator.write");
    out.add("operator.approvals");
    out.add("operator.pairing");
  } else if (out.has("operator.write")) {
    out.add("operator.read");
  }
  return [...out].toSorted();
}

function normalizeRoles(roles: string[]): string[] {
  return dedupeStrings(
    roles
      .map((role) => role.trim())
      .filter(Boolean),
  );
}

function formatScopeLabel(scope: string): string {
  switch (scope) {
    case "operator.admin":
      return "Admin control";
    case "operator.approvals":
      return "Approvals";
    case "operator.pairing":
      return "Pairing";
    case "operator.write":
      return "Write access";
    case "operator.read":
      return "Read access";
    default:
      return scope
        .split(".")
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

function scopeChipTone(scope: string): DeviceCapabilityChipTone {
  if (scope === "operator.admin") {
    return "good";
  }
  if (scope === "operator.read") {
    return "muted";
  }
  return "neutral";
}

function buildHeadline(normalizedScopes: string[], normalizedRoles: string[]): string {
  if (normalizedScopes.includes("operator.admin")) {
    return "Full operator control";
  }
  if (
    normalizedScopes.includes("operator.write") &&
    normalizedScopes.includes("operator.approvals") &&
    normalizedScopes.includes("operator.pairing")
  ) {
    return "Operator workspace control";
  }
  if (normalizedScopes.includes("operator.write")) {
    return "Interactive operator access";
  }
  if (
    normalizedScopes.includes("operator.approvals") ||
    normalizedScopes.includes("operator.pairing")
  ) {
    return "Limited control access";
  }
  if (normalizedScopes.includes("operator.read")) {
    return "Read-only visibility";
  }
  if (normalizedRoles.includes("node")) {
    return "Node-linked device";
  }
  if (normalizedRoles.includes("operator")) {
    return "Operator device";
  }
  return "Custom capability access";
}

export function summarizeDeviceCapabilities(
  params: SummarizeDeviceCapabilitiesParams,
): DeviceCapabilitySummary {
  const normalizedRoles = normalizeRoles(params.roles);
  const normalizedScopes = normalizeScopes(params.scopes);

  const primaryChips = OPERATOR_CAPABILITY_ORDER
    .filter((scope) => normalizedScopes.includes(scope))
    .map((scope) => ({
      key: scope,
      label: formatScopeLabel(scope),
      tone: scopeChipTone(scope),
      }));

  const customScopes = normalizedScopes.filter((scope) => !KNOWN_OPERATOR_SCOPES.has(scope));
  const roleChips = normalizedRoles
    .filter((role) => role !== "operator")
    .map((role) => ({
      key: `role:${role}`,
      label: `${role.charAt(0).toUpperCase() + role.slice(1)} role`,
      tone: "muted" as const,
    }));

  const chips = [...primaryChips, ...roleChips];
  if (customScopes.length > 0) {
    chips.push({
      key: "custom-scopes",
      label: `${customScopes.length} custom scope${customScopes.length === 1 ? "" : "s"}`,
      tone: "muted",
    });
  }

  const detail = customScopes.length > 0 ? customScopes.join(", ") : null;

  return {
    headline: buildHeadline(normalizedScopes, normalizedRoles),
    chips,
    detail,
  };
}
