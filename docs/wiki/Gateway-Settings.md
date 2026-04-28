# Gateway Settings

Open **Settings -> Gateway** to configure how ClawFace connects to OpenClaw.

## WebSocket URL

The WebSocket URL is the OpenClaw gateway endpoint used for chat, sessions,
streaming events, tools, and OpenClaw control messages.

Default:

```text
ws://127.0.0.1:18789
```

Remote examples:

```text
wss://openclaw.example.com/gateway
ws://192.168.1.100:18789
```

## Token And Password

Enter a token or password if your OpenClaw gateway requires one.

The exact value depends on your OpenClaw deployment. ClawFace stores these
settings locally in app storage.

## Test Button

Click **Test** next to the WebSocket URL to verify the current gateway settings.

The test attempts a temporary connection using the same OpenClaw control UI
client identity as the app. It reports:

- success with a green check when the gateway accepts the connection
- failure with a red X, short summary, and more detailed error description

Use this before debugging media or file access. If the gateway test fails, chat
and sessions will not work reliably either.

## Gateway URL Vs File Server URL

The gateway WebSocket URL controls live OpenClaw communication.

The File Server URL controls the Files surface only. It is optional and should
usually stay blank for local setups.

See [File Server URL](File-Server-URL).

## Common Failure Causes

- OpenClaw is not running.
- The gateway port is not exposed from Docker.
- The URL uses `ws://` when the deployment requires `wss://`.
- The token or password is missing or wrong.
- A remote firewall, proxy, or origin allowlist is blocking the app.
- The gateway is reachable from a browser on the host but not from the desktop
  runtime environment.
