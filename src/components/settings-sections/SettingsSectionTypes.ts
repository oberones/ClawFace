import type { UiSettings } from "../../lib/ui-settings.ts";
import type { AppActionShortcutId, ShortcutCombo } from "./shortcut-settings-utils.ts";

export type UiSettingsSchemeSummary = {
  id: string;
  name: string;
  updatedAt: number;
};

export type AppActionShortcutEntry = {
  id: AppActionShortcutId;
  label: string;
  enabled: boolean;
  combo: ShortcutCombo;
  shortcutLabel: string;
};

export type ModelShortcutScheme = {
  slot: number;
  combo: ShortcutCombo;
  model: string;
  thinkingLevel: string;
  updatedAt: number;
};

export type ModelShortcutSchemeEntry = {
  slot: number;
  combo: ShortcutCombo;
  shortcutLabel: string;
  scheme: ModelShortcutScheme | null;
};

export type AgentSessionShortcutScheme = {
  slot: number;
  combo: ShortcutCombo;
  agentId: string;
  agentLabel: string;
  updatedAt: number;
};

export type AgentSessionShortcutSchemeEntry = {
  slot: number;
  combo: ShortcutCombo;
  shortcutLabel: string;
  scheme: AgentSessionShortcutScheme | null;
};

export type ReplyDoneSoundPreview = {
  enabled: boolean;
  volume: number;
  tone: UiSettings["playReplyDoneSoundTone"];
  source: UiSettings["playReplyDoneSoundSource"];
  customAudioDataUrl: UiSettings["playReplyDoneSoundCustomAudioDataUrl"];
};

export type ReplyDoneSoundPatch = Partial<
  Pick<
    UiSettings,
    | "playReplyDoneSound"
    | "playReplyDoneSoundVolume"
    | "playReplyDoneSoundTone"
    | "playReplyDoneSoundSource"
    | "playReplyDoneSoundCustomAudioDataUrl"
    | "playReplyDoneSoundCustomAudioName"
  >
>;
