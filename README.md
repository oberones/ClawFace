# ClawFace

Desktop-first OpenClaw client for people who want sessions, tools, files, media, and memory visibility to feel like part of one real desktop app instead of scattered backend surfaces.

![ClawFace application preview](./public/ClawFace0.4.2.png)

> Compatibility note: some package/build metadata may still use the legacy name `ClawUI` while the rename to `ClawFace` finishes across the repo.

## What ClawFace Is

ClawFace is the desktop frontend for OpenClaw users who already run OpenClaw locally or on self-hosted infrastructure and want a better day-to-day interface.

- OpenClaw-native rather than a generic multi-provider chat shell
- Desktop-first rather than a web-first collaboration app
- Conversation-centered, with first-class sessions, tools, files, media, and memory visibility
- Focused on using OpenClaw, not replacing OpenClaw's backend admin/config surfaces

## What You Can Do Today

- Use **session-centered desktop chat** with streaming replies, connection feedback, model/thinking controls, and session activity visibility
- Work with **desktop attachments** through drag/drop, paste-image handling, staged attachments, local image rendering, and image lightbox support
- Follow **tool activity** in the conversation flow instead of digging through raw trace output
- Browse **Files** and **Media** inside dedicated app surfaces
- Open **Dream Inspector** to see waiting, grounded, and promoted memory candidates, Dream Diary context, and nearby related memory context
- Open **Dream Timeline** to see evidence-derived chronology from visible promotion timestamps, replay touchpoints, and Dream Diary timing
- Use **desktop-oriented settings** such as path-prefix mappings for shared-volume/container installs

## Quick Start

ClawFace currently works best as a desktop app pointed at an OpenClaw gateway you already have running.

```bash
npm ci
npm run desktop:dev
```

Use the pinned runtime for source builds:

- Node.js `22.22.0`
- npm `10.9.4`

## Install

### macOS

1. Install **Node.js `22.22.0`** and **npm `10.9.4`**.
2. Clone this repo.
3. Install dependencies:

```bash
npm ci
```

4. Start the desktop app in development mode:

```bash
npm run desktop:dev
```

5. If you want a packaged macOS build, create one with:

```bash
npm run desktop:dist:mac
```

That writes the app bundle and macOS artifacts to `desktop-dist/`.

### Windows

1. Install **Node.js `22.22.0`** and **npm `10.9.4`**.
2. Clone this repo in PowerShell or Command Prompt.
3. Install dependencies:

```bash
npm ci
```

4. Start the desktop app:

```bash
npm run desktop:dev
```

5. If you want an unpacked desktop build for your current machine, run:

```bash
npm run desktop:pack
```

Notes:
- The repo is currently exercised most heavily on macOS.
- Windows support is expected to work from source, but packaged Windows installer flows are not yet the primary validated path in this repo.

### Linux

1. Install **Node.js `22.22.0`** and **npm `10.9.4`**.
2. Clone this repo.
3. Install dependencies:

```bash
npm ci
```

4. Start the desktop app:

```bash
npm run desktop:dev
```

5. If you want an unpacked desktop build for your current machine, run:

```bash
npm run desktop:pack
```

Notes:
- Linux support is currently best treated as a source-run workflow.
- If Electron reports missing system libraries on your distro, install the usual desktop GUI dependencies required by Electron and retry.

## Notes

### Current Boundaries

- ClawFace works on top of the OpenClaw gateway surfaces that already exist today.
- This repo does **not** make backend OpenClaw changes.
- Some memory features are intentionally evidence-based because raw backend event logs are not exposed to the frontend.
- Dream Timeline is therefore a visible-evidence timeline, not a raw memory event-log viewer.

### Media Path Mapping

ClawFace can render OpenClaw-generated images and other local media in several deployment shapes, but the path resolution strategy depends on where OpenClaw is running.

- **OpenClaw on the host machine**: media paths usually resolve directly.
- **OpenClaw in a local container with shared volumes**: use **Settings -> Path Prefix Mappings** to map container paths to host paths.
- **OpenClaw on a remote machine**: path mappings alone are not enough unless the remote media directory is also exposed locally; use a file/media server or a gateway-served media endpoint for that setup.

The most common Docker mapping looks like:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

## For Contributors

If you are contributing to the app or onboarding quickly, start with:

- [`AGENTS.md`](./AGENTS.md) for repo bootstrap guidance and working conventions
- [`docs/DEVELOPMENT_CONSTRAINTS.md`](./docs/DEVELOPMENT_CONSTRAINTS.md) for pinned runtime details and required checks
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for current architecture boundaries and refactor guidance
- [`docs/PRODUCT-BRIEF.md`](./docs/PRODUCT-BRIEF.md) for product framing

### Common Development Commands

```bash
make help
make install
make dev
make build
make typecheck
make test-unit
make verify
```

`make test-unit` currently covers:

- path prefix mapping for shared-volume/container installs
- generated-image source resolution into `~/.openclaw/media`
- renderer image source selection when both pretty filenames and concrete UUID media paths are present
- Dream Inspector helper logic such as candidate shaping, diary parsing, and related-context matching
- Dream Timeline helper logic such as chronology derivation, empty/disabled handling, and artifact-link shaping

Practical validation guidance:

- `make test-unit` for helper-level regressions
- `make typecheck` for renderer/app safety
- `make build` for the production bundling check
- add a desktop visual pass for Dream Inspector and Dream Timeline changes because they rely on adjacent pane composition and shell interaction details

### Runtime Expectations

ClawFace is currently pinned to:

- Node.js `22.22.0`
- npm `10.9.4`

If you see `EBADENGINE` warnings on Node 20, treat that as a runtime mismatch rather than as supported dual-runtime behavior.

## License

[MIT](LICENSE)
