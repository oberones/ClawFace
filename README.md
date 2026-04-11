<p align="center">
  <h1 align="center">ClawFace</h1>
  <p align="center">
    A desktop-native OpenClaw client built to make sessions, tools, media, and future OpenClaw-native capabilities feel like first-class parts of the experience.
  </p>
</p>

<p align="center">
  <img src="./public/ClawFace0.4.2.png" alt="ClawFace application preview" width="900" />
</p>

> **Note:** The project has been rebranded in the docs as **ClawFace**, but some existing package/build/release metadata may still use the legacy **ClawUI** name until the rename is completed across the codebase.
ClawFace is a fork-forward continuation of an abandoned OpenClaw desktop/web client experiment.
It is now being repositioned as a **desktop-first frontend product for OpenClaw**, not a generic chatbot shell and not a replacement for OpenClaw’s backend management/configuration surfaces.

## Project direction

ClawFace exists to be the best way to *use* OpenClaw day to day on a desktop machine.

The product direction is:
- **OpenClaw-native**, not provider-native
- **desktop-first**, not web-first team collaboration
- **conversational at the center**, but with room for tools, sessions, tasks, media, and devices as first-class experiences
- **frontend-focused**, while OpenClaw itself remains the backend management and capability plane

### What ClawFace is not

ClawFace is **not** intended to become:
- a generic multi-provider chatbot shell
- a team collaboration workspace
- a prettier copy of OpenClaw’s backend config/admin UI
- just another settings panel with a chat window attached

## Current product thesis

> ClawFace should make OpenClaw feel like a real personal AI workstation, not just a backend with a chat window.

## Why this project exists

OpenClaw already has powerful capabilities across:
- sessions
- tools
- media analysis
- browser/canvas flows
- nodes/devices
- background work and orchestration
- local/self-hosted workflows

But those capabilities are currently spread across multiple surfaces.
ClawFace is intended to unify the everyday *desktop experience* of OpenClaw without trying to replace every backend/admin surface.

## High-level goals

Near-term priorities for ClawFace are:
- strong desktop chat UX
- stable session navigation and switching
- excellent drag-and-drop / paste workflows for images and files
- visible tool activity and better legibility around actionful work
- enough architectural cleanup to support future OpenClaw-native expansion

Longer-term opportunities include:
- approvals
- background tasks and subagents
- node/device surfaces
- richer browser/canvas/computer-use UX
- stronger artifact/media handling

## Current status

This codebase is **worth continuing**, but it is not treated as finished or production-ready architecture.

The current strategy is:
- salvage the valuable protocol/UI groundwork
- refactor the overloaded architecture
- expand deliberately in OpenClaw-native directions

In plain English:
- do **not** rewrite from scratch immediately
- do **not** keep piling features into giant central files
- proceed through staged refactoring and vertical product slices

## Working in this repo

If you are a coding agent or are onboarding quickly, start with:

- [`AGENTS.md`](./AGENTS.md) — bootstrap guide for repo orientation, doc reading order, architecture hotspots, and working conventions
- [`docs/DEVELOPMENT_CONSTRAINTS.md`](./docs/DEVELOPMENT_CONSTRAINTS.md) — pinned Node/npm versions, `npm ci`, required checks, and the concrete run/build expectations for local development

## Planning docs

The repo now includes project-planning docs to guide the modernization effort:

- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — architecture inventory and refactor plan
- [`PRODUCT-BRIEF.md`](./docs/PRODUCT-BRIEF.md) — product vision, principles, and differentiators
- [`MILESTONE-1.md`](./docs/MILESTONE-1.md) — first serious milestone definition
- [`IMPLEMENTATION-ROADMAP.md`](./docs/IMPLEMENTATION-ROADMAP.md) — phased roadmap with vertical slices

If you are working on the app, start with those docs before making major architectural changes.

## Milestone 1 summary

Milestone 1 is focused on shipping the first version of ClawFace that is genuinely worth using every day as an OpenClaw desktop frontend.

Milestone 1 focuses on:
- connection reliability
- session shell stability
- thread rendering and streaming cleanup
- composer cleanup
- drag/drop and paste workflows for media/files
- attachment previews and rendering polish
- basic tool activity visibility
- initial architecture cleanup around chat, state, and platform/media boundaries

## Technology stack

Current stack includes:
- React
- TypeScript
- Vite
- Electron

This remains a reasonable baseline for the product.

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

For media-related work, the practical validation stack is:
- `make test-unit` for helper-level regressions
- `make typecheck` for renderer/app safety
- `make build` for the final production bundling check

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
