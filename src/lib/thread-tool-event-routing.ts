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

export type ChatEventDispatch = {
  kind: "active" | "cached";
  state: "delta" | "final" | "aborted" | "error";
  targetKey: string | null;
};

export type AgentEventDispatch = {
  kind: "active" | "cached";
  targetKey: string | null;
};

function resolveThreadToolEventRoute(params: RouteParams): {
  kind: "active" | "cached";
  targetKey: string | null;
} {
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
  return {
    kind: route.kind,
    state: params.state,
    targetKey: route.targetKey,
  };
}

export function resolveAgentEventDispatch(params: RouteParams): AgentEventDispatch {
  return resolveThreadToolEventRoute(params);
}
