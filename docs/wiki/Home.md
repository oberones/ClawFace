# ClawFace

ClawFace is a desktop-first OpenClaw client for people who want sessions, tools,
files, media, and memory visibility to feel like one coherent workstation.

![ClawFace application preview](https://raw.githubusercontent.com/oberones/ClawFace/main/public/ClawFace-latest.png)

## What ClawFace Is For

ClawFace is built for OpenClaw users who run OpenClaw locally, in Docker, or on
self-hosted infrastructure and want a polished day-to-day desktop interface.

It is:

- OpenClaw-native, not a generic multi-provider chat shell
- desktop-first, not a web-first team collaboration app
- conversation-centered, with sessions, tools, files, media, and memory surfaces
- focused on using OpenClaw, not replacing OpenClaw backend administration

## What You Can Do Today

- Chat with OpenClaw through a session-centered desktop interface.
- Search, rename, create, and delete sessions.
- Watch visible gateway status, tool activity, and connection feedback.
- Test gateway settings directly from Settings.
- Drag, paste, preview, and reuse images and attachments.
- Browse workspace files in the Files view.
- Browse generated images and media in the Media view.
- Read OpenClaw dream output in the Dreams timeline reader.
- Resize the Sessions, Chat, and Dreams panes.
- Pick animated pixel avatar styles and customize the interface.

## First Stops

- [Getting Started](Getting-Started)
- [OpenClaw Setup Modes](OpenClaw-Setup-Modes)
- [Gateway Settings](Gateway-Settings)
- [Media and Path Mapping](Media-and-Path-Mapping)
- [Troubleshooting](Troubleshooting)

## Current Boundaries

- ClawFace expects an existing OpenClaw gateway.
- ClawFace does not install or manage the OpenClaw backend.
- Remote file and media access needs a compatible server, gateway artifact
  endpoint, or shared filesystem.
- Some local settings still use the legacy `clawui` key names for compatibility
  with existing installs.
