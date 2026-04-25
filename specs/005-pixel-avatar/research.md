# Research: Pixel-Art Session Avatar

## Decision: Use CSS Sprite Sheets For V1 Animation

**Rationale**: Sprite sheets match the pixel-art visual style, package cleanly with Electron/Vite static assets, work offline, and can be animated with CSS `background-position` plus `steps()` without JavaScript timers or runtime dependencies. Static reduced-motion frames can use the same image by selecting a stable background-position frame.

**Alternatives considered**:

- **Animated GIF/WebP**: Simple to embed, but poor state control, awkward reduced-motion handling, limited per-state frame selection, and less predictable packaging/decoding behavior across platforms.
- **Canvas**: Strong control and future flexibility, but adds imperative rendering and likely JS timers for no v1 benefit.
- **Lottie**: Good vector animation tooling, but adds a dependency and is less natural for crisp retro pixel art.
- **Rive**: Powerful interactive animation runtime, but heavier than needed, adds a dependency, and overfits future skin/interaction ambitions.

## Decision: Store Assets Under `public/avatars/`

**Rationale**: Public static assets are easy for Vite and Electron packaging to serve without import churn, fit the user's requested location, and keep avatar art separate from source logic.

**Alternatives considered**:

- **`src/assets/` imports**: Works with Vite hashing but makes asset replacement slightly more coupled to component source.
- **Inline SVG/CSS art**: Avoids files but conflicts with sprite sheet requirement and is less appropriate for bitmap pixel art.
- **Remote assets**: Rejected for v1 because ClawFace must work offline and must not add backend contracts.

## Decision: Derive State In A Pure Helper

**Rationale**: `src/lib/avatar-state.ts` keeps precedence, fallback, and final-outcome rules testable without rendering the app. A small shell-level hook can adapt existing app state without pushing avatar status logic into `ChatView.tsx`.

**Alternatives considered**:

- **Inline in `ChatView.tsx`**: Fastest implementation but worsens the known architectural hotspot.
- **Global store**: More structure than v1 needs and would introduce state ownership questions for a companion status surface.
- **Backend-provided mood/status metadata**: Future-friendly as optional input, but unavailable today and forbidden as a v1 dependency.

## Decision: Respect Existing Animation Settings And Reduced Motion

**Rationale**: ClawFace already has `UiSettings.enableAnimations`, `data-animations-off`, `--claw-animation-duration-scale`, and `prefers-reduced-motion` handling. The avatar should follow those controls rather than introducing a separate setting.

**Alternatives considered**:

- **Avatar-specific animation preference**: Extra settings surface for little value in v1.
- **Always animate but slow down**: Fails motion-sensitivity expectations and contradicts existing settings semantics.

## Decision: Integrate As A Lower-Left Shell Pane Below Sessions

**Rationale**: The lower-left shell placement gives the avatar enough presence to feel like an active session companion while keeping it away from chat controls, settings, gateway status, approval banners, and the composer. A small `useAvatarStatus` hook keeps app-shell wiring thin and prevents `ChatView.tsx` from absorbing avatar-specific state-machine logic.

**Alternatives considered**:

- **`ChatView` header actions**: Compact and close to gateway status, but too small for the desired companion surface and adds mood bookkeeping to a known hotspot.
- **Composer-adjacent placement**: Too close to the input workflow and less tied to gateway/settings status.
- **Floating overlay**: Higher overlap risk and more likely to feel like a mascot.

## Decision: Conservative Final Outcome Handling

**Rationale**: Live operational states are reliable; final response "moods" are only safe when existing explicit or obvious local signals exist. The helper should accept a local `finalOutcome` field but never inspect free-form assistant text.

**Alternatives considered**:

- **AI or text mood classifier**: Explicitly out of scope and likely to mislead users.
- **Always success on any final response**: Pleasant, but can obscure failed/blocked outcomes if not guarded by priority.
- **No final moods in v1**: Safest, but leaves a requested MVP state unsupported. The plan keeps final moods possible through explicit input only.
