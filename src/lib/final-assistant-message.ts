export function shouldCommitFinalAssistantMessage(params: {
  hasRenderableText: boolean;
  hasRenderableAttachment: boolean;
  shouldSkipText: boolean;
}): boolean {
  if (!params.hasRenderableText) {
    return true;
  }
  if (params.hasRenderableAttachment) {
    return true;
  }
  return !params.shouldSkipText;
}
