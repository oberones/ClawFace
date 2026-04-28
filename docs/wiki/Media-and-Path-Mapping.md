# Media and Path Mapping

ClawFace can render generated images and local media when it can resolve the
paths OpenClaw reports.

The correct setup depends on where OpenClaw runs.

## Local Host Setup

For a normal host install, generated media is usually under:

```text
~/.openclaw/media
```

Workspace files are usually under:

```text
~/.openclaw/workspace
```

No path mapping is normally needed because those paths mean the same thing to
OpenClaw and ClawFace.

## Docker Setup

For the common local Docker layout, add this in
**Settings -> Path Prefix Mappings**:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

These mappings translate paths emitted by OpenClaw inside the container into
paths the desktop app can read on the host.

## Custom Docker Paths

If your container paths differ, map your actual container paths to your actual
host paths.

Example:

```text
/app/.openclaw/media => /Users/alex/.openclaw/media
/app/.openclaw/workspace => /Users/alex/.openclaw/workspace
```

## Remote Setup

Path mappings alone are not enough for a truly remote machine. They only
translate path strings.

Remote setups need one of these:

- a compatible remote file/media server
- a gateway-served media/artifact read method
- a mounted network filesystem

If you mount remote folders locally, map the remote paths to your local mount:

```text
/home/node/.openclaw/media => /Volumes/openclaw/.openclaw/media
/home/node/.openclaw/workspace => /Volumes/openclaw/.openclaw/workspace
```

## Generated Image Troubleshooting

If generated images do not render:

1. Confirm the gateway connection test passes.
2. Confirm OpenClaw wrote the media file.
3. Confirm the path exists from ClawFace's machine.
4. For Docker, confirm both media and workspace volumes are mounted.
5. Confirm path-prefix mappings point from container paths to host paths.
6. For remote installs, confirm a compatible file/media path is available.
