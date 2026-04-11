# Ambient Thinking Widget Proposal

## Summary

This document proposes a concrete integration plan for adding a lower-left ambient "thinking" widget to ClawFace.

The goal is not to fake literal cognition. The goal is to give ClawFace a subtle, expressive ambient status surface that reflects runtime activity, response intensity, and broad conversational tone without distracting from the thread.

After reviewing the current ClawFace codebase, my recommendation is:

- do **not** use `particles.js`
- prototype with either:
  - **Option A, recommended prototype path:** `tsParticles`
  - **Option B, recommended final architecture:** a **custom canvas-based widget**
- architect the feature around a small **ambient state adapter** derived from existing ClawFace runtime data
- mount the widget inside the existing chat shell, anchored near the lower-left of the main chat area
- keep it optional, subtle, motion-aware, and performance-capped

My honest view: ClawFace already has enough state and UI structure to support this cleanly. The main design risk is not technical feasibility, it is making sure the visual language feels tasteful instead of gimmicky.

---

## Why this fits ClawFace

ClawFace already exposes several useful signals that can drive an ambient visualization.

### Existing integration signals

From the current codebase:

- `src/app.tsx`
  - owns top-level session/runtime state
  - tracks `thinking`, `thinkingLevel`, stream text, current run id, connection status, selected session state, and tool items
- `src/components/ChatView.tsx`
  - is the best current integration point for the main chat-pane experience
  - already computes session runtime tone and current session status copy
  - already receives `thinking`, `streamText`, `toolItems`, `sessionInfo`, and `uiSettings`
- `src/components/ChatThread.tsx`
  - currently renders the in-thread `Thinking` dots indicator when `thinking === true` and no stream text is present
- `src/components/ToolActivityPanel.tsx`
  - normalizes tool outcomes to `running`, `succeeded`, and `failed`
  - gives useful activity intensity signals
- `src/lib/types.ts`
  - already defines `SessionRuntimeStatus`, `ToolItem`, connection status, and related session types
- `src/lib/ui-settings.ts`
  - already supports feature flags and motion-related user preferences like `enableAnimations`
- `src/styles.css`
  - already contains animation tokens, accent color variables, and the current `thinking-indicator` styling

This means the feature does **not** need a speculative new data system. It can be built on existing runtime state.

---

## Recommendation

## Renderer choice

### Recommended final direction: custom canvas widget

For ClawFace specifically, I recommend a small custom canvas renderer over a generic particle library.

Why:

- the widget is small and localized, not a full-screen scene
- ClawFace only needs a narrow set of behaviors
- a custom renderer will be lighter than a generalized engine once the idea stabilizes
- it will be easier to make it feel unique to ClawFace instead of looking like a stock particle demo
- it will be easier to tune for Electron performance and reduced-motion behavior

### Recommended prototype shortcut: tsParticles

If the immediate goal is rapid experimentation, `tsParticles` is the better modern choice than `particles.js`.

Why:

- actively maintained
- modern API surface
- better runtime/state-driven reconfiguration
- React-friendly
- easier to stand up quickly than a custom renderer

### Not recommended: particles.js

I do not recommend `particles.js` for ClawFace beyond maybe a very rough throwaway proof of concept.

Why:

- old and mostly config-driven
- weaker for nuanced state transitions
- likely to feel bolted on in a modern Electron app
- more likely to produce a generic decorative effect instead of a distinct product feature

---

## Product intent

The widget should be framed as an **ambient state visualization**, not a literal window into hidden chain-of-thought.

Good framing:

- ambient state
- response activity
- reasoning intensity
- mood/tone signal

Bad framing:

- literal thoughts
- exact emotional state
- precise internal cognition

This distinction matters both for trust and for product taste.

---

## Proposed UX behavior

## Placement

Recommended placement:

- anchored in the **lower-left corner of the main chat pane**, above the composer region
- visually attached to the chat shell, not floating independently over the entire application window
- should not overlap the message composer, slash menus, or image lightbox

Why this placement works in the current layout:

- `src/app.tsx` mounts `ChatView` inside `.main-shell`
- `ChatView` already owns the chat header, scroll area, and composer region
- the widget can be positioned relative to the existing chat shell instead of hacking it into the message thread itself

## Visual goals

The widget should feel:

- subtle by default
- alive when active
- calm under tension
- brighter and more energetic on breakthroughs
- visually denser for higher context / more active work
- non-blocking and non-intrusive

It should not:

- dominate attention
- flash aggressively
- imply fake precision
- redraw the whole window unnecessarily

## Behavior examples

### Idle

- low particle count
- soft opacity
- slow drift
- low link density

### Thinking

- moderate particle count
- slightly tighter orbiting or clustering
- gentle pulses
- moderate link density

### Deep / high-context reasoning

- increased count, capped to a safe upper bound
- more layered motion
- more visible relationships or clustering
- slightly increased speed, but still restrained

### Tool activity / orchestration

- more directional motion
- brief surges as tools start/complete
- short-lived accents when multiple tools are active

### Excitement / breakthrough

- brighter accent palette
- slightly stronger pulse
- temporary expansion or bloom behavior

### Calm defusal / careful response

- cooler or softer palette
- smoother motion
- reduced jitter and reduced expansion
- more cohesive movement, less turbulence

### Error / interruption

- temporary contraction or desaturation
- brief warning tint
- then settle back to idle or disconnected state

---

## Proposed architecture

## 1. Add an ambient state adapter layer

Do **not** let the renderer read raw app state directly.

Instead, create a small derived view-model for the widget.

Suggested file:

- `src/lib/ambient-state.ts`

Suggested type:

```ts
type AmbientMode =
  | "idle"
  | "connecting"
  | "thinking"
  | "streaming"
  | "tooling"
  | "excited"
  | "calm-defuse"
  | "warning"
  | "error";

export type AmbientState = {
  mode: AmbientMode;
  intensity: number;   // 0..1
  complexity: number;  // 0..1
  warmth: number;      // 0..1
  coherence: number;   // 0..1
  motionBias: number;  // 0..1, low = calm, high = lively
  particleCount: number;
};
```

Suggested input shape:

```ts
type AmbientStateInput = {
  connected: boolean;
  connectionStatus?: ConnectionStatus;
  thinking: boolean;
  thinkingLevel: string | null;
  streamText: string | null;
  toolItems: ToolItem[];
  runtimeStatus?: SessionRuntimeStatus;
  contextTokens: number | null;
  contextLimit: number | null;
  lastUserMessageText?: string | null;
};
```

This adapter should:

- map existing ClawFace runtime signals into a constrained ambient state
- clamp values to safe ranges
- smooth abrupt transitions
- avoid exposing arbitrary or ungrounded emotion labels

## 2. Add a dedicated widget component

Suggested files:

- `src/components/AmbientThinkingWidget.tsx`
- `src/hooks/useAmbientAnimation.ts` if needed

Responsibilities:

- own the local canvas or library renderer
- receive only `AmbientState`, not the full app state
- interpolate between prior and next visual states
- pause/reduce work when hidden or unfocused

## 3. Mount it in `ChatView`

Recommended integration point:

- `src/components/ChatView.tsx`

Why:

- it already receives the runtime signals needed
- it already owns the visual chat shell
- it is a better host than `ChatThread.tsx`, because the widget should be a shell-level status ornament, not a message-row artifact

Recommended structure:

- keep the existing inline `Thinking` indicator initially for compatibility
- add the ambient widget as a shell overlay or anchored child near the bottom-left of the scroll/composer area
- once stable, optionally replace the old dot indicator during active thinking states

## 4. Add dedicated styling hooks

Suggested stylesheet areas:

- extend `src/styles.css` with a small, isolated ambient-widget section
- avoid sprinkling unrelated animation rules across existing chat/thread styles

Suggested class names:

- `.ambient-widget`
- `.ambient-widget-shell`
- `.ambient-widget-canvas`
- `.ambient-widget.is-idle`
- `.ambient-widget.is-active`
- `.ambient-widget.is-warning`
- `.ambient-widget.is-reduced-motion`

---

## State mapping plan

Below is a recommended first-pass mapping from existing ClawFace state into ambient behavior.

## Primary runtime mapping

### Connection status

- `connecting` → slow assembling motion, low brightness
- `connected` → normal baseline idle behavior
- `disconnected` → sparse or paused state, muted palette
- `pairing-required` / `error` → warning tint, reduced motion after brief pulse

### Thinking state

Inputs:

- `thinking`
- `thinkingLevel`
- `sessionInfo.thinkingLevel`

Mapping:

- `thinking === true` sets mode to `thinking` unless a stronger state overrides it
- `thinkingLevel` influences intensity and particle count
  - `off` or null → baseline
  - `low` → mild increase
  - `medium` → stronger density and pulse
  - `high` → strongest density and coherence, within cap

### Stream state

Input:

- `streamText`

Mapping:

- active stream should shift mode to `streaming`
- streaming should feel more directed and slightly more energetic than plain thinking
- avoid extreme count changes during stream; prefer motion and brightness changes

### Tool activity

Input:

- `toolItems`

Mapping:

- running tools increase activity intensity
- multiple concurrent running tools increase motion complexity
- failed tools briefly introduce warning color or disruption
- succeeded tools can create short-lived outward pulses

### Context load

Inputs:

- `sessionInfo.contextTokens`
- `sessionInfo.contextLimit`

Mapping:

- use context occupancy to influence density and complexity
- cap hard, for example:
  - min 16 to 24 particles
  - typical 24 to 72 particles
  - absolute cap 96 to 120 particles

Do **not** scale particle count linearly and unbounded with context.

### Tone inference

Optional later-stage input:

- recent user message text

Mapping:

- this should be conservative and bucketed, not pseudo-empathic freeform analysis
- use only broad categories like:
  - neutral
  - positive / energetic
  - tense / hostile
  - error-recovery / caution

Recommendation:

- do **not** ship text-tone inference in v1
- ship v1 using runtime/tool/context state only
- add tone-sensitive palette selection only after the base widget already feels good

That avoids building a mood machine before the fundamentals are stable.

---

## Custom canvas implementation plan

If implementing the recommended final version, the canvas renderer should be intentionally small.

## Rendering model

Suggested model:

- one canvas
- one animation loop via `requestAnimationFrame`
- 20 to 120 particles max
- optional lightweight links between nearby particles
- local state updated from interpolated `AmbientState`

Per-particle data can stay simple:

```ts
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  energy: number;
};
```

## Motion behaviors

Implement only a few field behaviors:

- drift
- orbit / attract
- pulse
- cohesion / clustering
- outward burst on events
- damping for calm states

That is enough for the effect without turning this into a full physics engine.

## Interpolation

The widget should interpolate between target values over time instead of snapping.

Smooth:

- color palette
- count target
- speed multiplier
- line opacity
- attract/repel strength

This matters more than adding more particle features.

## Performance controls

Required:

- render only in the widget region
- cap particle count hard
- throttle or pause when:
  - window is hidden
  - document is not visible
  - reduced motion is requested
- disable nonessential linking on low-power settings if needed
- avoid causing re-render storms in React by keeping animation state inside refs/canvas logic

In other words, React should configure the widget, not drive every frame.

---

## tsParticles implementation plan

If prototyping with `tsParticles`, keep the integration disciplined.

## Guardrails

- wrap it in `AmbientThinkingWidget.tsx`
- never scatter particle config logic across `ChatView`
- generate config from `AmbientState` through a dedicated mapping function
- keep the config surface intentionally narrow

Suggested files:

- `src/components/AmbientThinkingWidget.tsx`
- `src/lib/ambient-state.ts`
- `src/lib/ambient-particle-config.ts`

## What to vary

Safe runtime-varying params:

- particle number
- move speed
- color palette
- opacity
- size range
- link distance / link opacity

Avoid overcomplicating with too many effect modes in v1.

---

## Accessibility and preference handling

This is non-negotiable.

## Required controls

Add new UI settings for:

- `showAmbientWidget: boolean`
- `ambientWidgetIntensity: number`
- `ambientWidgetReducedMotionMode: "auto" | "on" | "off"`
- optional later: `ambientWidgetStyle: "minimal" | "linked" | "nebula"`

Suggested location:

- `src/lib/ui-settings.ts`
- expose in `SettingsModal.tsx`

## Behavior rules

- if `enableAnimations === false`, widget should either:
  - hide entirely, or
  - render a low-motion static form
- respect `prefers-reduced-motion`
- do not rely on color alone for warnings
- do not cover actionable controls
- do not interfere with text selection or scroll behavior

Recommendation:

- in reduced-motion mode, switch to a slow breathing glow or static clustered state instead of animated particles

---

## Integration steps

## Phase 1, architecture and low-risk shell integration

1. Add ambient state types and mapping helpers
   - create `src/lib/ambient-state.ts`
2. Add UI settings flags
   - update `src/lib/ui-settings.ts`
   - update defaults and persistence plumbing in `src/app.tsx`
   - add controls to `SettingsModal.tsx`
3. Add placeholder widget component
   - create `src/components/AmbientThinkingWidget.tsx`
   - initially render a simple shell with mock animation or static diagnostic state text
4. Mount the widget in `ChatView.tsx`
   - position inside the chat shell near the lower-left
5. Add CSS shell and layout rules
   - extend `src/styles.css`

Deliverable:

- no full particle effect yet
- state adapter exists
- widget mounting and settings path are real and testable

## Phase 2, renderer prototype

Choose one:

### Option A

Integrate `tsParticles` for quick evaluation.

### Option B

Implement the first custom canvas version directly.

For either option:

- map idle/thinking/streaming/tooling/error states
- clamp density and intensity
- tune for subtlety first

Deliverable:

- interactive ambient widget with 4 to 6 grounded states

## Phase 3, replace or refine

If Phase 2 used `tsParticles`, evaluate whether to:

1. keep it
2. simplify it
3. replace it with custom canvas

Deliverable:

- final renderer choice made based on actual feel and Electron performance

## Phase 4, optional tone-sensitive refinement

Only after the base widget feels right:

- add conservative tone buckets
- tune palette and motion for tension, caution, excitement
- keep the mapping explainable and bounded

---

## Suggested code insertion points

## `src/components/ChatView.tsx`

Best mount point for the widget.

Suggested placement in the render tree:

- inside the chat shell
- outside the scrollable message thread content
- near the composer or lower shell overlay layer

Why:

- this avoids making the widget behave like a message bubble
- it keeps shell-level status separate from thread content
- it avoids complicating `ChatThread.tsx` further

## `src/components/ChatThread.tsx`

Short-term:

- keep the existing `Thinking` bubble as a compatibility fallback

Later:

- consider downgrading or removing the inline dots when the ambient widget is enabled and mature

## `src/app.tsx`

Use only for:

- passing through any new settings
- optionally passing a few additional normalized runtime props into `ChatView`

Do **not** put ambient animation logic here.

## `src/lib/types.ts`

Optional:

- add ambient-specific types here only if they become shared across multiple components
- otherwise keep them local to `src/lib/ambient-state.ts`

Recommendation:

- keep ambient types out of the global shared types file unless they are reused broadly

---

## Testing plan

## Unit tests

Add tests for the adapter logic, not just visuals.

Suggested test file:

- `tests/ambient-state.test.mjs`

Test cases:

- idle baseline mapping
- thinking low/medium/high mapping
- stream overrides plain thinking
- running tool count increases intensity
- failed tool creates warning mode or warning accent signal
- context usage is capped and normalized
- disconnected/error state suppresses active visuals appropriately

## Manual validation

Review behavior in these scenarios:

- idle session, no recent activity
- active thinking, no streaming yet
- active streaming reply
- several concurrent tools
- tool failure
- session switching
- disconnected gateway
- reduced-motion enabled
- animations disabled in settings

## Performance validation

Measure:

- CPU while idle
- CPU during active stream
- CPU when app is backgrounded
- impact on scroll smoothness
- impact on composer responsiveness

Given current project constraints, this should be validated on the real desktop target, not only in the container.

---

## Risks and mitigations

## Risk 1, gimmick factor

The widget could feel cheesy.

Mitigation:

- tune for subtlety
- use restrained palettes
- avoid excessive particle count
- start with calm motion, not fireworks

## Risk 2, architectural sprawl

The feature could turn `ChatView.tsx` into even more of a gravity well.

Mitigation:

- isolate all ambient logic in dedicated files
- pass `AmbientState` into the component instead of raw app internals

## Risk 3, performance regression

Electron UIs can get visibly gross fast if animations are careless.

Mitigation:

- keep canvas local and bounded
- hard-cap particles
- pause or reduce work offscreen
- respect reduced motion and animation preferences

## Risk 4, misleading emotional claims

The widget could imply false emotional certainty.

Mitigation:

- derive primarily from runtime state, not speculative sentiment inference
- use broad tone buckets only if added later
- describe it as ambient status, not literal emotion reading

---

## Final recommendation

For ClawFace, I recommend this exact path:

1. **Create a small ambient-state adapter** based on current runtime/tool/context signals
2. **Mount a dedicated ambient widget in `ChatView.tsx`** near the lower-left of the chat shell
3. **Ship a prototype quickly**, ideally with either:
   - `tsParticles` for speed, or
   - a minimal custom canvas implementation if we want to skip the temporary dependency
4. **Prefer a custom canvas renderer as the likely final version** for performance, uniqueness, and tighter behavioral control
5. **Do not ship tone inference in v1**
6. **Keep the current inline thinking dots as fallback until the new widget proves itself**

If I were making the product call, I would choose:

- **prototype:** `tsParticles` or a very small custom canvas spike
- **final:** custom canvas

That gives ClawFace the best balance of modern feel, Electron practicality, and product identity.
