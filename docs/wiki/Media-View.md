# Media View

The Media view collects visible media artifacts from loaded session history and
generated media references.

## What It Is For

Use the Media view to:

- browse generated images and media artifacts
- filter media by session or provenance
- preview compatible artifacts
- reuse compatible images in the active chat draft

## Rendering Generated Images

Generated image rendering depends on ClawFace being able to resolve the media
path OpenClaw reports.

Local host installs usually work without extra setup. Docker installs usually
need path-prefix mappings. Remote installs need a compatible remote access path.

See [Media and Path Mapping](Media-and-Path-Mapping).

## Reusing Media In Chat

Compatible media can be inserted into the active chat draft. ClawFace builds a
portable media reference when possible and reports when a selected artifact
cannot be converted into a sendable reference.

## Image Preview And Save

Images opened from chat or media preview can use the native image context menu.
Right-click an image preview to use actions such as Save As when supported by
the operating system.
