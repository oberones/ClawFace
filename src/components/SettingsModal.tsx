import React from "react";
import { DEFAULT_UI_SETTINGS, type UiSettings } from "../lib/ui-settings.ts";
import { parsePathPrefixMappingsText } from "../lib/path-prefix-mappings.ts";
import { AgentSessionShortcutsSection } from "./settings-sections/AgentSessionShortcutsSection.tsx";
import { AppActionShortcutsSection } from "./settings-sections/AppActionShortcutsSection.tsx";
import { ChatControlsSection } from "./settings-sections/ChatControlsSection.tsx";
import { ColorSystemSection } from "./settings-sections/ColorSystemSection.tsx";
import { GatewaySettingsSection } from "./settings-sections/GatewaySettingsSection.tsx";
import { MarkdownReadabilitySection } from "./settings-sections/MarkdownReadabilitySection.tsx";
import { ModelShortcutSchemesSection } from "./settings-sections/ModelShortcutSchemesSection.tsx";
import { PathPrefixMappingsSection } from "./settings-sections/PathPrefixMappingsSection.tsx";
import {
  type AgentSessionShortcutSchemeEntry,
  type AppActionShortcutEntry,
  type ModelShortcutSchemeEntry,
  type ReplyDoneSoundPatch,
  type ReplyDoneSoundPreview,
  type UiSettingsSchemeSummary,
} from "./settings-sections/SettingsSectionTypes.ts";
import { SettingsSchemesSection } from "./settings-sections/SettingsSchemesSection.tsx";
import {
  type AppActionShortcutId,
  type ShortcutCombo,
} from "./settings-sections/shortcut-settings-utils.ts";
import { TypographyLayoutSection } from "./settings-sections/TypographyLayoutSection.tsx";
import {
  normalizeReplyDoneAudioDataUrl,
  normalizeReplyDoneAudioFileName,
  validateReplyDoneAudioFile,
} from "./settings-sections/reply-done-audio-utils.ts";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  gatewayUrl: string;
  token: string;
  password: string;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  fsServerUrl: string;
  onFsServerUrlChange: (value: string) => void;
  pathPrefixMappingsText: string;
  onPathPrefixMappingsTextChange: (value: string) => void;
  uiSettings: UiSettings;
  onUiSettingsChange: (next: UiSettings) => void;
  uiSettingsSchemes: UiSettingsSchemeSummary[];
  activeUiSettingsSchemeId: string;
  onApplyUiSettingsScheme: (schemeId: string) => void;
  onSaveUiSettingsScheme: (name: string) => void;
  onOverwriteUiSettingsScheme: (schemeId: string) => void;
  onDeleteUiSettingsScheme: (schemeId: string) => void;
  appActionShortcuts: AppActionShortcutEntry[];
  onChangeAppActionShortcut: (
    id: AppActionShortcutId,
    shortcut: {
      enabled: boolean;
      combo: ShortcutCombo;
    },
  ) => void;
  models?: Array<{ id: string; name: string; provider: string }>;
  newSessionPreferredModel?: string;
  onNewSessionPreferredModelChange?: (model: string) => void;
  modelShortcutSchemes: ModelShortcutSchemeEntry[];
  currentModelForShortcut: string;
  currentThinkingForShortcut: string;
  onSaveModelShortcutScheme: (slot: number) => void;
  onApplyModelShortcutScheme: (slot: number) => void;
  onChangeModelShortcutSchemeCombo: (
    slot: number,
    combo: ShortcutCombo,
  ) => void;
  onDeleteModelShortcutScheme: (slot: number) => void;
  onPreviewReplyDoneSound: (next: ReplyDoneSoundPreview) => void;
  agentSessionShortcutSchemes: AgentSessionShortcutSchemeEntry[];
  currentAgentIdForShortcut: string;
  currentAgentLabelForShortcut: string;
  onSaveAgentSessionShortcutScheme: (slot: number) => void;
  onApplyAgentSessionShortcutScheme: (slot: number) => void;
  onChangeAgentSessionShortcutSchemeCombo: (
    slot: number,
    combo: ShortcutCombo,
  ) => void;
  onDeleteAgentSessionShortcutScheme: (slot: number) => void;
};

const BUILTIN_UI_SETTINGS_SCHEME_ID = "default";
const MAX_REPLY_DONE_CUSTOM_AUDIO_BYTES = 420 * 1024;
const COMMON_OPENCLAW_DOCKER_MAPPINGS = [
  "/home/node/.openclaw/media => ~/.openclaw/media",
  "/home/node/.openclaw/workspace => ~/.openclaw/workspace",
].join("\n");

const TYPOGRAPHY_LAYOUT_DEFAULTS: Partial<UiSettings> = {
  fontFamily: DEFAULT_UI_SETTINGS.fontFamily,
  fontSize: DEFAULT_UI_SETTINGS.fontSize,
  lineHeight: DEFAULT_UI_SETTINGS.lineHeight,
  contentWidth: DEFAULT_UI_SETTINGS.contentWidth,
  sidebarWidth: DEFAULT_UI_SETTINGS.sidebarWidth,
  sidebarFontSize: DEFAULT_UI_SETTINGS.sidebarFontSize,
  sessionIndicatorWidth: DEFAULT_UI_SETTINGS.sessionIndicatorWidth,
  messageGap: DEFAULT_UI_SETTINGS.messageGap,
  chatBubbleRadius: DEFAULT_UI_SETTINGS.chatBubbleRadius,
};

const CHAT_CONTROLS_DEFAULTS: Partial<UiSettings> = {
  modelBadgeScale: DEFAULT_UI_SETTINGS.modelBadgeScale,
  composerActionScale: DEFAULT_UI_SETTINGS.composerActionScale,
  footerStatsFontSize: DEFAULT_UI_SETTINGS.footerStatsFontSize,
  toolCallFontSize: DEFAULT_UI_SETTINGS.toolCallFontSize,
  autoScrollAssistantResponses: DEFAULT_UI_SETTINGS.autoScrollAssistantResponses,
  showMessageTimestamp: DEFAULT_UI_SETTINGS.showMessageTimestamp,
  messageTimestampFontSize: DEFAULT_UI_SETTINGS.messageTimestampFontSize,
  playReplyDoneSound: DEFAULT_UI_SETTINGS.playReplyDoneSound,
  playReplyDoneSoundVolume: DEFAULT_UI_SETTINGS.playReplyDoneSoundVolume,
  playReplyDoneSoundTone: DEFAULT_UI_SETTINGS.playReplyDoneSoundTone,
  playReplyDoneSoundSource: DEFAULT_UI_SETTINGS.playReplyDoneSoundSource,
  playReplyDoneSoundCustomAudioDataUrl: DEFAULT_UI_SETTINGS.playReplyDoneSoundCustomAudioDataUrl,
  playReplyDoneSoundCustomAudioName: DEFAULT_UI_SETTINGS.playReplyDoneSoundCustomAudioName,
  showToolActivity: DEFAULT_UI_SETTINGS.showToolActivity,
  enableAnimations: DEFAULT_UI_SETTINGS.enableAnimations,
  autoHoverSidebar: DEFAULT_UI_SETTINGS.autoHoverSidebar,
};

const COLOR_SYSTEM_DEFAULTS: Partial<UiSettings> = {
  panelOpacity: DEFAULT_UI_SETTINGS.panelOpacity,
  backgroundPatternStrength: DEFAULT_UI_SETTINGS.backgroundPatternStrength,
  accentColor: DEFAULT_UI_SETTINGS.accentColor,
  accentSoftColor: DEFAULT_UI_SETTINGS.accentSoftColor,
  userBubbleColor: DEFAULT_UI_SETTINGS.userBubbleColor,
  assistantBubbleColor: DEFAULT_UI_SETTINGS.assistantBubbleColor,
};

const MARKDOWN_DEFAULTS: Partial<UiSettings> = {
  markdownHeadingColor: DEFAULT_UI_SETTINGS.markdownHeadingColor,
  markdownLinkColor: DEFAULT_UI_SETTINGS.markdownLinkColor,
  markdownBoldColor: DEFAULT_UI_SETTINGS.markdownBoldColor,
  markdownItalicColor: DEFAULT_UI_SETTINGS.markdownItalicColor,
  markdownCodeBg: DEFAULT_UI_SETTINGS.markdownCodeBg,
  markdownCodeText: DEFAULT_UI_SETTINGS.markdownCodeText,
  markdownQuoteBg: DEFAULT_UI_SETTINGS.markdownQuoteBg,
  markdownQuoteBorderColor: DEFAULT_UI_SETTINGS.markdownQuoteBorderColor,
};

export default function SettingsModal(props: SettingsModalProps) {
  const [schemeNameDraft, setSchemeNameDraft] = React.useState("");
  const [customSoundError, setCustomSoundError] = React.useState<string | null>(null);
  const parsedPathPrefixMappings = React.useMemo(
    () => parsePathPrefixMappingsText(props.pathPrefixMappingsText),
    [props.pathPrefixMappingsText],
  );

  React.useEffect(() => {
    if (!props.open) {
      setSchemeNameDraft("");
      setCustomSoundError(null);
    }
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  const patch = (next: Partial<UiSettings>) => {
    props.onUiSettingsChange({ ...props.uiSettings, ...next });
  };

  const patchReplyDoneSound = (next: ReplyDoneSoundPatch) => {
    const merged = { ...props.uiSettings, ...next };
    props.onUiSettingsChange(merged);
    props.onPreviewReplyDoneSound({
      enabled: merged.playReplyDoneSound,
      volume: merged.playReplyDoneSoundVolume,
      tone: merged.playReplyDoneSoundTone,
      source: merged.playReplyDoneSoundSource,
      customAudioDataUrl: merged.playReplyDoneSoundCustomAudioDataUrl,
    });
  };

  const handleCustomSoundChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    const validationError = validateReplyDoneAudioFile(file, MAX_REPLY_DONE_CUSTOM_AUDIO_BYTES);
    if (validationError) {
      setCustomSoundError(validationError);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      setCustomSoundError("Failed to read this file.");
    };
    reader.onload = () => {
      const result = normalizeReplyDoneAudioDataUrl(reader.result);
      if (!result) {
        setCustomSoundError("This file could not be used as an audio notification.");
        return;
      }
      setCustomSoundError(null);
      patchReplyDoneSound({
        playReplyDoneSoundSource: "custom",
        playReplyDoneSoundCustomAudioDataUrl: result,
        playReplyDoneSoundCustomAudioName: normalizeReplyDoneAudioFileName(file.name),
      });
    };
    reader.readAsDataURL(file);
  };

  const clearCustomSound = () => {
    setCustomSoundError(null);
    patchReplyDoneSound({
      playReplyDoneSoundCustomAudioDataUrl: "",
      playReplyDoneSoundCustomAudioName: "",
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="settings-modal">
        <header className="modal-header">
          <div>
            <h2 className="modal-title">Settings</h2>
            <p className="modal-subtitle">Gateway connection and deep UI customization.</p>
          </div>
          <div className="modal-header-actions">
            <button
              type="button"
              onClick={() => props.onApplyUiSettingsScheme(BUILTIN_UI_SETTINGS_SCHEME_ID)}
              className="ui-btn ui-btn-light"
            >
              Reset Defaults
            </button>
            <button type="button" onClick={props.onClose} className="ui-btn ui-btn-primary">
              Close
            </button>
          </div>
        </header>

        <div className="modal-body">
          <div className="settings-grid">
            <SettingsSchemesSection
              activeUiSettingsSchemeId={props.activeUiSettingsSchemeId}
              builtinSchemeId={BUILTIN_UI_SETTINGS_SCHEME_ID}
              schemeNameDraft={schemeNameDraft}
              uiSettingsSchemes={props.uiSettingsSchemes}
              onSchemeNameDraftChange={setSchemeNameDraft}
              onApplyUiSettingsScheme={props.onApplyUiSettingsScheme}
              onSaveUiSettingsScheme={props.onSaveUiSettingsScheme}
              onOverwriteUiSettingsScheme={props.onOverwriteUiSettingsScheme}
              onDeleteUiSettingsScheme={props.onDeleteUiSettingsScheme}
            />

            <AppActionShortcutsSection
              appActionShortcuts={props.appActionShortcuts}
              models={props.models}
              newSessionPreferredModel={props.newSessionPreferredModel}
              onNewSessionPreferredModelChange={props.onNewSessionPreferredModelChange}
              onChangeAppActionShortcut={props.onChangeAppActionShortcut}
            />

            <ModelShortcutSchemesSection
              modelShortcutSchemes={props.modelShortcutSchemes}
              currentModelForShortcut={props.currentModelForShortcut}
              currentThinkingForShortcut={props.currentThinkingForShortcut}
              onSaveModelShortcutScheme={props.onSaveModelShortcutScheme}
              onApplyModelShortcutScheme={props.onApplyModelShortcutScheme}
              onChangeModelShortcutSchemeCombo={props.onChangeModelShortcutSchemeCombo}
              onDeleteModelShortcutScheme={props.onDeleteModelShortcutScheme}
            />

            <AgentSessionShortcutsSection
              agentSessionShortcutSchemes={props.agentSessionShortcutSchemes}
              currentAgentIdForShortcut={props.currentAgentIdForShortcut}
              currentAgentLabelForShortcut={props.currentAgentLabelForShortcut}
              onSaveAgentSessionShortcutScheme={props.onSaveAgentSessionShortcutScheme}
              onApplyAgentSessionShortcutScheme={props.onApplyAgentSessionShortcutScheme}
              onChangeAgentSessionShortcutSchemeCombo={props.onChangeAgentSessionShortcutSchemeCombo}
              onDeleteAgentSessionShortcutScheme={props.onDeleteAgentSessionShortcutScheme}
            />

            <GatewaySettingsSection
              gatewayUrl={props.gatewayUrl}
              token={props.token}
              password={props.password}
              fsServerUrl={props.fsServerUrl}
              onGatewayUrlChange={props.onGatewayUrlChange}
              onTokenChange={props.onTokenChange}
              onPasswordChange={props.onPasswordChange}
              onFsServerUrlChange={props.onFsServerUrlChange}
            />

            <PathPrefixMappingsSection
              pathPrefixMappingsText={props.pathPrefixMappingsText}
              parsedPathPrefixMappings={parsedPathPrefixMappings}
              dockerMappingsExample={COMMON_OPENCLAW_DOCKER_MAPPINGS}
              onPathPrefixMappingsTextChange={props.onPathPrefixMappingsTextChange}
            />

            <TypographyLayoutSection
              uiSettings={props.uiSettings}
              onPatch={patch}
              onReset={() => patch(TYPOGRAPHY_LAYOUT_DEFAULTS)}
            />

            <ChatControlsSection
              uiSettings={props.uiSettings}
              customSoundError={customSoundError}
              maxCustomAudioBytes={MAX_REPLY_DONE_CUSTOM_AUDIO_BYTES}
              onPatch={patch}
              onReset={() => patch(CHAT_CONTROLS_DEFAULTS)}
              onPatchReplyDoneSound={patchReplyDoneSound}
              onCustomSoundChange={handleCustomSoundChange}
              onClearCustomSound={clearCustomSound}
            />

            <ColorSystemSection
              uiSettings={props.uiSettings}
              onPatch={patch}
              onReset={() => patch(COLOR_SYSTEM_DEFAULTS)}
            />

            <MarkdownReadabilitySection
              uiSettings={props.uiSettings}
              onPatch={patch}
              onReset={() => patch(MARKDOWN_DEFAULTS)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
