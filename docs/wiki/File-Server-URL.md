# File Server URL

The **File Server URL** setting controls where ClawFace sends requests for the
Files surface.

It does not replace the OpenClaw gateway WebSocket URL.

## Leave It Blank For Local Use

For normal local OpenClaw installs, leave **File Server URL** blank.

When blank, the desktop app uses its local filesystem bridge:

```text
claw-fs://fs
```

That bridge reads allowed local roots, defaulting to:

```text
~/.openclaw/workspace
```

## When Set

When File Server URL is set, ClawFace uses it as the base URL for the Files
surface and sends file requests to:

```text
<File Server URL>/__claw/fs
```

Example:

```text
File Server URL: http://192.168.1.100:3000
Files API:       http://192.168.1.100:3000/__claw/fs
```

This is only useful when that server exposes a compatible file API.

## What It Affects

The File Server URL affects:

- Files view roots and directory listing
- file preview reads
- uploads
- mkdir
- rename
- delete
- write/save actions

## What It Does Not Affect

The File Server URL does not control:

- OpenClaw gateway WebSocket connection
- session loading
- chat streaming
- model or thinking controls
- tool events
- generated media access unless the remote server exposes compatible media or
  file routes

## Security Note

Only point ClawFace at a file server you trust. A compatible file server can
read and modify workspace files exposed by that server.
