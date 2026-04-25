# ClawFace Avatar Sprite Sheets

These pixel-art sprite sheets are used by `AnimatedAvatar` and selectable through the
avatar style setting.

Bundled profiles:

- `clawface-default.png` — Classic
- `clawface-neon-console.png` — Neon Console
- `clawface-prism-node.png` — Prism Node
- `clawface-mark.png` — ClawFace Mark

Geometry:

- Frame size: 24 by 24 source pixels
- Columns: 4 animation frames
- Rows: 10 avatar states
- Row order: idle, thinking, streaming, tool-running, success, serious, caution, warning, approval-needed, disconnected

The renderer scales frames with `image-rendering: pixelated`; keep source art small and crisp.
All bundled profiles must preserve the same geometry so CSS state row mapping, thumbnails,
and reduced-motion static frames remain shared.

The generated companion sheets can be refreshed with:

```bash
node scripts/generate-avatar-sprites.mjs
```
