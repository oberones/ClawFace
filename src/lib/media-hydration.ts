export type MediaExpectationTool = {
  name?: string | null;
  output?: string | null;
  mediaPaths?: string[] | null;
};

export type FinalizedRunHydrationDecision = "clear" | "schedule" | "reload";
export type ScheduledHistoryHydrationTickDecision = {
  clearScheduled: boolean;
  loadHistory: boolean;
};

const MEDIA_PREFIX_RE = /\bmedia\s*:/i;
const MEDIA_TOOL_NAME_RE = /(image|media|screenshot|render|draw|picture|photo)/;
const IMAGE_OUTPUT_RE = /\.(png|jpe?g|webp|gif|bmp|svg)\b/i;

export function toolMayProduceMedia(tool: MediaExpectationTool): boolean {
  // Be intentionally generous: generated media can appear as a final attachment
  // after the textual tool result, so these hints decide whether to poll history.
  if (Boolean(tool.mediaPaths?.length)) {
    return true;
  }
  const normalizedName = (tool.name ?? "").trim().toLowerCase();
  if (MEDIA_TOOL_NAME_RE.test(normalizedName)) {
    return true;
  }
  const output = (tool.output ?? "").trim();
  if (!output) {
    return false;
  }
  return MEDIA_PREFIX_RE.test(output) || IMAGE_OUTPUT_RE.test(output);
}

export function runMayStillProduceMedia(params: {
  pendingToolUpdates?: MediaExpectationTool[] | null;
  priorToolItems?: MediaExpectationTool[] | null;
  pendingAssistantReplyMediaCount?: number | null;
}): boolean {
  const pendingToolUpdates = (params.pendingToolUpdates ?? []).filter(Boolean);
  if (pendingToolUpdates.some((item) => toolMayProduceMedia(item))) {
    return true;
  }
  const priorToolItems = (params.priorToolItems ?? []).filter(Boolean);
  if (priorToolItems.some((item) => toolMayProduceMedia(item))) {
    return true;
  }
  return (params.pendingAssistantReplyMediaCount ?? 0) > 0;
}

export function decideFinalizedRunHydration(params: {
  hasFinalAssistantMessage: true;
  hasRenderableAttachment: boolean;
  hasCommittedAttachment: boolean;
  hasCommittedMessage: boolean;
  expectsMedia: boolean;
}): "clear" | "schedule";
export function decideFinalizedRunHydration(params: {
  hasFinalAssistantMessage: false;
  hasRenderableAttachment: boolean;
  hasCommittedAttachment: boolean;
  hasCommittedMessage: boolean;
  expectsMedia: boolean;
}): "clear" | "reload";
export function decideFinalizedRunHydration(params: {
  hasFinalAssistantMessage: boolean;
  hasRenderableAttachment: boolean;
  hasCommittedAttachment: boolean;
  hasCommittedMessage: boolean;
  expectsMedia: boolean;
}): FinalizedRunHydrationDecision {
  // If the final assistant message is missing, a history reload is the fastest
  // way to recover both text and late-arriving attachments from the gateway.
  if (!params.hasFinalAssistantMessage) {
    if (params.hasCommittedAttachment || (params.hasCommittedMessage && !params.expectsMedia)) {
      return "clear";
    }
    return "reload";
  }

  if (params.hasRenderableAttachment || params.hasCommittedAttachment) {
    return "clear";
  }

  // Once text exists but expected media does not, schedule a short delayed poll
  // instead of immediately reloading the whole thread.
  return params.expectsMedia ? "schedule" : "clear";
}

export function decideScheduledHistoryHydrationTick(params: {
  isStillScheduled: boolean;
  isFinalAttempt: boolean;
  hasCommittedAttachment: boolean;
  isCurrentClient: boolean;
  isCurrentSession: boolean;
  activeRunId?: string | null;
  targetRunId: string;
  thinking: boolean;
  hasActiveStreamText: boolean;
  hasPendingAssistantReply: boolean;
  isHistoryLoadInFlight: boolean;
}): ScheduledHistoryHydrationTickDecision {
  if (!params.isStillScheduled) {
    return { clearScheduled: false, loadHistory: false };
  }

  const clearScheduled = params.isFinalAttempt || params.hasCommittedAttachment;
  if (params.hasCommittedAttachment) {
    return { clearScheduled, loadHistory: false };
  }
  if (!params.isCurrentClient || !params.isCurrentSession) {
    return { clearScheduled, loadHistory: false };
  }
  if (params.activeRunId === params.targetRunId) {
    if (params.thinking || params.hasActiveStreamText || params.hasPendingAssistantReply) {
      return { clearScheduled, loadHistory: false };
    }
  }
  if (params.activeRunId && params.activeRunId !== params.targetRunId) {
    return { clearScheduled, loadHistory: false };
  }
  if (params.isHistoryLoadInFlight) {
    return { clearScheduled, loadHistory: false };
  }
  return { clearScheduled, loadHistory: true };
}
