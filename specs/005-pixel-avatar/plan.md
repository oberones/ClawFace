# Implementation Plan: Pixel-Art Session Avatar

**Branch**: `005-pixel-avatar` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-pixel-avatar/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a small animated pixel-art avatar to its own lower-left ClawFace shell pane below the Sessions pane. The avatar will be a React component backed by static sprite sheet assets, CSS `background-position` plus `steps()` animation, and `image-rendering: pixelated`. Runtime state will be selected by a pure `src/lib/avatar-state.ts` helper from existing frontend-observable ClawFace/OpenClaw signals: connection status, pending approval, tool activity, thinking, streaming text, and explicit local final-response outcomes.

The implementation intentionally avoids new backend contracts, new runtime animation dependencies, AI mood classification, and additional state-machine weight inside `src/app.tsx` or `src/components/ChatView.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.6, React 18.3, Node.js 22.22.0, npm 10.9.4  
**Primary Dependencies**: React, React DOM, Vite, Electron; no new runtime animation dependency for v1  
**Storage**: Local bundled static avatar assets under `public/avatars/`; no persisted avatar user data  
**Testing**: Node built-in test runner through `npm run test:unit` / `make test-unit`; TypeScript via `make typecheck`; Vite build via `make build`  
**Target Platform**: Electron desktop runtime with Vite-rendered React UI  
**Project Type**: Desktop frontend application  
**Performance Goals**: Avatar state derivation is O(number of active tool items) and allocation-light; CSS sprite animation runs without JavaScript timers; no streaming-message list reflow attributable to avatar updates  
**Constraints**: Must respect `UiSettings.enableAnimations`, existing `data-animations-off`, `--claw-animation-duration-scale`, and `prefers-reduced-motion`; must remain dependency-light and offline/package-friendly; must not depend on new OpenClaw APIs  
**Scale/Scope**: One default avatar profile; ten MVP states; one lower-left status pane placement; future-compatible state/profile boundaries without v1 skin marketplace or editor

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable Boundaries Over Gravity Wells**: PASS. Plan introduces `src/lib/avatar-state.ts` for state resolution, `src/hooks/useAvatarStatus.ts` for shell-level signal adaptation, and focused avatar components for rendering. `ChatView.tsx` should not own avatar placement or state-machine logic.
- **Validation Is a Merge Gate**: PASS. Required validation is `make typecheck`, `make build`, and `make test-unit` because the feature adds pure helper tests.
- **UX Consistency Beats Novelty**: PASS. Avatar is small, in a lower-left shell pane, and reinforces existing gateway/session/tool/approval status instead of replacing explicit UI.
- **Performance And Responsiveness Are Product Features**: PASS. CSS sprite animation avoids JS animation loops; helper stays pure and cheap; no repeated parsing or message scans in hot streaming paths.
- **Testable Behavior Over Cleverness**: PASS. State priority is captured in unit tests at the helper seam.
- **Current OpenClaw Surface Is The Integration Boundary**: PASS. All inputs come from existing frontend state; future metadata is not required.

## Project Structure

### Documentation (this feature)

```text
specs/005-pixel-avatar/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── avatar-ui-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
public/
└── avatars/
    ├── clawface-default.png
    └── clawface-default@2x.png        # Optional if generated assets need a denser packaged source

src/
├── components/
│   ├── AnimatedAvatar.tsx
│   └── AvatarStatusPane.tsx
├── hooks/
│   └── useAvatarStatus.ts
├── lib/
│   └── avatar-state.ts
├── app.tsx                            # Thin shell integration below Sessions pane
└── styles.css                         # Sprite layout, state classes, reduced-motion/static-frame handling

tests/
└── avatar-state.test.mjs
```

**Structure Decision**: Use existing renderer structure. Add one pure library helper, focused rendering components, a small shell-level status hook, static packaged assets, and one unit test file. Avoid adding app-level providers, new stores, canvas loops, or backend-facing modules.

## Phase 0: Research

Research output is captured in [research.md](./research.md).

Key decisions:

- Use CSS sprite sheets with `background-position` and `steps()` for v1.
- Store assets under `public/avatars/`.
- Use existing animation disabling and `prefers-reduced-motion` instead of adding an avatar-specific setting.
- Resolve avatar state through a pure helper fed by already-owned `ChatView` state.

## Phase 1: Design

Design outputs:

- [data-model.md](./data-model.md)
- [contracts/avatar-ui-contract.md](./contracts/avatar-ui-contract.md)
- [quickstart.md](./quickstart.md)

### Implementation Slices

1. **Avatar state helper**
   - Add `AvatarState`, `AvatarSignalSnapshot`, `AvatarFinalOutcome`, and `deriveAvatarState`.
   - Encode priority order: disconnected/pairing required, approval needed, warning/blocked, tool-running, thinking, streaming, cautionary, serious, success, idle.
   - Treat connection `error` as warning/blocked unless paired with explicit pairing/disconnected status.
   - Conservative final outcomes only; no free-text mood classification.

2. **Unit tests**
   - Add `tests/avatar-state.test.mjs` using `tests/helpers/load-ts-module.mjs`.
   - Cover every MVP state and priority collisions: disconnected over approval/tool, approval over tool/thinking/streaming, warning over success, tool over thinking, thinking over streaming, idle fallback.

3. **Animated avatar component**
   - Add `src/components/AnimatedAvatar.tsx`.
   - Props: `state`, `animationsEnabled`, optional `className`.
   - Render a single status element with meaningful `aria-label` and `title`.
   - Use CSS classes/data attributes only; no JS timers.

4. **Static assets**
   - Add default sprite sheet asset(s) under `public/avatars/`.
   - Prefer a single sheet containing all state rows with consistent frame geometry.
   - Keep dimensions documented in CSS custom properties to make later replacement possible.

5. **CSS**
   - Add styles near chat header/status CSS in `src/styles.css`.
   - Use `image-rendering: pixelated`.
   - Use `steps(var(--avatar-frames))` animation for animated states.
   - In `[data-animations-off]` and `@media (prefers-reduced-motion: reduce)`, force static frame rendering with no loops, flashing, or bobbing.
   - Ensure light/dark theme contrast through border/background tokens, not one-off hardcoded theme blocks.

6. **Chat header integration**
   - Import `AnimatedAvatar` and `deriveAvatarState` in `ChatView.tsx`.
   - Build a minimal `AvatarSignalSnapshot` from existing props and already-derived values:
     - `connectionStatus`
     - `pendingApproval` / pairing approval banner
     - `toolItems.some(item.status !== "result")`
     - `thinking`
     - `streamText`
     - explicit local final outcome if already available
   - Render the avatar in its own lower-left shell pane below the Sessions pane.
   - Keep app-shell wiring thin by extracting transient avatar status adaptation to a small hook.

7. **Manual regression**
   - Run checklist in [quickstart.md](./quickstart.md) across light/dark, animation enabled/disabled, reduced motion, disconnected, pairing-required, approval-needed, tool-running, thinking, streaming, warning, and idle.

## Risk Management

- **Asset size**: Keep sprite sheets small and pixel-art native; prefer one compact PNG sheet over many large images. Document expected frame geometry.
- **Animation performance**: Use CSS background-position and no JS animation loop. Avoid triggering layout changes when state changes.
- **State flicker**: Centralize priority in `deriveAvatarState`; consider brief final outcome display only if existing local state supports it without timers in hot paths. Do not flip between thinking/streaming/tool states from noisy partial signals if a higher-priority state is present.
- **Overloading shell components**: Limit app-shell work to rendering and passing existing signals. Keep transient avatar state adaptation in a focused hook rather than expanding `ChatView.tsx` or `src/app.tsx` inline.
- **Ambiguous final-response moods**: Only use explicit or obvious local outcomes. Default normal completions may show success briefly if implementation already has a clean completion signal; otherwise idle is acceptable for v1.
- **Reduced motion**: Treat both `enableAnimations=false` and browser reduced-motion preference as hard stops for avatar loops.

## Constitution Check (Post-Design)

- **Maintainable Boundaries Over Gravity Wells**: PASS. Planned files isolate domain state, component rendering, and CSS assets; no new backend or app-wide store required.
- **Validation Is a Merge Gate**: PASS. Plan includes `make typecheck`, `make build`, and `make test-unit`.
- **UX Consistency Beats Novelty**: PASS. Placement is in a lower-left shell pane below Sessions and all explicit status UI remains authoritative.
- **Performance And Responsiveness Are Product Features**: PASS. CSS sprites and pure helper avoid streaming path overhead.
- **Testable Behavior Over Cleverness**: PASS. State priority and fallback behavior are narrow unit-test targets.
- **Current OpenClaw Surface Is The Integration Boundary**: PASS. No assumed OpenClaw backend changes.

## Complexity Tracking

No constitution violations are planned.
