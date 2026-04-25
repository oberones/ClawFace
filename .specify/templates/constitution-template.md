# ClawFace Constitution

## Core Principles

### I. Maintainable Boundaries Over Gravity Wells
ClawFace MUST favor small, explicit ownership boundaries over expanding centralized files. New work SHOULD extend or extract existing hooks, controllers, and normalization seams before adding parallel logic inline. Features MUST NOT casually increase the architectural load of known hotspots such as `src/app.tsx`, `src/components/ChatView.tsx`, `src/components/SettingsModal.tsx`, or `electron/main.cjs` when a reasonable extraction is available. Refactors are allowed to prioritize cleaner long-term ownership, but the resulting seam MUST have a clear purpose and a concrete caller.

### II. Validation Is a Merge Gate
No feature, fix, ticket, or refactor is complete until its required validation passes. Every implementation change MUST pass `make typecheck` and `make build`. Changes touching media/image/path resolution, gateway normalization seams, approval/event routing, or other helper-heavy behavior MUST also pass `make test-unit`. Electron main-process or protocol changes MUST additionally pass `node -c` for each edited `.cjs` file. Larger or riskier changes SHOULD run `make verify`. Exceptions MUST be documented explicitly in the spec, plan, or PR.

### III. UX Consistency Beats Novelty
User-facing flows MUST feel like parts of one desktop-native OpenClaw product, not disconnected mini-apps. New surfaces SHOULD reuse proven ClawFace interaction patterns where appropriate, including session-oriented navigation, preview-first media/file handling, clear runtime status, and explicit approval/tool visibility. The product MUST remain OpenClaw-native, desktop-first, and personal-use oriented; it MUST NOT drift into a generic provider shell, enterprise collaboration layer, or backend admin replacement. Clarity of user-visible state is required whenever the app is doing real work.

### IV. Performance And Responsiveness Are Product Features
Core chat, session, media, and desktop workflows MUST stay responsive on typical development hardware. Hot paths such as streaming events, session refreshes, approval updates, and media resolution MUST avoid unnecessary recomputation, duplicate parsing, and repeated full-list scans when a cached or normalized boundary can do the work once. Long-running or fallible operations MUST surface loading, recovery, and failure states instead of blocking silently. Regressions that make the app feel laggy, sticky, or visually unstable are product bugs, not polish debt.

### V. Testable Behavior Over Cleverness
Behavior-changing logic MUST be implemented in a way that can be tested at the narrowest useful seam. Pure helpers, controller hooks, domain-event adapters, and protocol modules are preferred test targets over brittle whole-surface tests when they protect risky logic. Bug fixes MUST add regression coverage whenever a stable seam exists or is introduced. Code SHOULD optimize for readability, explicit data flow, and maintainability over clever abstractions or overly magical generic helpers.

### VI. Current OpenClaw Surface Is The Integration Boundary
ClawFace MUST treat OpenClaw as an external dependency whose currently exposed gateway and protocol surfaces define the implementation boundary for this repository. Specs, plans, and tasks MUST NOT assume companion OpenClaw code changes, private backend filesystem reads, or future gateway seams as part of ClawFace implementation work. If a desired UX needs backend support that is not available today, the feature MUST either narrow scope to what current surfaces can truthfully support or mark the gap as a blocker or follow-up outside the implementation slice.

## Technical And Product Guardrails

- The pinned development runtime is Node.js `22.22.0` with npm `10.9.4`; dependency and lockfile churn MUST respect that environment.
- The intended local development machine is the authoritative validation environment for this repo; cross-host failures MUST be kept honest rather than treated as automatic product regressions.
- `node_modules/` MUST NOT be copied between machines.
- Features and specs MUST align with the current product docs in `docs/`, especially the product brief, milestone, architecture plan, roadmap, and active tickets.
- ClawFace planning MUST assume OpenClaw is read-only from this repo's point of view; integrations MUST ship against currently available surfaces rather than future or companion backend work.
- Desktop-native media/file behavior, tool visibility, session clarity, and connection reliability are core product value, not optional extras.
- Material architecture, roadmap, milestone, or product-direction changes MUST update the corresponding documentation in `docs/` before the work is considered complete.

## Development Workflow And Review Gates

- Read `AGENTS.md` and the relevant docs in `docs/` before making major architectural or product changes.
- Specs, plans, and task lists produced through spec-kit MUST demonstrate how they satisfy this constitution before implementation proceeds.
- All commits MUST use Conventional Commit format, such as `feat(scope): add selectable avatar styles` or `fix: prevent stale avatar status`.
- Code review MUST verify:
  - the change reduces or at least does not worsen ownership sprawl
  - validation coverage matches the risk of the change
  - UX stays consistent with existing ClawFace surfaces
  - performance-sensitive paths do not introduce obvious waste
  - the implementation does not depend on unavailable OpenClaw changes or implied backend seams
  - commit messages follow Conventional Commit format
- UI-heavy or workflow-heavy changes SHOULD include a concise manual regression checklist or explicit functional test flows.
- A simpler approach SHOULD be preferred unless added complexity is clearly justified by product value, platform constraints, or architecture health.

## Governance

This constitution supersedes informal local habits for spec-kit-driven work in this repository. Every new spec, plan, and task breakdown MUST be checked against these principles. Amendments require updating this file and the matching template, plus a short rationale in the change that introduced the amendment. When this constitution conflicts with stale planning output, the constitution and the current repo guidance in `AGENTS.md` and `docs/` win.

**Version**: 1.2.0 | **Ratified**: 2026-04-20 | **Last Amended**: 2026-04-25
