# Quickstart: Pixel-Art Session Avatar

## Implementation Checklist

1. Add `src/lib/avatar-state.ts` with `AvatarState`, `AvatarSignalSnapshot`, and `deriveAvatarState`.
2. Add `tests/avatar-state.test.mjs` covering state priority and fallbacks.
3. Add default sprite sheet asset(s) under `public/avatars/`.
4. Add `src/components/AnimatedAvatar.tsx`.
5. Add avatar CSS near chat/sidebar/status styles in `src/styles.css`.
6. Integrate the component as a dedicated lower-left shell pane below the Sessions pane.
7. Run validation.

## Validation Commands

```sh
make test-unit
make typecheck
make build
```

## Manual Regression Checklist

- Light theme: avatar remains crisp, readable, and visually subordinate to the session and chat controls.
- Dark theme: avatar border/background has enough contrast and does not create a single-hue distraction.
- Animations enabled: thinking, streaming, tool-running, and approval-needed animate gently with no rapid flashing.
- Enable UI animations off: all avatar states use static frames.
- OS/browser reduced motion: all avatar states use static frames.
- Gateway disconnected: avatar shows disconnected state while existing connection recovery UI remains visible.
- Pairing required: avatar shows disconnected/pairing state while pairing approval guidance remains visible.
- Approval needed: avatar shows approval-needed state and explicit approval controls remain usable.
- Tool running: avatar shows tool-running while existing tool activity panel/thread tool UI remains visible.
- Thinking: avatar shows thinking before stream text appears.
- Streaming: avatar shows streaming while response text arrives.
- Warning/blocked/denied/error: avatar shows warning only when explicit local outcome exists.
- Idle: avatar returns to idle when no higher-priority state is active.
- Session switch: transient final state from the previous session does not continue into the newly selected session.
- Narrow desktop window: avatar stays in the lower-left shell or collapses without covering session, settings, or gateway controls.

## Notes For Implementation

- Use CSS `background-position` and `steps()` for animation.
- Use `image-rendering: pixelated`.
- Avoid JS timers in the avatar component for v1.
- Do not add new runtime dependencies.
- Do not inspect assistant response text to determine mood.
