import type {
  AppearanceMode,
  AppearancePalettes,
} from "./appearance-mode.ts";
import { DEFAULT_APPEARANCE_PALETTES } from "./appearance-mode.ts";

export type ReplyDoneSoundTone =
  | "glass"
  | "marimba"
  | "bell"
  | "crystal"
  | "harp"
  | "wood"
  | "synth"
  | "orb";
export type ReplyDoneSoundSource = "tone" | "custom";

export type UiSettings = {
  appearanceMode: AppearanceMode;
  appearancePalettes: AppearancePalettes;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  sidebarFontSize: number;
  sidebarWidth: number;
  modelBadgeScale: number;
  composerActionScale: number;
  footerStatsFontSize: number;
  autoScrollAssistantResponses: boolean;
  showMessageTimestamp: boolean;
  messageTimestampFontSize: number;
  playReplyDoneSound: boolean;
  playReplyDoneSoundVolume: number;
  playReplyDoneSoundTone: ReplyDoneSoundTone;
  playReplyDoneSoundSource: ReplyDoneSoundSource;
  playReplyDoneSoundCustomAudioDataUrl: string;
  playReplyDoneSoundCustomAudioName: string;
  showToolActivity: boolean;
  toolCallFontSize: number;
  chatBubbleRadius: number;
  messageGap: number;
  panelOpacity: number;
  backgroundPatternStrength: number;
  enableAnimations: boolean;
  sessionIndicatorWidth: number;
  autoHoverSidebar: boolean;
};

export const DEFAULT_UI_SETTINGS: UiSettings = {
  appearanceMode: "light",
  appearancePalettes: {
    light: { ...DEFAULT_APPEARANCE_PALETTES.light },
    dark: { ...DEFAULT_APPEARANCE_PALETTES.dark },
  },
  fontFamily: "Manrope",
  fontSize: 16,
  lineHeight: 1.62,
  contentWidth: 900,
  sidebarFontSize: 13,
  sidebarWidth: 300,
  modelBadgeScale: 1,
  composerActionScale: 1,
  footerStatsFontSize: 12,
  autoScrollAssistantResponses: true,
  showMessageTimestamp: true,
  messageTimestampFontSize: 11,
  playReplyDoneSound: true,
  playReplyDoneSoundVolume: 58,
  playReplyDoneSoundTone: "glass",
  playReplyDoneSoundSource: "tone",
  playReplyDoneSoundCustomAudioDataUrl: "",
  playReplyDoneSoundCustomAudioName: "",
  showToolActivity: true,
  toolCallFontSize: 12,
  chatBubbleRadius: 12,
  messageGap: 14,
  panelOpacity: 100,
  backgroundPatternStrength: 10,
  enableAnimations: true,
  sessionIndicatorWidth: 3,
  autoHoverSidebar: false,
};
