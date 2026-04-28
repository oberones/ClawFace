# OpenClaw Setup Modes

ClawFace supports three common OpenClaw deployment shapes.

## OpenClaw Running Directly On Your Host

This is the simplest setup. OpenClaw and ClawFace run on the same machine, so
ClawFace can usually read generated media and workspace files directly.

Recommended settings:

- WebSocket URL: `ws://127.0.0.1:18789`
- File Server URL: leave blank
- Path Prefix Mappings: leave blank unless OpenClaw reports paths that differ
  from your host filesystem

Typical paths:

```text
~/.openclaw/media
~/.openclaw/workspace
```

## OpenClaw Running In Docker On Your Host

Use this setup when OpenClaw runs inside a local Docker container and ClawFace
runs as a desktop app on the host.

The important difference is path translation. OpenClaw may report container
paths such as `/home/node/.openclaw/media`, while ClawFace needs the matching
host paths such as `~/.openclaw/media`.

Recommended settings:

- WebSocket URL: the gateway URL exposed to the host, usually
  `ws://127.0.0.1:18789`
- File Server URL: usually blank
- Path Prefix Mappings:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

Your Docker volumes should mount the same folders:

```text
Host ~/.openclaw/media     -> Container /home/node/.openclaw/media
Host ~/.openclaw/workspace -> Container /home/node/.openclaw/workspace
```

If your container uses different paths, keep the same pattern but adjust the
left side to the container path and the right side to the host path.

## OpenClaw Running Remotely

Use this setup when OpenClaw runs on another machine, VM, or server and
ClawFace runs on your local desktop.

Example gateway URLs:

```text
wss://openclaw.example.com/gateway
ws://192.168.1.100:18789
```

Remote media and workspace access needs one of these:

- a compatible file/media server reachable from your desktop
- a gateway-served media/artifact read method
- a mounted network filesystem that makes the remote folders available locally

Path mappings only translate strings. They do not make remote files exist on
your local machine.

If you mount remote folders locally, map remote paths to the mount path:

```text
/home/node/.openclaw/media => /Volumes/openclaw/.openclaw/media
/home/node/.openclaw/workspace => /Volumes/openclaw/.openclaw/workspace
```
