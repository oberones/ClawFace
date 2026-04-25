import type { CSSProperties } from "react";
import type { AvatarState } from "../lib/avatar-state.ts";
import { AVATAR_STATE_LABELS } from "../lib/avatar-state.ts";

type AnimatedAvatarProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  className?: string;
};

type AvatarStyle = CSSProperties & {
  "--avatar-frames": number;
  "--avatar-image": string;
};

const DEFAULT_AVATAR_SPRITE_SRC = new URL("avatars/clawface-default.png", window.location.href).href;

const FRAME_COUNTS: Record<AvatarState, number> = {
  idle: 4,
  thinking: 4,
  streaming: 4,
  "tool-running": 4,
  success: 4,
  serious: 4,
  caution: 4,
  warning: 4,
  "approval-needed": 4,
  disconnected: 4,
};

const ANIMATED_STATES = new Set<AvatarState>([
  "thinking",
  "streaming",
  "tool-running",
  "success",
  "warning",
  "approval-needed",
  "disconnected",
]);

export function AnimatedAvatar(props: AnimatedAvatarProps) {
  const label = AVATAR_STATE_LABELS[props.state];
  const canAnimate = props.animationsEnabled && ANIMATED_STATES.has(props.state);
  const className = ["animated-avatar", props.className].filter(Boolean).join(" ");

  return (
    <span
      className={className}
      data-avatar-state={props.state}
      data-avatar-animated={canAnimate ? "true" : "false"}
      style={
        {
          "--avatar-frames": FRAME_COUNTS[props.state],
          "--avatar-image": `url("${DEFAULT_AVATAR_SPRITE_SRC}")`,
        } as AvatarStyle
      }
      role="img"
      aria-label={`OpenClaw status: ${label}`}
      title={`OpenClaw status: ${label}`}
    >
      <span className="animated-avatar-sprite" aria-hidden="true" />
    </span>
  );
}
