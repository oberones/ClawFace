import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { GatewayClient } from "../lib/gateway.ts";
import { loadOrCreateDeviceIdentity } from "../lib/device-identity.ts";
import {
  deriveDevicePairingActionSupport,
  pickDevicePairingResolveMethod,
  type DevicePairingActionSupport,
  type DevicePairingPendingDecision,
} from "../lib/device-pairing-actions.ts";
import {
  normalizeDevicePairingVisibility,
  type DevicePairingVisibility,
} from "../lib/device-pairing-visibility.ts";
import type { DevicePairingGatewayEvent } from "../lib/shell-gateway-events.ts";
import type { ConnectionStatus } from "../lib/types.ts";

const DEFAULT_DEVICE_PAIRING_ACTION_SUPPORT: DevicePairingActionSupport = {
  canApprovePendingRequests: false,
  canRejectPendingRequests: false,
};

export type DevicePairingSettingsModel = {
  connectionStatus: ConnectionStatus;
  currentDeviceId: string | null;
  devicePairingVisibility: DevicePairingVisibility | null;
  devicePairingSupported: boolean;
  devicePairingActionSupport: DevicePairingActionSupport;
  devicePairingLoading: boolean;
  devicePairingError: string | null;
  devicePairingLastUpdatedAt: number | null;
  resolvingDevicePairRequestIds: Record<string, DevicePairingPendingDecision>;
  onRefreshDevicePairingVisibility: () => void;
  onResolveDevicePairRequest: (requestId: string, decision: DevicePairingPendingDecision) => void;
};

type UseDevicePairingControllerParams = {
  showSettings: boolean;
  connectionStatus: ConnectionStatus;
  gatewayUrl: string;
  token: string;
  password: string;
  clientRef: MutableRefObject<GatewayClient | null>;
  gatewayMethodsRef: MutableRefObject<Set<string>>;
};

export function useDevicePairingController(
  params: UseDevicePairingControllerParams,
) {
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [devicePairingRaw, setDevicePairingRaw] = useState<unknown>(null);
  const [devicePairingSupported, setDevicePairingSupported] = useState(false);
  const [devicePairingActionSupport, setDevicePairingActionSupport] = useState<DevicePairingActionSupport>(
    DEFAULT_DEVICE_PAIRING_ACTION_SUPPORT,
  );
  const [devicePairingLoading, setDevicePairingLoading] = useState(false);
  const [devicePairingError, setDevicePairingError] = useState<string | null>(null);
  const [devicePairingLastUpdatedAt, setDevicePairingLastUpdatedAt] = useState<number | null>(null);
  const [resolvingDevicePairRequestIds, setResolvingDevicePairRequestIds] = useState<
    Record<string, DevicePairingPendingDecision>
  >({});

  const settingsOpenRef = useRef(params.showSettings);

  useEffect(() => {
    settingsOpenRef.current = params.showSettings;
  }, [params.showSettings]);

  const devicePairingVisibility = useMemo(
    () =>
      devicePairingRaw === null
        ? null
        : normalizeDevicePairingVisibility(devicePairingRaw, currentDeviceId),
    [currentDeviceId, devicePairingRaw],
  );

  const clearResolvingDevicePairRequest = useCallback((requestId: string) => {
    setResolvingDevicePairRequestIds((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, requestId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  }, []);

  const refreshDevicePairingVisibility = useCallback(async (clientOverride?: GatewayClient | null) => {
    const client = clientOverride ?? params.clientRef.current;
    if (!client || !client.connected) {
      return;
    }
    const supportsPairList = params.gatewayMethodsRef.current.has("device.pair.list");
    setDevicePairingSupported(supportsPairList);
    if (!supportsPairList) {
      setDevicePairingLoading(false);
      setDevicePairingError(null);
      setDevicePairingRaw(null);
      setDevicePairingLastUpdatedAt(null);
      return;
    }
    setDevicePairingLoading(true);
    try {
      const response = await client.request("device.pair.list", {}, { timeoutMs: 10_000 });
      if (params.clientRef.current !== client) {
        return;
      }
      setDevicePairingRaw(response);
      setDevicePairingError(null);
      setDevicePairingLastUpdatedAt(Date.now());
    } catch (error) {
      if (params.clientRef.current !== client) {
        return;
      }
      setDevicePairingError(error instanceof Error ? error.message : String(error));
    } finally {
      if (params.clientRef.current === client) {
        setDevicePairingLoading(false);
      }
    }
  }, [params.clientRef, params.gatewayMethodsRef]);

  useEffect(() => {
    setDevicePairingRaw(null);
    setDevicePairingSupported(false);
    setDevicePairingActionSupport(DEFAULT_DEVICE_PAIRING_ACTION_SUPPORT);
    setDevicePairingLoading(false);
    setDevicePairingError(null);
    setDevicePairingLastUpdatedAt(null);
    setResolvingDevicePairRequestIds({});
  }, [params.gatewayUrl, params.token, params.password]);

  useEffect(() => {
    if (!params.showSettings) {
      return;
    }
    let cancelled = false;
    void loadOrCreateDeviceIdentity()
      .then((identity) => {
        if (!cancelled) {
          setCurrentDeviceId(identity.deviceId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentDeviceId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.showSettings]);

  useEffect(() => {
    if (!params.showSettings || params.connectionStatus !== "connected") {
      return;
    }
    void refreshDevicePairingVisibility();
  }, [params.connectionStatus, params.showSettings, refreshDevicePairingVisibility]);

  const handleGatewayHello = useCallback((client: GatewayClient) => {
    const supportsPairList = params.gatewayMethodsRef.current.has("device.pair.list");
    setDevicePairingActionSupport(deriveDevicePairingActionSupport(params.gatewayMethodsRef.current));
    setDevicePairingSupported(supportsPairList);
    if (!supportsPairList) {
      setDevicePairingLoading(false);
      setDevicePairingError(null);
      setDevicePairingRaw(null);
      setDevicePairingLastUpdatedAt(null);
    } else if (settingsOpenRef.current) {
      void refreshDevicePairingVisibility(client);
    }
  }, [params.gatewayMethodsRef, refreshDevicePairingVisibility]);

  const handleGatewayClose = useCallback(() => {
    setDevicePairingActionSupport(DEFAULT_DEVICE_PAIRING_ACTION_SUPPORT);
    setDevicePairingLoading(false);
  }, []);

  const handleGatewayEvent = useCallback((event: DevicePairingGatewayEvent, client: GatewayClient) => {
    if (settingsOpenRef.current) {
      void refreshDevicePairingVisibility(client);
    }
    if (event.kind === "device-pair-resolved" && event.requestId) {
      clearResolvingDevicePairRequest(event.requestId);
    }
  }, [clearResolvingDevicePairRequest, refreshDevicePairingVisibility]);

  const resolveDevicePairRequest = useCallback(async (
    requestId: string,
    decision: DevicePairingPendingDecision,
  ) => {
    const client = params.clientRef.current;
    if (!client) {
      return;
    }
    const method = pickDevicePairingResolveMethod(params.gatewayMethodsRef.current, decision);
    if (!method) {
      setDevicePairingError(
        `This gateway does not advertise ${
          decision === "approve" ? "device.pair.approve" : "device.pair.reject"
        }.`,
      );
      return;
    }
    setDevicePairingError(null);
    setResolvingDevicePairRequestIds((prev) => ({ ...prev, [requestId]: decision }));
    try {
      await client.request(method, { requestId }, { timeoutMs: 10_000 });
      await refreshDevicePairingVisibility(client);
    } catch (error) {
      setDevicePairingError(error instanceof Error ? error.message : String(error));
    } finally {
      clearResolvingDevicePairRequest(requestId);
    }
  }, [clearResolvingDevicePairRequest, params.clientRef, params.gatewayMethodsRef, refreshDevicePairingVisibility]);

  const settingsModel = useMemo<DevicePairingSettingsModel>(() => ({
    connectionStatus: params.connectionStatus,
    currentDeviceId,
    devicePairingVisibility,
    devicePairingSupported,
    devicePairingActionSupport,
    devicePairingLoading,
    devicePairingError,
    devicePairingLastUpdatedAt,
    resolvingDevicePairRequestIds,
    onRefreshDevicePairingVisibility: () => {
      void refreshDevicePairingVisibility();
    },
    onResolveDevicePairRequest: (requestId, decision) => {
      void resolveDevicePairRequest(requestId, decision);
    },
  }), [
    currentDeviceId,
    devicePairingActionSupport,
    devicePairingError,
    devicePairingLastUpdatedAt,
    devicePairingLoading,
    devicePairingSupported,
    devicePairingVisibility,
    params.connectionStatus,
    refreshDevicePairingVisibility,
    resolveDevicePairRequest,
    resolvingDevicePairRequestIds,
  ]);

  return {
    settingsModel,
    handleGatewayHello,
    handleGatewayClose,
    handleGatewayEvent,
  };
}
