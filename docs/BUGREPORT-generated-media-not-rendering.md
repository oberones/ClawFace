# Bug Report: Tool-generated images are created successfully but do not render inline in ClawFace chat

## Summary
When the assistant generates an image successfully using `image_generate`, the file is created on disk and returned by the tool, but the generated image does not appear inline in the ClawFace chat UI.

## Expected Behavior
When an image generation tool call succeeds, the resulting image should render inline in the chat transcript as an assistant media message or attachment preview.

## Actual Behavior
The tool succeeds and returns a generated media path, for example:

```text
MEDIA:/home/node/.openclaw/media/tool-image-generation/mountain-landscape-bw-fine-art---941abb5c-0ea7-4ab6-84f2-d0af49ae7967.png
```

The assistant replies in chat, but ClawFace does not display the generated image inline.

## Reproduction
1. Open ClawFace and start a chat with the assistant.
2. Ask the assistant to generate an image.
3. Wait for successful completion.
4. Observe the assistant reply in the chat UI.

## Observed Result
The generation completes successfully and the image file exists on disk, but the image is not visible in the ClawFace conversation unless manually inspected outside the chat UI.

## Why This Matters
This breaks the basic user expectation for image generation in chat:
- request image
- assistant generates image
- user sees image inline immediately

Without inline rendering, the feature technically works but feels broken in normal use.

## Likely Cause
ClawFace may not be consuming or rendering the generated media payload emitted by OpenClaw tool results. The UI may be displaying only the assistant text response while ignoring, dropping, or failing to resolve associated media attachments.

## Suggested Fix
Ensure ClawFace can detect and render tool result media returned from image generation flows, including payloads represented like:

```text
MEDIA:/home/node/.openclaw/media/tool-image-generation/<filename>.png
```

Possible implementation directions:
- treat generated media as first-class assistant attachments in the transcript model
- resolve media paths into previewable URLs before rendering
- ensure tool result payloads are preserved through the control-ui transport layer and not reduced to text only

## Impact
High for multimodal UX.

This makes image generation appear non-functional from the user perspective even when backend generation succeeds.

## Notes
This was confirmed with a successfully generated black-and-white mountain landscape image. The file existed at the generated media path, but it did not render in the ClawFace chat window.
