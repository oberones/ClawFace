# Contributing

ClawFace is in active development as a desktop-native frontend for OpenClaw.

Start with these repo docs:

- `AGENTS.md`
- `docs/PRODUCT-BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/MILESTONE-1.md`
- `docs/IMPLEMENTATION-ROADMAP.md`
- `docs/PHASE-1-TICKETS.md`
- `docs/DEVELOPMENT_CONSTRAINTS.md`

## Development Commands

```bash
make help
make install
make dev
make build
make typecheck
make test-unit
make verify
```

## Validation Expectations

For most code changes, run:

```bash
make typecheck
make build
```

Also run `make test-unit` when touching:

- media rendering
- path-prefix mapping
- image source resolution
- Dream Diary parsing
- session normalization
- gateway connection handling
- helper logic covered by focused tests

## Product Direction

ClawFace should remain:

- OpenClaw-native
- desktop-first
- personal-workstation oriented
- focused on the working user experience

Avoid turning it into:

- a generic provider shell
- a web-first team collaboration app
- a replacement backend admin UI
- an unrestricted accumulation of features inside already-large components

## Wiki Updates

When a user-facing feature changes, update the relevant page under `docs/wiki/`
and publish it to the GitHub Wiki.
