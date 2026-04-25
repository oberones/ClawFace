import type { AvatarState } from "./avatar-state.ts";

export type AvatarProfileId =
  | "clawface-default"
  | "clawface-neon-console"
  | "clawface-prism-node"
  | "clawface-mark";

export type AvatarProfile = {
  id: AvatarProfileId;
  name: string;
  description: string;
  spriteSrc: string;
  thumbnailState: AvatarState;
  thumbnailFrame: number;
  frameSize: number;
  columns: number;
  rows: number;
};

export const DEFAULT_AVATAR_PROFILE_ID: AvatarProfileId = "clawface-default";

export const AVATAR_PROFILE_STATE_ORDER: readonly AvatarState[] = [
  "idle",
  "thinking",
  "streaming",
  "tool-running",
  "success",
  "serious",
  "caution",
  "warning",
  "approval-needed",
  "disconnected",
];

const AVATAR_PROFILE_FRAME_SIZE = 24;
const AVATAR_PROFILE_COLUMNS = 4;
const AVATAR_PROFILE_ROWS = AVATAR_PROFILE_STATE_ORDER.length;

export const AVATAR_PROFILES: readonly AvatarProfile[] = [
  {
    id: "clawface-default",
    name: "Classic",
    description: "The original ClawFace status companion.",
    spriteSrc: "avatars/clawface-default.png",
    thumbnailState: "success",
    thumbnailFrame: 0,
    frameSize: AVATAR_PROFILE_FRAME_SIZE,
    columns: AVATAR_PROFILE_COLUMNS,
    rows: AVATAR_PROFILE_ROWS,
  },
  {
    id: "clawface-neon-console",
    name: "Neon Console",
    description: "A crisp terminal-inspired companion with luminous status accents.",
    spriteSrc: "avatars/clawface-neon-console.png",
    thumbnailState: "streaming",
    thumbnailFrame: 0,
    frameSize: AVATAR_PROFILE_FRAME_SIZE,
    columns: AVATAR_PROFILE_COLUMNS,
    rows: AVATAR_PROFILE_ROWS,
  },
  {
    id: "clawface-prism-node",
    name: "Prism Node",
    description: "A geometric signal core with crystalline color shifts.",
    spriteSrc: "avatars/clawface-prism-node.png",
    thumbnailState: "success",
    thumbnailFrame: 0,
    frameSize: AVATAR_PROFILE_FRAME_SIZE,
    columns: AVATAR_PROFILE_COLUMNS,
    rows: AVATAR_PROFILE_ROWS,
  },
  {
    id: "clawface-mark",
    name: "ClawFace Mark",
    description: "A logo-inspired companion with cyan claws and a bright little grin.",
    spriteSrc: "avatars/clawface-mark.png",
    thumbnailState: "success",
    thumbnailFrame: 0,
    frameSize: AVATAR_PROFILE_FRAME_SIZE,
    columns: AVATAR_PROFILE_COLUMNS,
    rows: AVATAR_PROFILE_ROWS,
  },
];

const AVATAR_PROFILE_IDS = new Set<AvatarProfileId>(
  AVATAR_PROFILES.map((profile) => profile.id),
);

export function normalizeAvatarProfileId(value: unknown): AvatarProfileId {
  return typeof value === "string" && AVATAR_PROFILE_IDS.has(value as AvatarProfileId)
    ? (value as AvatarProfileId)
    : DEFAULT_AVATAR_PROFILE_ID;
}

export function getAvatarProfile(value: unknown): AvatarProfile {
  const profileId = normalizeAvatarProfileId(value);
  return AVATAR_PROFILES.find((profile) => profile.id === profileId) ?? AVATAR_PROFILES[0];
}

export function resolveAvatarSpriteSrc(profile: AvatarProfile, baseHref: string): string {
  return new URL(profile.spriteSrc, baseHref).href;
}
