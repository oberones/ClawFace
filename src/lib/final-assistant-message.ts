export function shouldCommitFinalAssistantMessage(params: {
  hasRenderableText: boolean;
  hasRenderableAttachment: boolean;
  shouldSkipText: boolean;
}): boolean {
  if (!params.hasRenderableText && !params.hasRenderableAttachment) {
    return false;
  }
  if (params.hasRenderableAttachment) {
    return true;
  }
  if (!params.hasRenderableText) {
    return true;
  }
  return !params.shouldSkipText;
}
