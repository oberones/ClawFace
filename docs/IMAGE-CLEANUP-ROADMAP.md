# Image Cleanup Roadmap

This roadmap captures the follow-up cleanup work after the generated-image rendering fixes in `fix: images not showing up in chat`.

The goal is to keep the working behavior, but trim the debugging-era divergence that built up while we were closing the bug.

## 1. Unify Relative Image Path Resolution

Status: Done

Problem:
- Live parsing in `src/app.tsx` still has its own fallback logic for bare image names.
- Renderer/runtime image resolution in `src/lib/message-image-source.ts` already treats generated-image filenames as media-first.
- That split makes live and post-reload attachment handling harder to reason about.

Tasks:
- Route bare generated image names through the same media-first assumption used by the renderer image resolver.
- Reduce duplicate fallback logic where possible.
- Confirm that live-generated attachments and reloaded history produce the same `sourcePath` shape.

Exit criteria:
- A bare generated filename like `foo---uuid.png` resolves to `~/.openclaw/media/...` in both live and reload paths.
- There is no remaining workspace-only fallback for bare generated image names in the live message parser.

## 2. Reconcile Eager Attachment Inserts With Final Assistant Messages

Status: Done

Problem:
- The app can append an attachment-only assistant message from live events, then append a second final assistant message for the same run.
- That keeps the flow working, but it leaves duplicate-render risk and extra state.

Tasks:
- Replace “append another message” behavior with “upgrade/merge the run’s assistant message” behavior.
- Key the reconciliation by `runId` plus attachment signature instead of only message content.
- Keep tool-output attachment messages separate from assistant messages.

Exit criteria:
- A run that streams media and then finishes with text+media renders as one assistant message, not two.

## 3. Narrow History Hydration To Real Fallback Cases

Status: Done

Problem:
- The delayed history hydration path is still doing useful recovery work, but it is also running in some normal-success flows.
- That adds extra session reload churn and complicates scroll stability.

Tasks:
- Only schedule delayed hydration when the final live payload is missing a renderable attachment or otherwise incomplete.
- Avoid reloading history after a run has already committed a complete assistant message locally.
- Keep the lifecycle-end fallback as a safety net, not the default success path.

Exit criteria:
- Successful local commits do not trigger avoidable history reloads.
- Recovery hydration still works when the live event stream is incomplete.

Notes:
- The schedule/clear/reload decision logic now lives in `src/lib/media-hydration.ts` so it can be tested without reaching through `src/app.tsx`.
- The delayed hydration timer-tick decision now also lives in `src/lib/media-hydration.ts`, which trims another branch out of `src/app.tsx` without changing the event flow itself.
- The duplicated assistant-reply attachment projection path for active vs cached agent events has been consolidated in `src/app.tsx`.
- Active and cached finalization branches now also share more of the run-state cleanup bookkeeping in `src/app.tsx`.
- Final tool-message bundling for active vs cached chat-final branches now goes through `src/lib/tool-final-messages.ts`.
- Final assistant commit eligibility now goes through `src/lib/final-assistant-message.ts`, which keeps attachment-bearing finals from depending on slightly different inline rules.
- `handleChatEvent` now delegates its cached/active final and terminal branches through dedicated local helpers instead of keeping all of that event-level flow inline.
- `handleAgentEvent` now delegates its cached/active tool, assistant, and lifecycle branches through dedicated local helpers as well.
- `handleChatEvent` now delegates its cached/active delta branches through dedicated local helpers too.
- Further extraction here is optional polish rather than a blocker for the image-rendering cleanup track.

## 4. Demote Temporary Debug UI

Status: Done

Problem:
- The `Source` / `Trying` lines in image placeholders were very helpful during debugging, but they are now always-on product UI.

Tasks:
- Move image debug details behind a debug toggle, developer mode, or error-expander.
- Keep enough failure detail for support/debugging without showing raw path data in the default UX.

Exit criteria:
- Normal users see clean loading/error states.
- Debug path details are still accessible when needed.

Notes:
- Image path details now stay hidden by default and can be re-enabled in the renderer with `localStorage.setItem("clawui.image.debugPaths", "1")` or `?imageDebugPaths=1`.

## 5. Add Focused Validation Coverage

Status: In progress

Problem:
- The generated-image fixes span multiple branches and fallbacks, but the behavior is mostly validated manually today.

Tasks:
- Add focused coverage for path-prefix mappings and image source resolution.
- Add coverage for live attachment hydration versus history reload.
- Add a regression check for scroll anchoring when attachments appear after initial message render.

Exit criteria:
- The highest-risk media/render paths have targeted automated coverage.

Notes:
- Added focused Node-based regression tests for path-prefix mapping, image source resolution, and specific-image-path selection via `make test-unit`.
- Added focused coverage for hydration decision rules in `src/lib/media-hydration.ts`.
- Added focused coverage for delayed hydration timer decisions in `src/lib/media-hydration.ts`.
- Added focused coverage for final tool-message bundling in `src/lib/tool-final-messages.ts`.
- Added focused coverage for final assistant commit eligibility in `src/lib/final-assistant-message.ts`.
- Live assistant hydration and delayed history recovery still need a cleaner event-level seam before they are a good automated test target.
