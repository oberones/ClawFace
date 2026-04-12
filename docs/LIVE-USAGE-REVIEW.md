# Live Usage Review

This document records the real desktop usage review that informed the post-`3.3` work.

The original goal of Ticket `3.3.5` was to stop inventing polish tickets from static inspection and instead use real product behavior on the authoritative macOS machine to choose the next work.

## Environment

- Authoritative environment: macOS desktop app
- Backend shape exercised: OpenClaw running through a local container with a shared `~/.openclaw/media` volume
- Review style: cumulative hands-on usage with iterative fixes, not a single scripted review session

## Scenarios exercised

- launch the desktop app and review existing sessions with prior generated images
- generate fresh images in an active chat while the backend is still running and streaming
- confirm generated images appear live in chat instead of only after restart or reload
- confirm delayed attachment hydration does not permanently fail when the image lands slightly later
- confirm the chat view stays pinned to the bottom when delayed image attachments land
- review the tool activity presentation during image generation and remove low-value duplicate image previews
- review shared-volume container path handling for generated media and validate configurable path-prefix mappings

## Findings that mattered

### 1. Fresh generated images were not stable in live chat

Observed behavior:
- previously generated images often appeared after app relaunch
- freshly generated images often required a reload before they showed up in chat

What this surfaced:
- live assistant events and finalized history were not being reconciled consistently
- delayed history hydration needed to remain available as a real fallback for image-producing runs
- pretty filenames could win over the concrete UUID-backed media path during extraction

Resulting work:
- live assistant/media reconciliation and delayed hydration were tightened
- assistant message upsert/finalization behavior was cleaned up
- image path resolution was corrected to prefer concrete media paths
- focused helper tests were added around hydration and final-assistant resolution

### 2. Shared-volume container installs needed path translation, not just local file serving

Observed behavior:
- generated media existed on disk, but ClawFace could still try the wrong local path
- container paths and host paths diverged even when the media volume was shared

What this surfaced:
- local rendering needed prefix translation support for container-to-host path remapping

Resulting work:
- built-in support was added for `~/.openclaw/media`
- configurable path-prefix mappings were added to Settings
- helper-level tests were added for media path and prefix mapping behavior

### 3. Delayed image hydration could break scroll position

Observed behavior:
- when an image finally appeared, the viewport could jump above the newest message
- startup could also land above the bottom of chat

What this surfaced:
- bottom pinning needed to react to late content growth, not just coarse message-state changes

Resulting work:
- resize-based bottom anchoring was added
- scroll anchoring was extracted into a small helper
- focused regression coverage was added for delayed attachment resize behavior

### 4. Tool activity became visually noisy once chat attachments worked

Observed behavior:
- the same generated image could appear both in the chat attachment flow and inside tool activity output

What this surfaced:
- the tool panel image preview was useful for debugging but not desirable as a steady-state product behavior

Resulting work:
- the duplicate `image_generate` inline preview was removed from tool activity

## Review outcome

The review did what Ticket `3.3.5` was supposed to do:

- it converted live product friction into concrete tickets and fixes
- it exposed the highest-value remaining issues through real usage instead of speculation
- it gave enough evidence to stop inventing more abstract `3.3` polish tickets

The strongest follow-on work from this review has already been consumed by:

- generated-image stabilization and cleanup
- media path mapping and container/shared-volume support
- delayed hydration and scroll anchoring cleanup
- `4.3` settings decomposition and targeted helper-level regression coverage

## Current conclusion

`3.3.5` should be considered complete.

There is no known remaining `3.3` review blocker that needs to be solved before moving on.
Future runtime/tool UX work should come from new live findings, not from reopening this ticket.
