# Troubleshooting

Start with **Settings -> Gateway -> Test**. If the gateway test fails, fix that
first.

## Gateway Test Fails

Check:

- OpenClaw is running.
- The WebSocket URL is correct.
- Docker exposes the gateway port to the host.
- The token or password is correct.
- You are using `wss://` when the remote deployment requires TLS.
- Firewalls, proxies, or origin allowlists are not blocking the desktop app.

Default local URL:

```text
ws://127.0.0.1:18789
```

## Docker Media Does Not Render

Check:

- The Docker container mounts media and workspace folders to the host.
- Path Prefix Mappings are configured.
- The left side of each mapping is the container path.
- The right side of each mapping is the host path.

Common mappings:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

## Files View Does Not Work

If OpenClaw is local, leave **File Server URL** blank.

If OpenClaw is remote, confirm the File Server URL points at a compatible file
API. ClawFace sends requests to:

```text
<File Server URL>/__claw/fs
```

## Remote Images Or Files Are Missing

Remote setups need more than path mappings. Use one of:

- compatible file/media server
- gateway-served media/artifact endpoint
- mounted network filesystem

If none of those exists, chat and sessions may work while direct image and file
previews remain limited.

## Source Build Shows Runtime Warnings

ClawFace source builds are pinned to:

- Node.js `22.22.0`
- npm `10.9.4`

If you see `EBADENGINE` warnings on another Node version, switch to the pinned
runtime before debugging further.

## Packaged App Cannot Connect

For packaged Electron builds loaded from `file://`, gateway origin checking may
see the browser origin as `null`. If your OpenClaw gateway uses origin
allowlisting, include `null` for the packaged-app path.

## Still Stuck

Open an issue with:

- ClawFace version
- operating system
- OpenClaw deployment mode: host, Docker, or remote
- gateway URL shape, without secrets
- whether **Test** succeeds or fails
- any relevant screenshots or logs
