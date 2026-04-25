# Research: Selectable Avatar Styles

## Decision: Use CSS Sprite Sheets For V1 Animation

**Decision**: Continue the current sprite-sheet approach: one PNG per avatar profile, shared frame geometry, CSS `background-position`, and `steps()` animation.

**Rationale**:

- It matches pixel-art artwork and keeps scaling crisp with `image-rendering: pixelated`.
- It works offline in packaged Electron builds as static renderer assets.
- It already respects the app's animation disable path by stopping CSS animation and showing a static frame.
- It requires no new runtime dependency and no imperative render loop.
- State selection can remain deterministic because every avatar profile maps the same rows to the same `AvatarState` values.

**Alternatives Considered**:

- **Animated GIF/WebP**: Rejected for v1. They are simple to display but awkward for per-state switching, reduced-motion static frames, consistent row mapping, and accessible status previews. They would likely require one asset per state or less control over frame playback.
- **Canvas**: Rejected for v1. Canvas gives full control, but it adds imperative drawing, lifecycle cleanup, test complexity, and unnecessary animation work for static pixel-art sprite playback.
- **Lottie**: Rejected for v1. It adds a runtime dependency, is vector-oriented rather than pixel-art-native, and complicates offline packaging and reduced-motion frame control.
- **Rive**: Rejected for v1. It is powerful for interactive animation but heavier than needed, adds dependency/runtime concerns, and does not match the dependency-light ClawFace architecture.

## Decision: Add A Profile Registry Instead Of Style Logic In Components

**Decision**: Add a pure helper such as `src/lib/avatar-profile.ts` with bundled profile definitions, a default id, profile lookup, and normalization.

**Rationale**:

- `AnimatedAvatar` can stay focused on rendering, not ownership of available profiles.
- `AvatarStatusPane` can receive a selected profile without changing status derivation.
- Settings can render a data-driven selector from the same registry.
- Future bundled skins or OpenClaw-provided metadata can plug in at the registry/normalization boundary without forking the state resolver.

**Alternatives Considered**:

- **Hard-code style buttons in `SettingsModal`**: Rejected because it adds known-hotspot load and duplicates profile metadata.
- **Put profile state into `avatar-state.ts`**: Rejected because state priority and visual profile selection are separate concerns.

## Decision: Persist The Selected Profile In Existing UI Settings

**Decision**: Add `avatarProfileId` to `UiSettings` and normalize it when loading local settings.

**Rationale**:

- Avatar style is a global local UI preference, not session or backend data.
- Existing UI settings already handle persistence, defaults, Settings patching, and app restart behavior.
- Settings schemes represent global UI settings snapshots; including the avatar choice is acceptable for v1 because applying a scheme is an explicit UI preference change.

**Alternatives Considered**:

- **New standalone localStorage key**: Rejected for v1 because it adds another persistence path and more shell plumbing for a value that fits existing UI settings.
- **Per-session or per-agent storage**: Rejected by clarification; style selection is global.

## Decision: Derive Thumbnails From The Same Sprite Sheets

**Decision**: Render thumbnail previews using each profile sprite sheet and a static representative frame.

**Rationale**:

- Settings previews stay truthful to the actual live avatar.
- No extra thumbnail assets are required unless implementation discovers a clarity issue.
- Reduced-motion and animation-disabled behavior remain simple because previews can be static.

**Alternatives Considered**:

- **Separate thumbnail PNGs**: Acceptable only if sprite-derived thumbnails are illegible. Separate assets increase maintenance and drift risk.
- **Text-only select**: Rejected by user clarification; Settings should show thumbnail previews.

## Decision: Generate Two New Bundled Static Assets

**Decision**: During implementation, generate three additional sprite sheets under `public/avatars`, each covering all ten existing avatar states with the same geometry as the default profile.

**Rationale**:

- Bundled PNGs are compatible with Vite public assets and Electron packaging.
- Asset generation is implementation-time work only; no runtime image generation is introduced.
- Shared geometry keeps CSS and tests small.

**Initial Art Direction Guidance**:

- **Neon Console**: compact, terminal-inspired, high-contrast pixel shape with cool glow accents and clear state lights.
- **Prism Node**: geometric, crystalline/status-light style with softer palette and different silhouette from the default and Neon Console.
- **ClawFace Mark**: compact mark based on the ClawFace logo's dark face, cyan claw shapes, magenta circuitry, bright eyes, and grin.

The exact generated art can vary as long as additional styles are tasteful, legible at the existing pane size, and clearly distinct from the default and from each other.

## Decision: Keep Avatar State Selection Shared Across Profiles

**Decision**: Do not modify state priority rules except as needed to prove style independence.

**Rationale**:

- The feature changes visual style only.
- Existing tests already cover priority ordering for disconnected, approval, tool-running, thinking, streaming, warning, and idle.
- Any profile-specific status semantics would make the avatar less trustworthy as a status surface.

**Alternatives Considered**:

- **Profile-specific mood mapping**: Rejected. It would violate the MVP requirement for same behavior and no mood classifier.
- **OpenClaw-provided mood metadata**: Deferred. Future versions may add optional metadata, but v1 must not assume a new backend contract.
