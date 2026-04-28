# Getting Started

ClawFace connects to an OpenClaw gateway you already have running.

The default gateway URL is:

```text
ws://127.0.0.1:18789
```

## Install From A Release

Download the current release for your platform from:

```text
https://github.com/oberones/ClawFace/releases
```

Release artifacts are currently unsigned, so your operating system may ask for
an extra confirmation step the first time you launch ClawFace.

Typical release artifacts:

- macOS arm64: `.dmg` or `.zip`
- Windows x64: `.exe` installer or `.zip`
- Linux x64: `.AppImage`, `.deb`, or `.rpm`

## Run From Source

Source builds require:

- Node.js `22.22.0`
- npm `10.9.4`

Install dependencies and start the desktop app:

```bash
npm ci
npm run desktop:dev
```

Create a packaged build for your current machine:

```bash
npm run desktop:pack
```

## First Launch Checklist

1. Start OpenClaw.
2. Launch ClawFace.
3. Open **Settings -> Gateway**.
4. Set the WebSocket URL, token, password, and optional File Server URL.
5. Click **Test** next to the WebSocket URL.
6. If OpenClaw is running in Docker, configure path mappings.
7. Create or select a session and send a message.

## Where To Go Next

- Local, Docker, and remote setup: [OpenClaw Setup Modes](OpenClaw-Setup-Modes)
- Gateway connection details: [Gateway Settings](Gateway-Settings)
- Docker media and workspace paths: [Media and Path Mapping](Media-and-Path-Mapping)
- Common issues: [Troubleshooting](Troubleshooting)
