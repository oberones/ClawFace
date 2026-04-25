# Avatar UI Contract

This feature has no external backend/API contract. The contract is an internal renderer contract between existing chat/session state and the avatar component.

## `deriveAvatarState(snapshot)`

Input:

```ts
type AvatarSignalSnapshot = {
  connectionStatus: "connecting" | "connected" | "disconnected" | "pairing-required" | "error";
  approvalNeeded?: boolean;
  activeToolCount?: number;
  thinking?: boolean;
  streaming?: boolean;
  finalOutcome?: "success" | "serious" | "caution" | "blocked" | "denied" | "error" | "none";
};
```

Output:

```ts
type AvatarState =
  | "idle"
  | "thinking"
  | "streaming"
  | "tool-running"
  | "success"
  | "serious"
  | "caution"
  | "warning"
  | "approval-needed"
  | "disconnected";
```

Behavior:

- Must be pure and deterministic.
- Must not read global state, browser APIs, timers, or message text.
- Must apply documented priority order.
- Must return `idle` for connected snapshots with no active signals.

## `<AnimatedAvatar />`

Props:

```ts
type AnimatedAvatarProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  className?: string;
};
```

Rendered behavior:

- Renders one compact element suitable for chat header actions.
- Uses sprite sheet CSS classes/data attributes for state.
- Provides meaningful `aria-label` and `title`, such as `OpenClaw status: Tool running`.
- Does not use `aria-live` by default, to avoid noisy status announcements during streaming. Existing explicit status UI remains the authoritative live status.
- Does not render controls, menus, approvals, or connection recovery actions.

Motion behavior:

- Animated only when `animationsEnabled` is true and CSS reduced-motion rules permit animation.
- Static frame when `animationsEnabled` is false or reduced motion is active.

Placement contract:

- In the app shell, render in a dedicated lower-left pane below the Sessions pane.
