# Implementation Plan: Selectable Avatar Styles

**Branch**: `006-selectable-avatar-styles` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-selectable-avatar-styles/spec.md`

## Summary

Extend the existing lower-left avatar status pane so users can choose between four bundled avatar profiles: the current default, two visually distinct companion styles, and one ClawFace logo-inspired style. The implementation will keep the existing avatar state derivation, pane placement, animation setting, and reduced-motion behavior, while adding a small profile registry, static sprite-sheet assets under `public/avatars`, and a thumbnail-based avatar selector in Settings.

The v1 technical approach stays dependency-light: React components render a selected profile, CSS `background-position` plus `steps()` handles frame playback, `image-rendering: pixelated` preserves crisp scaling, and local UI settings persist the selected profile id.

## Technical Context

**Language/Version**: TypeScript with React 18 in the Vite renderer; Electron desktop runtime
**Primary Dependencies**: Existing React/Vite/Electron stack; existing CSS animation infrastructure in `src/styles.css`; no new runtime animation dependency
**Storage**: Existing local UI settings persistence (`clawui.ui.settings`) plus static packaged assets in `public/avatars`
**Testing**: `make test-unit`, `make typecheck`, `make build`; manual desktop visual regression checklist
**Target Platform**: Electron desktop app packaged from the Vite renderer
**Project Type**: Desktop frontend application
**Performance Goals**: Avatar profile switching updates within one second; no streaming/chat hot-path recomputation; sprite rendering remains compositor-friendly CSS
**Constraints**: No backend/API/IPC contract changes; no remote assets; animations must obey existing `enableAnimations` and `prefers-reduced-motion`; packaged `file://` builds must resolve assets
**Scale/Scope**: Four bundled avatar profiles, ten shared avatar states, one global local preference, compact Settings selector

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Maintainable Boundaries Over Gravity Wells**: Pass. Profile data and validation live in a focused helper such as `src/lib/avatar-profile.ts`; rendering remains in `AnimatedAvatar`/`AvatarStatusPane`; Settings gets a focused selector section rather than inline profile logic.
- **Validation Is a Merge Gate**: Pass. The implementation requires `make test-unit`, `make typecheck`, and `make build`. Manual visual checks cover all profiles, motion modes, and packaged asset resolution.
- **UX Consistency Beats Novelty**: Pass. The avatar keeps the existing lower-left pane, size, status text, and explicit gateway/tool/approval UI; selection is a compact Settings preference.
- **Performance And Responsiveness Are Product Features**: Pass. Static sprite sheets avoid runtime drawing work and remote loading. State selection remains deterministic and shared across profiles.
- **Testable Behavior Over Cleverness**: Pass. Profile normalization and fallback behavior are pure helper tests; state behavior remains covered by existing avatar-state tests.
- **Current OpenClaw Surface Is The Integration Boundary**: Pass. The feature uses bundled frontend assets and existing local settings only.
- **Development Workflow And Review Gates**: Pass. Follow Conventional Commit format for any implementation commit and include manual regression notes in the PR.

## Project Structure

### Documentation

```text
specs/006-selectable-avatar-styles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── avatar-profile-contract.md
└── tasks.md
```

### Source Code

```text
public/
└── avatars/
    ├── README.md
    ├── clawface-default.png
    ├── clawface-neon-console.png
    ├── clawface-prism-node.png
    └── clawface-mark.png

src/
├── app.tsx
├── components/
│   ├── AnimatedAvatar.tsx
│   ├── AvatarStatusPane.tsx
│   ├── SettingsModal.tsx
│   └── settings-sections/
│       └── AvatarStyleSection.tsx
├── lib/
│   ├── avatar-profile.ts
│   ├── avatar-state.ts
│   └── ui-settings.ts
└── styles.css

tests/
├── avatar-profile.test.mjs
├── avatar-state.test.mjs
└── avatar-status.test.mjs
```

**Structure Decision**: Add a narrow `avatar-profile` helper and a focused Settings section. `src/app.tsx` should only parse/pass the selected profile id through existing `uiSettings`, and `SettingsModal.tsx` should only mount the selector section with the existing `patch` helper.

## Phase 0: Research

Research output is captured in [research.md](./research.md). Key conclusions:

- Continue with CSS sprite-sheet animation instead of animated GIF/WebP, canvas, Lottie, or Rive.
- Keep every profile on the same grid geometry and state row order as the default avatar.
- Use a data-driven profile registry for asset paths, display names, thumbnail metadata, and fallback behavior.
- Render Settings thumbnails from the same sprite sheets so previews cannot drift from the live avatar art.
- Generate the three additional sprite sheets as bundled static assets during implementation; do not add remote loading or runtime image generation.

## Phase 1: Design

Design artifacts:

- [data-model.md](./data-model.md): Avatar profile, selected preference, sprite geometry, and Settings option models.
- [contracts/avatar-profile-contract.md](./contracts/avatar-profile-contract.md): Internal renderer contract for profile registry, normalization, `AnimatedAvatar`, `AvatarStatusPane`, and Settings integration.
- [quickstart.md](./quickstart.md): Implementation and validation workflow, including manual regression checklist.

## Implementation Slices

1. **Profile Registry And Settings Normalization**
   - Add `src/lib/avatar-profile.ts` with stable profile ids, default id, sprite URLs, thumbnail metadata, and `normalizeAvatarProfileId`.
   - Add `avatarProfileId` to `UiSettings` and `DEFAULT_UI_SETTINGS`.
   - Update `parseUiSettings` in `src/app.tsx` to normalize unknown/missing profile ids to the default.

2. **Bundled Avatar Assets**
   - Generate three additional pixel-art sprite sheets under `public/avatars`.
   - Use the same 4 columns, 10 state rows, and default row order documented in `public/avatars/README.md`.
   - Update the avatar asset README with all bundled profiles and asset requirements.
   - Suggested implementation-time art directions: `Neon Console` for a sharp terminal/glow style, `Prism Node` for a softer crystalline/status-light style, and `ClawFace Mark` for a compact logo-inspired style. Final names may change if the generated artwork lands better, but they must remain tasteful and clearly distinct.

3. **Renderer Integration**
   - Update `AnimatedAvatar` to accept an `AvatarProfile` or profile id and set `--avatar-image` from the selected profile.
   - Keep frame counts, state rows, animation enablement, ARIA status label, and reduced-motion behavior shared across profiles.
   - Update `AvatarStatusPane` to pass the selected profile through without changing state derivation or pane copy.

4. **Settings Selector**
   - Add `AvatarStyleSection` under `src/components/settings-sections`.
   - Show exactly four thumbnail choices with accessible labels, selected state, and a compact layout that fits the existing Settings grid.
   - Use the same sprite sheet as the live avatar for each thumbnail, likely a static success or idle frame plus label.
   - Wire the section through `SettingsModal` using existing `patch({ avatarProfileId })` behavior.

5. **Focused Tests**
   - Add `tests/avatar-profile.test.mjs` for default profile coverage, unique ids, valid sprite references, and invalid id normalization.
   - Add or extend tests to prove avatar state derivation is independent of selected profile.
   - Keep existing avatar-state priority tests unchanged except where imports need new profile-aware helpers.

6. **Validation And Manual Regression**
   - Run `make test-unit`, `make typecheck`, and `make build`.
   - Manually verify each profile across light/dark themes, collapsed/expanded sidebar, animations enabled/disabled, reduced motion, disconnected/pairing-required, approval-needed, tool-running, thinking, streaming, final success/caution/warning, and packaged Electron asset loading.

## Risk Management

- **Asset size**: Keep source sprite sheets small and pixel-art native; avoid oversized generated images or separate per-state files.
- **Animation performance**: Continue using one CSS background image per avatar instance and `steps()` animation; no timers or canvas loops.
- **State flicker**: Do not change `deriveAvatarState` priority. Switching style should preserve the current state and only update the image URL.
- **Packaged asset paths**: Resolve sprite URLs the same way the default avatar does so `file://` packaged builds work.
- **Thumbnail drift**: Prefer thumbnails derived from the sprite sheets rather than separate preview art.
- **Settings bloat**: Keep selector in a focused Settings section; avoid editor/import/download controls.
- **Hotspot load**: Limit `app.tsx` and `SettingsModal.tsx` changes to settings parsing and one section mount. Put reusable logic in helpers/components.

## Post-Design Constitution Check

- **Boundary check**: Pass. The plan creates `avatar-profile.ts` and `AvatarStyleSection.tsx`; no avatar profile logic belongs in `ChatView.tsx`.
- **Validation check**: Pass. Unit, typecheck, build, and manual packaged asset checks are defined.
- **UX check**: Pass. The selector is compact and thumbnail based, while the live pane keeps the existing size, placement, and status text.
- **Performance check**: Pass. Static sprite sheets and CSS animations keep rendering dependency-free and local.
- **Integration check**: Pass. No backend, gateway, IPC, marketplace, or runtime image-generation contract is required.

## Complexity Tracking

No constitution violations are expected. If implementation requires a new dependency, backend/API assumption, or larger settings refactor, the plan must be revised before proceeding.
