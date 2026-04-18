export type ThreadToolEventSessionResolver = (params: {
  sessionKeyHint?: string | null;
  runId?: string | null;
  selectedSessionKey?: string | null;
  activeRunId?: string | null;
}) => string | null;

export type ThreadToolEventSessionMatcher = (
  left: string | null | undefined,
  right: string | null | undefined,
) => boolean;

type RouteParams = {
  sessionKeyHint?: string | null;
  runId?: string | null;
  activeSessionKey?: string | null;
  activeRunId?: string | null;
  resolveSessionKey: ThreadToolEventSessionResolver;
  sessionKeysMatch: ThreadToolEventSessionMatcher;
};

export type ChatEventDispatch =
  | {
    kind: "active";
    state: "delta" | "final" | "aborted" | "error";
    targetKey: null;
  }
  | {
    kind: "cached";
    state: "delta" | "final" | "aborted" | "error";
    targetKey: string;
  };

export type AgentEventDispatch =
  | {
    kind: "active";
    targetKey: null;
  }
  | {
    kind: "cached";
    targetKey: string;
  };

function resolveThreadToolEventRoute(params: RouteParams):
  | { kind: "active"; targetKey: null }
  | { kind: "cached"; targetKey: string } {
  const activeSessionKey = params.activeSessionKey ?? null;
  const resolvedSessionKey = params.resolveSessionKey({
    sessionKeyHint: params.sessionKeyHint,
    runId: params.runId,
    selectedSessionKey: activeSessionKey,
    activeRunId: params.activeRunId,
  });
  const isNonActiveSession = Boolean(
    resolvedSessionKey &&
      (!activeSessionKey || !params.sessionKeysMatch(resolvedSessionKey, activeSessionKey)),
  );

  if (!isNonActiveSession) {
    return { kind: "active", targetKey: null };
  }

  const isSameActiveRun = Boolean(
    activeSessionKey &&
      params.activeRunId &&
      params.runId &&
      params.runId === params.activeRunId,
  );

  if (isSameActiveRun) {
    return { kind: "active", targetKey: null };
  }

  if (!resolvedSessionKey) {
    return { kind: "active", targetKey: null };
  }

  return {
    kind: "cached",
    targetKey: resolvedSessionKey,
  };
}

export function resolveChatEventDispatch(
  params: RouteParams & {
    state: "delta" | "final" | "aborted" | "error";
  },
): ChatEventDispatch {
  const route = resolveThreadToolEventRoute(params);
  if (route.kind === "cached") {
    return {
      kind: "cached",
      state: params.state,
      targetKey: route.targetKey,
    };
  }
  return {
    kind: "active",
    state: params.state,
    targetKey: null,
  };
}

export function resolveAgentEventDispatch(params: RouteParams): AgentEventDispatch {
  return resolveThreadToolEventRoute(params);
}
