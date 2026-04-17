import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ChatMessage, ToolItem } from "../lib/types.ts";
import {
  cloneThreadToolStateSnapshot,
  createEmptyThreadToolStateSnapshot,
  type ThreadToolStateSnapshot,
} from "../lib/thread-tool-state.ts";

type UseThreadToolControllerResult = {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  streamText: string | null;
  chatRunId: string | null;
  setChatRunId: Dispatch<SetStateAction<string | null>>;
  thinking: boolean;
  setThinking: Dispatch<SetStateAction<boolean>>;
  toolItems: ToolItem[];
  setToolItems: Dispatch<SetStateAction<ToolItem[]>>;
  thinkingLevel: string | null;
  setThinkingLevel: Dispatch<SetStateAction<string | null>>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  streamTextRef: MutableRefObject<string | null>;
  chatRunRef: MutableRefObject<string | null>;
  thinkingRef: MutableRefObject<boolean>;
  toolItemsRef: MutableRefObject<ToolItem[]>;
  thinkingLevelRef: MutableRefObject<string | null>;
  pendingStreamTextRef: MutableRefObject<string | null>;
  streamFlushRafRef: MutableRefObject<number | null>;
  setStreamTextSynced: (next: string | null) => void;
  mergeStreamTextSynced: (incoming: string, mergeText: (previous: string | null, incoming: string) => string) => void;
  clearActiveStreamingState: () => void;
  snapshotThreadToolState: () => ThreadToolStateSnapshot;
  applyThreadToolState: (next: ThreadToolStateSnapshot) => void;
  clearThreadToolState: () => void;
  disposeThreadToolController: () => void;
};

export function useThreadToolController(): UseThreadToolControllerResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [chatRunId, setChatRunId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [toolItems, setToolItems] = useState<ToolItem[]>([]);
  const [thinkingLevel, setThinkingLevel] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>(messages);
  const streamTextRef = useRef<string | null>(streamText);
  const chatRunRef = useRef<string | null>(chatRunId);
  const thinkingRef = useRef<boolean>(thinking);
  const toolItemsRef = useRef<ToolItem[]>(toolItems);
  const thinkingLevelRef = useRef<string | null>(thinkingLevel);
  const pendingStreamTextRef = useRef<string | null>(null);
  const streamFlushRafRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    streamTextRef.current = streamText;
  }, [streamText]);

  useEffect(() => {
    chatRunRef.current = chatRunId;
  }, [chatRunId]);

  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  useEffect(() => {
    toolItemsRef.current = toolItems;
  }, [toolItems]);

  useEffect(() => {
    thinkingLevelRef.current = thinkingLevel;
  }, [thinkingLevel]);

  const flushPendingStreamText = useCallback(() => {
    streamFlushRafRef.current = null;
    const next = pendingStreamTextRef.current;
    pendingStreamTextRef.current = null;
    if (next === streamTextRef.current) {
      return;
    }
    streamTextRef.current = next;
    setStreamText(next);
  }, []);

  const setStreamTextSynced = useCallback((next: string | null) => {
    pendingStreamTextRef.current = null;
    if (streamFlushRafRef.current !== null) {
      window.cancelAnimationFrame(streamFlushRafRef.current);
      streamFlushRafRef.current = null;
    }
    if (next === streamTextRef.current) {
      return;
    }
    streamTextRef.current = next;
    setStreamText(next);
  }, []);

  const mergeStreamTextSynced = useCallback((
    incoming: string,
    mergeText: (previous: string | null, incoming: string) => string,
  ) => {
    const current = pendingStreamTextRef.current ?? streamTextRef.current;
    pendingStreamTextRef.current = mergeText(current, incoming);
    if (streamFlushRafRef.current !== null) {
      return;
    }
    streamFlushRafRef.current = window.requestAnimationFrame(() => {
      flushPendingStreamText();
    });
  }, [flushPendingStreamText]);

  const clearActiveStreamingState = useCallback(() => {
    pendingStreamTextRef.current = null;
    if (streamFlushRafRef.current !== null) {
      window.cancelAnimationFrame(streamFlushRafRef.current);
      streamFlushRafRef.current = null;
    }
    streamTextRef.current = null;
    chatRunRef.current = null;
    thinkingRef.current = false;
    setStreamText(null);
    setChatRunId(null);
    setThinking(false);
  }, []);

  const snapshotThreadToolState = useCallback((): ThreadToolStateSnapshot => {
    return cloneThreadToolStateSnapshot({
      messages: messagesRef.current,
      streamText: streamTextRef.current,
      toolItems: toolItemsRef.current,
      thinking: thinkingRef.current,
      chatRunId: chatRunRef.current,
      thinkingLevel: thinkingLevelRef.current,
    });
  }, []);

  const applyThreadToolState = useCallback((next: ThreadToolStateSnapshot) => {
    const snapshot = cloneThreadToolStateSnapshot(next);
    messagesRef.current = snapshot.messages;
    toolItemsRef.current = snapshot.toolItems;
    thinkingLevelRef.current = snapshot.thinkingLevel;
    thinkingRef.current = snapshot.thinking;
    chatRunRef.current = snapshot.chatRunId;
    setMessages(snapshot.messages);
    setStreamTextSynced(snapshot.streamText);
    setToolItems(snapshot.toolItems);
    setThinking(snapshot.thinking);
    setChatRunId(snapshot.chatRunId);
    setThinkingLevel(snapshot.thinkingLevel);
  }, [setStreamTextSynced]);

  const clearThreadToolState = useCallback(() => {
    applyThreadToolState(createEmptyThreadToolStateSnapshot());
  }, [applyThreadToolState]);

  const disposeThreadToolController = useCallback(() => {
    pendingStreamTextRef.current = null;
    if (streamFlushRafRef.current !== null) {
      window.cancelAnimationFrame(streamFlushRafRef.current);
      streamFlushRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disposeThreadToolController();
    };
  }, [disposeThreadToolController]);

  return {
    messages,
    setMessages,
    streamText,
    chatRunId,
    setChatRunId,
    thinking,
    setThinking,
    toolItems,
    setToolItems,
    thinkingLevel,
    setThinkingLevel,
    messagesRef,
    streamTextRef,
    chatRunRef,
    thinkingRef,
    toolItemsRef,
    thinkingLevelRef,
    pendingStreamTextRef,
    streamFlushRafRef,
    setStreamTextSynced,
    mergeStreamTextSynced,
    clearActiveStreamingState,
    snapshotThreadToolState,
    applyThreadToolState,
    clearThreadToolState,
    disposeThreadToolController,
  };
}
