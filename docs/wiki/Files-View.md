# Files View

The Files view lets you browse OpenClaw-adjacent workspace files from inside
ClawFace.

## Local Mode

When **File Server URL** is blank, the desktop app uses the local `claw-fs://fs`
bridge.

The default local root is:

```text
~/.openclaw/workspace
```

## Remote Mode

When **File Server URL** is set, the Files view sends requests to:

```text
<File Server URL>/__claw/fs
```

The remote server must expose a compatible file API.

## Supported Actions

Depending on the active file backend, the Files view can support:

- listing roots and folders
- previewing text, markdown, images, and PDFs
- uploading files
- creating folders
- renaming files or folders
- deleting files or folders
- writing edited text files

## Safety Notes

The local desktop bridge only allows paths under configured roots.

For remote file servers, trust and permissions depend on the server you point
ClawFace at. Only use a File Server URL you control.
