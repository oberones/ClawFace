import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AvatarState } from "../lib/avatar-state.ts";
import { AVATAR_STATE_LABELS } from "../lib/avatar-state.ts";
import {
  DEFAULT_AVATAR_PROFILE_ID,
  getAvatarProfile,
  resolveAvatarSpriteSrc,
  type AvatarProfile,
} from "../lib/avatar-profile.ts";

type AnimatedAvatarProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  profile: AvatarProfile;
  className?: string;
};

type AvatarStyle = CSSProperties & {
  "--avatar-frames": number;
  "--avatar-image": string;
};

const DEFAULT_AVATAR_PROFILE = getAvatarProfile(DEFAULT_AVATAR_PROFILE_ID);

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
  const selectedSpriteUrl = useMemo(
    () => resolveAvatarSpriteSrc(props.profile, window.location.href),
    [props.profile],
  );
  const fallbackSpriteUrl = useMemo(
    () => resolveAvatarSpriteSrc(DEFAULT_AVATAR_PROFILE, window.location.href),
    [],
  );
  const [spriteUrl, setSpriteUrl] = useState(selectedSpriteUrl);

  useEffect(() => {
    let cancelled = false;
    setSpriteUrl(selectedSpriteUrl);

    if (props.profile.id === DEFAULT_AVATAR_PROFILE_ID) {
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setSpriteUrl(selectedSpriteUrl);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setSpriteUrl(fallbackSpriteUrl);
      }
    };
    image.src = selectedSpriteUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [fallbackSpriteUrl, props.profile.id, selectedSpriteUrl]);

  return (
    <span
      className={className}
      data-avatar-state={props.state}
      data-avatar-animated={canAnimate ? "true" : "false"}
      style={
        {
          "--avatar-frames": FRAME_COUNTS[props.state],
          "--avatar-image": `url("${spriteUrl}")`,
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
