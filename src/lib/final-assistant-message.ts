import { decideFinalizedRunHydration } from "./media-hydration.ts";
import type { ChatMessage } from "./types.ts";

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

export type FinalAssistantMessageResolution = {
  hasRenderableText: boolean;
  hasRenderableAttachment: boolean;
  shouldCommitMessage: boolean;
  hydrationDecision: "clear" | "schedule";
};

export type ActiveFinalAssistantEventResolution =
  | { kind: "schedule-history-hydration" }
  | ({ kind: "final-assistant-message" } & FinalAssistantMessageResolution);

export function resolveFinalAssistantMessage(params: {
  message: Pick<ChatMessage, "text" | "attachments">;
  hasCommittedAttachment: boolean;
  expectsMedia: boolean;
  shouldSkipText: boolean;
}): FinalAssistantMessageResolution {
  const hasRenderableText = Boolean(params.message.text.trim());
  const hasRenderableAttachment = Boolean(params.message.attachments?.length);

  return {
    hasRenderableText,
    hasRenderableAttachment,
    shouldCommitMessage: shouldCommitFinalAssistantMessage({
      hasRenderableText,
      hasRenderableAttachment,
      shouldSkipText: params.shouldSkipText,
    }),
    hydrationDecision: decideFinalizedRunHydration({
      hasFinalAssistantMessage: true,
      hasRenderableAttachment,
      hasCommittedAttachment: params.hasCommittedAttachment,
      hasCommittedMessage: true,
      expectsMedia: params.expectsMedia,
    }),
  };
}

export function resolveActiveFinalAssistantEvent(params: {
  message: Pick<ChatMessage, "text" | "attachments"> | null;
  hasCommittedAttachment: boolean;
  expectsMedia: boolean;
  shouldSkipText: boolean;
}): ActiveFinalAssistantEventResolution {
  if (!params.message) {
    return { kind: "schedule-history-hydration" };
  }

  return {
    kind: "final-assistant-message",
    ...resolveFinalAssistantMessage({
      message: params.message,
      hasCommittedAttachment: params.hasCommittedAttachment,
      expectsMedia: params.expectsMedia,
      shouldSkipText: params.shouldSkipText,
    }),
  };
}
