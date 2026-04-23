# ClawFace

ClawFace is a desktop-first frontend for OpenClaw. The goal is simple: make OpenClaw feel like a real personal AI workstation on your machine, not just a backend with a chat window or a bundle of admin pages in your browser.

## What ClawFace Is

ClawFace is built for people already running OpenClaw locally or on self-hosted infrastructure who want a better everyday desktop experience.

- **OpenClaw-native** rather than a generic multi-provider shell
- **desktop-first** rather than a web-first collaboration app
- **conversation-centered** with first-class sessions, tools, files, media, and memory visibility
- **frontend-focused**, while OpenClaw remains the backend management and capability plane

## What You Can Do Today

ClawFace already includes a usable first pass of the core workstation surfaces:

- **Session-centered desktop chat** with streaming replies, connection feedback, model/thinking controls, and session activity visibility
- **Desktop attachment workflows** including drag/drop, paste-image handling, staged attachments, local image rendering, and image lightbox support
- **Tool activity visibility** in the conversation flow so OpenClaw actions are easier to follow than raw trace output
- **Dedicated Files and Media surfaces** for browsing workspace files and reusable media artifacts inside the app shell
- **Dream Inspector** for signal-first visibility into waiting, grounded, and promoted memory candidates plus Dream Diary and nearby memory context
- **Dream Timeline** for evidence-derived chronology from currently exposed memory data, including promotion moments, replay touchpoints, dated diary entries, and candidate-scoped related-context handoffs
- **Desktop-oriented settings and compatibility support** including path-prefix mappings for shared-volume/container installs

## Current Boundaries

ClawFace intentionally stays on top of the OpenClaw gateway surfaces that already exist today.

- It **does not** make backend changes to OpenClaw from this repo.
- If a capability is not exposed by the current gateway, ClawFace should surface that as a limitation instead of quietly depending on companion backend work.
- Dream Timeline is therefore a **visible-evidence timeline**, not a raw memory event-log viewer.

## Why It Exists

OpenClaw already has powerful capabilities across sessions, tools, media analysis, browser/canvas flows, background work, and local/self-hosted workflows. ClawFace brings more of that day-to-day experience into a single desktop app without trying to replace every backend surface OpenClaw already has.

## Technology stack

Current stack includes:
- React
- TypeScript
- Vite
- Electron

## For Contributors

If you are contributing to the app or onboarding quickly, start with:

- [`AGENTS.md`](./AGENTS.md) — repo bootstrap guide, working conventions, and architecture hotspots
- [`docs/DEVELOPMENT_CONSTRAINTS.md`](./docs/DEVELOPMENT_CONSTRAINTS.md) — pinned Node/npm versions and required local checks
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — current architecture inventory and guidance
- [`docs/PRODUCT-BRIEF.md`](./docs/PRODUCT-BRIEF.md) — product framing and principles

## Install

ClawFace currently works best as a desktop app pointed at an OpenClaw gateway you already have running.

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

## Common development commands

A `Makefile` is available for common local tasks.

Examples:

```bash
make help
make install
make dev
make build
make typecheck
make test-unit
make verify
```

The Makefile wraps the commands that are actually present in the repo today, plus a small number of sensible extras like `typecheck`, `test-unit`, and `clean`.

`make test-unit` runs the focused Node-based regression checks that currently cover:
- path prefix mapping for shared-volume/container installs
- generated-image source resolution into `~/.openclaw/media`
- renderer image source selection when both pretty filenames and concrete UUID media paths are present
- Dream Inspector helper logic such as candidate shaping, diary parsing, and related-context matching
- Dream Timeline helper logic such as chronology derivation, empty/disabled handling, and artifact-link shaping

For media-related work, the practical validation stack is:
- `make test-unit` for helper-level regressions
- `make typecheck` for renderer/app safety
- `make build` for the final production bundling check

For Dream Inspector or Dream Timeline work, use that same validation stack and add a desktop visual pass because those features rely on adjacent pane composition and shell interaction details.

## Runtime expectations

ClawFace is currently pinned to a **Node 22** development/runtime target.

If you see `EBADENGINE` warnings on Node 20, that is expected with the current repo constraints rather than a sign that the repo is intended to support both lines equally.
Some parts of the current Electron/tooling dependency chain now also require Node 22+.

Use the pinned runtime described in [`docs/DEVELOPMENT_CONSTRAINTS.md`](./docs/DEVELOPMENT_CONSTRAINTS.md) before treating install or validation failures as application-code regressions.

## Media path mapping

ClawFace can render OpenClaw-generated images and other local media in a few different deployment shapes, but the path resolution strategy depends on where OpenClaw is running.

- **OpenClaw on the host machine**: media paths usually resolve directly.
- **OpenClaw in a local container with shared volumes**: use **Settings -> Path Prefix Mappings** to map container paths to host paths.
- **OpenClaw on a remote machine**: path mappings alone are not enough unless the remote media directory is also exposed locally; use a file/media server or a gateway-served media endpoint for that setup.

The most common Docker mapping looks like:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

Notes:
- Path mappings are applied when ClawFace needs to turn backend filesystem paths into local renderable image sources.
- This makes shared-volume container installs much more practical without hardcoding Docker-specific paths into the app.
- For community-facing portability, local path mapping should be treated as a compatibility layer; truly remote installs still benefit from gateway-served media access.

## Development status and expectations

This repo is under active repositioning and architectural cleanup.

Expect:
- moving boundaries
- refactors before major new features
- some legacy complexity from the abandoned predecessor
- planning docs that may be more accurate than older implementation assumptions

## Practical development guidance

When working in this repo:
- do not treat current giant components as the final architecture
- prefer extracting clear boundaries over adding more logic to overloaded files
- align product changes with the roadmap’s vertical slices
- keep OpenClaw-native capability exposure central to the product direction

## Original project note

This repo began as a more generic “modern chat client for OpenClaw Gateway” effort under a different project identity.
That framing is no longer sufficient for where the project is headed.

The new direction is intentional: ClawFace should become a true desktop frontend for OpenClaw’s richer ecosystem of sessions, tools, media, and future operator surfaces.

## License

[MIT](LICENSE)
