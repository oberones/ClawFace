# Contract: Avatar Profile Integration

This is an internal renderer contract. It does not define a backend, gateway, IPC, or OpenClaw protocol contract.

## Profile Registry

`src/lib/avatar-profile.ts` should expose:

```ts
export type AvatarProfileId = "clawface-default" | "clawface-neon-console" | "clawface-prism-node";

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

export const DEFAULT_AVATAR_PROFILE_ID: AvatarProfileId;
export const AVATAR_PROFILES: readonly AvatarProfile[];
export function normalizeAvatarProfileId(value: unknown): AvatarProfileId;
export function getAvatarProfile(value: unknown): AvatarProfile;
```

**Required behavior**:

- `AVATAR_PROFILES` contains exactly three profiles for v1.
- `normalizeAvatarProfileId` returns `DEFAULT_AVATAR_PROFILE_ID` for invalid values.
- `getAvatarProfile` always returns a valid profile.
- Every profile points to a bundled asset under `public/avatars`.

## AnimatedAvatar Props

`AnimatedAvatar` should continue to receive the runtime status state and animation flag, and additionally receive the selected profile or profile id.

```ts
type AnimatedAvatarProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  profile: AvatarProfile;
  className?: string;
};
```

**Required behavior**:

- ARIA label remains based on `AvatarState`, not profile name.
- `--avatar-image` comes from `profile.spriteSrc`.
- Frame counts and state rows remain shared unless the plan is updated.
- Reduced-motion and disabled-animation behavior remain unchanged.

## AvatarStatusPane Props

`AvatarStatusPane` should pass the selected visual profile through without changing state derivation.

```ts
type AvatarStatusPaneProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  collapsed: boolean;
  profile: AvatarProfile;
};
```

**Required behavior**:

- Pane placement, layout footprint, and status copy remain unchanged.
- The selected profile affects artwork only.
- State labels and detail copy remain driven by `AvatarState`.

## Settings Selector

`AvatarStyleSection` should render from the profile registry.

```ts
type AvatarStyleSectionProps = {
  selectedProfileId: AvatarProfileId;
  onSelectProfile: (profileId: AvatarProfileId) => void;
};
```

**Required behavior**:

- Exactly three selectable thumbnail options render for v1.
- The selected option is visibly and accessibly marked.
- Selection calls `onSelectProfile` with a normalized profile id.
- The selector does not expose upload, marketplace, editor, or remote asset affordances.

## Settings Persistence

`UiSettings` should include:

```ts
avatarProfileId: AvatarProfileId;
```

**Required behavior**:

- Defaults use `DEFAULT_AVATAR_PROFILE_ID`.
- Parsing saved settings normalizes unknown values.
- Applying a settings patch updates the live avatar pane through existing React state.
- No session, agent, backend, or Electron IPC data model is introduced.
