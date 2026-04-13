import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSessionSidebarActivityModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/session-sidebar-activity.ts"));
}

test("deriveSessionSidebarActivityState keeps the selected session on the current badge", () => {
  const { deriveSessionSidebarActivityState } = loadSessionSidebarActivityModule();

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: true,
      pendingApprovalCount: 2,
      activity: { working: true, unread: true },
    }),
    {
      activityClass: "is-active",
      activityLabel: "Current",
    },
  );
});

test("deriveSessionSidebarActivityState prioritizes pending approvals over unread and working states", () => {
  const { deriveSessionSidebarActivityState } = loadSessionSidebarActivityModule();

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: false,
      pendingApprovalCount: 1,
      activity: { working: true, unread: true },
    }),
    {
      activityClass: "is-approval",
      activityLabel: "Approval",
    },
  );

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: false,
      pendingApprovalCount: 3,
      activity: { working: false, unread: true },
    }),
    {
      activityClass: "is-approval",
      activityLabel: "3 approvals",
    },
  );
});

test("deriveSessionSidebarActivityState falls back to unread, working, and empty states", () => {
  const { deriveSessionSidebarActivityState } = loadSessionSidebarActivityModule();

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: false,
      pendingApprovalCount: 0,
      activity: { working: false, unread: true },
    }),
    {
      activityClass: "is-unread",
      activityLabel: "New activity",
    },
  );

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: false,
      pendingApprovalCount: 0,
      activity: { working: true, unread: false },
    }),
    {
      activityClass: "is-working",
      activityLabel: "Working",
    },
  );

  assert.deepEqual(
    deriveSessionSidebarActivityState({
      isActive: false,
      pendingApprovalCount: 0,
      activity: null,
    }),
    {
      activityClass: "",
      activityLabel: null,
    },
  );
});
