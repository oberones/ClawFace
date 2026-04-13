import type { GatewaySessionRow, SessionActivityState } from "./types.ts";

export type BackgroundSessionNotice = {
  count: number;
  sessionKeys: string[];
  title: string;
  detail: string;
};

type DeriveBackgroundSessionNoticeParams = {
  selectedSessionKey: string | null;
  sessions: GatewaySessionRow[];
  sessionActivity: Record<string, SessionActivityState>;
};

function resolveSessionLabel(session: GatewaySessionRow | null, sessionKey: string): string {
  const label = session?.label?.trim() || session?.derivedTitle?.trim() || session?.displayName?.trim();
  return label || sessionKey;
}

export function deriveBackgroundSessionNotice(
  params: DeriveBackgroundSessionNoticeParams,
): BackgroundSessionNotice | null {
  const workingSessionKeys: string[] = [];
  const seen = new Set<string>();

  for (const session of params.sessions) {
    if (session.key === params.selectedSessionKey) {
      continue;
    }
    if (!params.sessionActivity[session.key]?.working) {
      continue;
    }
    workingSessionKeys.push(session.key);
    seen.add(session.key);
  }

  for (const [sessionKey, activity] of Object.entries(params.sessionActivity)) {
    if (sessionKey === params.selectedSessionKey || !activity?.working || seen.has(sessionKey)) {
      continue;
    }
    workingSessionKeys.push(sessionKey);
  }

  if (workingSessionKeys.length === 0) {
    return null;
  }

  const sessionLabels = workingSessionKeys.slice(0, 2).map((sessionKey) => {
    const session = params.sessions.find((entry) => entry.key === sessionKey) ?? null;
    return resolveSessionLabel(session, sessionKey);
  });

  const count = workingSessionKeys.length;
  const title = count === 1 ? "Background session still working" : `${count} background sessions still working`;

  let detail: string;
  if (count === 1) {
    detail = `"${sessionLabels[0]}" is still running in the background. Check the sidebar to switch back when you're ready.`;
  } else if (count === 2) {
    detail = `"${sessionLabels[0]}" and "${sessionLabels[1]}" are still running in the background. Check the sidebar to switch between them.`;
  } else {
    detail = `"${sessionLabels[0]}", "${sessionLabels[1]}", and ${count - 2} more session${count - 2 === 1 ? "" : "s"} are still running in the background. Check the sidebar to switch between them.`;
  }

  return {
    count,
    sessionKeys: workingSessionKeys,
    title,
    detail,
  };
}
