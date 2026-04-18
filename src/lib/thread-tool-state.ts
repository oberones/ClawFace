import type { ChatMessage, ToolItem } from "./types.ts";

export type ThreadToolStateSnapshot = {
  messages: ChatMessage[];
  streamText: string | null;
  toolItems: ToolItem[];
  thinking: boolean;
  chatRunId: string | null;
  thinkingLevel: string | null;
};

export function createEmptyThreadToolStateSnapshot(): ThreadToolStateSnapshot {
  return {
    messages: [],
    streamText: null,
    toolItems: [],
    thinking: false,
    chatRunId: null,
    thinkingLevel: null,
  };
}

export function cloneThreadToolStateSnapshot(
  snapshot: ThreadToolStateSnapshot,
): ThreadToolStateSnapshot {
  return {
    messages: [...snapshot.messages],
    streamText: snapshot.streamText,
    toolItems: [...snapshot.toolItems],
    thinking: snapshot.thinking,
    chatRunId: snapshot.chatRunId,
    thinkingLevel: snapshot.thinkingLevel,
  };
}
