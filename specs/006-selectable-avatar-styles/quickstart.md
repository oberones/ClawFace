# Quickstart: Selectable Avatar Styles

## Implementation Workflow

1. Add `src/lib/avatar-profile.ts` with the bundled profile registry, default profile id, profile lookup, and normalization helper.
2. Add `avatarProfileId` to `UiSettings`, `DEFAULT_UI_SETTINGS`, and `parseUiSettings`.
3. Generate and add two new sprite sheets under `public/avatars`, matching the default geometry and row order.
4. Update `AnimatedAvatar` to accept a selected profile and set `--avatar-image` from that profile.
5. Update `AvatarStatusPane` and the `AvatarStatusPane` call site in `src/app.tsx` to pass the selected profile id or profile.
6. Add `AvatarStyleSection` to `src/components/settings-sections` and mount it from `SettingsModal` using the existing settings patch flow.
7. Add focused unit tests for profile normalization and registry completeness.
8. Update `public/avatars/README.md` to document all bundled profiles and geometry requirements.

## Validation Commands

```bash
make test-unit
make typecheck
make build
```

If image asset generation uses any temporary local tooling, do not add runtime dependencies for the generated assets unless the plan is revised first.

## Manual Regression Checklist

- Settings shows exactly three avatar choices with thumbnail previews.
- Each avatar can be selected and the lower-left pane updates within one second.
- The selected avatar persists after closing/reopening Settings and after app restart.
- Invalid saved profile ids fall back to the default without a broken Settings UI.
- All three profiles show the same state set: idle, thinking, streaming, tool-running, success, serious, caution, warning, approval-needed, disconnected.
- Animations enabled: animated states play smoothly without rapid flashing.
- UI animations disabled: every profile shows a static representative frame.
- OS/browser reduced motion active: every profile shows a static representative frame.
- Light and dark themes keep thumbnails and live pane legible.
- Expanded and collapsed sidebar keep the same avatar pane footprint.
- Gateway disconnected or pairing-required overrides normal activity states for every profile.
- Approval-needed overrides thinking/streaming/tool-running presentation for every profile.
- Tool-running overrides ordinary thinking when active tools are running.
- Streaming and thinking remain visually distinct for every profile.
- Packaged Electron build from the DMG can resolve all bundled avatar assets.
