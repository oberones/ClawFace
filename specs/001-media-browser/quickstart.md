# Quickstart: Media Browser

## Goal

Validate the first implementation of the Media Browser as a FileManager-style, image-first, source-first media surface that can preview artifacts and reuse them in chat as references/links.

## Prerequisites

- ClawFace desktop app running locally
- OpenClaw backend available
- At least one session with generated or uploaded image artifacts
- Ideally one remote/self-hosted scenario or a portability-compatible setup already supported by current ClawFace media resolution

## Automated Validation

Run:

```bash
make test-unit
make typecheck
make build
```

If Electron main-process files changed, also run:

```bash
node -c electron/main.cjs
node -c electron/ipc/register-desktop-ipc.cjs
node -c electron/protocols/local-image.cjs
```

Only include the `.cjs` checks for files actually touched by the implementation.

## Manual Validation

### 1. Open and browse

1. Launch ClawFace.
2. Open the Media Browser surface.
3. Confirm the browser uses a FileManager-like structure:
   - source roots
   - browse-oriented side pane
   - preview-first main pane

### 2. Source-first roots

1. Switch between available source roots.
2. Confirm the browser does not require raw filesystem navigation.
3. Confirm image entries show enough context to understand what they are.

### 3. Preview images

1. Select a generated image.
2. Confirm preview loads in the main pane.
3. Open the same item into the richer image/lightbox path if provided.
4. Confirm unsupported or missing previews fail clearly.

### 4. Reuse in chat

1. Open the browser while a chat session is active.
2. Reuse a selected image into the current chat.
3. Confirm the browser inserts a reference/link style artifact into the draft/workflow instead of staging it as a normal attachment by default.
4. Send or otherwise continue the chat flow and confirm the inserted reference behaves as designed.

### 5. Remote/self-hosted portability

1. Repeat preview on a setup where direct local media paths are not the primary path.
2. Confirm preview still works through the existing portable media resolution behavior.
3. Confirm the UI never exposes backend-path assumptions as the main user workflow.

### 6. Regression checks

1. Open the existing FileManager surface and confirm it still behaves normally.
2. Confirm existing chat image rendering still works:
   - live generated images
   - reloaded history images
   - image lightbox
3. Confirm no regressions to current staged attachment behavior in normal composer flows.
