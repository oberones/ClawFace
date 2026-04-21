import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatView from "./components/ChatView.tsx";
import FileManager, { FileManagerProvider } from "./components/FileManager.tsx";
import MediaBrowser from "./components/media-browser/MediaBrowser.tsx";
import SessionSidebar from "./components/SessionSidebar.tsx";
import SettingsModal from "./components/SettingsModal.tsx";
import NewSessionModal from "./components/NewSessionModal.tsx";
import { GatewayClient } from "./lib/gateway.ts";
import {
  type AgentsListResult,
  type ApprovalDecision,
  type Attachment,
  type ChatMessage,
  type ConnectionState,
  type GatewayConfig,
  type GatewaySessionRow,
  type ModelsListResult,
  type PendingApproval,
  type SessionActivityState,
  type SessionPreviewItem,
  type SessionState,
  type SessionsListResult,
  type ToolItem,
} from "./lib/types.ts";
import { generateUUID } from "./lib/uuid.ts";
import { formatBytes, formatCompactTokens, slugify } from "./lib/format.ts";
import {
  DEFAULT_UI_SETTINGS,
  type ReplyDoneSoundSource,
  type ReplyDoneSoundTone,
  type UiSettings,
} from "./lib/ui-settings.ts";
import {
  normalizePathPrefixMappingsText,
  setActivePathPrefixMappingHomeDir,
  setActivePathPrefixMappingsText,
} from "./lib/path-prefix-mappings.ts";
import {
  decideFinalizedRunHydration,
  decideScheduledHistoryHydrationTick,
  runMayStillProduceMedia,
  toolMayProduceMedia,
} from "./lib/media-hydration.ts";
import {
  applyModelRuntimeOverride,
  applyThinkingRuntimeOverride,
  buildSessionRuntimePatchDecision,
} from "./lib/runtime-control-state.ts";
import { normalizeModelKey, normalizeThinkingValue } from "./lib/runtime-controls.ts";
import {
  resolveActiveFinalAssistantEvent,
  resolveFinalAssistantMessage,
} from "./lib/final-assistant-message.ts";
import { collectToolFinalMessages } from "./lib/tool-final-messages.ts";
import { createReplyDoneSoundPlayer } from "./lib/reply-done-sound.ts";
import { PAIRING_APPROVAL_COMMAND } from "./lib/connection-feedback.ts";
import {
  formatApprovalDecisionLabel,
  pickApprovalResolveMethod,
  removeResolvedApprovalBySession,
  upsertPendingApprovalBySession,
  type ApprovalResolution,
} from "./lib/approval-events.ts";
import {
  buildConnectionRecoveryNotice,
  buildInterruptedRunSessionBanner,
  buildInterruptedRunSnapshot,
  hasInterruptedRunResolved,
  shouldAnnounceConnectionRecovery,
  type ConnectionRecoveryNotice,
  type InterruptedRunSessionBanner,
  type InterruptedRunSnapshot,
} from "./lib/connection-recovery.ts";
import { deriveBackgroundSessionNotice } from "./lib/background-session-visibility.ts";
import { resolveEventSessionKey } from "./lib/session-run-routing.ts";
import { setImageSourceRuntimeHints } from "./lib/message-image-source.ts";
import { buildAttachmentSignature, toChatMessageSafe } from "./lib/chat-message-attachments.ts";
import { normalizeShellGatewayEvent } from "./lib/shell-gateway-events.ts";
import {
  extractGatewayStatusSnapshot,
  normalizeGatewayCloseState,
  normalizeGatewayHelloState,
} from "./lib/shell-gateway-state.ts";
import {
  mergeSessionRowsWithLocalState,
  normalizeAgentsListResult,
  normalizeModelsListResult,
  normalizeSessionsListResult,
  normalizeSessionsPreviewResult,
} from "./lib/shell-gateway-responses.ts";
import { normalizeShellGatewayHistory } from "./lib/shell-gateway-history.ts";
import {
  normalizeChatSendResult,
  normalizeSessionsResetResult,
} from "./lib/shell-gateway-mutations.ts";
import { buildMediaBrowserSourceData } from "./lib/media-browser-sources.ts";
import {
  normalizeShellGatewayConfigState,
  resolvePrimarySessionKey,
  resolveProviderApiKeyLabel,
  type GatewayConfigState,
} from "./lib/shell-gateway-config.ts";
import {
  attachLifecycleErrorToToolItems,
  collectReplyPayloadMediaUrls,
  hasReplyPayloadLikeContent,
  mergeAssistantReplyPayload,
  normalizeAgentEventPayload,
  normalizeChatEventPayload,
  type ToolUpdate,
} from "./lib/thread-tool-domain-events.ts";
import {
  createEmptyThreadToolStateSnapshot,
  type ThreadToolStateSnapshot,
} from "./lib/thread-tool-state.ts";
import { useDevicePairingController } from "./hooks/useDevicePairingController.ts";
import { useRemoteImageResolver } from "./hooks/useRemoteImageResolver.ts";
import { useStagedAttachments } from "./hooks/useStagedAttachments.ts";
import { useThreadToolEventController } from "./hooks/useThreadToolEventController.ts";
import { useThreadToolController } from "./hooks/useThreadToolController.ts";

const STORAGE_KEYS = {
  gatewayUrl: "clawui.gateway.url",
  token: "clawui.gateway.token",
  fsServerUrl: "clawui.fs.serverUrl",
  uiSettings: "clawui.ui.settings",
  uiSettingsSchemes: "clawui.ui.settings.schemes",
  activeUiSettingsScheme: "clawui.ui.settings.activeScheme",
  pathPrefixMappings: "clawui.path.prefixMappings",
  modelShortcutSchemes: "clawui.model.shortcuts",
  agentSessionShortcutSchemes: "clawui.agent.session.shortcuts",
  appActionShortcuts: "clawui.app.action.shortcuts",
  lastSession: "clawui.session.last",
  newSessionPreferredModel: "clawui.newSession.preferredModel",
};

const SESSION_LIST_INITIAL_LIMIT = 80;
const SESSION_LIST_STEP = 80;
const SESSION_LIST_MAX_LIMIT = 1000;
const SESSION_SEARCH_LIMIT = 200;
const SESSION_PREVIEW_BATCH_SIZE = 20;
const SESSION_PREVIEW_ITEM_LIMIT = 10;
const SESSION_PREVIEW_MAX_CHARS = 500;
const CHAT_HISTORY_INITIAL_LIMIT = 120;
const CHAT_HISTORY_STEP = 120;
const CHAT_HISTORY_MAX_LIMIT = 1000;
const DEFAULT_MAX_WS_PAYLOAD_BYTES = 512 * 1024;
const WS_PAYLOAD_SAFETY_BYTES = 8 * 1024;
const MIN_IMAGE_ATTACHMENT_BYTES = 48 * 1024;
const BUILTIN_UI_SETTINGS_SCHEME_ID = "default";
const MODEL_SHORTCUT_SLOT_MIN = 1;
const MODEL_SHORTCUT_SLOT_MAX = 5;
const MODEL_SHORTCUT_KEY_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
] as const;
const MAX_REPLY_DONE_CUSTOM_AUDIO_DATA_URL_CHARS = 900_000;
const WORKSPACE_MARKER = "/.openclaw/workspace";
const runtimePathHints: { homeDir: string; workspaceDir: string } = {
  homeDir: "",
  workspaceDir: "",
};

type UiSettingsScheme = {
  id: string;
  name: string;
  settings: UiSettings;
  updatedAt: number;
};

type AgentChoice = {
  id: string;
  label: string;
};

type ShortcutCombo = {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

type AppActionShortcutId = "toggleSidebar" | "newSession" | "toggleFiles";

type AppActionShortcut = {
  enabled: boolean;
  combo: ShortcutCombo;
};

type AppActionShortcutMap = Record<AppActionShortcutId, AppActionShortcut>;

type ModelShortcutScheme = {
  slot: number;
  combo: ShortcutCombo;
  model: string;
  thinkingLevel: string;
  updatedAt: number;
};

type ModelShortcutSchemeMap = Partial<Record<string, ModelShortcutScheme>>;

type AgentSessionShortcutScheme = {
  slot: number;
  combo: ShortcutCombo;
  agentId: string;
  agentLabel: string;
  updatedAt: number;
};

type AgentSessionShortcutSchemeMap = Partial<Record<string, AgentSessionShortcutScheme>>;

const AGENT_SESSION_SHORTCUT_SLOT_MIN = 1;
const AGENT_SESSION_SHORTCUT_SLOT_MAX = 5;
const APP_ACTION_SHORTCUT_IDS: AppActionShortcutId[] = ["toggleSidebar", "newSession", "toggleFiles"];

function getDefaultAgentSessionShortcutCombo(slot: number): ShortcutCombo {
  const normalizedSlot = Math.max(
    AGENT_SESSION_SHORTCUT_SLOT_MIN,
    Math.min(AGENT_SESSION_SHORTCUT_SLOT_MAX, slot),
  );
  return {
    meta: true,
    ctrl: false,
    alt: false,
    shift: true,
    key: String(normalizedSlot),
  };
}

function getDefaultAgentSessionShortcutKey(slot: number): string {
  const keys = ["q", "w", "e", "r", "t"];
  const normalizedSlot = Math.max(
    AGENT_SESSION_SHORTCUT_SLOT_MIN,
    Math.min(AGENT_SESSION_SHORTCUT_SLOT_MAX, slot),
  );
  return keys[normalizedSlot - 1] ?? "q";
}

function normalizeAgentSessionShortcutSlot(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < AGENT_SESSION_SHORTCUT_SLOT_MIN || value > AGENT_SESSION_SHORTCUT_SLOT_MAX) {
    return null;
  }
  return value;
}

function parseAgentSessionShortcutScheme(value: unknown): AgentSessionShortcutScheme | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const slot = normalizeAgentSessionShortcutSlot(row.slot);
  if (slot === null) {
    return null;
  }
  const agentId = typeof row.agentId === "string" ? row.agentId.trim() : "";
  if (!agentId) {
    return null;
  }
  const combo =
    normalizeShortcutCombo(row.combo) ??
    getDefaultAgentSessionShortcutCombo(slot);
  const agentLabel = typeof row.agentLabel === "string" ? row.agentLabel.trim() : agentId;
  const updatedAt =
    typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now();
  return {
    slot,
    combo,
    agentId,
    agentLabel,
    updatedAt,
  };
}

function normalizeAgentSessionShortcutSchemes(
  map: AgentSessionShortcutSchemeMap,
): AgentSessionShortcutSchemeMap {
  const sorted = Object.values(map)
    .filter((item): item is AgentSessionShortcutScheme => Boolean(item))
    .sort((a, b) => a.slot - b.slot);
  const usedSignatures = new Set<string>();
  const next: AgentSessionShortcutSchemeMap = {};
  for (const item of sorted) {
    const normalizedCombo =
      normalizeShortcutCombo(item.combo) ?? getDefaultAgentSessionShortcutCombo(item.slot);
    const signature = shortcutComboSignature(normalizedCombo);
    const combo = usedSignatures.has(signature)
      ? {
        ...getDefaultAgentSessionShortcutCombo(item.slot),
        key: getDefaultAgentSessionShortcutKey(item.slot),
      }
      : normalizedCombo;
    usedSignatures.add(shortcutComboSignature(combo));
    next[String(item.slot)] = {
      ...item,
      combo,
    };
  }
  return next;
}

function loadAgentSessionShortcutSchemes(): AgentSessionShortcutSchemeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.agentSessionShortcutSchemes);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    const next: AgentSessionShortcutSchemeMap = {};
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const normalized = parseAgentSessionShortcutScheme(item);
        if (!normalized) {
          continue;
        }
        next[String(normalized.slot)] = normalized;
      }
      return normalizeAgentSessionShortcutSchemes(next);
    }
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const normalized = parseAgentSessionShortcutScheme(value);
      if (!normalized) {
        continue;
      }
      next[String(normalized.slot)] = normalized;
    }
    return normalizeAgentSessionShortcutSchemes(next);
  } catch {
    return {};
  }
}

function saveAgentSessionShortcutSchemes(schemes: AgentSessionShortcutSchemeMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.agentSessionShortcutSchemes, JSON.stringify(schemes));
  } catch {
    // ignore
  }
}

function getDefaultGatewayUrl(): string {
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:18789";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}://${host}:18789`;
}

function normalizeGatewayUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  return trimmed;
}

const DEFAULT_GATEWAY_URL = getDefaultGatewayUrl();

function loadStored(key: string, fallback = ""): string {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function parseNumberSetting(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function parseColorSetting(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed);
  const isRgb = /^rgba?\(\s*[-\d.%\s,]+\)$/i.test(trimmed);
  const isHsl = /^hsla?\(\s*[-\d.%\s,]+\)$/i.test(trimmed);
  return isHex || isRgb || isHsl ? trimmed : fallback;
}

function parseReplyDoneSoundTone(
  value: unknown,
  fallback: ReplyDoneSoundTone,
): ReplyDoneSoundTone {
  if (value === "soft") {
    return "marimba";
  }
  if (value === "balanced") {
    return "glass";
  }
  if (value === "bright") {
    return "crystal";
  }
  return value === "glass" ||
    value === "marimba" ||
    value === "bell" ||
    value === "crystal" ||
    value === "harp" ||
    value === "wood" ||
    value === "synth" ||
    value === "orb"
    ? value
    : fallback;
}

function parseReplyDoneSoundSource(
  value: unknown,
  fallback: ReplyDoneSoundSource,
): ReplyDoneSoundSource {
  return value === "custom" || value === "tone" ? value : fallback;
}

function parseReplyDoneSoundCustomAudioDataUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REPLY_DONE_CUSTOM_AUDIO_DATA_URL_CHARS) {
    return "";
  }
  if (!trimmed.startsWith("data:audio/")) {
    return "";
  }
  if (!trimmed.includes(";base64,")) {
    return "";
  }
  return trimmed;
}

function parseReplyDoneSoundCustomAudioName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 120);
}

function formatSessionTimeLabel(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function resolveSessionLabel(label: string): string {
  return label.trim();
}

function parseUiSettings(value: unknown): UiSettings {
  const parsed = value && typeof value === "object" ? (value as Partial<UiSettings>) : {};
  return {
    fontFamily: typeof parsed.fontFamily === "string" && parsed.fontFamily.trim()
      ? parsed.fontFamily.trim()
      : DEFAULT_UI_SETTINGS.fontFamily,
    fontSize: parseNumberSetting(parsed.fontSize, DEFAULT_UI_SETTINGS.fontSize, 10, 32),
    lineHeight: parseNumberSetting(parsed.lineHeight, DEFAULT_UI_SETTINGS.lineHeight, 1.1, 2.8),
    contentWidth: parseNumberSetting(
      parsed.contentWidth,
      DEFAULT_UI_SETTINGS.contentWidth,
      420,
      1400,
    ),
    sidebarFontSize: parseNumberSetting(
      parsed.sidebarFontSize,
      DEFAULT_UI_SETTINGS.sidebarFontSize,
      10,
      18,
    ),
    sidebarWidth: parseNumberSetting(
      parsed.sidebarWidth,
      DEFAULT_UI_SETTINGS.sidebarWidth,
      220,
      420,
    ),
    modelBadgeScale: parseNumberSetting(
      parsed.modelBadgeScale,
      DEFAULT_UI_SETTINGS.modelBadgeScale,
      0.8,
      1.8,
    ),
    composerActionScale: parseNumberSetting(
      parsed.composerActionScale,
      DEFAULT_UI_SETTINGS.composerActionScale,
      0.8,
      1.8,
    ),
    footerStatsFontSize: parseNumberSetting(
      parsed.footerStatsFontSize,
      DEFAULT_UI_SETTINGS.footerStatsFontSize,
      10,
      18,
    ),
    autoScrollAssistantResponses:
      typeof parsed.autoScrollAssistantResponses === "boolean"
        ? parsed.autoScrollAssistantResponses
        : DEFAULT_UI_SETTINGS.autoScrollAssistantResponses,
    showMessageTimestamp:
      typeof parsed.showMessageTimestamp === "boolean"
        ? parsed.showMessageTimestamp
        : DEFAULT_UI_SETTINGS.showMessageTimestamp,
    messageTimestampFontSize: parseNumberSetting(
      parsed.messageTimestampFontSize,
      DEFAULT_UI_SETTINGS.messageTimestampFontSize,
      9,
      18,
    ),
    playReplyDoneSound:
      typeof parsed.playReplyDoneSound === "boolean"
        ? parsed.playReplyDoneSound
        : DEFAULT_UI_SETTINGS.playReplyDoneSound,
    playReplyDoneSoundVolume: parseNumberSetting(
      parsed.playReplyDoneSoundVolume,
      DEFAULT_UI_SETTINGS.playReplyDoneSoundVolume,
      0,
      100,
    ),
    playReplyDoneSoundTone: parseReplyDoneSoundTone(
      parsed.playReplyDoneSoundTone,
      DEFAULT_UI_SETTINGS.playReplyDoneSoundTone,
    ),
    playReplyDoneSoundSource: parseReplyDoneSoundSource(
      parsed.playReplyDoneSoundSource,
      DEFAULT_UI_SETTINGS.playReplyDoneSoundSource,
    ),
    playReplyDoneSoundCustomAudioDataUrl: parseReplyDoneSoundCustomAudioDataUrl(
      parsed.playReplyDoneSoundCustomAudioDataUrl,
    ),
    playReplyDoneSoundCustomAudioName: parseReplyDoneSoundCustomAudioName(
      parsed.playReplyDoneSoundCustomAudioName,
    ),
    showToolActivity:
      typeof parsed.showToolActivity === "boolean"
        ? parsed.showToolActivity
        : DEFAULT_UI_SETTINGS.showToolActivity,
    toolCallFontSize: parseNumberSetting(
      parsed.toolCallFontSize,
      DEFAULT_UI_SETTINGS.toolCallFontSize,
      10,
      18,
    ),
    chatBubbleRadius: parseNumberSetting(
      parsed.chatBubbleRadius,
      DEFAULT_UI_SETTINGS.chatBubbleRadius,
      10,
      28,
    ),
    messageGap: parseNumberSetting(
      parsed.messageGap,
      DEFAULT_UI_SETTINGS.messageGap,
      8,
      30,
    ),
    panelOpacity: parseNumberSetting(
      parsed.panelOpacity,
      DEFAULT_UI_SETTINGS.panelOpacity,
      75,
      100,
    ),
    backgroundPatternStrength: parseNumberSetting(
      parsed.backgroundPatternStrength,
      DEFAULT_UI_SETTINGS.backgroundPatternStrength,
      0,
      100,
    ),
    accentColor: parseColorSetting(parsed.accentColor, DEFAULT_UI_SETTINGS.accentColor),
    accentSoftColor: parseColorSetting(parsed.accentSoftColor, DEFAULT_UI_SETTINGS.accentSoftColor),
    userBubbleColor: parseColorSetting(parsed.userBubbleColor, DEFAULT_UI_SETTINGS.userBubbleColor),
    assistantBubbleColor: parseColorSetting(
      parsed.assistantBubbleColor,
      DEFAULT_UI_SETTINGS.assistantBubbleColor,
    ),
    markdownHeadingColor: parseColorSetting(
      parsed.markdownHeadingColor,
      DEFAULT_UI_SETTINGS.markdownHeadingColor,
    ),
    markdownLinkColor: parseColorSetting(
      parsed.markdownLinkColor,
      DEFAULT_UI_SETTINGS.markdownLinkColor,
    ),
    markdownBoldColor: parseColorSetting(
      parsed.markdownBoldColor,
      DEFAULT_UI_SETTINGS.markdownBoldColor,
    ),
    markdownItalicColor: parseColorSetting(
      parsed.markdownItalicColor,
      DEFAULT_UI_SETTINGS.markdownItalicColor,
    ),
    markdownCodeBg: parseColorSetting(parsed.markdownCodeBg, DEFAULT_UI_SETTINGS.markdownCodeBg),
    markdownCodeText: parseColorSetting(parsed.markdownCodeText, DEFAULT_UI_SETTINGS.markdownCodeText),
    markdownQuoteBg: parseColorSetting(parsed.markdownQuoteBg, DEFAULT_UI_SETTINGS.markdownQuoteBg),
    markdownQuoteBorderColor: parseColorSetting(
      parsed.markdownQuoteBorderColor,
      DEFAULT_UI_SETTINGS.markdownQuoteBorderColor,
    ),
    enableAnimations:
      typeof parsed.enableAnimations === "boolean"
        ? parsed.enableAnimations
        : DEFAULT_UI_SETTINGS.enableAnimations,
    sessionIndicatorWidth: Math.max(
      1,
      Math.min(
        10,
        typeof parsed.sessionIndicatorWidth === "number"
          ? parsed.sessionIndicatorWidth
          : DEFAULT_UI_SETTINGS.sessionIndicatorWidth,
      ),
    ),
    autoHoverSidebar:
      typeof parsed.autoHoverSidebar === "boolean"
        ? parsed.autoHoverSidebar
        : DEFAULT_UI_SETTINGS.autoHoverSidebar,
  };
}

function loadUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.uiSettings);
    if (!raw) {
      return { ...DEFAULT_UI_SETTINGS };
    }
    return parseUiSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

function saveUiSettings(settings: UiSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.uiSettings, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function loadPathPrefixMappingsText(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pathPrefixMappings);
    if (!raw) {
      return "";
    }
    return normalizePathPrefixMappingsText(raw);
  } catch {
    return "";
  }
}

function savePathPrefixMappingsText(text: string) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.pathPrefixMappings,
      normalizePathPrefixMappingsText(text),
    );
  } catch {
    // ignore
  }
}

function normalizeUiSettingsSchemeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 42);
}

function loadUiSettingsSchemes(): UiSettingsScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.uiSettingsSchemes);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seenIds = new Set<string>();
    const schemes: UiSettingsScheme[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? normalizeUiSettingsSchemeName(row.name) : "";
      if (!id || !name || id === BUILTIN_UI_SETTINGS_SCHEME_ID || seenIds.has(id)) {
        continue;
      }
      const updatedAt = typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt)
        ? row.updatedAt
        : Date.now();
      schemes.push({
        id,
        name,
        settings: parseUiSettings(row.settings),
        updatedAt,
      });
      seenIds.add(id);
    }
    return schemes.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function saveUiSettingsSchemes(schemes: UiSettingsScheme[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.uiSettingsSchemes, JSON.stringify(schemes));
  } catch {
    // ignore
  }
}

function normalizeShortcutSlot(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < MODEL_SHORTCUT_SLOT_MIN || value > MODEL_SHORTCUT_SLOT_MAX) {
    return null;
  }
  return value;
}

function normalizeShortcutKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function getDefaultShortcutCombo(slot: number): ShortcutCombo {
  const normalizedSlot = Math.max(MODEL_SHORTCUT_SLOT_MIN, Math.min(MODEL_SHORTCUT_SLOT_MAX, slot));
  return {
    meta: true,
    ctrl: false,
    alt: false,
    shift: false,
    key: String(normalizedSlot),
  };
}

function normalizeShortcutCombo(value: unknown): ShortcutCombo | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const key = normalizeShortcutKey(row.key);
  if (!key) {
    return null;
  }
  return {
    meta: row.meta === true,
    ctrl: row.ctrl === true,
    alt: row.alt === true,
    shift: row.shift === true,
    key,
  };
}

function getDefaultAppActionShortcutCombo(id: AppActionShortcutId): ShortcutCombo {
  if (id === "toggleSidebar") {
    return {
      meta: true,
      ctrl: false,
      alt: false,
      shift: false,
      key: "d",
    };
  }
  if (id === "toggleFiles") {
    return {
      meta: true,
      ctrl: false,
      alt: false,
      shift: true,
      key: "f",
    };
  }
  return {
    meta: true,
    ctrl: false,
    alt: false,
    shift: false,
    key: "e",
  };
}

function getDefaultAppActionShortcut(id: AppActionShortcutId): AppActionShortcut {
  return {
    enabled: true,
    combo: getDefaultAppActionShortcutCombo(id),
  };
}

function parseAppActionShortcut(id: AppActionShortcutId, value: unknown): AppActionShortcut {
  const fallback = getDefaultAppActionShortcut(id);
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const row = value as Record<string, unknown>;
  const combo =
    normalizeShortcutCombo(row.combo) ??
    normalizeShortcutCombo(row) ??
    fallback.combo;
  const enabled = typeof row.enabled === "boolean" ? row.enabled : fallback.enabled;
  return {
    enabled,
    combo,
  };
}

function loadAppActionShortcuts(): AppActionShortcutMap {
  const defaults: AppActionShortcutMap = {
    toggleSidebar: getDefaultAppActionShortcut("toggleSidebar"),
    newSession: getDefaultAppActionShortcut("newSession"),
    toggleFiles: getDefaultAppActionShortcut("toggleFiles"),
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.appActionShortcuts);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }
    const row = parsed as Record<string, unknown>;
    const next: AppActionShortcutMap = { ...defaults };
    for (const id of APP_ACTION_SHORTCUT_IDS) {
      next[id] = parseAppActionShortcut(id, row[id]);
    }
    return next;
  } catch {
    return defaults;
  }
}

function saveAppActionShortcuts(shortcuts: AppActionShortcutMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.appActionShortcuts, JSON.stringify(shortcuts));
  } catch {
    // ignore
  }
}

function shortcutComboSignature(combo: ShortcutCombo): string {
  return [
    combo.meta ? "1" : "0",
    combo.ctrl ? "1" : "0",
    combo.alt ? "1" : "0",
    combo.shift ? "1" : "0",
    combo.key,
  ].join(":");
}

function findUnusedShortcutCombo(usedSignatures: Set<string>, preferredSlot: number): ShortcutCombo {
  const preferred = getDefaultShortcutCombo(preferredSlot);
  if (!usedSignatures.has(shortcutComboSignature(preferred))) {
    return preferred;
  }
  for (const key of MODEL_SHORTCUT_KEY_OPTIONS) {
    const candidate: ShortcutCombo = {
      meta: true,
      ctrl: false,
      alt: false,
      shift: false,
      key,
    };
    if (!usedSignatures.has(shortcutComboSignature(candidate))) {
      return candidate;
    }
  }
  return preferred;
}

function parseLegacyShortcutCombo(row: Record<string, unknown>, slot: number): ShortcutCombo | null {
  const shortcutKeyString = normalizeShortcutKey(
    typeof row.shortcutKey === "string" ? row.shortcutKey : "",
  );
  if (shortcutKeyString) {
    return {
      ...getDefaultShortcutCombo(slot),
      key: shortcutKeyString,
    };
  }
  const shortcutKeyNumber =
    typeof row.shortcutKey === "number" && Number.isInteger(row.shortcutKey) ? row.shortcutKey : null;
  if (shortcutKeyNumber !== null && shortcutKeyNumber >= 0 && shortcutKeyNumber <= 9) {
    return {
      ...getDefaultShortcutCombo(slot),
      key: String(shortcutKeyNumber),
    };
  }
  const functionKeyRaw = typeof row.functionKey === "string" ? row.functionKey.trim().toUpperCase() : "";
  const functionKeyMatch = /^F(\d{1,2})$/.exec(functionKeyRaw);
  if (functionKeyMatch) {
    const functionIndex = Number(functionKeyMatch[1]);
    const mappedDigit = functionIndex === 10 ? "0" : functionIndex >= 1 && functionIndex <= 9 ? String(functionIndex) : null;
    if (mappedDigit) {
      return {
        ...getDefaultShortcutCombo(slot),
        key: mappedDigit,
      };
    }
  }
  return null;
}

function parseModelShortcutScheme(value: unknown): ModelShortcutScheme | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const slot = normalizeShortcutSlot(row.slot);
  if (slot === null) {
    return null;
  }
  const model = typeof row.model === "string" ? row.model.trim() : "";
  if (!model) {
    return null;
  }
  const combo =
    normalizeShortcutCombo(row.combo) ??
    normalizeShortcutCombo(row) ??
    parseLegacyShortcutCombo(row, slot) ??
    getDefaultShortcutCombo(slot);
  const thinkingLevel = normalizeThinkingValue(
    typeof row.thinkingLevel === "string" ? row.thinkingLevel : null,
  );
  const updatedAt =
    typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now();
  return {
    slot,
    combo,
    model,
    thinkingLevel,
    updatedAt,
  };
}

function normalizeModelShortcutSchemes(map: ModelShortcutSchemeMap): ModelShortcutSchemeMap {
  const sorted = Object.values(map)
    .filter((item): item is ModelShortcutScheme => Boolean(item))
    .sort((a, b) => a.slot - b.slot);
  const usedSignatures = new Set<string>();
  const next: ModelShortcutSchemeMap = {};
  for (const item of sorted) {
    const normalizedCombo = normalizeShortcutCombo(item.combo) ?? getDefaultShortcutCombo(item.slot);
    const signature = shortcutComboSignature(normalizedCombo);
    const combo = usedSignatures.has(signature)
      ? findUnusedShortcutCombo(usedSignatures, item.slot)
      : normalizedCombo;
    usedSignatures.add(shortcutComboSignature(combo));
    next[String(item.slot)] = {
      ...item,
      combo,
    };
  }
  return next;
}

function loadModelShortcutSchemes(): ModelShortcutSchemeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.modelShortcutSchemes);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    const next: ModelShortcutSchemeMap = {};
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const normalized = parseModelShortcutScheme(item);
        if (!normalized) {
          continue;
        }
        next[String(normalized.slot)] = normalized;
      }
      return normalizeModelShortcutSchemes(next);
    }
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const normalized = parseModelShortcutScheme(value);
      if (!normalized) {
        continue;
      }
      next[String(normalized.slot)] = normalized;
    }
    return normalizeModelShortcutSchemes(next);
  } catch {
    return {};
  }
}

function saveModelShortcutSchemes(schemes: ModelShortcutSchemeMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.modelShortcutSchemes, JSON.stringify(schemes));
  } catch {
    // ignore
  }
}

function shortcutKeyFromKeyboardEvent(event: KeyboardEvent): string | null {
  const code = event.code.trim();
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }
  return normalizeShortcutKey(event.key);
}

function isShortcutComboEventMatch(combo: ShortcutCombo, event: KeyboardEvent): boolean {
  const key = shortcutKeyFromKeyboardEvent(event);
  if (!key || key !== combo.key) {
    return false;
  }
  return (
    event.metaKey === combo.meta &&
    event.ctrlKey === combo.ctrl &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift
  );
}

function resolveShortcutLabel(combo: ShortcutCombo): string {
  const parts: string[] = [];
  if (combo.meta) {
    parts.push("Cmd");
  }
  if (combo.ctrl) {
    parts.push("Control");
  }
  if (combo.alt) {
    parts.push("Option");
  }
  if (combo.shift) {
    parts.push("Shift");
  }
  parts.push(combo.key.toUpperCase());
  return parts.join("+");
}

type OutgoingGatewayAttachment = {
  type: "image" | "file";
  mimeType: string;
  fileName: string;
  content: string;
};

function extractBase64Content(dataUrl: string): string {
  const match = /^data:[^;]+;base64,(.*)$/i.exec(dataUrl.trim());
  return match?.[1]?.trim() ?? "";
}

function estimateBase64Bytes(base64: string): number {
  const trimmed = base64.trim();
  if (!trimmed) {
    return 0;
  }
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

function estimateChatSendFrameBytes(params: {
  sessionKey: string;
  message: string;
  deliver: boolean;
  idempotencyKey: string;
  attachments?: OutgoingGatewayAttachment[];
}): number {
  const frame = { type: "req", id: "frame-size-estimate", method: "chat.send", params };
  return new TextEncoder().encode(JSON.stringify(frame)).length;
}

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
  "application/x-sh",
  "application/x-python",
  "application/sql",
  "application/graphql",
  "application/ld+json",
];

const TEXT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "jsonl", "json5", "csv", "tsv",
  "xml", "html", "htm", "svg", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "c", "h", "cpp", "hpp", "cs",
  "sh", "bash", "zsh", "fish", "bat", "ps1", "cmd",
  "sql", "graphql", "gql",
  "css", "scss", "sass", "less",
  "vue", "svelte", "astro",
  "env", "gitignore", "dockerignore", "editorconfig",
  "log", "diff", "patch",
  "tex", "bib", "rst", "adoc",
]);

function isTextMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return TEXT_MIME_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function isTextFile(attachment: Attachment): boolean {
  if (isTextMime(attachment.type)) {
    return true;
  }
  const ext = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function decodeBase64Content(dataUrl: string): string {
  const b64 = extractBase64Content(dataUrl);
  if (!b64) {
    return "";
  }
  try {
    return atob(b64);
  } catch {
    return "";
  }
}

const MAX_EMBEDDED_FILE_CHARS = 100_000;

function buildFileFallbackText(attachments: Attachment[]): string | null {
  // Only inline text files; binary files (PDF etc.) are sent as real attachments
  const textFiles = attachments.filter((item) => !item.isImage && isTextFile(item));
  if (textFiles.length === 0) {
    return null;
  }

  const parts: string[] = [];
  for (const file of textFiles) {
    let text = decodeBase64Content(file.dataUrl);
    if (text.length > MAX_EMBEDDED_FILE_CHARS) {
      text = text.slice(0, MAX_EMBEDDED_FILE_CHARS) + "\n...(truncated)";
    }
    if (text) {
      parts.push(`<file name="${file.name}">\n${text}\n</file>`);
    } else {
      parts.push(`[Attached file: ${file.name} (could not decode)]`);
    }
  }

  return parts.join("\n\n");
}

/* ── PDF attachment upload (follows Telegram's saveMediaBuffer pattern) ──── */

const PDF_MEDIA_DIR = "/__claw/fs";
const PDF_INBOUND_DIR_HINT = ".openclaw/media/inbound";

function isPdfAttachment(att: Attachment): boolean {
  if (att.type === "application/pdf") return true;
  const ext = att.name.split(".").pop()?.toLowerCase();
  return ext === "pdf";
}

/**
 * Sanitize filename for cross-platform safety.
 * Mirrors openclaw's sanitizeFilename: keeps alphanumeric, dots, hyphens,
 * underscores, Unicode letters/numbers.
 */
function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

/**
 * Upload a PDF attachment to ~/.openclaw/media/inbound/ via the FS API.
 * Returns the saved file path on disk.
 * Naming convention follows Telegram: {sanitizedName}---{uuid}.pdf
 */
async function uploadPdfToMediaInbound(attachment: Attachment): Promise<string> {
  // Resolve the inbound directory path
  const homeDir = await resolveHomeDir();
  const inboundDir = `${homeDir}/${PDF_INBOUND_DIR_HINT}`;

  // Ensure the directory exists
  await fetch(`${PDF_MEDIA_DIR}/mkdir?path=${encodeURIComponent(inboundDir)}`, {
    method: "POST",
  });

  // Build filename: {sanitized}---{uuid}.pdf
  const baseName = attachment.name.replace(/\.pdf$/i, "");
  const sanitized = sanitizeFilename(baseName);
  const uuid = generateUUID();
  const fileName = sanitized
    ? `${sanitized}---${uuid}.pdf`
    : `${uuid}.pdf`;

  // Decode base64 to binary
  const base64 = extractBase64Content(attachment.dataUrl);
  if (!base64) {
    throw new Error(`PDF attachment "${attachment.name}" has no content`);
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });

  // Upload via FormData
  const formData = new FormData();
  formData.append("files", blob, fileName);
  const res = await fetch(
    `${PDF_MEDIA_DIR}/upload?path=${encodeURIComponent(inboundDir)}`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PDF upload failed (${res.status}): ${body}`);
  }
  const result = await res.json() as { uploaded?: string[] };
  const savedPath = result.uploaded?.[0];
  if (!savedPath) {
    throw new Error("PDF upload returned no path");
  }
  return savedPath;
}

/** Resolve home directory from FS roots config. */
let _cachedHomeDir: string | null = null;
async function resolveHomeDir(): Promise<string> {
  if (_cachedHomeDir) return _cachedHomeDir;
  try {
    const res = await fetch(`${PDF_MEDIA_DIR}/roots`);
    if (res.ok) {
      const data = await res.json() as { roots: { label: string; path: string }[] };
      // Look for a root that contains .openclaw
      for (const root of data.roots) {
        if (root.path.includes("/.openclaw/") || root.path.endsWith("/.openclaw")) {
          const home = root.path.replace(/\/\.openclaw.*$/, "");
          _cachedHomeDir = home;
          return home;
        }
      }
      // Fallback: try Home root
      const homeRoot = data.roots.find((r) => r.label === "Home");
      if (homeRoot) {
        _cachedHomeDir = homeRoot.path;
        return homeRoot.path;
      }
      // Last fallback: derive from any root with .openclaw pattern
      for (const root of data.roots) {
        const match = root.path.match(/^(\/home\/[^/]+|\/root|\/Users\/[^/]+)/);
        if (match) {
          _cachedHomeDir = match[1];
          return match[1];
        }
      }
    }
  } catch {
    // ignore
  }
  // Absolute fallback
  _cachedHomeDir = "/home/" + (typeof window !== "undefined" ? "user" : "user");
  return _cachedHomeDir;
}

type PdfUploadResult = {
  attachment: Attachment;
  savedPath: string;
};

/**
 * Upload all PDF attachments and build <file> reference blocks.
 * Returns the file blocks text and the list of attachment IDs that were processed.
 */
async function uploadPdfsAndBuildBlocks(
  attachments: Attachment[],
): Promise<{ pdfBlocks: string | null; uploadedIds: Set<string> }> {
  const pdfs = attachments.filter((att) => !att.isImage && isPdfAttachment(att));
  if (pdfs.length === 0) {
    return { pdfBlocks: null, uploadedIds: new Set() };
  }

  const results: PdfUploadResult[] = [];
  const uploadedIds = new Set<string>();

  for (const pdf of pdfs) {
    try {
      const savedPath = await uploadPdfToMediaInbound(pdf);
      results.push({ attachment: pdf, savedPath });
      uploadedIds.add(pdf.id);
    } catch (err) {
      console.warn(`Failed to upload PDF "${pdf.name}":`, err);
      // Fall through — this PDF won't get a file block
    }
  }

  if (results.length === 0) {
    return { pdfBlocks: null, uploadedIds: new Set() };
  }

  const blocks = results.map(({ attachment, savedPath }) => {
    const sizeStr = formatBytes(attachment.size);
    return `<file name="${attachment.name}" mime="application/pdf" path="${savedPath}">\n[PDF document – ${sizeStr} – saved to ${savedPath}]\n</file>`;
  });

  return { pdfBlocks: blocks.join("\n\n"), uploadedIds };
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = dataUrl;
  });
}

async function compressImageAttachment(
  attachment: Attachment,
  targetBytes: number,
): Promise<Attachment | null> {
  if (!attachment.isImage) {
    return null;
  }
  const sourceBase64 = extractBase64Content(attachment.dataUrl);
  const sourceBytes = estimateBase64Bytes(sourceBase64);
  if (sourceBytes <= 0 || sourceBytes <= targetBytes) {
    return attachment;
  }
  let image: HTMLImageElement;
  try {
    image = await loadImageElement(attachment.dataUrl);
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const maxDimension = 2200;
  const initialScale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const attempts = [
    { scale: initialScale, quality: 0.85 },
    { scale: initialScale * 0.92, quality: 0.78 },
    { scale: initialScale * 0.82, quality: 0.7 },
    { scale: initialScale * 0.72, quality: 0.62 },
    { scale: initialScale * 0.62, quality: 0.55 },
    { scale: initialScale * 0.54, quality: 0.5 },
    { scale: initialScale * 0.46, quality: 0.45 },
  ];

  let best: Attachment | null = null;
  let bestBytes = sourceBytes;
  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(image.naturalWidth * attempt.scale));
    const height = Math.max(1, Math.round(image.naturalHeight * attempt.scale));
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const nextDataUrl = canvas.toDataURL("image/jpeg", attempt.quality);
    const nextBase64 = extractBase64Content(nextDataUrl);
    const nextBytes = estimateBase64Bytes(nextBase64);
    if (nextBytes <= 0) {
      continue;
    }
    if (nextBytes < bestBytes) {
      bestBytes = nextBytes;
      best = {
        ...attachment,
        type: "image/jpeg",
        dataUrl: nextDataUrl,
        size: nextBytes,
      };
    }
    if (nextBytes <= targetBytes) {
      return {
        ...attachment,
        type: "image/jpeg",
        dataUrl: nextDataUrl,
        size: nextBytes,
      };
    }
  }
  return best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function getNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNumberLike(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toFiniteNumber(source[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

type SessionTokenStats = {
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type SessionViewState = ThreadToolStateSnapshot & {
  draft: string;
  attachments: Attachment[];
  lastLoadedAt: number;
};

function extractSessionTokenStatsFromMessage(message: unknown): Partial<SessionTokenStats> | null {
  if (!isRecord(message)) {
    return null;
  }
  const readRecord = (path: string[]): Record<string, unknown> | null => {
    const value = getNested(message, path);
    return isRecord(value) ? value : null;
  };
  const usageRecord = isRecord(message.usage) ? message.usage : null;
  const tokenUsageRecord = isRecord(message.tokenUsage) ? message.tokenUsage : null;
  const responseUsageRecord = isRecord(message.responseUsage) ? message.responseUsage : null;
  const statsRecord = isRecord(message.stats) ? message.stats : null;
  const dataRecord = isRecord(message.data) ? message.data : null;
  const payloadRecord = isRecord(message.payload) ? message.payload : null;
  const resultRecord = isRecord(message.result) ? message.result : null;
  const dataUsageRecord = readRecord(["data", "usage"]);
  const dataTokenUsageRecord = readRecord(["data", "tokenUsage"]);
  const dataResponseUsageRecord = readRecord(["data", "responseUsage"]);
  const dataStatsRecord = readRecord(["data", "stats"]);
  const payloadUsageRecord = readRecord(["payload", "usage"]);
  const payloadTokenUsageRecord = readRecord(["payload", "tokenUsage"]);
  const payloadResponseUsageRecord = readRecord(["payload", "responseUsage"]);
  const payloadStatsRecord = readRecord(["payload", "stats"]);
  const resultUsageRecord = readRecord(["result", "usage"]);
  const resultTokenUsageRecord = readRecord(["result", "tokenUsage"]);
  const resultResponseUsageRecord = readRecord(["result", "responseUsage"]);
  const resultStatsRecord = readRecord(["result", "stats"]);
  const metadataUsage = getNested(message, ["metadata", "usage"]);
  const metadataUsageRecord = isRecord(metadataUsage) ? metadataUsage : null;
  const metaUsage = getNested(message, ["meta", "usage"]);
  const metaUsageRecord = isRecord(metaUsage) ? metaUsage : null;
  const sources = [
    message,
    dataRecord,
    payloadRecord,
    resultRecord,
    usageRecord,
    tokenUsageRecord,
    responseUsageRecord,
    statsRecord,
    dataUsageRecord,
    dataTokenUsageRecord,
    dataResponseUsageRecord,
    dataStatsRecord,
    payloadUsageRecord,
    payloadTokenUsageRecord,
    payloadResponseUsageRecord,
    payloadStatsRecord,
    resultUsageRecord,
    resultTokenUsageRecord,
    resultResponseUsageRecord,
    resultStatsRecord,
    metadataUsageRecord,
    metaUsageRecord,
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  const read = (keys: string[]): number | null => {
    for (const source of sources) {
      const value = getNumberLike(source, keys);
      if (value !== null) {
        return value;
      }
    }
    return null;
  };

  const inputTokens = read([
    "inputTokens",
    "input_tokens",
    "promptTokens",
    "prompt_tokens",
    "promptTokenCount",
    "requestTokens",
    "request_tokens",
  ]);
  const outputTokens = read([
    "outputTokens",
    "output_tokens",
    "completionTokens",
    "completion_tokens",
    "completionTokenCount",
    "responseTokens",
    "response_tokens",
  ]);
  const totalTokensRaw = read([
    "totalTokens",
    "total_tokens",
    "allTokens",
    "all_tokens",
    "tokenCount",
  ]);
  const contextTokens = read([
    "contextTokens",
    "context_tokens",
    "contextWindow",
    "context_window",
    "contextLimit",
    "context_limit",
    "maxContextTokens",
    "max_context_tokens",
  ]);
  const totalTokens =
    totalTokensRaw ??
    (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);

  const patch: Partial<SessionTokenStats> = {};
  if (contextTokens !== null) {
    patch.contextTokens = contextTokens;
  }
  if (inputTokens !== null) {
    patch.inputTokens = inputTokens;
  }
  if (outputTokens !== null) {
    patch.outputTokens = outputTokens;
  }
  if (totalTokens !== null) {
    patch.totalTokens = totalTokens;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function isEventVariant(eventName: string, root: string): boolean {
  const name = eventName.trim().toLowerCase();
  if (!name) {
    return false;
  }
  return (
    name === root ||
    name.startsWith(`${root}.`) ||
    name.startsWith(`${root}:`) ||
    name.startsWith(`${root}/`)
  );
}

function getNested(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function formatAgeFromTimestamp(updatedAt: number | null | undefined): string {
  if (!Number.isFinite(updatedAt)) {
    return "unknown";
  }
  const delta = Math.max(0, Date.now() - (updatedAt as number));
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function clearOverride<T extends string>(
  map: Record<string, T>,
  key: string,
): Record<string, T> {
  if (!(key in map)) {
    return map;
  }
  const next = { ...map };
  delete next[key];
  return next;
}

function resolveCanonicalModelFromCatalog(
  value: string | null | undefined,
  catalog: ModelsListResult["models"],
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "";
  }
  const exact =
    catalog.find((entry) => `${entry.provider}/${entry.id}` === normalized) ??
    catalog.find((entry) => entry.id === normalized) ??
    catalog.find((entry) => `${entry.provider}/${entry.name}` === normalized) ??
    catalog.find((entry) => entry.name === normalized) ??
    null;
  if (!exact) {
    return normalized;
  }
  return `${exact.provider}/${exact.id}`;
}

function resolveMainSessionFallback(agents: AgentsListResult | null): string {
  if (agents?.scope === "global") {
    return "global";
  }
  const agentId = (agents?.defaultId ?? "main").trim().toLowerCase() || "main";
  const mainKey = (agents?.mainKey ?? "main").trim().toLowerCase() || "main";
  return `agent:${agentId}:${mainKey}`;
}

function reconcileSelectedSessionKey(params: {
  previousKey: string | null;
  sessions: GatewaySessionRow[];
  primarySessionKey: string;
}): string | null {
  const { previousKey, sessions, primarySessionKey } = params;
  if (sessions.length === 0) {
    return previousKey;
  }
  if (!previousKey) {
    return sessions[0]!.key;
  }
  const exactMatch = sessions.find((session) => session.key === previousKey);
  if (exactMatch) {
    return exactMatch.key;
  }
  const normalizedPreviousKey = previousKey.toLowerCase();
  const normalizedMatch = sessions.find(
    (session) => session.key.toLowerCase() === normalizedPreviousKey,
  );
  if (normalizedMatch) {
    return normalizedMatch.key;
  }
  const compatibleMatch = sessions.find((session) => sessionKeysMatch(session.key, previousKey));
  if (compatibleMatch) {
    return compatibleMatch.key;
  }
  const primaryMatch = sessions.find(
    (session) => session.key.toLowerCase() === primarySessionKey,
  );
  if (primaryMatch) {
    return primaryMatch.key;
  }
  return sessions[0]!.key;
}

function filterConfiguredModels(
  catalog: ModelsListResult["models"],
  configuredKeys: Set<string>,
): ModelsListResult["models"] {
  if (configuredKeys.size === 0) {
    return catalog.filter((model) => model.available === true);
  }
  return catalog.filter((model) => {
    const full = normalizeModelKey(`${model.provider}/${model.id}`);
    const idOnly = normalizeModelKey(model.id);
    return configuredKeys.has(full) || configuredKeys.has(idOnly);
  });
}

function mergeToolItems(prev: ToolItem[], updates: ToolUpdate[]): ToolItem[] {
  if (updates.length === 0) {
    return prev;
  }
  const stripToolLabel = (input: string): string =>
    input
      .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim();
  const map = new Map(prev.map((item) => [item.id, item] as const));
  for (const update of updates) {
    const existing = map.get(update.id);
    const status = update.status ?? existing?.status ?? "update";
    const normalizedName = stripToolLabel(update.name ?? existing?.name ?? "tool") || "tool";
    const outcome = update.outcome ?? existing?.outcome ?? (status === "result" ? "succeeded" : "running");
    const next: ToolItem = {
      id: update.id,
      name: normalizedName,
      status,
      outcome,
      runId: update.runId ?? existing?.runId,
      args: update.args ?? existing?.args,
      output: update.output ?? existing?.output,
      mediaPaths: update.mediaPaths ?? existing?.mediaPaths,
      errorMessage: update.errorMessage ?? existing?.errorMessage,
      startedAt: update.startedAt ?? existing?.startedAt ?? Date.now(),
      updatedAt: update.updatedAt ?? Date.now(),
    };
    map.set(update.id, next);
  }
  return [...map.values()].sort((a, b) => {
    if (a.startedAt !== b.startedAt) {
      return a.startedAt - b.startedAt;
    }
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt - b.updatedAt;
    }
    return a.id.localeCompare(b.id);
  });
}

function normalizeSessionKeyForMatch(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function splitAgentSessionKey(value: string): { agentId: string; rest: string } | null {
  if (!value.startsWith("agent:")) {
    return null;
  }
  const firstSep = value.indexOf(":", "agent:".length);
  if (firstSep <= "agent:".length || firstSep >= value.length - 1) {
    return null;
  }
  return {
    agentId: value.slice("agent:".length, firstSep),
    rest: value.slice(firstSep + 1),
  };
}

function normalizeAgentId(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function resolveAgentIdWithFallback(value: string | null | undefined): string {
  return normalizeAgentId(value) || "main";
}

function resolveAgentChoiceLabel(entry: AgentsListResult["agents"][number]): string {
  const identityName = entry.identity?.name?.trim() ?? "";
  if (identityName) {
    return identityName;
  }
  const name = entry.name?.trim() ?? "";
  if (name) {
    return name;
  }
  return entry.id;
}

function resolveAgentForSession(
  agents: AgentsListResult | null,
  sessionKey: string | null | undefined,
): AgentChoice {
  if (agents?.scope === "global") {
    return { id: "global", label: "global" };
  }
  const preferredId = sessionKey ? splitAgentSessionKey(sessionKey)?.agentId ?? null : null;
  const selectedId = resolveAgentIdWithFallback(preferredId ?? agents?.defaultId);
  const matched = agents?.agents.find((entry) => normalizeAgentId(entry.id) === selectedId);
  return {
    id: selectedId,
    label: matched ? resolveAgentChoiceLabel(matched) : selectedId,
  };
}

function sessionKeysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeSessionKeyForMatch(a);
  const right = normalizeSessionKeyForMatch(b);
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  const leftAgent = splitAgentSessionKey(left);
  const rightAgent = splitAgentSessionKey(right);
  if (leftAgent && !rightAgent) {
    return leftAgent.rest === right;
  }
  if (!leftAgent && rightAgent) {
    return left === rightAgent.rest;
  }
  return false;
}

function mergeStreamingText(previous: string | null, incoming: string): string {
  if (!previous) {
    return incoming;
  }
  if (!incoming || incoming === previous) {
    return previous;
  }
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  if (previous.startsWith(incoming) || previous.endsWith(incoming)) {
    return previous;
  }
  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (previous.slice(-overlap) === incoming.slice(0, overlap)) {
      return `${previous}${incoming.slice(overlap)}`;
    }
  }
  return `${previous}${incoming}`;
}

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimTrailingSlashes(value: string): string {
  const normalized = normalizeFsPath(value).trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/g, "");
}

function deriveHomeFromWorkspacePath(workspacePath: string): string {
  const normalized = trimTrailingSlashes(workspacePath).toLowerCase();
  const markerIndex = normalized.indexOf(WORKSPACE_MARKER);
  if (markerIndex <= 0) {
    return "";
  }
  return trimTrailingSlashes(workspacePath).slice(0, markerIndex);
}

function setRuntimePathHints(next: { homeDir?: string | null; workspaceDir?: string | null }) {
  const homeDir = trimTrailingSlashes(next.homeDir ?? "");
  const workspaceDir = trimTrailingSlashes(next.workspaceDir ?? "");
  if (homeDir) {
    runtimePathHints.homeDir = homeDir;
  }
  if (workspaceDir) {
    runtimePathHints.workspaceDir = workspaceDir;
  }
  if (!runtimePathHints.homeDir && runtimePathHints.workspaceDir) {
    const derivedHome = deriveHomeFromWorkspacePath(runtimePathHints.workspaceDir);
    if (derivedHome) {
      runtimePathHints.homeDir = derivedHome;
    }
  }
  if (!runtimePathHints.workspaceDir && runtimePathHints.homeDir) {
    runtimePathHints.workspaceDir = `${runtimePathHints.homeDir}${WORKSPACE_MARKER}`;
  }
  if (runtimePathHints.homeDir) {
    setActivePathPrefixMappingHomeDir(runtimePathHints.homeDir);
  }
  setImageSourceRuntimeHints({
    homeDir: runtimePathHints.homeDir || null,
    workspaceDir: runtimePathHints.workspaceDir || null,
  });
}

function getRuntimeHomeDir(): string {
  const desktopHomeDir = trimTrailingSlashes(window.desktopInfo?.homeDir ?? "");
  if (desktopHomeDir) {
    return desktopHomeDir;
  }
  return runtimePathHints.homeDir;
}

function getRuntimeWorkspaceDir(): string {
  const desktopWorkspaceDir = trimTrailingSlashes(window.desktopInfo?.workspaceDir ?? "");
  if (desktopWorkspaceDir) {
    return desktopWorkspaceDir;
  }
  if (runtimePathHints.workspaceDir) {
    return runtimePathHints.workspaceDir;
  }
  const homeDir = getRuntimeHomeDir();
  if (!homeDir) {
    return "";
  }
  return `${homeDir}${WORKSPACE_MARKER}`;
}

function getAttachmentParsingOptions(fallbackTimestamp?: number): {
  fallbackTimestamp?: number;
  runtimeHints: { homeDir: string | null; workspaceDir: string | null };
} {
  return {
    fallbackTimestamp,
    runtimeHints: {
      homeDir: getRuntimeHomeDir() || null,
      workspaceDir: getRuntimeWorkspaceDir() || null,
    },
  };
}

function applyConfigRuntimePathHints(configState: GatewayConfigState | null | undefined) {
  setRuntimePathHints(configState?.runtimePathHints ?? {});
}

function buildChatMessageDedupeKey(message: ChatMessage): string {
  const tsKey = Math.floor(message.timestamp / 2000);
  const textKey = message.text.slice(0, 200);
  const attachmentKey = (message.attachments ?? [])
    .map((attachment) => buildAttachmentSignature(attachment.type, attachment.dataUrl))
    .join("|");
  return `${message.role}:${tsKey}:${textKey}:${attachmentKey}`;
}

function appendDistinctMessages(messages: ChatMessage[], additions: Array<ChatMessage | null | undefined>): ChatMessage[] {
  if (additions.length === 0) {
    return messages;
  }
  const seen = new Set(messages.map((message) => buildChatMessageDedupeKey(message)));
  let next = messages;
  for (const addition of additions) {
    if (!addition) {
      continue;
    }
    const key = buildChatMessageDedupeKey(addition);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next = [...next, addition];
  }
  return next;
}

function withAssistantRunId(message: ChatMessage | null, runId: string | null | undefined): ChatMessage | null {
  if (!message || message.role !== "assistant") {
    return message;
  }
  const normalizedRunId = runId?.trim();
  if (!normalizedRunId) {
    return message;
  }
  if (message.runId === normalizedRunId) {
    return message;
  }
  return {
    ...message,
    runId: normalizedRunId,
  };
}

function mergeAssistantMessagesForRun(existing: ChatMessage, next: ChatMessage): ChatMessage {
  const nextText = next.text.trim() ? next.text : existing.text;
  const nextAttachments =
    next.attachments && next.attachments.length > 0
      ? next.attachments
      : existing.attachments;
  return {
    ...existing,
    ...next,
    id: existing.id,
    role: "assistant",
    text: nextText,
    attachments: nextAttachments,
    raw: next.raw ?? existing.raw,
    runId: next.runId ?? existing.runId,
  };
}

function upsertAssistantMessageForRun(
  messages: ChatMessage[],
  runId: string | null | undefined,
  nextMessage: ChatMessage | null | undefined,
): ChatMessage[] {
  const prepared = withAssistantRunId(nextMessage ?? null, runId);
  if (!prepared) {
    return messages;
  }
  const normalizedRunId = runId?.trim();
  if (!normalizedRunId) {
    return appendDistinctMessages(messages, [prepared]);
  }

  let replaced = false;
  const nextMessages: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && message.runId === normalizedRunId) {
      if (!replaced) {
        nextMessages.push(mergeAssistantMessagesForRun(message, prepared));
        replaced = true;
      }
      continue;
    }
    nextMessages.push(message);
  }

  return replaced ? nextMessages : appendDistinctMessages(nextMessages, [prepared]);
}

function buildAttachmentMessagesFromToolUpdates(toolUpdates: ToolUpdate[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const update of toolUpdates) {
    const output = update.output?.trim() ?? "";
    const mediaText = (update.mediaPaths ?? []).map((path) => `MEDIA:${path}`).join("\n");
    const combined = [output, mediaText].filter(Boolean).join("\n");
    if (!combined) {
      continue;
    }
    const parsed = toChatMessageSafe(
      {
        role: "toolResult",
        toolName: update.name,
        content: combined,
        timestamp: update.updatedAt,
      },
      getAttachmentParsingOptions(update.updatedAt),
    );
    if (parsed) {
      messages.push(parsed);
    }
  }
  return messages;
}

export default function App() {
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
    gatewayUrl: loadStored(STORAGE_KEYS.gatewayUrl, DEFAULT_GATEWAY_URL),
    token: loadStored(STORAGE_KEYS.token, ""),
    password: "",
  });
  const { gatewayUrl, token, password } = gatewayConfig;
  const setGatewayUrl = useCallback((value: string) => {
    setGatewayConfig((prev) => ({ ...prev, gatewayUrl: value }));
  }, []);
  const setToken = useCallback((value: string) => {
    setGatewayConfig((prev) => ({ ...prev, token: value }));
  }, []);
  const setPassword = useCallback((value: string) => {
    setGatewayConfig((prev) => ({ ...prev, password: value }));
  }, []);
  const [fsServerUrl, setFsServerUrl] = useState(loadStored(STORAGE_KEYS.fsServerUrl, ""));
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
    reason: null,
    note: null,
  });
  const [sessionState, setSessionState] = useState<SessionState>({
    selectedSessionKey: loadStored(STORAGE_KEYS.lastSession, ""),
    sessions: [],
    isCurrentSessionLoading: false,
    transitionState: "idle",
  });
  const connected = connectionState.status === "connected";
  const { selectedSessionKey, sessions, isCurrentSessionLoading, transitionState } = sessionState;
  const setSessions = useCallback((value: React.SetStateAction<GatewaySessionRow[]>) => {
    setSessionState((prev) => ({
      ...prev,
      sessions: typeof value === "function" ? (value as (prev: GatewaySessionRow[]) => GatewaySessionRow[])(prev.sessions) : value,
    }));
  }, []);
  const setSelectedSessionKey = useCallback((value: React.SetStateAction<string | null>) => {
    setSessionState((prev) => ({
      ...prev,
      selectedSessionKey: typeof value === "function" ? (value as (prev: string | null) => string | null)(prev.selectedSessionKey) : value,
    }));
  }, []);
  const setIsCurrentSessionLoading = useCallback((value: boolean) => {
    setSessionState((prev) => ({ ...prev, isCurrentSessionLoading: value }));
  }, []);
  const setSessionTransitionState = useCallback((value: SessionState["transitionState"]) => {
    setSessionState((prev) => ({ ...prev, transitionState: value }));
  }, []);
  const [sessionPreviews, setSessionPreviews] = useState<Record<string, SessionPreviewItem[]>>({});
  const [allSessionRows, setAllSessionRows] = useState<Record<string, GatewaySessionRow>>({});
  const [sessionDefaults, setSessionDefaults] = useState<SessionsListResult["defaults"] | null>(
    null,
  );
  const threadToolController = useThreadToolController();
  const {
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
  } = threadToolController;
  const [draft, setDraft] = useState("");
  const {
    attachments,
    replaceAttachments,
    appendAttachments,
    removeAttachment,
    clearAttachments,
  } = useStagedAttachments();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadUiSettings().autoHoverSidebar);
  const [activeView, setActiveView] = useState<"chat" | "files" | "media">("chat");
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => loadUiSettings());
  const [pathPrefixMappingsText, setPathPrefixMappingsText] = useState<string>(
    () => loadPathPrefixMappingsText(),
  );
  const [uiSettingsSchemes, setUiSettingsSchemes] = useState<UiSettingsScheme[]>(
    () => loadUiSettingsSchemes(),
  );
  const [modelShortcutSchemes, setModelShortcutSchemes] = useState<ModelShortcutSchemeMap>(
    () => loadModelShortcutSchemes(),
  );
  const [agentSessionShortcutSchemes, setAgentSessionShortcutSchemes] =
    useState<AgentSessionShortcutSchemeMap>(() => loadAgentSessionShortcutSchemes());
  const [appActionShortcuts, setAppActionShortcuts] = useState<AppActionShortcutMap>(
    () => loadAppActionShortcuts(),
  );
  const [activeUiSettingsSchemeId, setActiveUiSettingsSchemeId] = useState<string>(
    () => loadStored(STORAGE_KEYS.activeUiSettingsScheme, BUILTIN_UI_SETTINGS_SCHEME_ID),
  );
  const [agents, setAgents] = useState<AgentsListResult | null>(null);
  const [models, setModels] = useState<ModelsListResult["models"]>([]);
  const [sessionModelOverrides, setSessionModelOverrides] = useState<Record<string, string>>({});
  const [sessionThinkingOverrides, setSessionThinkingOverrides] = useState<Record<string, string>>(
    {},
  );
  const [serverInfo, setServerInfo] = useState<{ version: string | null; commit: string | null }>({
    version: null,
    commit: null,
  });
  const [maxPayloadBytes, setMaxPayloadBytes] = useState(DEFAULT_MAX_WS_PAYLOAD_BYTES);
  const [sessionActivity, setSessionActivity] = useState<Record<string, SessionActivityState>>({});
  const [sessionListLimit, setSessionListLimit] = useState(SESSION_LIST_INITIAL_LIMIT);
  const [canLoadMoreSessions, setCanLoadMoreSessions] = useState(false);
  const [canLoadMoreHistory, setCanLoadMoreHistory] = useState(false);
  const [loadingOlderHistory, setLoadingOlderHistory] = useState(false);
  const [deletingSessionKeys, setDeletingSessionKeys] = useState<Set<string>>(new Set());
  const [newSessionPreferredModel, setNewSessionPreferredModel] = useState<string>(
    () => loadStored(STORAGE_KEYS.newSessionPreferredModel, ""),
  );
  const [connectionRecoveryNotice, setConnectionRecoveryNotice] = useState<ConnectionRecoveryNotice | null>(null);
  const [interruptedRunsBySession, setInterruptedRunsBySession] = useState<Record<string, InterruptedRunSnapshot>>({});
  const [visibleInterruptedRunsBySession, setVisibleInterruptedRunsBySession] = useState<Record<string, true>>({});
  const [pendingApprovalsBySession, setPendingApprovalsBySession] = useState<Record<string, PendingApproval[]>>({});
  const [resolvingApprovalIds, setResolvingApprovalIds] = useState<Record<string, ApprovalDecision>>({});

  const clientRef = useRef<GatewayClient | null>(null);
  const connectionStatusRef = useRef(connectionState.status);
  const hasConnectedOnceRef = useRef(false);
  const connectionRecoveryNoticeTimerRef = useRef<number | null>(null);
  const connectionRecoveryNoticeSeqRef = useRef(0);
  const selectedSessionRef = useRef<string | null>(selectedSessionKey);
  const lastConfigStateRef = useRef<GatewayConfigState | null>(null);
  const sessionListLimitRef = useRef<number>(sessionListLimit);
  const loadingMoreSessionsRef = useRef(false);
  const historyLimitBySessionRef = useRef<Record<string, number>>({});
  const historyCanLoadMoreBySessionRef = useRef<Record<string, boolean>>({});
  const historyLoadInFlightRef = useRef(new Set<string>());
  const loadingSessionKeyRef = useRef<string | null>(null);
  const replyDoneSoundRef = useRef<ReturnType<typeof createReplyDoneSoundPlayer> | null>(null);
  const agentFinalizeTimerByRunRef = useRef<Record<string, number>>({});
  const finalizedAssistantByRunRef = useRef<Map<string, string>>(new Map());
  const lastFinalizedAssistantRef = useRef<{ text: string; at: number } | null>(null);
  const gatewayMethodsRef = useRef<Set<string>>(new Set());
  const sessionsRef = useRef<GatewaySessionRow[]>(sessions);
  const assistantReplyByRunRef = useRef<Record<string, Record<string, unknown>>>({});
  const committedAssistantAttachmentByRunRef = useRef<Record<string, string>>({});
  const scheduledHistoryHydrationByRunRef = useRef<Record<string, true>>({});
  const pendingSessionCreatesRef = useRef<Set<string>>(new Set());
  const deferredSessionRefreshTimersRef = useRef<number[]>([]);
  const deferredHistoryHydrationTimersRef = useRef<number[]>([]);
  const deletingSessionKeysRef = useRef<Set<string>>(new Set());
  const sessionCacheRef = useRef<Map<string, SessionViewState>>(new Map());
  const sessionPreviewsRef = useRef<Record<string, SessionPreviewItem[]>>(sessionPreviews);
  const sessionPreviewFetchSeqRef = useRef(0);
  const sessionPreviewKeysSignatureRef = useRef("");
  const interruptedRunsBySessionRef = useRef<Record<string, InterruptedRunSnapshot>>(interruptedRunsBySession);

  const devicePairingController = useDevicePairingController({
    showSettings,
    connectionStatus: connectionState.status,
    gatewayUrl,
    token,
    password,
    clientRef,
    gatewayMethodsRef,
  });
  const resolveRemoteImage = useRemoteImageResolver({
    connected,
    gatewayUrl,
    clientRef,
    gatewayMethodsRef,
  });

  useEffect(() => {
    connectionStatusRef.current = connectionState.status;
  }, [connectionState.status]);

  useEffect(() => {
    interruptedRunsBySessionRef.current = interruptedRunsBySession;
  }, [interruptedRunsBySession]);

  useEffect(() => {
    if (loadingSessionKeyRef.current !== null && loadingSessionKeyRef.current !== selectedSessionKey) {
      loadingSessionKeyRef.current = null;
      setIsCurrentSessionLoading(false);
    }
    selectedSessionRef.current = selectedSessionKey;
  }, [selectedSessionKey]);

  useEffect(() => {
    if (selectedSessionKey) {
      updateSessionActivity(selectedSessionKey, { unread: false });
    }
  }, [selectedSessionKey]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    sessionPreviewsRef.current = sessionPreviews;
  }, [sessionPreviews]);

  const clearDeferredSessionRefreshTimers = () => {
    for (const timer of deferredSessionRefreshTimersRef.current) {
      window.clearTimeout(timer);
    }
    deferredSessionRefreshTimersRef.current = [];
  };

  const clearDeferredHistoryHydrationTimers = () => {
    for (const timer of deferredHistoryHydrationTimersRef.current) {
      window.clearTimeout(timer);
    }
    deferredHistoryHydrationTimersRef.current = [];
  };

  const removeDeferredHistoryHydrationTimer = (timerId: number) => {
    deferredHistoryHydrationTimersRef.current = deferredHistoryHydrationTimersRef.current.filter(
      (existingTimerId) => existingTimerId !== timerId,
    );
  };

  const clearConnectionRecoveryNotice = useCallback(() => {
    if (connectionRecoveryNoticeTimerRef.current !== null) {
      window.clearTimeout(connectionRecoveryNoticeTimerRef.current);
      connectionRecoveryNoticeTimerRef.current = null;
    }
    setConnectionRecoveryNotice(null);
  }, []);

  const showConnectionRecoveryNotice = useCallback((notice: ConnectionRecoveryNotice, durationMs = 4200) => {
    if (connectionRecoveryNoticeTimerRef.current !== null) {
      window.clearTimeout(connectionRecoveryNoticeTimerRef.current);
      connectionRecoveryNoticeTimerRef.current = null;
    }
    const noticeId = ++connectionRecoveryNoticeSeqRef.current;
    setConnectionRecoveryNotice(notice);
    connectionRecoveryNoticeTimerRef.current = window.setTimeout(() => {
      setConnectionRecoveryNotice((current) =>
        connectionRecoveryNoticeSeqRef.current === noticeId ? null : current,
      );
      connectionRecoveryNoticeTimerRef.current = null;
    }, durationMs);
  }, []);

  const resolveInterruptedRunSessionKey = useCallback((sessionKey: string | null | undefined): string | null => {
    const normalizedKey = sessionKey?.trim();
    if (!normalizedKey) {
      return null;
    }
    for (const existingKey of Object.keys(interruptedRunsBySessionRef.current)) {
      if (sessionKeysMatch(existingKey, normalizedKey)) {
        return existingKey;
      }
    }
    return null;
  }, []);

  const getInterruptedRunSnapshot = useCallback((sessionKey: string | null | undefined): InterruptedRunSnapshot | null => {
    const resolvedKey = resolveInterruptedRunSessionKey(sessionKey);
    return resolvedKey ? interruptedRunsBySessionRef.current[resolvedKey] ?? null : null;
  }, [resolveInterruptedRunSessionKey]);

  const setInterruptedRunSnapshot = useCallback((snapshot: InterruptedRunSnapshot | null) => {
    if (!snapshot) {
      return;
    }
    setInterruptedRunsBySession((prev) => ({
      ...prev,
      [snapshot.sessionKey]: snapshot,
    }));
  }, []);

  const clearInterruptedRunSnapshot = useCallback((sessionKey?: string | null) => {
    if (!sessionKey) {
      setInterruptedRunsBySession({});
      setVisibleInterruptedRunsBySession({});
      return;
    }
    setInterruptedRunsBySession((prev) => {
      const resolvedKey = Object.keys(prev).find((existingKey) => sessionKeysMatch(existingKey, sessionKey));
      if (!resolvedKey) {
        return prev;
      }
      const next = { ...prev };
      delete next[resolvedKey];
      return next;
    });
    setVisibleInterruptedRunsBySession((prev) => {
      const resolvedKey = Object.keys(prev).find((existingKey) => sessionKeysMatch(existingKey, sessionKey));
      if (!resolvedKey) {
        return prev;
      }
      const next = { ...prev };
      delete next[resolvedKey];
      return next;
    });
  }, []);

  const markInterruptedRunVisible = useCallback((sessionKey: string) => {
    setVisibleInterruptedRunsBySession((prev) => {
      const resolvedKey = Object.keys(interruptedRunsBySessionRef.current).find((existingKey) =>
        sessionKeysMatch(existingKey, sessionKey)
      );
      const nextKey = resolvedKey ?? sessionKey;
      if (prev[nextKey]) {
        return prev;
      }
      return {
        ...prev,
        [nextKey]: true,
      };
    });
  }, []);

  const reconcileInterruptedRunSnapshotForSession = useCallback((sessionKey: string, nextState: SessionViewState) => {
    const snapshot = getInterruptedRunSnapshot(sessionKey);
    if (!snapshot) {
      return;
    }
    if (hasInterruptedRunResolved({
      snapshot,
      messages: nextState.messages,
      toolItems: nextState.toolItems,
    })) {
      clearInterruptedRunSnapshot(sessionKey);
      return;
    }
    markInterruptedRunVisible(sessionKey);
  }, [clearInterruptedRunSnapshot, getInterruptedRunSnapshot, markInterruptedRunVisible]);

  const clearInterruptedRunSnapshotForRun = useCallback((
    sessionKey: string | null | undefined,
    runId: string | null | undefined,
  ) => {
    const snapshot = getInterruptedRunSnapshot(sessionKey);
    const normalizedRunId = runId?.trim();
    if (!snapshot || !normalizedRunId || snapshot.runId !== normalizedRunId) {
      return;
    }
    clearInterruptedRunSnapshot(sessionKey);
  }, [clearInterruptedRunSnapshot, getInterruptedRunSnapshot]);

  const switchView = useCallback((target: "chat" | "files" | "media") => {
    if (target === activeViewRef.current) return;
    setActiveView(target);
    if (uiSettings.autoHoverSidebar) {
      // Auxiliary browser surfaces keep the session sidebar expanded.
      setSidebarCollapsed(target === "chat");
    }
  }, [uiSettings.autoHoverSidebar]);

  const getEmptySessionViewState = useCallback((): SessionViewState => {
    return {
      ...createEmptyThreadToolStateSnapshot(),
      draft: "",
      attachments: [],
      lastLoadedAt: 0,
    };
  }, []);

  const ensureSessionCache = useCallback((key: string): SessionViewState => {
    const existing = sessionCacheRef.current.get(key);
    if (existing) {
      return existing;
    }
    const next = getEmptySessionViewState();
    sessionCacheRef.current.set(key, next);
    return next;
  }, [getEmptySessionViewState]);

  function saveCurrentToCache(key: string) {
    if (!key) {
      return;
    }
    const snapshot = snapshotThreadToolState();
    sessionCacheRef.current.set(key, {
      ...snapshot,
      draft,
      attachments: [...attachments],
      lastLoadedAt: Date.now(),
    });
  }

  function restoreFromCache(key: string): boolean {
    if (!key) {
      return false;
    }
    const cached = sessionCacheRef.current.get(key);
    if (!cached) {
      return false;
    }
    applyThreadToolState({
      messages: cached.messages,
      streamText: cached.streamText,
      toolItems: cached.toolItems,
      thinking: cached.thinking,
      chatRunId: cached.chatRunId,
      thinkingLevel: cached.thinkingLevel,
    });
    setDraft(cached.draft);
    replaceAttachments(cached.attachments);
    return true;
  }

  function clearActiveSessionView() {
    clearThreadToolState();
    setDraft("");
    replaceAttachments([]);
  }

  function updateSessionActivity(
    key: string,
    update: Partial<SessionActivityState>,
  ) {
    if (!key) {
      return;
    }
    setSessionActivity((previous) => {
      const current = previous[key] ?? { working: false, unread: false };
      const next = { ...current, ...update };
      if (current.working === next.working && current.unread === next.unread) {
        return previous;
      }
      return { ...previous, [key]: next };
    });
  }

  function updateCacheField(key: string, updater: (cached: SessionViewState) => SessionViewState) {
    if (!key) {
      return;
    }
    const current = ensureSessionCache(key);
    const next = updater(current);
    sessionCacheRef.current.set(key, {
      ...next,
      lastLoadedAt: Date.now(),
    });
  }

  function getCachedRunOwnershipEntries() {
    return Array.from(sessionCacheRef.current.entries(), ([sessionKey, cached]) => ({
      sessionKey,
      runId: cached.chatRunId,
    }));
  }

  function resolveEventSessionKeyFromCache(params: {
    sessionKeyHint?: string | null;
    runId?: string | null;
    selectedSessionKey?: string | null;
    activeRunId?: string | null;
  }): string | null {
    const normalizedSessionKeyHint = params.sessionKeyHint?.trim();
    if (normalizedSessionKeyHint) {
      return normalizedSessionKeyHint;
    }
    const normalizedRunId = params.runId?.trim();
    if (!normalizedRunId) {
      return null;
    }
    if (params.selectedSessionKey?.trim() && params.activeRunId?.trim() === normalizedRunId) {
      return params.selectedSessionKey.trim();
    }
    return resolveEventSessionKey({
      ...params,
      cachedRuns: getCachedRunOwnershipEntries(),
    });
  }

  const shouldSkipAssistantFinal = (runId: string | null | undefined, text: string): boolean => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return true;
    }
    const normalizedRunId = runId?.trim();
    if (normalizedRunId) {
      const seen = finalizedAssistantByRunRef.current.get(normalizedRunId);
      if (seen === normalizedText) {
        return true;
      }
      finalizedAssistantByRunRef.current.set(normalizedRunId, normalizedText);
      if (finalizedAssistantByRunRef.current.size > 200) {
        const oldestKey = finalizedAssistantByRunRef.current.keys().next().value;
        if (typeof oldestKey === "string") {
          finalizedAssistantByRunRef.current.delete(oldestKey);
        }
      }
      return false;
    }
    const now = Date.now();
    const last = lastFinalizedAssistantRef.current;
    if (last && last.text === normalizedText && now - last.at < 1500) {
      return true;
    }
    lastFinalizedAssistantRef.current = { text: normalizedText, at: now };
    return false;
  };

  const applySessionTokenStatsFromMessage = (
    rawMessage: unknown,
    sessionKeyHint?: string | null,
  ) => {
    const patch = extractSessionTokenStatsFromMessage(rawMessage);
    if (!patch) {
      return;
    }
    const activeSessionKey = selectedSessionRef.current;
    setSessions((prev) => {
      let didChange = false;
      const next = prev.map((session) => {
        const shouldPatch = sessionKeyHint
          ? sessionKeysMatch(session.key, sessionKeyHint)
          : activeSessionKey
            ? sessionKeysMatch(session.key, activeSessionKey)
            : false;
        if (!shouldPatch) {
          return session;
        }
        const mergedInputTokens = patch.inputTokens ?? toFiniteNumber(session.inputTokens);
        const mergedOutputTokens = patch.outputTokens ?? toFiniteNumber(session.outputTokens);
        const mergedTotalTokens =
          patch.totalTokens ??
          toFiniteNumber(session.totalTokens) ??
          (mergedInputTokens !== null && mergedOutputTokens !== null
            ? mergedInputTokens + mergedOutputTokens
            : undefined);
        const mergedContextTokens = patch.contextTokens ?? toFiniteNumber(session.contextTokens);
        const nextSession: GatewaySessionRow = {
          ...session,
          inputTokens: mergedInputTokens ?? undefined,
          outputTokens: mergedOutputTokens ?? undefined,
          totalTokens: mergedTotalTokens ?? undefined,
          contextTokens: mergedContextTokens ?? undefined,
          updatedAt: Date.now(),
        };
        if (
          nextSession.inputTokens === session.inputTokens &&
          nextSession.outputTokens === session.outputTokens &&
          nextSession.totalTokens === session.totalTokens &&
          nextSession.contextTokens === session.contextTokens
        ) {
          return session;
        }
        didChange = true;
        return nextSession;
      });
      return didChange ? next : prev;
    });
  };

  const clearAgentFinalizeTimer = (runId: string | null | undefined) => {
    if (!runId) {
      return;
    }
    const timer = agentFinalizeTimerByRunRef.current[runId];
    if (!timer) {
      return;
    }
    window.clearTimeout(timer);
    const next = { ...agentFinalizeTimerByRunRef.current };
    delete next[runId];
    agentFinalizeTimerByRunRef.current = next;
  };

  const getAssistantReplyForRun = (runId: string | null | undefined): Record<string, unknown> | null => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return null;
    }
    return assistantReplyByRunRef.current[normalizedRunId] ?? null;
  };

  const cacheAssistantReplyForRun = (
    runId: string | null | undefined,
    payload: Record<string, unknown> | null | undefined,
  ) => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId || !payload) {
      return;
    }
    const previous = assistantReplyByRunRef.current[normalizedRunId];
    assistantReplyByRunRef.current = {
      ...assistantReplyByRunRef.current,
      [normalizedRunId]: mergeAssistantReplyPayload(previous, payload),
    };
  };

  const clearAssistantReplyForRun = (runId: string | null | undefined) => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId || !assistantReplyByRunRef.current[normalizedRunId]) {
      return;
    }
    const next = { ...assistantReplyByRunRef.current };
    delete next[normalizedRunId];
    assistantReplyByRunRef.current = next;
  };

  const getCommittedAssistantAttachmentSignature = (runId: string | null | undefined): string | null => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return null;
    }
    return committedAssistantAttachmentByRunRef.current[normalizedRunId] ?? null;
  };

  const setCommittedAssistantAttachmentSignature = (
    runId: string | null | undefined,
    signature: string | null,
  ) => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return;
    }
    const next = { ...committedAssistantAttachmentByRunRef.current };
    if (signature) {
      next[normalizedRunId] = signature;
    } else {
      delete next[normalizedRunId];
    }
    committedAssistantAttachmentByRunRef.current = next;
  };

  const clearCommittedAssistantAttachmentForRun = (runId: string | null | undefined) => {
    setCommittedAssistantAttachmentSignature(runId, null);
  };

  const hasCommittedAssistantMessageForRun = (runId: string | null | undefined): boolean => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return false;
    }
    return messagesRef.current.some((message) => (
      message.role === "assistant" &&
      message.runId === normalizedRunId &&
      (Boolean(message.text.trim()) || Boolean(message.attachments?.length))
    ));
  };

  const hasCommittedAssistantAttachmentForRun = (runId: string | null | undefined): boolean => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return false;
    }
    return messagesRef.current.some((message) => (
      message.role === "assistant" &&
      message.runId === normalizedRunId &&
      Boolean(message.attachments?.length)
    ));
  };

  const runHasExpectedMediaForRun = (
    runId: string | null | undefined,
    options?: { toolUpdates?: ToolUpdate[] | null },
  ): boolean => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return false;
    }
    const pendingAssistantReply = getAssistantReplyForRun(normalizedRunId);
    return runMayStillProduceMedia({
      pendingToolUpdates: options?.toolUpdates ?? [],
      priorToolItems: toolItemsRef.current.filter((item) => item.runId === normalizedRunId),
      pendingAssistantReplyMediaCount: pendingAssistantReply
        ? collectReplyPayloadMediaUrls(pendingAssistantReply).length
        : 0,
    });
  };

  const clearScheduledHistoryHydrationForRun = (runId: string | null | undefined) => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId || !scheduledHistoryHydrationByRunRef.current[normalizedRunId]) {
      return;
    }
    const next = { ...scheduledHistoryHydrationByRunRef.current };
    delete next[normalizedRunId];
    scheduledHistoryHydrationByRunRef.current = next;
  };

  const markScheduledHistoryHydrationForRun = (runId: string | null | undefined): boolean => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return false;
    }
    if (scheduledHistoryHydrationByRunRef.current[normalizedRunId]) {
      return false;
    }
    scheduledHistoryHydrationByRunRef.current = {
      ...scheduledHistoryHydrationByRunRef.current,
      [normalizedRunId]: true,
    };
    return true;
  };

  const buildAssistantAttachmentOnlyMessage = (
    rawMessage: unknown,
    runId: string | null | undefined,
    fallbackTimestamp?: number,
  ): ChatMessage | null => {
    const parsed = withAssistantRunId(
      toChatMessageSafe(rawMessage, getAttachmentParsingOptions(fallbackTimestamp)),
      runId,
    );
    const attachments = parsed?.attachments ?? [];
    if (!parsed || attachments.length === 0) {
      return null;
    }
    return {
      ...parsed,
      role: "assistant",
      text: "",
    };
  };

  const buildAssistantAttachmentSignature = (message: ChatMessage | null): string | null => {
    const attachments = message?.attachments ?? [];
    if (attachments.length === 0) {
      return null;
    }
    return attachments
      .map((attachment) => buildAttachmentSignature(attachment.type, attachment.dataUrl))
      .join("|");
  };

  const buildAssistantReplyAttachmentProjection = (
    rawReply: unknown,
    runId: string | null | undefined,
  ): {
    runId: string;
    assistantReply: Record<string, unknown>;
    attachmentMessage: ChatMessage;
    attachmentSignature: string;
  } | null => {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId || !isRecord(rawReply) || !hasReplyPayloadLikeContent(rawReply)) {
      return null;
    }
    const attachmentMessage = buildAssistantAttachmentOnlyMessage(rawReply, normalizedRunId);
    const attachmentSignature = buildAssistantAttachmentSignature(attachmentMessage);
    if (!attachmentMessage || !attachmentSignature) {
      return null;
    }
    return {
      runId: normalizedRunId,
      assistantReply: rawReply,
      attachmentMessage,
      attachmentSignature,
    };
  };

  const commitAssistantReplyAttachmentProjection = (
    projection: {
      runId: string;
      assistantReply: Record<string, unknown>;
      attachmentMessage: ChatMessage;
      attachmentSignature: string;
    } | null,
    commitAttachmentMessage: (params: { runId: string; attachmentMessage: ChatMessage }) => void,
  ) => {
    if (!projection) {
      return;
    }
    cacheAssistantReplyForRun(projection.runId, projection.assistantReply);
    if (projection.attachmentSignature === getCommittedAssistantAttachmentSignature(projection.runId)) {
      return;
    }
    setCommittedAssistantAttachmentSignature(projection.runId, projection.attachmentSignature);
    commitAttachmentMessage({
      runId: projection.runId,
      attachmentMessage: projection.attachmentMessage,
    });
  };

  const buildFinalAssistantMessage = (
    rawMessage: unknown,
    streamedText: string,
    runId?: string | null,
  ): ChatMessage | null => {
    let msg = withAssistantRunId(toChatMessageSafe(rawMessage, getAttachmentParsingOptions()), runId);
    if (msg && msg.role !== "user" && !msg.text.trim() && streamedText) {
      msg = { ...msg, text: streamedText };
    }
    if ((!msg || !msg.text.trim()) && streamedText) {
      msg = {
        id: generateUUID(),
        role: "assistant",
        text: streamedText,
        timestamp: Date.now(),
        runId: runId?.trim() || undefined,
        raw: rawMessage,
      };
    }
    const hasRenderableAttachment = Boolean(msg?.attachments && msg.attachments.length > 0);
    const hasRenderableText = Boolean(msg?.text.trim());
    return msg && (hasRenderableText || hasRenderableAttachment) ? msg : null;
  };

  const buildStreamCommittedAssistantMessage = (streamedText: string): ChatMessage | null => {
    const normalized = streamedText.trim();
    if (!normalized) {
      return null;
    }
    return {
      id: generateUUID(),
      role: "assistant",
      text: normalized,
      timestamp: Date.now(),
    };
  };

  const buildToolAttachmentMessage = (rawMessage: unknown): ChatMessage | null => {
    const msg = toChatMessageSafe(rawMessage, getAttachmentParsingOptions());
    const hasRenderableAttachment = Boolean(msg?.attachments && msg.attachments.length > 0);
    return msg && hasRenderableAttachment ? msg : null;
  };

  const clearCachedStreamingState = (key: string) => {
    updateCacheField(key, (cached) => ({
      ...cached,
      streamText: null,
      chatRunId: null,
      thinking: false,
    }));
  };

  const refreshSessionListsSoon = () => {
    const client = clientRef.current;
    if (client) {
      refreshSessionsWithFollowUp(client);
    }
  };

  const reloadActiveSessionHistory = async (
    clientOverride?: GatewayClient | null,
    options?: { recoverySessionKey?: string | null },
  ) => {
    const client = clientOverride ?? clientRef.current;
    if (!client) {
      return;
    }
    await refreshSessions(client);
    const activeSessionKey = selectedSessionRef.current;
    if (!activeSessionKey || historyLoadInFlightRef.current.has(activeSessionKey)) {
      return;
    }
    await loadHistory(client, activeSessionKey, getHistoryLimit(activeSessionKey));
    const refreshedSessionState = sessionCacheRef.current.get(activeSessionKey);
    if (refreshedSessionState) {
      reconcileInterruptedRunSnapshotForSession(activeSessionKey, refreshedSessionState);
    }
    refreshSessionsWithFollowUp(client);
    if (
      options?.recoverySessionKey &&
      sessionKeysMatch(options.recoverySessionKey, activeSessionKey) &&
      selectedSessionRef.current &&
      sessionKeysMatch(selectedSessionRef.current, activeSessionKey) &&
      clientRef.current === client
    ) {
      showConnectionRecoveryNotice(buildConnectionRecoveryNotice({ stage: "session-refreshed" }));
    }
  };

  const scheduleActiveHistoryHydration = (runId: string | null | undefined) => {
    const normalizedRunId = runId?.trim();
    const client = clientRef.current;
    const activeSessionKey = selectedSessionRef.current;
    if (!normalizedRunId || !client || !activeSessionKey) {
      return;
    }
    if (hasCommittedAssistantAttachmentForRun(normalizedRunId)) {
      clearScheduledHistoryHydrationForRun(normalizedRunId);
      return;
    }
    if (!markScheduledHistoryHydrationForRun(normalizedRunId)) {
      return;
    }
    const delaysMs = [180, 900, 2500];
    deferredHistoryHydrationTimersRef.current.push(
      ...delaysMs.map((delayMs, index) => {
        let timerId = 0;
        timerId = window.setTimeout(() => {
          removeDeferredHistoryHydrationTimer(timerId);
          const pendingAssistantReply = getAssistantReplyForRun(normalizedRunId);
          const activeStreamText = (pendingStreamTextRef.current ?? streamTextRef.current ?? "").trim();
          const tickDecision = decideScheduledHistoryHydrationTick({
            isStillScheduled: Boolean(scheduledHistoryHydrationByRunRef.current[normalizedRunId]),
            isFinalAttempt: index === delaysMs.length - 1,
            hasCommittedAttachment: hasCommittedAssistantAttachmentForRun(normalizedRunId),
            isCurrentClient: clientRef.current === client,
            isCurrentSession: selectedSessionRef.current === activeSessionKey,
            activeRunId: chatRunRef.current,
            targetRunId: normalizedRunId,
            thinking: thinkingRef.current,
            hasActiveStreamText: Boolean(activeStreamText),
            hasPendingAssistantReply: Boolean(pendingAssistantReply),
            isHistoryLoadInFlight: historyLoadInFlightRef.current.has(activeSessionKey),
          });
          if (tickDecision.clearScheduled) {
            clearScheduledHistoryHydrationForRun(normalizedRunId);
          }
          if (!tickDecision.loadHistory) {
            return;
          }
          void loadHistory(client, activeSessionKey, getHistoryLimit(activeSessionKey));
        }, delayMs);
        return timerId;
      }),
    );
  };

  const applyFinalizedRunHydrationDecision = (
    runId: string | null | undefined,
    decision: "clear" | "schedule",
  ) => {
    if (decision === "schedule") {
      scheduleActiveHistoryHydration(runId);
      return;
    }
    clearScheduledHistoryHydrationForRun(runId);
  };

  const clearRunAssistantProjectionState = (
    runId: string | null | undefined,
    options?: { clearScheduledHydration?: boolean },
  ) => {
    clearAssistantReplyForRun(runId);
    clearCommittedAssistantAttachmentForRun(runId);
    if (options?.clearScheduledHydration) {
      clearScheduledHistoryHydrationForRun(runId);
    }
  };

  const clearActiveRunTransientState = (
    runId: string | null | undefined,
    options?: { clearScheduledHydration?: boolean },
  ) => {
    clearRunAssistantProjectionState(runId, options);
    clearActiveStreamingState();
  };

  const updateActiveSessionRunActivity = (params: { working: boolean; unread?: boolean }) => {
    const activeSessionKey = selectedSessionRef.current;
    if (activeSessionKey) {
      updateSessionActivity(activeSessionKey, {
        working: params.working,
        unread: params.unread ?? false,
      });
    }
  };

  const attachLifecycleErrorToActiveTools = useCallback((params: { runId?: string | null; errorMessage?: string | null }) => {
    if (!params.runId || !params.errorMessage) {
      return;
    }
    setToolItems((prev) => attachLifecycleErrorToToolItems(prev, params));
  }, []);

  const attachLifecycleErrorToCachedTools = useCallback((sessionKey: string, params: { runId?: string | null; errorMessage?: string | null }) => {
    if (!sessionKey || !params.runId || !params.errorMessage) {
      return;
    }
    updateCacheField(sessionKey, (cached) => ({
      ...cached,
      toolItems: attachLifecycleErrorToToolItems(cached.toolItems, params),
    }));
  }, [updateCacheField]);

  const scheduleAgentFinalizeFallback = (params: {
    sessionKey?: string | null;
    runId: string | null | undefined;
    phase: "end" | "error";
    errorMessage?: string | null;
  }) => {
    const runId = params.runId?.trim();
    if (!runId) {
      return;
    }
    clearAgentFinalizeTimer(runId);
    const timer = window.setTimeout(() => {
      const next = { ...agentFinalizeTimerByRunRef.current };
      delete next[runId];
      agentFinalizeTimerByRunRef.current = next;
      const activeRun = chatRunRef.current;
      if (activeRun && activeRun !== runId) {
        return;
      }
      const streamedText = (streamTextRef.current ?? "").trim();
      const pendingAssistantReply = getAssistantReplyForRun(runId);
      if (params.phase === "end") {
        const finalAssistantMessage = pendingAssistantReply
          ? buildFinalAssistantMessage(pendingAssistantReply, streamedText, runId)
          : buildStreamCommittedAssistantMessage(streamedText);
        if (!finalAssistantMessage) {
          const hydrationDecision = decideFinalizedRunHydration({
            hasFinalAssistantMessage: false,
            hasRenderableAttachment: false,
            hasCommittedAttachment: hasCommittedAssistantAttachmentForRun(runId),
            hasCommittedMessage: hasCommittedAssistantMessageForRun(runId),
            expectsMedia: runHasExpectedMediaForRun(runId),
          });
          if (hydrationDecision === "clear") {
            clearActiveRunTransientState(runId, { clearScheduledHydration: true });
            refreshSessionListsSoon();
            updateActiveSessionRunActivity({ working: false, unread: false });
            return;
          }
          clearActiveRunTransientState(runId);
          void reloadActiveSessionHistory();
          updateActiveSessionRunActivity({ working: false, unread: false });
          return;
        }
        const finalAssistantResolution = resolveFinalAssistantMessage({
          message: finalAssistantMessage,
          hasCommittedAttachment: hasCommittedAssistantAttachmentForRun(runId),
          expectsMedia: runHasExpectedMediaForRun(runId),
          shouldSkipText: finalAssistantMessage.text.trim()
            ? shouldSkipAssistantFinal(runId, finalAssistantMessage.text)
            : true,
        });
        if (finalAssistantResolution.shouldCommitMessage) {
          setMessages((prev) => upsertAssistantMessageForRun(prev, runId, finalAssistantMessage));
          notifyReplyCompleted();
        }
        applyFinalizedRunHydrationDecision(runId, finalAssistantResolution.hydrationDecision);
        clearActiveRunTransientState(runId);
        refreshSessionListsSoon();
        updateActiveSessionRunActivity({ working: false, unread: false });
        return;
      }
      clearActiveRunTransientState(runId, { clearScheduledHydration: true });
      const activeSessionKey = selectedSessionRef.current;
      updateActiveSessionRunActivity({ working: false, unread: false });
      if (params.errorMessage) {
        if (params.sessionKey && activeSessionKey && sessionKeysMatch(params.sessionKey, activeSessionKey)) {
          attachLifecycleErrorToActiveTools({ runId, errorMessage: params.errorMessage });
        } else if (params.sessionKey) {
          attachLifecycleErrorToCachedTools(params.sessionKey, { runId, errorMessage: params.errorMessage });
        }
      }
      if (params.errorMessage) {
        pushSystemMessage(`Error: ${params.errorMessage}`);
      }
    }, 220);
    agentFinalizeTimerByRunRef.current = {
      ...agentFinalizeTimerByRunRef.current,
      [runId]: timer,
    };
  };

  useEffect(() => {
    sessionListLimitRef.current = sessionListLimit;
  }, [sessionListLimit]);

  useEffect(() => {
    const player = createReplyDoneSoundPlayer();
    replyDoneSoundRef.current = player;
    const warmup = () => {
      player.warmup();
    };
    window.addEventListener("pointerdown", warmup, { passive: true });
    window.addEventListener("keydown", warmup);
    return () => {
      clearDeferredSessionRefreshTimers();
      clearDeferredHistoryHydrationTimers();
      clearConnectionRecoveryNotice();
      disposeThreadToolController();
      for (const timer of Object.values(agentFinalizeTimerByRunRef.current)) {
        window.clearTimeout(timer);
      }
      agentFinalizeTimerByRunRef.current = {};
      scheduledHistoryHydrationByRunRef.current = {};
      window.removeEventListener("pointerdown", warmup);
      window.removeEventListener("keydown", warmup);
      player.dispose();
      replyDoneSoundRef.current = null;
    };
  }, []);

  function notifyReplyCompleted() {
    if (!uiSettings.playReplyDoneSound) {
      return;
    }
    if (uiSettings.playReplyDoneSoundVolume <= 0) {
      return;
    }
    replyDoneSoundRef.current?.play({
      volume: uiSettings.playReplyDoneSoundVolume,
      tone: uiSettings.playReplyDoneSoundTone,
      source: uiSettings.playReplyDoneSoundSource,
      customAudioDataUrl: uiSettings.playReplyDoneSoundCustomAudioDataUrl,
    });
  }

  function previewReplyDoneSound(next: {
    enabled: boolean;
    volume: number;
    tone: UiSettings["playReplyDoneSoundTone"];
    source: UiSettings["playReplyDoneSoundSource"];
    customAudioDataUrl: UiSettings["playReplyDoneSoundCustomAudioDataUrl"];
  }) {
    if (!next.enabled || next.volume <= 0) {
      return;
    }
    if (next.source === "custom" && !next.customAudioDataUrl) {
      return;
    }
    replyDoneSoundRef.current?.play({
      volume: next.volume,
      tone: next.tone,
      source: next.source,
      customAudioDataUrl: next.customAudioDataUrl,
    });
  }

  const getHistoryLimit = (key: string): number => {
    return historyLimitBySessionRef.current[key] ?? CHAT_HISTORY_INITIAL_LIMIT;
  };

  const setHistoryLimit = (key: string, limit: number) => {
    historyLimitBySessionRef.current = {
      ...historyLimitBySessionRef.current,
      [key]: limit,
    };
  };

  const handleApplyUiSettingsScheme = (schemeId: string) => {
    if (schemeId === BUILTIN_UI_SETTINGS_SCHEME_ID) {
      setUiSettings({ ...DEFAULT_UI_SETTINGS });
      setActiveUiSettingsSchemeId(BUILTIN_UI_SETTINGS_SCHEME_ID);
      return;
    }
    const matched = uiSettingsSchemes.find((item) => item.id === schemeId);
    if (!matched) {
      return;
    }
    setUiSettings({ ...matched.settings });
    setActiveUiSettingsSchemeId(matched.id);
  };

  const handleSaveUiSettingsScheme = (rawName: string) => {
    const baseName = normalizeUiSettingsSchemeName(rawName);
    if (!baseName) {
      return;
    }
    const timestamp = Date.now();
    const nextId = generateUUID();
    setUiSettingsSchemes((prev) => {
      const used = new Set(prev.map((item) => item.name.toLowerCase()));
      let nextName = baseName;
      let suffix = 2;
      while (used.has(nextName.toLowerCase())) {
        nextName = `${baseName} (${suffix})`;
        suffix += 1;
      }
      return [{ id: nextId, name: nextName, settings: { ...uiSettings }, updatedAt: timestamp }, ...prev];
    });
    setActiveUiSettingsSchemeId(nextId);
  };

  const handleOverwriteUiSettingsScheme = (schemeId: string) => {
    if (schemeId === BUILTIN_UI_SETTINGS_SCHEME_ID) {
      return;
    }
    const timestamp = Date.now();
    setUiSettingsSchemes((prev) =>
      prev.map((item) =>
        item.id === schemeId ? { ...item, settings: { ...uiSettings }, updatedAt: timestamp } : item
      ).sort((a, b) => b.updatedAt - a.updatedAt)
    );
  };

  const handleDeleteUiSettingsScheme = (schemeId: string) => {
    if (schemeId === BUILTIN_UI_SETTINGS_SCHEME_ID) {
      return;
    }
    setUiSettingsSchemes((prev) => prev.filter((item) => item.id !== schemeId));
    setActiveUiSettingsSchemeId((prev) =>
      prev === schemeId ? BUILTIN_UI_SETTINGS_SCHEME_ID : prev
    );
  };

  const handleChangeAppActionShortcut = (
    id: AppActionShortcutId,
    shortcutRaw: AppActionShortcut,
  ) => {
    const combo = normalizeShortcutCombo(shortcutRaw.combo);
    if (!combo) {
      return;
    }
    const enabled = shortcutRaw.enabled === true;
    setAppActionShortcuts((prev) => {
      const current = prev[id];
      if (
        current.enabled === enabled &&
        shortcutComboSignature(current.combo) === shortcutComboSignature(combo)
      ) {
        return prev;
      }
      return {
        ...prev,
        [id]: {
          enabled,
          combo,
        },
      };
    });
  };

  const handleSaveModelShortcutScheme = (slotRaw: number) => {
    const slot = normalizeShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    const existing = modelShortcutSchemes[String(slot)];
    const model = currentShortcutModel.trim();
    if (!model) {
      pushSystemMessage("Cannot save model shortcut: active session has no model.");
      return;
    }
    const nextScheme: ModelShortcutScheme = {
      slot,
      combo: existing?.combo ?? getDefaultShortcutCombo(slot),
      model,
      thinkingLevel: currentShortcutThinkingLevel,
      updatedAt: Date.now(),
    };
    setModelShortcutSchemes((prev) =>
      normalizeModelShortcutSchemes({
        ...prev,
        [String(slot)]: nextScheme,
      })
    );
    pushSystemMessage(
      `saved ${resolveShortcutLabel(nextScheme.combo)} → ${model} · thinking ${nextScheme.thinkingLevel}`,
    );
  };

  const handleClearModelShortcutScheme = (slotRaw: number) => {
    const slot = normalizeShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    setModelShortcutSchemes((prev) => {
      if (!(String(slot) in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[String(slot)];
      return next;
    });
  };

  const handleChangeModelShortcutSchemeCombo = (
    slotRaw: number,
    comboRaw: ShortcutCombo,
  ) => {
    const slot = normalizeShortcutSlot(slotRaw);
    const combo = normalizeShortcutCombo(comboRaw);
    if (slot === null || combo === null) {
      return;
    }
    const target = modelShortcutSchemes[String(slot)];
    if (!target || shortcutComboSignature(target.combo) === shortcutComboSignature(combo)) {
      return;
    }
    const occupiedEntry =
      Object.values(modelShortcutSchemes).find(
        (entry) =>
          entry &&
          entry.slot !== slot &&
          shortcutComboSignature(entry.combo) === shortcutComboSignature(combo),
      ) ?? null;
    setModelShortcutSchemes((prev) => {
      const target = prev[String(slot)];
      if (!target || shortcutComboSignature(target.combo) === shortcutComboSignature(combo)) {
        return prev;
      }
      const next = { ...prev };
      const occupiedEntry = Object.values(prev).find(
        (entry) =>
          entry &&
          entry.slot !== slot &&
          shortcutComboSignature(entry.combo) === shortcutComboSignature(combo),
      );
      if (occupiedEntry) {
        next[String(occupiedEntry.slot)] = {
          ...occupiedEntry,
          combo: target.combo,
          updatedAt: Date.now(),
        };
      }
      next[String(slot)] = {
        ...target,
        combo,
        updatedAt: Date.now(),
      };
      return normalizeModelShortcutSchemes(next);
    });
    if (occupiedEntry) {
      pushSystemMessage(
        `shortcut updated: slot ${slot} → ${resolveShortcutLabel(combo)} (swapped with slot ${occupiedEntry.slot})`,
      );
    } else {
      pushSystemMessage(
        `shortcut updated: slot ${slot} → ${resolveShortcutLabel(combo)}`,
      );
    }
  };

  const applyModelShortcutScheme = async (
    scheme: ModelShortcutScheme,
    source: "shortcut" | "manual",
  ) => {
    const key = selectedSessionRef.current;
    if (!key) {
      return;
    }
    const thinking = normalizeThinkingValue(scheme.thinkingLevel);
    try {
      await patchSessionRuntimeSettings({
        key,
        model: scheme.model,
        thinkingLevel: thinking,
      });
      if (source === "shortcut") {
        pushSystemMessage(
          `switched by ${resolveShortcutLabel(scheme.combo)} → ${scheme.model} · thinking ${thinking}`,
        );
      }
    } catch (err) {
      pushSystemMessage(`Model shortcut failed: ${String(err)}`);
    }
  };

  const handleApplyModelShortcutScheme = async (
    slotRaw: number,
    source: "shortcut" | "manual" = "manual",
  ) => {
    const slot = normalizeShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    const scheme = modelShortcutSchemes[String(slot)];
    if (!scheme) {
      if (source === "manual") {
        pushSystemMessage(`No saved scheme in slot ${slot}.`);
      }
      return;
    }
    await applyModelShortcutScheme(scheme, source);
  };

  const handleSaveAgentSessionShortcutScheme = (slotRaw: number) => {
    const slot = normalizeAgentSessionShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    const existing = agentSessionShortcutSchemes[String(slot)];
    const agentId = currentShortcutAgentId.trim();
    if (!agentId) {
      pushSystemMessage("Cannot save agent session shortcut: no active agent.");
      return;
    }
    const nextScheme: AgentSessionShortcutScheme = {
      slot,
      combo:
        existing?.combo ?? {
          ...getDefaultAgentSessionShortcutCombo(slot),
          key: getDefaultAgentSessionShortcutKey(slot),
        },
      agentId,
      agentLabel: currentShortcutAgentLabel || agentId,
      updatedAt: Date.now(),
    };
    setAgentSessionShortcutSchemes((prev) =>
      normalizeAgentSessionShortcutSchemes({
        ...prev,
        [String(slot)]: nextScheme,
      }),
    );
    pushSystemMessage(
      `saved ${resolveShortcutLabel(nextScheme.combo)} → new session with ${nextScheme.agentLabel}`,
    );
  };

  const handleClearAgentSessionShortcutScheme = (slotRaw: number) => {
    const slot = normalizeAgentSessionShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    setAgentSessionShortcutSchemes((prev) => {
      if (!(String(slot) in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[String(slot)];
      return next;
    });
  };

  const handleChangeAgentSessionShortcutSchemeCombo = (
    slotRaw: number,
    comboRaw: ShortcutCombo,
  ) => {
    const slot = normalizeAgentSessionShortcutSlot(slotRaw);
    const combo = normalizeShortcutCombo(comboRaw);
    if (slot === null || combo === null) {
      return;
    }
    const target = agentSessionShortcutSchemes[String(slot)];
    if (!target || shortcutComboSignature(target.combo) === shortcutComboSignature(combo)) {
      return;
    }
    const occupiedEntry =
      Object.values(agentSessionShortcutSchemes).find(
        (entry) =>
          entry &&
          entry.slot !== slot &&
          shortcutComboSignature(entry.combo) === shortcutComboSignature(combo),
      ) ?? null;
    setAgentSessionShortcutSchemes((prev) => {
      const target = prev[String(slot)];
      if (!target || shortcutComboSignature(target.combo) === shortcutComboSignature(combo)) {
        return prev;
      }
      const next = { ...prev };
      const occupiedEntry = Object.values(prev).find(
        (entry) =>
          entry &&
          entry.slot !== slot &&
          shortcutComboSignature(entry.combo) === shortcutComboSignature(combo),
      );
      if (occupiedEntry) {
        next[String(occupiedEntry.slot)] = {
          ...occupiedEntry,
          combo: target.combo,
          updatedAt: Date.now(),
        };
      }
      next[String(slot)] = {
        ...target,
        combo,
        updatedAt: Date.now(),
      };
      return normalizeAgentSessionShortcutSchemes(next);
    });
    if (occupiedEntry) {
      pushSystemMessage(
        `agent shortcut updated: slot ${slot} → ${resolveShortcutLabel(combo)} (swapped with slot ${occupiedEntry.slot})`,
      );
    } else {
      pushSystemMessage(`agent shortcut updated: slot ${slot} → ${resolveShortcutLabel(combo)}`);
    }
  };

  const handleApplyAgentSessionShortcutScheme = async (
    slotRaw: number,
    source: "shortcut" | "manual" = "manual",
  ) => {
    const slot = normalizeAgentSessionShortcutSlot(slotRaw);
    if (slot === null) {
      return;
    }
    const scheme = agentSessionShortcutSchemes[String(slot)];
    if (!scheme) {
      if (source === "manual") {
        pushSystemMessage(`No saved agent session shortcut in slot ${slot}.`);
      }
      return;
    }
    const key = await createSession("", true, scheme.agentId);
    if (source === "shortcut" && key) {
      pushSystemMessage(
        `created session ${key} via ${resolveShortcutLabel(scheme.combo)} (agent: ${scheme.agentLabel})`,
      );
    }
  };

  useEffect(() => {
    if (
      activeUiSettingsSchemeId !== BUILTIN_UI_SETTINGS_SCHEME_ID &&
      !uiSettingsSchemes.some((item) => item.id === activeUiSettingsSchemeId)
    ) {
      setActiveUiSettingsSchemeId(BUILTIN_UI_SETTINGS_SCHEME_ID);
    }
  }, [activeUiSettingsSchemeId, uiSettingsSchemes]);

  useEffect(() => {
    document.documentElement.style.setProperty("--claw-font", uiSettings.fontFamily);
    document.documentElement.style.setProperty("--claw-font-size", `${uiSettings.fontSize}px`);
    document.documentElement.style.setProperty("--claw-line-height", uiSettings.lineHeight.toString());
    document.documentElement.style.setProperty(
      "--claw-content-width",
      `${uiSettings.contentWidth}px`,
    );
    document.documentElement.style.setProperty(
      "--claw-sidebar-font-size",
      `${uiSettings.sidebarFontSize}px`,
    );
    document.documentElement.style.setProperty("--claw-sidebar-width", `${uiSettings.sidebarWidth}px`);
    document.documentElement.style.setProperty(
      "--claw-chat-bubble-radius",
      `${uiSettings.chatBubbleRadius}px`,
    );
    document.documentElement.style.setProperty("--claw-message-gap", `${uiSettings.messageGap}px`);
    document.documentElement.style.setProperty("--claw-panel-opacity", `${uiSettings.panelOpacity / 100}`);
    document.documentElement.style.setProperty(
      "--claw-pattern-strength",
      `${uiSettings.backgroundPatternStrength / 100}`,
    );
    document.documentElement.style.setProperty("--claw-accent", uiSettings.accentColor);
    document.documentElement.style.setProperty("--claw-accent-soft", uiSettings.accentSoftColor);
    document.documentElement.style.setProperty("--claw-user-bubble", uiSettings.userBubbleColor);
    document.documentElement.style.setProperty(
      "--claw-assistant-bubble",
      uiSettings.assistantBubbleColor,
    );
    document.documentElement.style.setProperty(
      "--claw-md-heading",
      uiSettings.markdownHeadingColor,
    );
    document.documentElement.style.setProperty("--claw-md-link", uiSettings.markdownLinkColor);
    document.documentElement.style.setProperty("--claw-md-strong", uiSettings.markdownBoldColor);
    document.documentElement.style.setProperty("--claw-md-em", uiSettings.markdownItalicColor);
    document.documentElement.style.setProperty("--claw-md-code-bg", uiSettings.markdownCodeBg);
    document.documentElement.style.setProperty("--claw-md-code-text", uiSettings.markdownCodeText);
    document.documentElement.style.setProperty("--claw-md-quote-bg", uiSettings.markdownQuoteBg);
    document.documentElement.style.setProperty(
      "--claw-md-quote-border",
      uiSettings.markdownQuoteBorderColor,
    );
    document.documentElement.style.setProperty(
      "--claw-session-indicator-w",
      `${uiSettings.sessionIndicatorWidth}px`,
    );
    document.documentElement.style.setProperty(
      "--claw-animation-duration-scale",
      uiSettings.enableAnimations ? "1" : "0",
    );
    if (uiSettings.enableAnimations) {
      document.documentElement.removeAttribute("data-animations-off");
    } else {
      document.documentElement.setAttribute("data-animations-off", "");
    }
    saveUiSettings(uiSettings);
  }, [uiSettings]);

  useEffect(() => {
    const normalizedText = normalizePathPrefixMappingsText(pathPrefixMappingsText);
    setActivePathPrefixMappingsText(normalizedText, { homeDir: getRuntimeHomeDir() });
    savePathPrefixMappingsText(normalizedText);
  }, [pathPrefixMappingsText]);

  useEffect(() => {
    if (uiSettings.autoHoverSidebar) {
      // Only auto-collapse in chat view; browser surfaces keep the sidebar expanded.
      setSidebarCollapsed(activeViewRef.current === "chat");
    }
  }, [uiSettings.autoHoverSidebar]);

  useEffect(() => {
    saveUiSettingsSchemes(uiSettingsSchemes);
  }, [uiSettingsSchemes]);

  useEffect(() => {
    saveModelShortcutSchemes(modelShortcutSchemes);
  }, [modelShortcutSchemes]);

  useEffect(() => {
    saveAgentSessionShortcutSchemes(agentSessionShortcutSchemes);
  }, [agentSessionShortcutSchemes]);

  useEffect(() => {
    saveAppActionShortcuts(appActionShortcuts);
  }, [appActionShortcuts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.activeUiSettingsScheme, activeUiSettingsSchemeId);
    } catch {
      // ignore
    }
  }, [activeUiSettingsSchemeId]);

  useEffect(() => {
    try {
      if (newSessionPreferredModel) {
        localStorage.setItem(STORAGE_KEYS.newSessionPreferredModel, newSessionPreferredModel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.newSessionPreferredModel);
      }
    } catch {
      // ignore
    }
  }, [newSessionPreferredModel]);

  useEffect(() => {
    const normalized = normalizeGatewayUrl(gatewayUrl);
    if (normalized !== gatewayUrl) {
      setGatewayUrl(normalized);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.gatewayUrl, normalized);
    } catch {
      // ignore
    }
  }, [gatewayUrl]);

  useEffect(() => {
    const setGatewayUrl = window.desktopInfo?.setGatewayUrl;
    if (typeof setGatewayUrl !== "function") {
      return;
    }
    void setGatewayUrl(gatewayUrl).catch(() => {
      // ignore desktop bridge errors
    });
  }, [gatewayUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.token, token);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.fsServerUrl, fsServerUrl);
    } catch {
      // ignore
    }
    const setUrl = window.desktopInfo?.setFsServerUrl;
    if (typeof setUrl === "function") {
      void setUrl(fsServerUrl).catch(() => {});
    }
  }, [fsServerUrl]);

  useEffect(() => {
    if (selectedSessionKey) {
      try {
        localStorage.setItem(STORAGE_KEYS.lastSession, selectedSessionKey);
      } catch {
        // ignore
      }
    }
  }, [selectedSessionKey]);

  useEffect(() => {
    sessionPreviewFetchSeqRef.current += 1;
    sessionPreviewKeysSignatureRef.current = "";
    setSessionPreviews({});
    setAllSessionRows({});
    const client = new GatewayClient({
      url: gatewayUrl,
      token,
      password,
      clientName: "openclaw-control-ui",
      mode: "webchat",
      onHello: (hello) => {
        const helloState = normalizeGatewayHelloState(hello, DEFAULT_MAX_WS_PAYLOAD_BYTES);
        const previousConnectionStatus = connectionStatusRef.current;
        const isRecoveryHello = shouldAnnounceConnectionRecovery(
          previousConnectionStatus,
          hasConnectedOnceRef.current,
        );
        connectionStatusRef.current = "connected";
        setConnectionState({
          status: "connected",
          reason: null,
          note: null,
        });
        gatewayMethodsRef.current = helloState.methods;
        devicePairingController.handleGatewayHello(client);
        setServerInfo({
          version: helloState.serverVersion,
          commit: helloState.serverCommit,
        });
        setMaxPayloadBytes(helloState.maxPayloadBytes);
        void loadAgents(client);
        void loadModels(client);
        void refreshSessions(client);
        const activeSessionKey = selectedSessionRef.current;
        if (isRecoveryHello) {
          showConnectionRecoveryNotice(
            buildConnectionRecoveryNotice({
              stage: "gateway-reconnected",
              hasActiveSession: Boolean(activeSessionKey),
            }),
          );
        }
        if (activeSessionKey) {
          updateSessionActivity(activeSessionKey, { unread: false });
          void reloadActiveSessionHistory(client, {
            recoverySessionKey: isRecoveryHello ? activeSessionKey : null,
          });
        }
        hasConnectedOnceRef.current = true;
      },
      onClose: (info) => {
        gatewayMethodsRef.current.clear();
        devicePairingController.handleGatewayClose();
        const activeSessionKey = selectedSessionRef.current;
        const interruptedRunSnapshot = buildInterruptedRunSnapshot({
          sessionKey: activeSessionKey,
          runId: chatRunRef.current,
          streamText: pendingStreamTextRef.current ?? streamTextRef.current,
          thinking: thinkingRef.current,
          toolItems: toolItemsRef.current,
        });
        setInterruptedRunSnapshot(interruptedRunSnapshot);
        clearConnectionRecoveryNotice();
        clearActiveStreamingState();
        if (activeSessionKey) {
          updateSessionActivity(activeSessionKey, { working: false, unread: false });
        }
        const nextConnectionState = normalizeGatewayCloseState(info, client.isClosed);
        connectionStatusRef.current = nextConnectionState.status;
        setConnectionState(nextConnectionState);
      },
      onEvent: (evt) => {
        const shellEvent = normalizeShellGatewayEvent(evt.event, evt.payload);
        if (shellEvent) {
          switch (shellEvent.kind) {
            case "device-pair-requested":
            case "device-pair-resolved":
              devicePairingController.handleGatewayEvent(shellEvent, client);
              break;
            case "approval-requested":
              handleRequestedApproval(shellEvent.approval);
              break;
            case "approval-resolved":
              handleResolvedApproval(shellEvent.resolution);
              break;
          }
          return;
        }
        if (isEventVariant(evt.event, "chat")) {
          handleChatEvent(evt.payload, evt.event);
        }
        if (evt.event === "agent") {
          handleAgentEvent(evt.payload);
          return;
        }
        const evtName = evt.event.toLowerCase();
        const payload = isRecord(evt.payload) ? evt.payload : {};
        const payloadData = isRecord(payload.data) ? payload.data : {};
        const streamHint =
          getString(payload, ["stream", "channel", "topic"]) ??
          getString(payloadData, ["stream", "channel", "topic"]) ??
          "";
        const shouldParseTool =
          evtName.includes("agent") ||
          evtName.includes("tool") ||
          evtName.includes("function") ||
          streamHint.toLowerCase().includes("tool");
        if (shouldParseTool) {
          handleAgentEvent(evt.payload);
        }
      },
    });
    clientRef.current = client;
    client.start();
    return () => client.stop();
  }, [gatewayUrl, token, password]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    const client = clientRef.current;
    if (!client || !selectedSessionKey) {
      return;
    }
    if (pendingSessionCreatesRef.current.has(selectedSessionKey)) {
      return;
    }
    setCanLoadMoreHistory(historyCanLoadMoreBySessionRef.current[selectedSessionKey] ?? false);
    const cached = sessionCacheRef.current.get(selectedSessionKey);
    if (cached) {
      const hasCachedContent =
        cached.messages.length > 0 ||
        cached.toolItems.length > 0 ||
        Boolean(cached.streamText) ||
        Boolean(cached.chatRunId) ||
        cached.thinking;
      if (hasCachedContent) {
        const ageMs = Date.now() - cached.lastLoadedAt;
        if (ageMs < 30_000) {
          return;
        }
      }
    }
    void loadHistory(client, selectedSessionKey, getHistoryLimit(selectedSessionKey));
  }, [connected, selectedSessionKey]);

  const currentSession = useMemo(() => {
    if (!selectedSessionKey) {
      return null;
    }
    return (
      sessions.find((session) => session.key === selectedSessionKey) ??
      sessions.find((session) => sessionKeysMatch(session.key, selectedSessionKey)) ??
      null
    );
  }, [sessions, selectedSessionKey]);

  const currentSessionAgent = useMemo(
    () => resolveAgentForSession(agents, selectedSessionKey ?? currentSession?.key),
    [agents, selectedSessionKey, currentSession?.key],
  );

  const defaultAgentChoice = useMemo(
    () => resolveAgentForSession(agents, null),
    [agents],
  );

  const newSessionAgentChoices = useMemo(() => {
    const listedAgents = agents?.agents ?? [];
    const next: AgentChoice[] = [];
    const seen = new Set<string>();
    for (const entry of listedAgents) {
      const normalizedId = normalizeAgentId(entry.id);
      if (!normalizedId) {
        continue;
      }
      if (seen.has(normalizedId)) {
        continue;
      }
      seen.add(normalizedId);
      next.push({
        id: normalizedId,
        label: resolveAgentChoiceLabel(entry),
      });
    }
    if (!seen.has(defaultAgentChoice.id)) {
      next.unshift(defaultAgentChoice);
    }
    return next;
  }, [agents, defaultAgentChoice]);

  useEffect(() => {
    setSessionModelOverrides((prev) => {
      const activeKeys = new Set(sessions.map((session) => session.key));
      const nextEntries = Object.entries(prev).filter(([key]) => activeKeys.has(key));
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
    setSessionThinkingOverrides((prev) => {
      const activeKeys = new Set(sessions.map((session) => session.key));
      const nextEntries = Object.entries(prev).filter(([key]) => activeKeys.has(key));
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [sessions]);

  const usageEnabledRef = useRef(new Set<string>());
  const usageEnablePendingRef = useRef(new Set<string>());
  const verboseEnabledRef = useRef(new Set<string>());
  const verboseEnablePendingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!connected) {
      return;
    }
    const client = clientRef.current;
    if (!client || !currentSession?.key) {
      return;
    }
    const usage = (currentSession.responseUsage ?? "").toLowerCase();
    if (usage === "tokens" || usage === "full") {
      usageEnabledRef.current.add(currentSession.key);
      return;
    }
    void ensureUsageTokenStats(client, currentSession.key);
  }, [connected, currentSession?.key, currentSession?.responseUsage]);

  async function ensureUsageTokenStats(client: GatewayClient, key: string) {
    if (usageEnabledRef.current.has(key) || usageEnablePendingRef.current.has(key)) {
      return;
    }
    usageEnablePendingRef.current.add(key);
    try {
      await client.request("sessions.patch", {
        key,
        responseUsage: "tokens",
      });
      usageEnabledRef.current.add(key);
      setSessions((prev) =>
        prev.map((session) =>
          session.key === key ? { ...session, responseUsage: "tokens" } : session,
        ),
      );
      await refreshSessions(client);
    } catch {
      // ignore
    } finally {
      usageEnablePendingRef.current.delete(key);
    }
  }

  useEffect(() => {
    if (!connected) {
      return;
    }
    const client = clientRef.current;
    if (!client || !currentSession?.key) {
      return;
    }
    if (verboseEnabledRef.current.has(currentSession.key)) {
      return;
    }
    if ((currentSession.verboseLevel ?? "").toLowerCase() === "on") {
      verboseEnabledRef.current.add(currentSession.key);
      return;
    }
    void ensureVerboseToolEvents(client, currentSession.key);
  }, [connected, currentSession?.key, currentSession?.verboseLevel]);

  async function ensureVerboseToolEvents(client: GatewayClient, key: string) {
    if (verboseEnabledRef.current.has(key) || verboseEnablePendingRef.current.has(key)) {
      return;
    }
    verboseEnablePendingRef.current.add(key);
    try {
      await client.request("sessions.patch", {
        key,
        verboseLevel: "on",
      });
      verboseEnabledRef.current.add(key);
      await refreshSessions(client);
    } catch {
      // ignore
    } finally {
      verboseEnablePendingRef.current.delete(key);
    }
  }

  const sessionInfo = useMemo(() => {
    const serverModel = currentSession?.model
      ? currentSession.modelProvider
        ? `${currentSession.modelProvider}/${currentSession.model}`
        : currentSession.model
      : sessionDefaults?.modelProvider && sessionDefaults?.model
        ? `${sessionDefaults.modelProvider}/${sessionDefaults.model}`
        : sessionDefaults?.model ?? "";
    const overrideModel =
      selectedSessionKey ? sessionModelOverrides[selectedSessionKey] : undefined;
    const overrideThinking =
      selectedSessionKey ? sessionThinkingOverrides[selectedSessionKey] : undefined;
    const modelLabel = overrideModel ?? serverModel;
    const modelId = overrideModel ?? serverModel;
    const overrideModelCatalog =
      models.find((entry) => `${entry.provider}/${entry.id}` === modelId) ??
      models.find((entry) => entry.id === modelId) ??
      null;
    const contextTokens = toFiniteNumber(currentSession?.contextTokens);
    const inputTokens = toFiniteNumber(currentSession?.inputTokens);
    const outputTokens = toFiniteNumber(currentSession?.outputTokens);
    const totalTokens =
      toFiniteNumber(currentSession?.totalTokens) ??
      (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
    const defaultContextTokens = toFiniteNumber(sessionDefaults?.contextTokens);
    return {
      agentId: currentSessionAgent.id,
      agentLabel: currentSessionAgent.label,
      modelLabel,
      modelId,
      contextLimit:
        overrideModelCatalog?.contextWindow ??
        contextTokens ??
        defaultContextTokens ??
        null,
      contextTokens,
      inputTokens,
      outputTokens,
      totalTokens,
      thinkingLevel: overrideThinking ?? currentSession?.thinkingLevel ?? thinkingLevel,
      responseUsage: currentSession?.responseUsage ?? null,
    };
  }, [
    currentSessionAgent.id,
    currentSessionAgent.label,
    currentSession,
    thinkingLevel,
    sessionDefaults,
    sessionModelOverrides,
    sessionThinkingOverrides,
    selectedSessionKey,
    models,
  ]);

  const currentShortcutModel = useMemo(
    () => resolveCanonicalModelFromCatalog(sessionInfo.modelId || sessionInfo.modelLabel || "", models),
    [sessionInfo.modelId, sessionInfo.modelLabel, models],
  );
  const currentShortcutThinkingLevel = useMemo(
    () => normalizeThinkingValue(sessionInfo.thinkingLevel),
    [sessionInfo.thinkingLevel],
  );

  const appActionShortcutEntries = useMemo(
    () => [
      {
        id: "toggleSidebar" as const,
        label: "Toggle Sidebar",
        enabled: appActionShortcuts.toggleSidebar.enabled,
        combo: appActionShortcuts.toggleSidebar.combo,
        shortcutLabel: resolveShortcutLabel(appActionShortcuts.toggleSidebar.combo),
      },
      {
        id: "newSession" as const,
        label: "New Session",
        enabled: appActionShortcuts.newSession.enabled,
        combo: appActionShortcuts.newSession.combo,
        shortcutLabel: resolveShortcutLabel(appActionShortcuts.newSession.combo),
      },
      {
        id: "toggleFiles" as const,
        label: "Toggle Files",
        enabled: appActionShortcuts.toggleFiles.enabled,
        combo: appActionShortcuts.toggleFiles.combo,
        shortcutLabel: resolveShortcutLabel(appActionShortcuts.toggleFiles.combo),
      },
    ],
    [appActionShortcuts],
  );

  const modelShortcutSlots = useMemo(
    () =>
      Array.from({ length: MODEL_SHORTCUT_SLOT_MAX }, (_, index) => {
        const slot = index + MODEL_SHORTCUT_SLOT_MIN;
        const scheme = modelShortcutSchemes[String(slot)] ?? null;
        const combo = scheme?.combo ?? getDefaultShortcutCombo(slot);
        return {
          slot,
          combo,
          shortcutLabel: resolveShortcutLabel(combo),
          scheme,
        };
      }),
    [modelShortcutSchemes],
  );

  const currentShortcutAgentId = useMemo(
    () => currentSessionAgent.id,
    [currentSessionAgent.id],
  );
  const currentShortcutAgentLabel = useMemo(
    () => currentSessionAgent.label,
    [currentSessionAgent.label],
  );

  const agentSessionShortcutSlots = useMemo(
    () =>
      Array.from({ length: AGENT_SESSION_SHORTCUT_SLOT_MAX }, (_, index) => {
        const slot = index + AGENT_SESSION_SHORTCUT_SLOT_MIN;
        const scheme = agentSessionShortcutSchemes[String(slot)] ?? null;
        const combo = scheme?.combo ?? {
          ...getDefaultAgentSessionShortcutCombo(slot),
          key: getDefaultAgentSessionShortcutKey(slot),
        };
        return {
          slot,
          combo,
          shortcutLabel: resolveShortcutLabel(combo),
          scheme,
        };
      }),
    [agentSessionShortcutSchemes],
  );

  async function loadAgents(client: GatewayClient) {
    try {
      const res = normalizeAgentsListResult(await client.request("agents.list", {}));
      setAgents(res);
      if (!selectedSessionKey) {
        setSelectedSessionKey(resolveMainSessionFallback(res));
      }
      // Agent metadata determines the canonical "main" session key.
      // Refresh once more so the pinned-main ordering uses the resolved default agent/main key.
      void refreshSessions(client);
    } catch (err) {
      setConnectionState((prev) => ({
        ...prev,
        note: String(err),
      }));
    }
  }

  async function loadModels(client: GatewayClient): Promise<ModelsListResult["models"]> {
    try {
      const res = normalizeModelsListResult(await client.request("models.list", {}));
      const catalog = res.models;
      let configuredKeys = new Set<string>();
      try {
        const configState = normalizeShellGatewayConfigState(await client.request("config.get", {}));
        lastConfigStateRef.current = configState;
        applyConfigRuntimePathHints(configState);
        configuredKeys = configState.configuredModelKeys;
      } catch {
        // ignore
      }

      const filtered = filterConfiguredModels(catalog, configuredKeys);
      setModels(filtered);
      return filtered;
    } catch {
      setModels([]);
      return [];
    }
  }

  const searchSessionsFromGateway = useCallback(async (query: string): Promise<GatewaySessionRow[]> => {
    const client = clientRef.current;
    const needle = query.trim();
    if (!client || !needle) {
      return [];
    }
    try {
      const res = normalizeSessionsListResult(await client.request("sessions.list", {
        search: needle,
        limit: SESSION_SEARCH_LIMIT,
        includeDerivedTitles: true,
        includeLastMessage: true,
      }));
      return mergeSessionRowsWithLocalState(sessionsRef.current, res.sessions);
    } catch {
      return [];
    }
  }, []);

  const preloadAllSessionPreviews = useCallback(async (client: GatewayClient) => {
    // Step 1: Fetch ALL session keys with titles (for search result display)
    let allSessions: GatewaySessionRow[];
    try {
      const res = normalizeSessionsListResult(await client.request("sessions.list", {
        limit: SESSION_LIST_MAX_LIMIT,
        includeDerivedTitles: true,
        includeLastMessage: true,
      }));
      allSessions = mergeSessionRowsWithLocalState(sessionsRef.current, res.sessions);
    } catch {
      return;
    }
    if (allSessions.length === 0 || clientRef.current !== client) {
      return;
    }

    // Store all session row data for search result rendering
    const rowsByKey: Record<string, GatewaySessionRow> = {};
    const uniqueKeys: string[] = [];
    for (const s of allSessions) {
      if (s.key.trim().length > 0) {
        rowsByKey[s.key] = s;
        uniqueKeys.push(s.key);
      }
    }
    setAllSessionRows(rowsByKey);
    const keysSignature = [...uniqueKeys].sort().join("\n");
    if (keysSignature === sessionPreviewKeysSignatureRef.current) {
      return;
    }
    sessionPreviewKeysSignatureRef.current = keysSignature;
    sessionPreviewFetchSeqRef.current += 1;
    const fetchSeq = sessionPreviewFetchSeqRef.current;

    // Step 3: Batch-fetch previews for ALL sessions
    const fetchedByKey: Record<string, SessionPreviewItem[]> = {};
    for (let index = 0; index < uniqueKeys.length; index += SESSION_PREVIEW_BATCH_SIZE) {
      if (clientRef.current !== client || sessionPreviewFetchSeqRef.current !== fetchSeq) {
        return;
      }
      const batch = uniqueKeys.slice(index, index + SESSION_PREVIEW_BATCH_SIZE);
      try {
        const res = normalizeSessionsPreviewResult(await client.request("sessions.preview", {
          keys: batch,
          limit: SESSION_PREVIEW_ITEM_LIMIT,
          maxChars: SESSION_PREVIEW_MAX_CHARS,
        }));
        for (const preview of res.previews) {
          fetchedByKey[preview.key] = preview.items;
        }
      } catch {
        // Ignore individual preview batch failures; search can still use partial cache.
      }
    }

    if (clientRef.current !== client || sessionPreviewFetchSeqRef.current !== fetchSeq) {
      return;
    }

    setSessionPreviews((previous) => {
      const next: Record<string, SessionPreviewItem[]> = {};
      for (const key of uniqueKeys) {
        next[key] = fetchedByKey[key] ?? previous[key] ?? [];
      }
      return next;
    });
  }, []);

  async function refreshSessions(client: GatewayClient, requestedLimit?: number) {
    try {
      const limit = Math.min(
        SESSION_LIST_MAX_LIMIT,
        Math.max(1, requestedLimit ?? sessionListLimitRef.current),
      );
      if (limit !== sessionListLimitRef.current) {
        sessionListLimitRef.current = limit;
        setSessionListLimit(limit);
      }
      const res = normalizeSessionsListResult(await client.request("sessions.list", {
        limit,
        includeDerivedTitles: true,
        includeLastMessage: true,
      }));
      setSessionDefaults(res.defaults);
      const primarySessionKey = resolvePrimarySessionKey(agents, lastConfigStateRef.current);
      const mergedSessions = mergeSessionRowsWithLocalState(sessionsRef.current, res.sessions);
      const ordered = [...mergedSessions].sort((a, b) => {
        const aIsPrimary = a.key.toLowerCase() === primarySessionKey;
        const bIsPrimary = b.key.toLowerCase() === primarySessionKey;
        if (aIsPrimary !== bIsPrimary) {
          return aIsPrimary ? -1 : 1;
        }
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      });
      // Patch: fill missing lastMessagePreview from cached stream text
      for (const session of ordered) {
        if (!session.lastMessagePreview) {
          const cached = sessionCacheRef.current.get(session.key);
          if (cached) {
            const lastMsg = cached.messages[cached.messages.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg.text?.trim()) {
              session.lastMessagePreview = lastMsg.text.trim();
            }
          }
        }
      }
      // Filter out sessions that are currently being deleted (prevents reappear flicker)
      const pendingDeletes = deletingSessionKeysRef.current;
      const visible = pendingDeletes.size > 0
        ? ordered.filter((s) => !pendingDeletes.has(s.key))
        : ordered;
      setSessions(visible);
      void preloadAllSessionPreviews(client);
      setCanLoadMoreSessions(visible.length >= limit && limit < SESSION_LIST_MAX_LIMIT);
      loadingMoreSessionsRef.current = false;
      setSelectedSessionKey((previousKey) =>
        reconcileSelectedSessionKey({
          previousKey,
          sessions: visible,
          primarySessionKey,
        }),
      );
    } catch (err) {
      loadingMoreSessionsRef.current = false;
      setConnectionState((prev) => ({
        ...prev,
        note: String(err),
      }));
    }
  }

  function refreshSessionsWithFollowUp(client: GatewayClient) {
    clearDeferredSessionRefreshTimers();
    const delaysMs = [260, 1100];
    deferredSessionRefreshTimersRef.current = delaysMs.map((delayMs) =>
      window.setTimeout(() => {
        if (clientRef.current !== client) {
          return;
        }
        void refreshSessions(client);
      }, delayMs)
    );
  }

  async function loadHistory(client: GatewayClient, key: string, requestedLimit?: number) {
    if (selectedSessionRef.current === key) {
      loadingSessionKeyRef.current = key;
      setIsCurrentSessionLoading(true);
    }
    try {
      const limit = Math.min(
        CHAT_HISTORY_MAX_LIMIT,
        Math.max(1, requestedLimit ?? getHistoryLimit(key)),
      );
      setHistoryLimit(key, limit);
      const history = normalizeShellGatewayHistory(await client.request("chat.history", {
        sessionKey: key,
        limit,
      }), {
        fallbackNow: Date.now(),
        toChatMessage: (raw, fallbackTimestamp) =>
          toChatMessageSafe(raw, getAttachmentParsingOptions(fallbackTimestamp)),
        buildToolAttachmentMessages: buildAttachmentMessagesFromToolUpdates,
        buildMessageDedupeKey: buildChatMessageDedupeKey,
      });
      const canLoadMore = history.rawCount >= limit && limit < CHAT_HISTORY_MAX_LIMIT;
      historyCanLoadMoreBySessionRef.current = {
        ...historyCanLoadMoreBySessionRef.current,
        [key]: canLoadMore,
      };
      const isActiveSession = selectedSessionRef.current === key;
      if (isActiveSession) {
        setCanLoadMoreHistory(canLoadMore);
      }
      const resolvedThinkingLevel = history.thinkingLevel;
      const historyMessages = history.messages;
      const historyTools = mergeToolItems([], history.toolUpdates);
      const activeStreamText = pendingStreamTextRef.current ?? streamTextRef.current;
      const shouldPreserveActiveStreaming =
        isActiveSession &&
        (thinkingRef.current ||
          Boolean(chatRunRef.current) ||
          Boolean(activeStreamText && activeStreamText.trim()));
      const mergedTools = shouldPreserveActiveStreaming
        ? mergeToolItems(historyTools, toolItemsRef.current)
        : historyTools;
      const existingViewState = sessionCacheRef.current.get(key) ?? getEmptySessionViewState();
      sessionCacheRef.current.set(key, {
        messages: historyMessages,
        streamText: shouldPreserveActiveStreaming ? activeStreamText : null,
        toolItems: mergedTools,
        thinking: shouldPreserveActiveStreaming ? thinkingRef.current : false,
        chatRunId: shouldPreserveActiveStreaming ? chatRunRef.current : null,
        thinkingLevel: resolvedThinkingLevel,
        draft: existingViewState.draft,
        attachments: existingViewState.attachments,
        lastLoadedAt: Date.now(),
      });
      if (!isActiveSession) {
        return;
      }
      setSessionTransitionState("idle");
      applyThreadToolState({
        messages: historyMessages,
        streamText: shouldPreserveActiveStreaming ? activeStreamText : null,
        toolItems: mergedTools,
        thinking: shouldPreserveActiveStreaming ? thinkingRef.current : false,
        chatRunId: shouldPreserveActiveStreaming ? chatRunRef.current : null,
        thinkingLevel: resolvedThinkingLevel,
      });
      if (!shouldPreserveActiveStreaming) {
        finalizedAssistantByRunRef.current.clear();
        lastFinalizedAssistantRef.current = null;
      }
    } catch (err) {
      if (selectedSessionRef.current !== key) {
        return;
      }
      setConnectionState((prev) => ({
        ...prev,
        note: String(err),
      }));
    } finally {
      historyLoadInFlightRef.current.delete(key);
      if (selectedSessionRef.current === key) {
        setLoadingOlderHistory(false);
      }
      if (loadingSessionKeyRef.current === key) {
        loadingSessionKeyRef.current = null;
        setIsCurrentSessionLoading(false);
      }
    }
  }

  const getCachedStreamText = useCallback(
    (key: string) => sessionCacheRef.current.get(key)?.streamText ?? "",
    [],
  );

  const getCachedChatRunId = useCallback(
    (key: string) => sessionCacheRef.current.get(key)?.chatRunId ?? null,
    [],
  );

  const threadToolEventController = useThreadToolEventController({
    chatRunRef,
    thinkingRef,
    streamTextRef,
    setMessages,
    setChatRunId,
    setThinking,
    setToolItems,
    mergeStreamTextSynced,
    reloadActiveSessionHistory,
    resolveSessionKeyFromCache: resolveEventSessionKeyFromCache,
    sessionKeysMatch,
    updateCacheField,
    getCachedStreamText,
    getCachedChatRunId,
    updateSessionActivity,
    clearAgentFinalizeTimer,
    getAssistantReplyForRun,
    applySessionTokenStatsFromMessage,
    clearRunAssistantProjectionState,
    clearCachedStreamingState,
    clearActiveRunTransientState,
    updateActiveSessionRunActivity,
    applyFinalizedRunHydrationDecision,
    scheduleActiveHistoryHydration,
    hasCommittedAssistantAttachmentForRun,
    runHasExpectedMediaForRun,
    shouldSkipAssistantFinal,
    refreshSessionListsSoon,
    notifyReplyCompleted,
    attachLifecycleErrorToCachedTools,
    attachLifecycleErrorToActiveTools,
    scheduleAgentFinalizeFallback,
    clearInterruptedRunSnapshotForRun,
    pushSystemMessage,
    buildStreamCommittedAssistantMessage,
    buildToolAttachmentMessage,
    buildAttachmentMessagesFromToolUpdates,
    collectToolFinalMessages,
    buildFinalAssistantMessage,
    upsertAssistantMessageForRun,
    appendDistinctMessages,
    mergeToolItems,
    buildAssistantReplyAttachmentProjection,
    commitAssistantReplyAttachmentProjection,
    mergeStreamingText,
    resolveActiveFinalAssistantEvent,
  });

  function handleChatEvent(payload: unknown, eventHint?: string) {
    const parsed = normalizeChatEventPayload(payload, eventHint);
    if (!parsed) {
      return;
    }
    threadToolEventController.handleChatEvent(parsed, payload, selectedSessionRef.current);
  }

  function handleAgentEvent(payload: unknown) {
    const normalized = normalizeAgentEventPayload(payload);
    if (!normalized) {
      return;
    }
    threadToolEventController.handleAgentEvent(normalized, selectedSessionRef.current);
  }

  function handleRequestedApproval(approval: PendingApproval) {
    setPendingApprovalsBySession((prev) => upsertPendingApprovalBySession(prev, approval));
  }

  function handleResolvedApproval(resolution: ApprovalResolution) {
    setPendingApprovalsBySession((prev) => removeResolvedApprovalBySession(prev, resolution));
    setResolvingApprovalIds((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, resolution.id)) {
        return prev;
      }
      const next = { ...prev };
      delete next[resolution.id];
      return next;
    });
  }

  async function handleResolvePendingApproval(
    approval: PendingApproval,
    decision: ApprovalDecision,
  ) {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const method = pickApprovalResolveMethod(gatewayMethodsRef.current, approval.kind);
    if (!method) {
      pushSystemMessage(`Approval resolve is not available for ${approval.kind} approvals on this gateway.`);
      return;
    }
    setResolvingApprovalIds((prev) => ({ ...prev, [approval.id]: decision }));
    try {
      await client.request(method, {
        id: approval.id,
        decision,
      });
      setPendingApprovalsBySession((prev) =>
        removeResolvedApprovalBySession(prev, {
          id: approval.id,
          kind: approval.kind,
          sessionKey: approval.sessionKey,
          decision,
        }),
      );
      pushSystemMessage(`Approval submitted: ${formatApprovalDecisionLabel(decision)}.`);
    } catch (err) {
      pushSystemMessage(`Approval failed: ${String(err)}`);
    } finally {
      setResolvingApprovalIds((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, approval.id)) {
          return prev;
        }
        const next = { ...prev };
        delete next[approval.id];
        return next;
      });
    }
  }

  function pushSystemMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: generateUUID(), role: "system", text, timestamp: Date.now() },
    ]);
  }

  function resolveTargetAgentId(preferredAgentId?: string | null): string {
    const preferred = preferredAgentId?.trim();
    if (preferred) {
      return resolveAgentIdWithFallback(preferred);
    }
    if (agents?.defaultId) {
      return resolveAgentIdWithFallback(agents.defaultId);
    }
    const current = selectedSessionRef.current;
    if (current?.startsWith("agent:")) {
      const parts = current.split(":");
      if (parts.length > 1 && parts[1]) {
        return resolveAgentIdWithFallback(parts[1]);
      }
    }
    return "main";
  }

  function handleSelectSession(key: string) {
    if (!key) {
      return;
    }
    const previousKey = selectedSessionRef.current;
    if (previousKey && previousKey !== key) {
      saveCurrentToCache(previousKey);
    }
    updateSessionActivity(key, { unread: false });
    const restored = restoreFromCache(key);
    if (!restored) {
      clearActiveSessionView();
    }
    selectedSessionRef.current = key;
    setCanLoadMoreHistory(historyCanLoadMoreBySessionRef.current[key] ?? false);
    setSessionTransitionState(previousKey && previousKey !== key ? "switching" : "idle");
    setSelectedSessionKey(key);
  }

  async function createSession(
    labelInput: string,
    closeModal: boolean,
    preferredAgentId?: string | null,
    preferredModelId?: string | null,
  ): Promise<string | null> {
    const client = clientRef.current;
    if (!client) {
      return null;
    }
    const label = resolveSessionLabel(labelInput);
    const slug = label ? (slugify(label) || "chat") : "chat";
    const agentId = resolveTargetAgentId(preferredAgentId);
    const key = `agent:${agentId}:ui:${slug}-${generateUUID().slice(0, 8)}`;
    const primarySessionKey = resolvePrimarySessionKey(agents, lastConfigStateRef.current);
    const previousSelectedKey = selectedSessionRef.current;
    if (previousSelectedKey && previousSelectedKey !== key) {
      saveCurrentToCache(previousSelectedKey);
    }
    pendingSessionCreatesRef.current.add(key);
    setSessions((prev) => {
      const nextSession: GatewaySessionRow = {
        key,
        kind: "direct",
        label: label || undefined,
        derivedTitle: label || undefined,
        lastMessagePreview: "",
        updatedAt: Date.now(),
      };
      const withoutDuplicate = prev.filter((session) => session.key !== key);
      const primaryIndex = withoutDuplicate.findIndex(
        (session) => session.key.toLowerCase() === primarySessionKey,
      );
      if (primaryIndex < 0) {
        return [nextSession, ...withoutDuplicate];
      }
      const next = [...withoutDuplicate];
      next.splice(primaryIndex + 1, 0, nextSession);
      return next;
    });
    setSessionPreviews((prev) => (Object.prototype.hasOwnProperty.call(prev, key)
      ? prev
      : { ...prev, [key]: [] }));
    selectedSessionRef.current = key;
    setSelectedSessionKey(key);
    clearThreadToolState();
    setDraft("");
    clearAttachments();
    sessionCacheRef.current.set(key, {
      ...createEmptyThreadToolStateSnapshot(),
      draft: "",
      attachments: [],
      lastLoadedAt: Date.now(),
    });
    updateSessionActivity(key, { working: false, unread: false });
    setHistoryLimit(key, CHAT_HISTORY_INITIAL_LIMIT);
    historyCanLoadMoreBySessionRef.current = {
      ...historyCanLoadMoreBySessionRef.current,
      [key]: false,
    };
    setCanLoadMoreHistory(false);
    try {
      await client.request("sessions.patch", { key, ...(label ? { label } : {}) });
      // Apply preferred model if specified
      const modelToApply = preferredModelId?.trim() || "";
      if (modelToApply) {
        try {
          await client.request("sessions.patch", { key, model: modelToApply });
          if (normalizeModelKey(modelToApply) === "default") {
            setSessionModelOverrides((prev) => clearOverride(prev, key));
          } else {
            setSessionModelOverrides((prev) => ({ ...prev, [key]: modelToApply }));
          }
        } catch {
          // model patch failed but session was created — continue
        }
      }
      if (closeModal) {
        setShowNewSession(false);
      }
      pendingSessionCreatesRef.current.delete(key);
      if (selectedSessionRef.current === key) {
        setCanLoadMoreHistory(historyCanLoadMoreBySessionRef.current[key] ?? false);
        void loadHistory(client, key, getHistoryLimit(key));
      }
      void refreshSessions(client);
      return key;
    } catch (err) {
      pendingSessionCreatesRef.current.delete(key);
      setSessions((prev) => prev.filter((session) => session.key !== key));
      selectedSessionRef.current = previousSelectedKey;
      setSelectedSessionKey((prev) => (prev === key ? previousSelectedKey : prev));
      sessionCacheRef.current.delete(key);
      setSessionActivity((prev) => {
        if (!(key in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
      const nextHistoryCanLoadMore = { ...historyCanLoadMoreBySessionRef.current };
      delete nextHistoryCanLoadMore[key];
      historyCanLoadMoreBySessionRef.current = nextHistoryCanLoadMore;
      const nextHistoryLimit = { ...historyLimitBySessionRef.current };
      delete nextHistoryLimit[key];
      historyLimitBySessionRef.current = nextHistoryLimit;
      if (previousSelectedKey) {
        restoreFromCache(previousSelectedKey);
        setCanLoadMoreHistory(historyCanLoadMoreBySessionRef.current[previousSelectedKey] ?? false);
        void loadHistory(client, previousSelectedKey, getHistoryLimit(previousSelectedKey));
      }
      pushSystemMessage(`Create failed: ${String(err)}`);
      return null;
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const matchedModelScheme = Object.values(modelShortcutSchemes).find(
        (entry) => entry && isShortcutComboEventMatch(entry.combo, event),
      );
      if (matchedModelScheme) {
        event.preventDefault();
        void applyModelShortcutScheme(matchedModelScheme, "shortcut");
        return;
      }
      const matchedAgentScheme = Object.values(agentSessionShortcutSchemes).find(
        (entry) => entry && isShortcutComboEventMatch(entry.combo, event),
      );
      if (matchedAgentScheme) {
        event.preventDefault();
        void handleApplyAgentSessionShortcutScheme(matchedAgentScheme.slot, "shortcut");
        return;
      }
      const toggleSidebarShortcut = appActionShortcuts.toggleSidebar;
      if (toggleSidebarShortcut.enabled && !uiSettings.autoHoverSidebar && isShortcutComboEventMatch(toggleSidebarShortcut.combo, event)) {
        event.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        return;
      }
      const newSessionShortcut = appActionShortcuts.newSession;
      if (newSessionShortcut.enabled && isShortcutComboEventMatch(newSessionShortcut.combo, event)) {
        event.preventDefault();
        void createSession("", false, null, newSessionPreferredModel || null);
        return;
      }
      const toggleFilesShortcut = appActionShortcuts.toggleFiles;
      if (toggleFilesShortcut.enabled && isShortcutComboEventMatch(toggleFilesShortcut.combo, event)) {
        event.preventDefault();
        switchView(activeViewRef.current === "chat" ? "files" : "chat");
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [agents, connected, modelShortcutSchemes, agentSessionShortcutSchemes, appActionShortcuts, newSessionPreferredModel, uiSettings.autoHoverSidebar, switchView]);

  function buildStatusCard(
    statusPayload: unknown,
    configState: GatewayConfigState | null | undefined,
  ): string {
    const statusSnapshot = extractGatewayStatusSnapshot(statusPayload);
    const { statusRoot, defaults, recent } = statusSnapshot;
    const activeKey = selectedSessionRef.current ?? selectedSessionKey ?? currentSession?.key ?? null;
    const statusSession =
      (activeKey ? recent.find((entry) => getString(entry, ["key"]) === activeKey) : null) ??
      (currentSession?.key
        ? recent.find((entry) => getString(entry, ["key"]) === currentSession.key)
        : null) ??
      recent[0] ??
      null;

    const currentSessionModel = currentSession?.model
      ? currentSession.modelProvider
        ? `${currentSession.modelProvider}/${currentSession.model}`
        : currentSession.model
      : null;
    const statusModel = statusSession ? getString(statusSession, ["model"]) : null;
    const defaultsModel = defaults ? getString(defaults, ["model"]) : null;
    const modelLabel =
      sessionInfo.modelLabel ||
      currentSessionModel ||
      statusModel ||
      defaultsModel ||
      "unknown";
    const provider =
      modelLabel.includes("/")
        ? modelLabel.split("/")[0] ?? null
        : currentSession?.modelProvider ?? null;
    const authLabel = resolveProviderApiKeyLabel(configState, provider);
    const currentInputTokens = toFiniteNumber(currentSession?.inputTokens);
    const currentOutputTokens = toFiniteNumber(currentSession?.outputTokens);
    const currentTotalTokens =
      toFiniteNumber(currentSession?.totalTokens) ??
      (currentInputTokens !== null && currentOutputTokens !== null
        ? currentInputTokens + currentOutputTokens
        : null);
    const currentContextTokens = toFiniteNumber(currentSession?.contextTokens);
    const defaultContextTokens = defaults ? getNumberLike(defaults, ["contextTokens", "context_tokens"]) : null;

    const inputTokens =
      (statusSession ? getNumberLike(statusSession, ["inputTokens", "input_tokens"]) : null) ??
      currentInputTokens ??
      sessionInfo.inputTokens ??
      null;
    const outputTokens =
      (statusSession ? getNumberLike(statusSession, ["outputTokens", "output_tokens"]) : null) ??
      currentOutputTokens ??
      sessionInfo.outputTokens ??
      null;
    const contextUsed =
      (statusSession ? getNumberLike(statusSession, ["totalTokens", "total_tokens"]) : null) ??
      currentTotalTokens ??
      currentInputTokens ??
      sessionInfo.totalTokens ??
      sessionInfo.inputTokens ??
      null;
    const contextLimit =
      (statusSession ? getNumberLike(statusSession, ["contextTokens", "context_tokens"]) : null) ??
      currentContextTokens ??
      sessionInfo.contextLimit ??
      defaultContextTokens ??
      null;
    const contextPercent =
      Number.isFinite(contextUsed) && Number.isFinite(contextLimit) && (contextLimit as number) > 0
        ? Math.max(
          0,
          Math.min(999, Math.round(((contextUsed as number) / (contextLimit as number)) * 100)),
        )
        : null;
    const compactions =
      statusSession ? getNumberLike(statusSession, ["compactionCount", "compaction_count"]) ?? 0 : 0;
    const sessionKeyForLine =
      (statusSession ? getString(statusSession, ["key"]) : null) ??
      activeKey ??
      currentSession?.key ??
      "unknown";
    const updatedAt =
      (statusSession ? getNumberLike(statusSession, ["updatedAt", "updated_at"]) : null) ??
      toFiniteNumber(currentSession?.updatedAt) ??
      null;
    const runtime =
      (statusSession ? getString(statusSession, ["kind"]) : null) ??
      currentSession?.kind ??
      "direct";
    const thinkLabel = normalizeThinkingValue(sessionInfo.thinkingLevel);
    const verboseLevel = normalizeModelKey(
      (statusSession ? getString(statusSession, ["verboseLevel"]) : null) ??
      currentSession?.verboseLevel ??
      "",
    );
    const verboseLabel =
      verboseLevel === "full" ? "verbose:full" : verboseLevel === "on" ? "verbose" : null;
    const queueDepth = Array.isArray(statusRoot.queuedSystemEvents)
      ? statusRoot.queuedSystemEvents.length
      : (isRecord(statusRoot.queue) ? getNumber(statusRoot.queue, ["depth"]) : null) ?? 0;
    const queueMode = configState?.queueMode ?? "collect";
    const version = serverInfo.version?.trim() || "dev";
    const commit = serverInfo.commit?.trim() || null;
    const { subagentsLine, taskLine } = statusSnapshot;

    return [
      `🦞 OpenClaw ${version}${commit ? ` (${commit})` : ""}`,
      `🧠 Model: ${modelLabel}${authLabel ? ` · 🔑 ${authLabel}` : ""}`,
      `🧮 Tokens: ${Number.isFinite(inputTokens) ? formatCompactTokens(inputTokens) : "?"
      } in / ${Number.isFinite(outputTokens) ? formatCompactTokens(outputTokens) : "?"} out`,
      `📚 Context: ${Number.isFinite(contextUsed) ? formatCompactTokens(contextUsed) : "?"
      }/${Number.isFinite(contextLimit) ? formatCompactTokens(contextLimit) : "?"}${contextPercent !== null ? ` (${contextPercent}%)` : ""
      } · 🧹 Compactions: ${compactions}`,
      `🧵 Session: ${sessionKeyForLine} • updated ${formatAgeFromTimestamp(updatedAt)}`,
      subagentsLine,
      taskLine,
      `⚙️ Runtime: ${runtime} · Think: ${thinkLabel}${verboseLabel ? ` · ${verboseLabel}` : ""}`,
      `🪢 Queue: ${queueMode} (depth ${queueDepth})`,
    ].filter(Boolean).join("\n");
  }

  async function handleSend() {
    if (!connected) {
      return;
    }
    const client = clientRef.current;
    if (!client || !selectedSessionKey) {
      return;
    }
    const trimmed = draft.trim();
    if (trimmed.startsWith("/")) {
      const cmd = trimmed.replace(/^\//, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      const locallyHandledSlashCommands = new Set([
        "status",
        "models",
        "compact",
        "model",
        "think",
        "verbose",
        "reasoning",
        "usage",
        "abort",
        "new",
        "reset",
      ]);
      if (locallyHandledSlashCommands.has(cmd)) {
        await handleSlashCommand(trimmed);
        return;
      }
      // Let OpenClaw handle slash commands that the desktop app does not intercept locally.
    }

    if (!trimmed && attachments.length === 0) {
      return;
    }

    const responseUsage = (currentSession?.responseUsage ?? "").toLowerCase();
    if (responseUsage !== "tokens" && responseUsage !== "full") {
      await ensureUsageTokenStats(client, selectedSessionKey);
    }

    if ((currentSession?.verboseLevel ?? "").toLowerCase() !== "on") {
      await ensureVerboseToolEvents(client, selectedSessionKey);
    }

    clearInterruptedRunSnapshot(selectedSessionKey);
    const runId = generateUUID();
    const maxFrameBytes = Math.max(32 * 1024, maxPayloadBytes - WS_PAYLOAD_SAFETY_BYTES);
    const draftBeforeSend = draft;
    const attachmentsBeforeSend = attachments;

    let preparedAttachments = [...attachments];

    // ── PDF upload: save to ~/.openclaw/media/inbound/ (Telegram pattern) ──
    let pdfBlockText: string | null = null;
    const pdfAttachments = preparedAttachments.filter((att) => !att.isImage && isPdfAttachment(att));
    if (pdfAttachments.length > 0) {
      try {
        const { pdfBlocks, uploadedIds } = await uploadPdfsAndBuildBlocks(pdfAttachments);
        pdfBlockText = pdfBlocks;
        // Remove uploaded PDFs from attachments (they're now referenced by path)
        if (uploadedIds.size > 0) {
          preparedAttachments = preparedAttachments.filter((att) => !uploadedIds.has(att.id));
        }
      } catch (err) {
        pushSystemMessage(`PDF upload failed: ${String(err)}`);
        return;
      }
    }

    const toApiAttachments = (source: Attachment[]): OutgoingGatewayAttachment[] =>
      source
        .map((att): OutgoingGatewayAttachment | null => {
          const content = extractBase64Content(att.dataUrl);
          if (!content) {
            return null;
          }
          return {
            type: att.isImage ? ("image" as const) : ("file" as const),
            mimeType: att.type,
            fileName: att.name,
            content,
          };
        })
        .filter((item): item is OutgoingGatewayAttachment => item !== null);

    let apiAttachments = toApiAttachments(preparedAttachments);
    const fallbackText = buildFileFallbackText(preparedAttachments);
    // Combine all text parts: user text + text file fallback + PDF file blocks
    const messageParts = [trimmed, fallbackText, pdfBlockText].filter(Boolean);
    const outboundMessage = messageParts.join("\n\n") || "";

    let estimate = estimateChatSendFrameBytes({
      sessionKey: selectedSessionKey,
      message: outboundMessage,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
    });

    let compressionRounds = 0;
    while (apiAttachments.length > 0 && estimate > maxFrameBytes && compressionRounds < 8) {
      const imageCandidates = preparedAttachments
        .map((item, index) => ({
          item,
          index,
          bytes: estimateBase64Bytes(extractBase64Content(item.dataUrl)),
        }))
        .filter((entry) => entry.item.isImage && entry.bytes > MIN_IMAGE_ATTACHMENT_BYTES)
        .sort((a, b) => b.bytes - a.bytes);
      const largest = imageCandidates[0];
      if (!largest) {
        break;
      }
      const targetBytes = Math.max(
        MIN_IMAGE_ATTACHMENT_BYTES,
        Math.floor(largest.bytes * 0.72),
      );
      const compressed = await compressImageAttachment(largest.item, targetBytes);
      if (!compressed) {
        break;
      }
      const compressedBytes = estimateBase64Bytes(extractBase64Content(compressed.dataUrl));
      if (compressedBytes <= 0 || compressedBytes >= largest.bytes) {
        break;
      }
      preparedAttachments = preparedAttachments.map((item, index) =>
        index === largest.index ? compressed : item,
      );
      apiAttachments = toApiAttachments(preparedAttachments);
      estimate = estimateChatSendFrameBytes({
        sessionKey: selectedSessionKey,
        message: outboundMessage,
        deliver: false,
        idempotencyKey: runId,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      });
      compressionRounds += 1;
    }

    if (estimate > maxFrameBytes) {
      const payloadKb = Math.round(maxFrameBytes / 1024);
      pushSystemMessage(
        `Attachment payload is too large for this gateway (${payloadKb}KB frame budget). Please send fewer/smaller files.`,
      );
      return;
    }

    const optimisticMessageId = generateUUID();
    const userMessage: ChatMessage = {
      id: optimisticMessageId,
      role: "user",
      text: outboundMessage,
      attachments: preparedAttachments,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    updateCacheField(selectedSessionKey, (cached) => ({
      ...cached,
      messages: [...cached.messages, userMessage],
      thinking: true,
      chatRunId: runId,
      streamText: "",
      thinkingLevel: thinkingLevelRef.current,
    }));
    setDraft("");
    clearAttachments();
    chatRunRef.current = runId;
    setChatRunId(runId);
    setThinking(true);
    setStreamTextSynced("");
    updateSessionActivity(selectedSessionKey, { working: true, unread: false });

    try {
      const sendRes = normalizeChatSendResult(await client.request("chat.send", {
        sessionKey: selectedSessionKey,
        message: outboundMessage,
        deliver: false,
        idempotencyKey: runId,
        attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
      }));
      const ackRunId = sendRes.runId;
      if (ackRunId && ackRunId !== chatRunRef.current) {
        chatRunRef.current = ackRunId;
        setChatRunId(ackRunId);
        updateCacheField(selectedSessionKey, (cached) => ({
          ...cached,
          chatRunId: ackRunId,
        }));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessageId));
      setDraft(draftBeforeSend);
      replaceAttachments(attachmentsBeforeSend);
      updateCacheField(selectedSessionKey, (cached) => ({
        ...cached,
        messages: cached.messages.filter((message) => message.id !== optimisticMessageId),
        streamText: null,
        thinking: false,
        chatRunId: null,
      }));
      pushSystemMessage(`Send failed: ${String(err)}`);
      setStreamTextSynced(null);
      setChatRunId(null);
      setThinking(false);
      updateSessionActivity(selectedSessionKey, { working: false, unread: false });
    }
  }

  async function handleSlashCommand(input: string) {
    const client = clientRef.current;
    if (!client || !selectedSessionKey) {
      return;
    }
    const parts = input.replace(/^\//, "").trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(" ");

    try {
      switch (cmd) {
        case "status": {
          const [statusRes, configSnapshot] = await Promise.all([
            client.request("status", {}),
            client.request("config.get", {}).catch(() => null),
          ]);
          const configState = normalizeShellGatewayConfigState(configSnapshot);
          applyConfigRuntimePathHints(configState);
          pushSystemMessage(buildStatusCard(statusRes, configState));
          break;
        }
        case "models": {
          const availableModels = await loadModels(client);
          const list = availableModels
            .map((model) => `${model.provider}/${model.id}`)
            .join(", ");
          pushSystemMessage(list ? `models: ${list}` : "models: (none)");
          break;
        }
        case "compact": {
          const normalizedArgs = args.trim();
          const commandText = normalizedArgs ? `/compact ${normalizedArgs}` : "/compact";
          clearInterruptedRunSnapshot(selectedSessionKey);
          const runId = generateUUID();
          chatRunRef.current = runId;
          setChatRunId(runId);
          setThinking(true);
          setStreamTextSynced("");
          updateCacheField(selectedSessionKey, (cached) => ({
            ...cached,
            streamText: "",
            thinking: true,
            chatRunId: runId,
          }));
          updateSessionActivity(selectedSessionKey, { working: true, unread: false });
          pushSystemMessage("running /compact...");
          const sendRes = normalizeChatSendResult(await client.request("chat.send", {
            sessionKey: selectedSessionKey,
            message: commandText,
            deliver: false,
            idempotencyKey: runId,
          }));
          const ackRunId = sendRes.runId;
          if (ackRunId && ackRunId !== chatRunRef.current) {
            chatRunRef.current = ackRunId;
            setChatRunId(ackRunId);
            updateCacheField(selectedSessionKey, (cached) => ({
              ...cached,
              chatRunId: ackRunId,
            }));
          }
          break;
        }
        case "model": {
          if (!args) {
            pushSystemMessage("/model requires provider/model");
            break;
          }
          const nextModel = args.trim();
          await patchSessionRuntimeSettings({
            key: selectedSessionKey,
            model: nextModel,
          });
          pushSystemMessage(`model set to ${nextModel}`);
          break;
        }
        case "think": {
          const rawValue = args.trim();
          const value = normalizeThinkingValue(rawValue);
          await patchSessionRuntimeSettings({
            key: selectedSessionKey,
            thinkingLevel: rawValue ? value : null,
          });
          pushSystemMessage(`thinking set to ${rawValue ? value : "default"}`);
          break;
        }
        case "verbose": {
          const value = args.trim();
          await client.request("sessions.patch", {
            key: selectedSessionKey,
            verboseLevel: value ? value : null,
          });
          pushSystemMessage(`verbose ${value || "default"}`);
          await refreshSessions(client);
          break;
        }
        case "reasoning": {
          const value = args.trim();
          await client.request("sessions.patch", {
            key: selectedSessionKey,
            reasoningLevel: value ? value : null,
          });
          pushSystemMessage(`reasoning ${value || "default"}`);
          await refreshSessions(client);
          break;
        }
        case "usage": {
          const value = args.trim();
          await client.request("sessions.patch", {
            key: selectedSessionKey,
            responseUsage: value ? value : null,
          });
          pushSystemMessage(`usage ${value || "default"}`);
          await refreshSessions(client);
          break;
        }
        case "abort": {
          const runId = chatRunRef.current ?? undefined;
          await client.request(
            "chat.abort",
            runId ? { sessionKey: selectedSessionKey, runId } : { sessionKey: selectedSessionKey },
          );
          pushSystemMessage("abort requested");
          setStreamTextSynced(null);
          setChatRunId(null);
          setThinking(false);
          updateCacheField(selectedSessionKey, (cached) => ({
            ...cached,
            streamText: null,
            chatRunId: null,
            thinking: false,
          }));
          updateSessionActivity(selectedSessionKey, { working: false, unread: false });
          break;
        }
        case "new": {
          await createSession(args, false);
          break;
        }
        case "reset": {
          const resetRes = normalizeSessionsResetResult(await client.request("sessions.reset", {
            key: selectedSessionKey,
          }));
          const resolvedKey = resetRes.key ?? selectedSessionKey;
          if (resolvedKey !== selectedSessionKey) {
            setSelectedSessionKey(resolvedKey);
          }
          setSessionModelOverrides((prev) =>
            clearOverride(clearOverride(prev, selectedSessionKey), resolvedKey),
          );
          setSessionThinkingOverrides((prev) =>
            clearOverride(clearOverride(prev, selectedSessionKey), resolvedKey),
          );
          pushSystemMessage("session reset");
          await refreshSessions(client);
          await loadModels(client);
          await loadHistory(client, resolvedKey, getHistoryLimit(resolvedKey));
          break;
        }
        default:
          pushSystemMessage(`Unknown command: /${cmd}`);
      }
    } catch (err) {
      pushSystemMessage(`Command failed: ${String(err)}`);
    } finally {
      setDraft("");
    }
  }

  async function handleCreateSession(label: string, agentId?: string | null, modelId?: string | null) {
    await createSession(label, true, agentId, modelId);
  }

  async function handleLoadMoreSessions() {
    const client = clientRef.current;
    if (!client || loadingMoreSessionsRef.current || !canLoadMoreSessions) {
      return;
    }
    loadingMoreSessionsRef.current = true;
    const nextLimit = Math.min(
      SESSION_LIST_MAX_LIMIT,
      sessionListLimitRef.current + SESSION_LIST_STEP,
    );
    try {
      setSessionListLimit(nextLimit);
      sessionListLimitRef.current = nextLimit;
      await refreshSessions(client, nextLimit);
    } finally {
      loadingMoreSessionsRef.current = false;
    }
  }

  async function handleLoadOlderHistory() {
    const client = clientRef.current;
    const key = selectedSessionRef.current;
    if (!client || !key || thinkingRef.current || Boolean(chatRunRef.current)) {
      return;
    }
    const canLoad = historyCanLoadMoreBySessionRef.current[key] ?? false;
    if (!canLoad || historyLoadInFlightRef.current.has(key)) {
      return;
    }
    const currentLimit = getHistoryLimit(key);
    const nextLimit = Math.min(CHAT_HISTORY_MAX_LIMIT, currentLimit + CHAT_HISTORY_STEP);
    if (nextLimit <= currentLimit) {
      return;
    }
    historyLoadInFlightRef.current.add(key);
    setLoadingOlderHistory(true);
    await loadHistory(client, key, nextLimit);
  }

  async function handleRefreshCurrentSession() {
    const client = clientRef.current;
    if (!client || !selectedSessionRef.current) {
      return;
    }
    await reloadActiveSessionHistory(client);
  }

  async function handleDeleteSession(
    key: string,
    options?: { skipConfirm?: boolean },
  ) {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    // Skip if this specific session is already being deleted
    if (deletingSessionKeysRef.current.has(key)) {
      return;
    }
    if (!options?.skipConfirm && typeof window !== "undefined") {
      const target = sessions.find((session) => session.key === key);
      const label = target?.label ?? target?.derivedTitle ?? key;
      const confirmed = window.confirm(`Delete session "${label}"?`);
      if (!confirmed) {
        return;
      }
    }
    // Track this delete (allows concurrent deletes)
    deletingSessionKeysRef.current = new Set([...deletingSessionKeysRef.current, key]);
    setDeletingSessionKeys(new Set(deletingSessionKeysRef.current));

    const wasSelected = selectedSessionRef.current === key;
    const nextSelectedKey = wasSelected
      ? sessionsRef.current.find((session) => session.key !== key && !deletingSessionKeysRef.current.has(session.key))?.key ?? null
      : selectedSessionRef.current;

    // Clean up history tracking for deleted session
    const nextHistoryCanLoadMore = { ...historyCanLoadMoreBySessionRef.current };
    delete nextHistoryCanLoadMore[key];
    historyCanLoadMoreBySessionRef.current = nextHistoryCanLoadMore;
    const nextHistoryLimit = { ...historyLimitBySessionRef.current };
    delete nextHistoryLimit[key];
    historyLimitBySessionRef.current = nextHistoryLimit;

    // Optimistic removal from UI
    setSessions((prev) => prev.filter((session) => session.key !== key));
    setSessionPreviews((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSessionModelOverrides((prev) => clearOverride(prev, key));
    setSessionThinkingOverrides((prev) => clearOverride(prev, key));
    setPendingApprovalsBySession((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (wasSelected) {
      selectedSessionRef.current = nextSelectedKey;
      if (nextSelectedKey) {
        restoreFromCache(nextSelectedKey);
        updateSessionActivity(nextSelectedKey, { unread: false });
        setCanLoadMoreHistory(historyCanLoadMoreBySessionRef.current[nextSelectedKey] ?? false);
      }
      setSelectedSessionKey(nextSelectedKey);
      if (!nextSelectedKey) {
        setMessages([]);
        setToolItems([]);
        setStreamTextSynced(null);
        setChatRunId(null);
        setThinking(false);
        setCanLoadMoreHistory(false);
      }
    }
    try {
      await client.request("sessions.delete", { key });
      sessionCacheRef.current.delete(key);
      setSessionActivity((prev) => {
        if (!(key in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      pushSystemMessage(`Delete failed: ${String(err)}`);
    } finally {
      // Remove from pending-delete set
      const nextPending = new Set(deletingSessionKeysRef.current);
      nextPending.delete(key);
      deletingSessionKeysRef.current = nextPending;
      setDeletingSessionKeys(new Set(nextPending));
      // Refresh from server to reconcile (filtered by remaining pending deletes)
      void refreshSessions(client);
    }
  }

  async function patchSessionRuntimeSettings(params: {
    key: string | null;
    model?: string;
    thinkingLevel?: string | null;
  }) {
    const client = clientRef.current;
    const key = params.key;
    if (!client || !key) {
      return false;
    }

    const decision = buildSessionRuntimePatchDecision({
      model: params.model,
      thinkingLevel: params.thinkingLevel,
    });

    if (!decision.shouldPatch) {
      return true;
    }

    await client.request("sessions.patch", {
      key,
      ...decision.patch,
    });

    if (decision.nextModel !== undefined) {
      setSessionModelOverrides((prev) =>
        applyModelRuntimeOverride(prev, key, decision.nextModel),
      );
    }

    if (decision.nextThinkingLevel !== undefined) {
      setSessionThinkingOverrides((prev) =>
        applyThinkingRuntimeOverride(prev, key, decision.nextThinkingLevel),
      );
    }

    await refreshSessions(client);
    if (decision.refreshModels) {
      await loadModels(client);
    }
    return true;
  }

  async function handleSelectModel(model: string) {
    try {
      await patchSessionRuntimeSettings({
        key: selectedSessionRef.current,
        model,
      });
    } catch (err) {
      pushSystemMessage(`Model switch failed: ${String(err)}`);
    }
  }

  async function handleSelectThinking(level: string) {
    try {
      await patchSessionRuntimeSettings({
        key: selectedSessionRef.current,
        thinkingLevel: level,
      });
    } catch (err) {
      pushSystemMessage(`Thinking switch failed: ${String(err)}`);
    }
  }

  const protocolWarning =
    typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      gatewayUrl.startsWith("ws://")
      ? "This page is HTTPS. Use wss:// for the Gateway WebSocket."
      : null;

  const disabledReason = connectionState.status === "pairing-required"
    ? `Pairing required. Approve this device with ${PAIRING_APPROVAL_COMMAND}.`
    : [protocolWarning, connectionState.note].filter(Boolean).join(" ");

  const activeInterruptedRunBanner = useMemo<InterruptedRunSessionBanner | null>(() => {
    if (connectionState.status !== "connected" || !selectedSessionKey) {
      return null;
    }
    const isVisible = Object.keys(visibleInterruptedRunsBySession).some((key) =>
      sessionKeysMatch(key, selectedSessionKey)
    );
    if (!isVisible) {
      return null;
    }
    const snapshot = Object.entries(interruptedRunsBySession).find(([key]) =>
      sessionKeysMatch(key, selectedSessionKey)
    )?.[1] ?? null;
    return snapshot ? buildInterruptedRunSessionBanner(snapshot) : null;
  }, [connectionState.status, interruptedRunsBySession, selectedSessionKey, visibleInterruptedRunsBySession]);

  const activePendingApproval = useMemo<PendingApproval | null>(() => {
    if (!selectedSessionKey) {
      return null;
    }
    const approvals = Object.entries(pendingApprovalsBySession).find(([key]) =>
      sessionKeysMatch(key, selectedSessionKey)
    )?.[1] ?? [];
    return approvals[0] ?? null;
  }, [pendingApprovalsBySession, selectedSessionKey]);

  const pendingApprovalCountsBySession = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    const exactSessionKeys = new Set(sessions.map((session) => session.key));
    const matchedSessionKeyByApprovalSessionKey = new Map<string, string | null>();

    for (const [approvalSessionKey, approvals] of Object.entries(pendingApprovalsBySession)) {
      let matchedSessionKey: string | null;
      if (exactSessionKeys.has(approvalSessionKey)) {
        matchedSessionKey = approvalSessionKey;
      } else if (matchedSessionKeyByApprovalSessionKey.has(approvalSessionKey)) {
        matchedSessionKey = matchedSessionKeyByApprovalSessionKey.get(approvalSessionKey) ?? null;
      } else {
        matchedSessionKey =
          sessions.find((session) => sessionKeysMatch(approvalSessionKey, session.key))?.key ?? null;
        matchedSessionKeyByApprovalSessionKey.set(approvalSessionKey, matchedSessionKey);
      }

      if (!matchedSessionKey) {
        continue;
      }
      counts[matchedSessionKey] = (counts[matchedSessionKey] ?? 0) + approvals.length;
    }
    return counts;
  }, [pendingApprovalsBySession, sessions]);

  const backgroundSessionNotice = useMemo(() => {
    if (connectionState.status !== "connected") {
      return null;
    }
    return deriveBackgroundSessionNotice({
      selectedSessionKey,
      sessions,
      sessionActivity,
    });
  }, [connectionState.status, selectedSessionKey, sessionActivity, sessions]);

  const mediaBrowserSourceData = useMemo(() => {
    const normalizedSessionRows =
      Object.keys(allSessionRows).length > 0 ? Object.values(allSessionRows) : sessions;
    const loadedHistories: Record<string, { sessionKey: string; messages: ChatMessage[] }> = {};

    if (selectedSessionKey && messages.length > 0) {
      loadedHistories[selectedSessionKey] = {
        sessionKey: selectedSessionKey,
        messages,
      };
    }

    for (const [sessionKey, cached] of sessionCacheRef.current.entries()) {
      if (sessionKey === selectedSessionKey || cached.messages.length === 0) {
        continue;
      }
      loadedHistories[sessionKey] = {
        sessionKey,
        messages: cached.messages,
      };
    }

    return buildMediaBrowserSourceData({
      sessions: normalizedSessionRows,
      sessionPreviews,
      loadedHistories,
    });
  }, [allSessionRows, messages, selectedSessionKey, sessionPreviews, sessions]);

  return (
    <FileManagerProvider>
    <div className="app-shell">
      {/* Sidebar with unified 3D flip */}
      <div className={`sidebar-flip-container${activeView === "files" ? " is-flipped" : ""}`}
        style={{ width: sidebarCollapsed ? "84px" : `${uiSettings.sidebarWidth}px`, height: "100%", transition: "width 0.34s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div className="sidebar-flip-card" style={{ height: "100%" }}>
          <div className="sidebar-face face-front" style={{ height: "100%" }}>
            <SessionSidebar
              sessions={sessions}
              selectedKey={selectedSessionKey}
              sessionActivity={sessionActivity}
              pendingApprovalCounts={pendingApprovalCountsBySession}
              collapsed={sidebarCollapsed}
              sidebarWidth={uiSettings.sidebarWidth}
              deletingKeys={deletingSessionKeys}
              enableAnimations={uiSettings.enableAnimations}
              autoHover={uiSettings.autoHoverSidebar && activeView === "chat"}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
              onSetCollapsed={(v) => setSidebarCollapsed(v)}
              onSelect={handleSelectSession}
              onCreate={() => setShowNewSession(true)}
              onDelete={(key, opts) => void handleDeleteSession(key, opts)}
              hasMore={canLoadMoreSessions}
              onReachEnd={() => void handleLoadMoreSessions()}
              sessionPreviews={sessionPreviews}
              allSessionRows={allSessionRows}
              onSearchGateway={searchSessionsFromGateway}
              onOpenFiles={() => switchView("files")}
              onOpenMedia={() => switchView("media")}
            />
          </div>
          <div className="sidebar-face face-back" style={{ height: "100%" }}>
            <FileManager
              mode="sidebar"
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={uiSettings.sidebarWidth}
              enableAnimations={uiSettings.enableAnimations}
              autoHoverSidebar={false}
              onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
              onSetSidebarCollapsed={(v) => setSidebarCollapsed(v)}
              onSwitchToChat={() => switchView("chat")}
              onSwitchToMedia={() => switchView("media")}
              onOpenSettings={() => setShowSettings(true)}
            />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="main-shell">
        {activeView === "chat" ? (
          <ChatView
            sessionKey={selectedSessionKey}
            messages={messages}
            streamText={streamText}
            thinking={thinking}
            toolItems={toolItems}
            draft={draft}
            onDraftChange={setDraft}
            stagedAttachments={{
              attachments,
              replaceAttachments,
              appendAttachments,
              removeAttachment,
              clearAttachments,
            }}
            onSend={() => void handleSend()}
            onAbort={() => void handleSlashCommand("/abort")}
            canAbort={Boolean(chatRunId)}
            connected={connected}
            connectionStatus={connectionState.status}
            connectionRecoveryNotice={connectionRecoveryNotice}
            interruptedRunBanner={activeInterruptedRunBanner}
            backgroundSessionNotice={backgroundSessionNotice}
            pendingApproval={activePendingApproval}
            resolvingApprovalDecision={
              activePendingApproval ? (resolvingApprovalIds[activePendingApproval.id] ?? null) : null
            }
            disabledReason={disabledReason}
            sessionInfo={sessionInfo}
            models={models}
            uiSettings={uiSettings}
            canLoadOlder={canLoadMoreHistory}
            loadingOlder={loadingOlderHistory}
            isCurrentSessionLoading={isCurrentSessionLoading}
            sessionTransitionState={transitionState}
            onLoadOlder={() => void handleLoadOlderHistory()}
            onRefreshSession={() => void handleRefreshCurrentSession()}
            onResolveApproval={(approval, decision) => void handleResolvePendingApproval(approval, decision)}
            onModelSelect={(model) => void handleSelectModel(model)}
            onThinkingSelect={(level) => void handleSelectThinking(level)}
            onCreateSession={() => setShowNewSession(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenFiles={() => switchView("files")}
            onResolveRemoteImage={resolveRemoteImage}
            onCompact={() => void handleSlashCommand("/compact")}
          />
        ) : activeView === "files" ? (
          <FileManager
            mode="main"
            sidebarCollapsed={sidebarCollapsed}
            sidebarWidth={uiSettings.sidebarWidth}
            enableAnimations={uiSettings.enableAnimations}
            autoHoverSidebar={false}
            onToggleSidebarCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onSetSidebarCollapsed={(v) => setSidebarCollapsed(v)}
            onSwitchToChat={() => switchView("chat")}
            onSwitchToMedia={() => switchView("media")}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <MediaBrowser
            sourceData={mediaBrowserSourceData}
            activeSessionKey={selectedSessionKey}
            enableAnimations={uiSettings.enableAnimations}
            onSwitchToChat={() => switchView("chat")}
            onOpenFiles={() => switchView("files")}
            onOpenSettings={() => setShowSettings(true)}
            onResolveRemoteImage={resolveRemoteImage}
          />
        )}
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        gatewayUrl={gatewayUrl}
        token={token}
        password={password}
        onGatewayUrlChange={setGatewayUrl}
        onTokenChange={setToken}
        onPasswordChange={setPassword}
        fsServerUrl={fsServerUrl}
        onFsServerUrlChange={setFsServerUrl}
        pathPrefixMappingsText={pathPrefixMappingsText}
        onPathPrefixMappingsTextChange={setPathPrefixMappingsText}
        uiSettings={uiSettings}
        onUiSettingsChange={setUiSettings}
        uiSettingsSchemes={uiSettingsSchemes.map((item) => ({
          id: item.id,
          name: item.name,
          updatedAt: item.updatedAt,
        }))}
        activeUiSettingsSchemeId={activeUiSettingsSchemeId}
        onApplyUiSettingsScheme={handleApplyUiSettingsScheme}
        onSaveUiSettingsScheme={handleSaveUiSettingsScheme}
        onOverwriteUiSettingsScheme={handleOverwriteUiSettingsScheme}
        onDeleteUiSettingsScheme={handleDeleteUiSettingsScheme}
        appActionShortcuts={appActionShortcutEntries}
        onChangeAppActionShortcut={handleChangeAppActionShortcut}
        modelShortcutSchemes={modelShortcutSlots}
        currentModelForShortcut={currentShortcutModel}
        currentThinkingForShortcut={currentShortcutThinkingLevel}
        onSaveModelShortcutScheme={handleSaveModelShortcutScheme}
        onApplyModelShortcutScheme={(slot) => void handleApplyModelShortcutScheme(slot, "manual")}
        onChangeModelShortcutSchemeCombo={handleChangeModelShortcutSchemeCombo}
        onDeleteModelShortcutScheme={handleClearModelShortcutScheme}
        onPreviewReplyDoneSound={previewReplyDoneSound}
        agentSessionShortcutSchemes={agentSessionShortcutSlots}
        currentAgentIdForShortcut={currentShortcutAgentId}
        currentAgentLabelForShortcut={currentShortcutAgentLabel}
        onSaveAgentSessionShortcutScheme={handleSaveAgentSessionShortcutScheme}
        onApplyAgentSessionShortcutScheme={(slot) =>
          void handleApplyAgentSessionShortcutScheme(slot, "manual")
        }
        onChangeAgentSessionShortcutSchemeCombo={handleChangeAgentSessionShortcutSchemeCombo}
        onDeleteAgentSessionShortcutScheme={handleClearAgentSessionShortcutScheme}
        models={models}
        newSessionPreferredModel={newSessionPreferredModel}
        onNewSessionPreferredModelChange={setNewSessionPreferredModel}
        devicePairing={devicePairingController.settingsModel}
      />

      <NewSessionModal
        open={showNewSession}
        onClose={() => setShowNewSession(false)}
        onCreate={handleCreateSession}
        agentOptions={newSessionAgentChoices}
        defaultAgentId={defaultAgentChoice.id}
        defaultAgentLabel={defaultAgentChoice.label}
        models={models}
        preferredModel={newSessionPreferredModel || null}
        onPreferredModelChange={(model) => setNewSessionPreferredModel(model ?? "")}
      />
    </div>
    </FileManagerProvider>
  );
}
