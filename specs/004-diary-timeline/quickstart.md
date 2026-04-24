# Quickstart: Dream Diary Timeline

## Goal

Validate that the Dreams surface now behaves like an interactive Dream Diary reader, not a memory dashboard.

## Automated Validation

Run:

```bash
make test-unit
make typecheck
make build
```

Expected result: all commands pass.

## Manual Desktop Flow

1. Launch ClawFace in the desktop environment.
2. Connect to an OpenClaw workspace with Dream Diary content.
3. Open Dreams from the sidebar.
4. Confirm the first meaningful surface is a diary timeline plus focused reader.
5. Select an older diary entry.
6. Confirm the selected entry is visibly active and the reader updates.
7. Use the latest-entry affordance.
8. Confirm the newest diary entry is selected again.
9. Trigger manual refresh.
10. Confirm the snapshot freshness or refreshing state is visible and the selected entry remains understandable.

## State Validation

Verify these cases when fixtures or workspaces are available:

- diary content with several dated entries
- diary content with headings but weak dates
- diary content that falls back to one limited readable entry
- empty diary response
- disabled dreaming with existing diary content
- diary method unavailable or gateway disconnected

## Regression Checks

- The Dreams surface should not lead with signal overview cards.
- Waiting, grounded, and promoted memory lanes should not dominate the primary flow.
- Candidate detail and candidate timeline panels should not appear in the main diary reader.
- Imported Insights and Memory Palace panels should not appear in MVP unless they are explicitly entry-scoped in a later feature.
- Raw backend method names, memory filesystem paths, and score internals should not appear as the main user-facing explanation.
