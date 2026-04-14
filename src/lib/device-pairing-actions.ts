export type DevicePairingPendingDecision = "approve" | "reject";

const DEVICE_PAIRING_METHOD_BY_DECISION: Record<DevicePairingPendingDecision, string> = {
  approve: "device.pair.approve",
  reject: "device.pair.reject",
};

export type DevicePairingActionSupport = {
  canApprovePendingRequests: boolean;
  canRejectPendingRequests: boolean;
};

export function pickDevicePairingResolveMethod(
  methods: Iterable<string>,
  decision: DevicePairingPendingDecision,
): string | null {
  const methodSet = new Set(Array.from(methods));
  const method = DEVICE_PAIRING_METHOD_BY_DECISION[decision];
  return methodSet.has(method) ? method : null;
}

export function deriveDevicePairingActionSupport(
  methods: Iterable<string>,
): DevicePairingActionSupport {
  return {
    canApprovePendingRequests: pickDevicePairingResolveMethod(methods, "approve") !== null,
    canRejectPendingRequests: pickDevicePairingResolveMethod(methods, "reject") !== null,
  };
}
