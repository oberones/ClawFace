# Phase 1 Regression Checklist

Use this checklist for Phase 1 refactors that touch shell behavior, session state,
thread rendering, streaming, connection handling, or Electron shell behavior.

This is intentionally manual and lightweight. The goal is to catch obvious shell
regressions before or during PR review.

## Connection

- Launch ClawFace and confirm the shell connects without showing stale error copy.
- Disconnect the gateway or point the app at an invalid gateway URL and confirm:
  - the shell shows a disconnected/error state
  - send controls stop implying work is still in flight
- Restore the gateway and confirm reconnect/recovery notices behave sensibly.

## Sessions

- Switch between at least three sessions and confirm:
  - the selected session changes immediately
  - draft state stays scoped to the correct session
  - stale tool or streaming state does not leak into other sessions
- Create a new session and confirm it appears in the sidebar and loads cleanly.
- If the change touched session ordering/defaults, confirm the primary session
  still sorts correctly.

## Sending And Streaming

- Send a normal text message and confirm:
  - the optimistic user message appears once
  - assistant streaming begins and completes normally
- During an active stream, switch to another session and back:
  - the originating session keeps the active work
  - other sessions do not inherit the stream or tool activity
- If the change touched history or finalization, reload the app and confirm the
  completed thread still renders the expected final assistant content once.

## Slash Commands

- Run `/status` and confirm the status card renders instead of raw payload text.
- Run `/models` and confirm the list renders cleanly.
- If the change touched command/reset/send flows, run `/reset` in a disposable
  session and confirm the thread reloads without leaving stale run state behind.

## Thread And Scroll

- Open a session with existing history and confirm the thread loads without a
  blank or duplicate message region.
- Scroll up, then back down, and confirm the bottom-pin / scroll behavior still
  feels stable.
- Verify the empty-thread state still renders correctly for a brand-new session.

## Media And Tool Visibility

- If the refactor touched any message/tool/media path, run one tool-producing
  thread and confirm tool rows and attachment messages still render once.
- If image generation is available in the environment, verify that image tool
  activity remains scoped to the correct session while it runs.

## Desktop Shell

- On desktop launch, confirm the main window opens correctly and external links
  still open outside the app.
- On macOS, close the main window and confirm the app hides instead of quitting.
- Re-activate the app and confirm the main window restores/focuses correctly.

## When To Treat This As Required

Run at least the relevant sections whenever a slice touches:
- `src/app.tsx`
- thread/session/tool controller seams
- connection/recovery behavior
- `electron/main.cjs`
- Electron window/protocol/ipc behavior
