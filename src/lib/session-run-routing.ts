export type RunScopedSessionEntry = {
  sessionKey: string;
  runId?: string | null;
};

export function resolveEventSessionKey(params: {
  sessionKeyHint?: string | null;
  runId?: string | null;
  selectedSessionKey?: string | null;
  activeRunId?: string | null;
  cachedRuns?: RunScopedSessionEntry[];
}): string | null {
  const hintedSessionKey = params.sessionKeyHint?.trim();
  if (hintedSessionKey) {
    return hintedSessionKey;
  }

  const normalizedRunId = params.runId?.trim();
  if (!normalizedRunId) {
    return null;
  }

  const selectedSessionKey = params.selectedSessionKey?.trim();
  if (selectedSessionKey && params.activeRunId?.trim() === normalizedRunId) {
    return selectedSessionKey;
  }

  // Background run events may arrive after the user switches sessions, so keep a
  // small run-to-session cache instead of routing every event to the selected tab.
  for (const entry of params.cachedRuns ?? []) {
    const sessionKey = entry.sessionKey?.trim();
    if (!sessionKey) {
      continue;
    }
    if (entry.runId?.trim() === normalizedRunId) {
      return sessionKey;
    }
  }

  return null;
}
