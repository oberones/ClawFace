# Bug Report: Inbound image attachments are visible to the model but unusable by image generation/edit tools

## Summary
When using ClawFace to chat with the assistant, an image attached in the conversation can be understood by the model for descriptive tasks, but the same attachment cannot be passed to `image_generate` for edit-style workflows.

## Expected Behavior
An image attached in chat should be resolvable into a tool-consumable asset reference so the assistant can use it with downstream tools such as `image_generate`.

## Actual Behavior
The assistant receives the attachment as a chat-visible reference in the form:

```text
media://inbound/<filename>.png
```

That reference works for multimodal understanding in-chat, but `image_generate` rejects it because the tool only accepts:
- local file paths
- `file://` URLs
- `http(s)://` URLs
- `data:` URLs

## Reproduction
1. Open ClawFace and start a chat with the assistant.
2. Attach an image.
3. Ask the assistant to describe the image.
4. Ask the assistant to generate a cartoon version of that same image.

## Observed Result
Step 3 succeeds.

Step 4 fails with an error equivalent to:

```text
Unsupported image reference: media://inbound/<filename>.png. Use a file path, a file:// URL, a data: URL, or an http(s) URL.
```

## Why This Matters
This breaks a core multimodal workflow:
- attach image
- discuss/analyze image
- transform/edit image with a downstream tool

In practice, ClawFace attachments currently work as model-visible media, but not as tool-usable assets.

## Likely Cause
ClawFace or the surrounding OpenClaw attachment pipeline is surfacing inbound media as a display/reference handle only, without also exposing a resolved asset location that downstream tools can consume.

## Suggested Fix
Normalize inbound attachments into a second, tool-usable reference at message ingest time. Any of these would likely work:
- local temp file path
- `file://` URL
- signed or gateway-served `http(s)://` URL
- automatic resolution layer that translates `media://inbound/...` before tool invocation

## Product Requirement
For first-class multimodal tooling, each inbound attachment should ideally have:
- stable asset identifier
- preview/display reference
- MIME/type metadata
- tool-consumable resolved path or URL

## Impact
Medium to high.

This does not block image understanding, but it does block image-to-image and edit-from-attachment workflows, which makes ClawFace feel incomplete for real multimodal assistant use.

## Notes
This was observed from ClawFace while talking to the assistant through the control UI, using an attached PNG that the assistant could successfully describe but could not pass to `image_generate` unchanged.
