import type { SessionActivityState } from "./types.ts";

export type SessionSidebarActivityState = {
  activityClass: "" | "is-active" | "is-approval" | "is-unread" | "is-working";
  activityLabel: string | null;
};

type DeriveSessionSidebarActivityStateParams = {
  isActive: boolean;
  pendingApprovalCount?: number;
  activity?: SessionActivityState | null;
};

export function deriveSessionSidebarActivityState(
  params: DeriveSessionSidebarActivityStateParams,
): SessionSidebarActivityState {
  if (params.isActive) {
    return {
      activityClass: "is-active",
      activityLabel: "Current",
    };
  }

  const pendingApprovalCount = Math.max(0, params.pendingApprovalCount ?? 0);
  if (pendingApprovalCount > 0) {
    return {
      activityClass: "is-approval",
      activityLabel: pendingApprovalCount > 1 ? `${pendingApprovalCount} approvals` : "Approval",
    };
  }

  if (params.activity?.unread) {
    return {
      activityClass: "is-unread",
      activityLabel: "New activity",
    };
  }

  if (params.activity?.working) {
    return {
      activityClass: "is-working",
      activityLabel: "Working",
    };
  }

  return {
    activityClass: "",
    activityLabel: null,
  };
}
