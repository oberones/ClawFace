# Data Model: Selectable Avatar Styles

## Avatar Profile

Represents one bundled visual style for the existing avatar status pane.

**Fields**:

- `id`: Stable profile id used in settings persistence.
- `name`: User-facing display name in Settings.
- `description`: Short Settings helper copy, if needed.
- `spriteSrc`: Packaged public asset URL for the sprite sheet.
- `thumbnailState`: `AvatarState` row to show in Settings previews.
- `thumbnailFrame`: Static frame index for preview rendering.
- `frameSize`: Source pixel size for one frame.
- `columns`: Number of animation frames per state row.
- `rows`: Number of avatar state rows.

**Rules**:

- `id` values are stable and unique.
- All v1 profiles use the same frame size, columns, rows, and row order.
- All v1 profiles support the same ten `AvatarState` values.
- The default profile is always present and is the fallback for invalid saved ids.

## Selected Avatar Style Preference

The persisted local user choice for the active avatar profile.

**Storage**:

- Field: `UiSettings.avatarProfileId`
- Default: default profile id from `src/lib/avatar-profile.ts`
- Persistence: existing `clawui.ui.settings` local settings storage

**Rules**:

- Missing, empty, non-string, or unknown values normalize to the default profile id.
- Changing the value updates the live avatar pane immediately through React state.
- The value is global to the local ClawFace UI, not per session, per agent, or backend managed.

## Avatar Sprite Asset

Static packaged PNG used by `AnimatedAvatar`.

**Geometry**:

- Source frame size: `24px` by `24px`
- Columns: `4`
- Rows: `10`
- Row order: idle, thinking, streaming, tool-running, success, serious, caution, warning, approval-needed, disconnected

**Rules**:

- All profiles use equivalent geometry so CSS variables and state row mapping stay shared.
- Assets must live under `public/avatars` or an equivalent static asset location supported by Vite/Electron packaging.
- Assets must remain small enough to avoid noticeable app startup or rendering cost.

## Settings Avatar Option

View model used by the Settings selector.

**Fields**:

- `id`: Avatar profile id.
- `name`: Display name.
- `description`: Optional short description.
- `thumbnailStyle`: CSS variables or profile metadata used to render a static sprite frame.
- `selected`: Whether this option is the active profile.

**Rules**:

- Settings shows exactly three options for v1.
- Options are selectable by mouse, keyboard, and screen reader.
- Selecting an option patches existing UI settings with the profile id.

## Relationships

- `UiSettings.avatarProfileId` references one `AvatarProfile.id`.
- `AnimatedAvatar` renders one `AvatarProfile` and one `AvatarState`.
- `AvatarStatusPane` passes the selected profile to `AnimatedAvatar` but does not derive profile-specific state.
- `AvatarStyleSection` renders options from the profile registry and patches `UiSettings.avatarProfileId`.
