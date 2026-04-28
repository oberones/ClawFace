import { GatewayClient, type GatewayClientOptions, type GatewayCloseInfo, type GatewayHelloOk } from "./gateway.ts";

export const GATEWAY_CONNECTION_TEST_TIMEOUT_MS = 7_000;

export type GatewayConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | GatewayConnectionTestSuccess
  | GatewayConnectionTestFailure;

export type GatewayConnectionTestSuccess = {
  status: "success";
  summary: string;
  description: string;
  testedAt: number;
};

export type GatewayConnectionTestFailure = {
  status: "failure";
  summary: string;
  description: string;
  testedAt: number;
};

type GatewayConnectionTestClient = {
  start: () => void;
  stop: () => void;
};

type GatewayConnectionTestTimer = ReturnType<typeof setTimeout>;

type GatewayConnectionTestClientConstructor = new (
  options: GatewayClientOptions,
) => GatewayConnectionTestClient;

export type RunGatewayConnectionTestOptions = {
  gatewayUrl: string;
  token?: string;
  password?: string;
  timeoutMs?: number;
  clientConstructor?: GatewayConnectionTestClientConstructor;
  now?: () => number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => GatewayConnectionTestTimer;
  clearTimeoutFn?: (timer: GatewayConnectionTestTimer) => void;
};

function nowFrom(options: Pick<RunGatewayConnectionTestOptions, "now">): number {
  return typeof options.now === "function" ? options.now() : Date.now();
}

function normalizeFailureText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return normalizeFailureText(error) || "An unknown error occurred.";
}

export function validateGatewayConnectionTestUrl(
  gatewayUrl: string,
  testedAt = Date.now(),
): GatewayConnectionTestFailure | null {
  const trimmed = normalizeFailureText(gatewayUrl);
  if (!trimmed) {
    return {
      status: "failure",
      summary: "Gateway URL is required",
      description: "Enter a WebSocket URL before testing the connection.",
      testedAt,
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return {
        status: "failure",
        summary: "Invalid WebSocket URL",
        description: "Use a ws:// or wss:// Gateway URL.",
        testedAt,
      };
    }
  } catch {
    return {
      status: "failure",
      summary: "Invalid WebSocket URL",
      description: "The Gateway URL could not be parsed. Check for typos or missing protocol.",
      testedAt,
    };
  }
  return null;
}

export function buildGatewayConnectionTestSuccess(
  hello: GatewayHelloOk,
  testedAt = Date.now(),
): GatewayConnectionTestSuccess {
  const details: string[] = [];
  if (hello.protocol) {
    details.push(`protocol ${hello.protocol}`);
  }
  if (hello.server?.version) {
    details.push(`server ${hello.server.version}`);
  }
  if (hello.server?.host) {
    details.push(`host ${hello.server.host}`);
  }
  const suffix = details.length > 0 ? ` (${details.join(", ")}).` : ".";
  return {
    status: "success",
    summary: "Connection succeeded",
    description: `The Gateway accepted the WebSocket connection and completed the OpenClaw handshake${suffix}`,
    testedAt,
  };
}

export function buildGatewayConnectionTestFailureFromClose(
  info: GatewayCloseInfo,
  testedAt = Date.now(),
): GatewayConnectionTestFailure {
  const reason = normalizeFailureText(info.reason);
  const errorCode = normalizeFailureText(info.error?.code);
  const errorMessage = normalizeFailureText(info.error?.message);
  const searchText = `${errorCode} ${errorMessage} ${reason}`.toLowerCase();

  if (searchText.includes("pairing")) {
    return {
      status: "failure",
      summary: "Pairing approval required",
      description: "The Gateway is reachable, but this device needs to be approved before ClawFace can connect.",
      testedAt,
    };
  }

  if (
    searchText.includes("auth") ||
    searchText.includes("token") ||
    searchText.includes("password") ||
    searchText.includes("unauthorized") ||
    searchText.includes("forbidden")
  ) {
    return {
      status: "failure",
      summary: "Authentication failed",
      description: errorMessage || reason || "The Gateway rejected the supplied token or password.",
      testedAt,
    };
  }

  if (errorCode === "INVALID_URL") {
    return {
      status: "failure",
      summary: "Invalid WebSocket URL",
      description: errorMessage || reason || "The Gateway URL could not be opened.",
      testedAt,
    };
  }

  if (info.code === 1006 && !reason && !errorMessage) {
    return {
      status: "failure",
      summary: "Connection failed",
      description: "The WebSocket closed before the Gateway handshake completed. Check the URL, network access, and Origin allowlist.",
      testedAt,
    };
  }

  return {
    status: "failure",
    summary: info.code === 4008 ? "Handshake failed" : "Connection failed",
    description:
      errorMessage ||
      reason ||
      `The Gateway closed the connection with code ${info.code}. Check the URL, server status, and credentials.`,
    testedAt,
  };
}

export function buildGatewayConnectionTestFailureFromError(
  error: unknown,
  testedAt = Date.now(),
): GatewayConnectionTestFailure {
  return {
    status: "failure",
    summary: "Connection test failed",
    description: formatErrorDetail(error),
    testedAt,
  };
}

export function buildGatewayConnectionTestTimeoutFailure(
  timeoutMs: number,
  testedAt = Date.now(),
): GatewayConnectionTestFailure {
  return {
    status: "failure",
    summary: "Connection timed out",
    description: `No Gateway handshake completed within ${Math.round(timeoutMs / 1000)} seconds. Check the server address, firewall, and network route.`,
    testedAt,
  };
}

export function runGatewayConnectionTest(
  options: RunGatewayConnectionTestOptions,
): Promise<GatewayConnectionTestSuccess | GatewayConnectionTestFailure> {
  const testedAt = nowFrom(options);
  const invalidUrl = validateGatewayConnectionTestUrl(options.gatewayUrl, testedAt);
  if (invalidUrl) {
    return Promise.resolve(invalidUrl);
  }

  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(1, Math.floor(options.timeoutMs))
      : GATEWAY_CONNECTION_TEST_TIMEOUT_MS;
  const Client = options.clientConstructor ?? GatewayClient;
  const setTimeoutFn = options.setTimeoutFn ?? globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = options.clearTimeoutFn ?? globalThis.clearTimeout.bind(globalThis);

  return new Promise((resolve) => {
    let settled = false;
    let client: GatewayConnectionTestClient | null = null;
    let timeoutHandle: GatewayConnectionTestTimer | null = null;

    const finish = (result: GatewayConnectionTestSuccess | GatewayConnectionTestFailure) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle !== null) {
        clearTimeoutFn(timeoutHandle);
        timeoutHandle = null;
      }
      try {
        client?.stop();
      } catch {
        // ignore cleanup errors from a failed test client
      }
      resolve(result);
    };

    timeoutHandle = setTimeoutFn(() => {
      finish(buildGatewayConnectionTestTimeoutFailure(timeoutMs, nowFrom(options)));
    }, timeoutMs);

    try {
      client = new Client({
        url: options.gatewayUrl.trim(),
        token: options.token,
        password: options.password,
        clientName: "openclaw-control-ui",
        mode: "webchat",
        persistDeviceAuth: false,
        onHello: (hello) => {
          finish(buildGatewayConnectionTestSuccess(hello, nowFrom(options)));
        },
        onClose: (info) => {
          finish(buildGatewayConnectionTestFailureFromClose(info, nowFrom(options)));
        },
      });
      client.start();
    } catch (error) {
      finish(buildGatewayConnectionTestFailureFromError(error, nowFrom(options)));
    }
  });
}
