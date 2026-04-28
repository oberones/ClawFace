# ClawFace Quick Start

Use this guide after ClawFace is installed or running in desktop development mode.

ClawFace connects to an existing OpenClaw gateway. The default gateway URL is:

```text
ws://127.0.0.1:18789
```

In ClawFace, open **Settings -> Gateway** to change the WebSocket URL, token, password, or file server URL.

---

# 1. OpenClaw Running Directly on Your Host

This is the simplest setup. OpenClaw and ClawFace both run on the same machine, and ClawFace can usually read generated media and workspace files directly from your local filesystem.

## Steps

1. Start OpenClaw on your host machine.
2. Confirm the OpenClaw gateway is listening locally, usually at:

```text
ws://127.0.0.1:18789
```

3. Start ClawFace.
4. Open **Settings -> Gateway**.
5. Set **WebSocket URL** to the local gateway URL if it is not already selected.
6. Enter any required gateway token or password.
7. Click **Test** next to the WebSocket URL to confirm ClawFace can reach the gateway.
8. Leave **File Server URL** empty unless your OpenClaw setup specifically exposes files through a separate server.
9. Leave **Path Prefix Mappings** empty unless your OpenClaw process reports paths that differ from your host filesystem.

## Media and workspace access

For a normal host install, OpenClaw-generated media is usually under:

```text
~/.openclaw/media
```

Workspace files are usually under:

```text
~/.openclaw/workspace
```

No extra path mapping is normally needed because those paths already mean the same thing to OpenClaw and ClawFace.

---

# 2. OpenClaw Running in Docker on Your Host

Use this setup when OpenClaw runs inside a local Docker container and ClawFace runs as a desktop app on the host.

The important difference is path translation: OpenClaw may report container paths such as `/home/node/.openclaw/media`, while ClawFace needs the matching host paths such as `~/.openclaw/media`.

## Steps

1. Start the OpenClaw Docker container with the gateway port exposed to the host.
2. Make sure the gateway is reachable from the host, usually at:

```text
ws://127.0.0.1:18789
```

3. Make sure the container's media and workspace folders are mounted to host folders.
4. Start ClawFace.
5. Open **Settings -> Gateway**.
6. Set **WebSocket URL** to the exposed gateway URL.
7. Enter any required gateway token or password.
8. Click **Test** next to the WebSocket URL to confirm ClawFace can reach the gateway.
9. Open **Settings -> Path Prefix Mappings**.
10. Add the Docker path mappings below, or click **Use Docker Example** if the default paths match your container.

## Required path mappings

For the common OpenClaw Docker layout, add:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

These mappings tell ClawFace how to translate paths emitted by OpenClaw inside the container into paths the desktop app can read on the host.

## Docker volume shape

Your Docker setup should mount the same host directories that the mappings target. Conceptually:

```text
Host ~/.openclaw/media     -> Container /home/node/.openclaw/media
Host ~/.openclaw/workspace -> Container /home/node/.openclaw/workspace
```

If your container uses different paths, keep the same pattern but adjust the left side to the container path and the right side to the host path.

Example:

```text
/app/.openclaw/media => /Users/alex/.openclaw/media
/app/.openclaw/workspace => /Users/alex/.openclaw/workspace
```

## Media and workspace access

Generated images and workspace files should render in ClawFace when:

- the gateway is reachable from the host
- the Docker volumes expose media and workspace files on the host
- **Path Prefix Mappings** translate container paths to the host paths

---

# 3. OpenClaw Running Remotely

Use this setup when OpenClaw runs on another machine, VM, or server and ClawFace runs on your local desktop.

## Steps

1. Make sure the remote OpenClaw gateway is reachable from your desktop.
2. Use a secure transport or trusted network path for the gateway connection.
3. Start ClawFace.
4. Open **Settings -> Gateway**.
5. Set **WebSocket URL** to the remote gateway URL, for example:

```text
wss://openclaw.example.com/gateway
```

or, on a trusted private network:

```text
ws://192.168.1.100:18789
```

6. Enter any required gateway token or password.
7. Click **Test** next to the WebSocket URL to confirm ClawFace can reach the gateway.
8. Set **File Server URL** only if your remote setup exposes workspace/media files through a separate HTTP file server.

## Media and workspace access

Remote setups need one of these media access paths:

- a gateway-served media/artifact read method or endpoint
- a file/media server reachable from the desktop
- a mounted network filesystem that makes the remote media and workspace directories available locally

Path prefix mappings alone are not enough for a truly remote machine. They only translate path strings; they do not make remote files exist on your local filesystem.

If you mount the remote OpenClaw folders locally, add mappings from the remote paths to your local mount paths. For example:

```text
/home/node/.openclaw/media => /Volumes/openclaw/.openclaw/media
/home/node/.openclaw/workspace => /Volumes/openclaw/.openclaw/workspace
```

If you do not have a shared filesystem or gateway-served media endpoint, chat and session features may still work, but generated images and direct workspace file previews may be limited.
