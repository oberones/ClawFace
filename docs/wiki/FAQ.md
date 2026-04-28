# FAQ

## Does ClawFace Install OpenClaw?

No. ClawFace expects an existing OpenClaw gateway.

## Is ClawFace A Replacement For The OpenClaw Admin UI?

No. ClawFace is focused on the day-to-day desktop working experience: chat,
sessions, files, media, tools, and memory surfaces.

OpenClaw backend administration and configuration remain separate concerns.

## Is ClawFace A Generic Multi-Provider Chat App?

No. ClawFace is OpenClaw-native. Model controls matter, but the product is built
around OpenClaw's gateway, sessions, tools, files, media, and runtime
capabilities.

## What Should I Use For Docker Path Mappings?

For the common OpenClaw Docker layout:

```text
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace => ~/.openclaw/workspace
```

Adjust the paths if your container or host layout differs.

## What Is File Server URL?

It is an optional base URL for the Files surface.

When set, ClawFace sends file requests to:

```text
<File Server URL>/__claw/fs
```

Leave it blank for normal local use.

## Why Do Some Settings Mention `clawui`?

Some local storage keys still use the legacy `clawui` name for compatibility
with existing installs.

## Why Are Dream-Writing Sessions Hidden?

ClawFace keeps OpenClaw dream-writing background sessions out of the main user
session list so the Sessions panel stays focused on user-facing work. Their
human-facing diary output still appears in Dreams.

## Can I Save Images From Chat?

Yes. Open an image preview and right-click it to use the native image context
menu, including Save As when supported by the operating system.
