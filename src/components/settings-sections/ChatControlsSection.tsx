import React from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import { formatBytes } from "./reply-done-audio-utils.ts";
import type { ReplyDoneSoundPatch } from "./SettingsSectionTypes.ts";
import { NumberField, ToggleField } from "./SettingsFieldControls.tsx";

type ChatControlsSectionProps = {
  uiSettings: UiSettings;
  customSoundError: string | null;
  maxCustomAudioBytes: number;
  onPatch: (next: Partial<UiSettings>) => void;
  onReset: () => void;
  onPatchReplyDoneSound: (next: ReplyDoneSoundPatch) => void;
  onCustomSoundChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCustomSound: () => void;
};

export function ChatControlsSection(props: ChatControlsSectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Chat Controls</h3>
        <button
          type="button"
          onClick={props.onReset}
          className="ui-btn ui-btn-light section-reset-btn"
        >
          Reset Section
        </button>
      </div>
      <div className="setting-fields">
        <NumberField
          label="Model badge scale"
          value={props.uiSettings.modelBadgeScale}
          min={0.8}
          max={1.8}
          step={0.05}
          suffix="x"
          onChange={(value) => props.onPatch({ modelBadgeScale: value })}
        />
        <NumberField
          label="Composer action scale"
          value={props.uiSettings.composerActionScale}
          min={0.8}
          max={1.8}
          step={0.05}
          suffix="x"
          onChange={(value) => props.onPatch({ composerActionScale: value })}
        />
        <NumberField
          label="Footer stats font"
          value={props.uiSettings.footerStatsFontSize}
          min={10}
          max={18}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ footerStatsFontSize: value })}
        />
        <NumberField
          label="Tool activity font"
          value={props.uiSettings.toolCallFontSize}
          min={10}
          max={18}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ toolCallFontSize: value })}
        />
        <NumberField
          label="Message timestamp font"
          value={props.uiSettings.messageTimestampFontSize}
          min={9}
          max={18}
          step={1}
          suffix="px"
          onChange={(value) => props.onPatch({ messageTimestampFontSize: value })}
        />

        <ToggleField
          label="Auto-scroll while assistant responds"
          checked={props.uiSettings.autoScrollAssistantResponses}
          onChange={(value) => props.onPatch({ autoScrollAssistantResponses: value })}
        />
        <ToggleField
          label="Show message timestamps"
          checked={props.uiSettings.showMessageTimestamp}
          onChange={(value) => props.onPatch({ showMessageTimestamp: value })}
        />
        <ToggleField
          label="Play sound when reply completes"
          checked={props.uiSettings.playReplyDoneSound}
          onChange={(value) => props.onPatchReplyDoneSound({ playReplyDoneSound: value })}
        />
        <NumberField
          label="Reply done volume"
          value={props.uiSettings.playReplyDoneSoundVolume}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => props.onPatchReplyDoneSound({ playReplyDoneSoundVolume: value })}
        />
        <label className="field-block">
          <span className="field-label">Reply done sound source</span>
          <select
            value={props.uiSettings.playReplyDoneSoundSource}
            onChange={(e) =>
              props.onPatchReplyDoneSound({
                playReplyDoneSoundSource: e.target.value as UiSettings["playReplyDoneSoundSource"],
              })
            }
            className="ui-input"
          >
            <option value="tone">Built-in tone</option>
            <option value="custom">Custom audio file</option>
          </select>
        </label>
        <label className="field-block">
          <span className="field-label">
            {props.uiSettings.playReplyDoneSoundSource === "tone"
              ? "Reply done tone"
              : "Fallback tone (if custom audio fails)"}
          </span>
          <select
            value={props.uiSettings.playReplyDoneSoundTone}
            onChange={(e) =>
              props.onPatchReplyDoneSound({
                playReplyDoneSoundTone: e.target.value as UiSettings["playReplyDoneSoundTone"],
              })
            }
            className="ui-input"
          >
            <option value="glass">Glass Chime</option>
            <option value="crystal">Crystal Ping</option>
            <option value="marimba">Marimba Tap</option>
            <option value="bell">Warm Bell</option>
            <option value="harp">Harp Pluck</option>
            <option value="wood">Wood Block</option>
            <option value="synth">Synth Pop</option>
            <option value="orb">Orb Glow</option>
          </select>
        </label>
        {props.uiSettings.playReplyDoneSoundSource === "custom" && (
          <>
            <label className="field-block">
              <span className="field-label">
                Upload notification audio (max {formatBytes(props.maxCustomAudioBytes)})
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={props.onCustomSoundChange}
                className="ui-input"
              />
            </label>
            <div className="field-inline">
              <span className="field-label">
                {props.uiSettings.playReplyDoneSoundCustomAudioName
                  ? `Selected: ${props.uiSettings.playReplyDoneSoundCustomAudioName}`
                  : "No custom audio selected."}
              </span>
              <button
                type="button"
                onClick={props.onClearCustomSound}
                className="ui-btn ui-btn-light"
                disabled={!props.uiSettings.playReplyDoneSoundCustomAudioDataUrl}
              >
                Clear
              </button>
            </div>
            {props.customSoundError && <span className="field-label">{props.customSoundError}</span>}
          </>
        )}
        <ToggleField
          label="Show tool activity panel"
          checked={props.uiSettings.showToolActivity}
          onChange={(value) => props.onPatch({ showToolActivity: value })}
        />
        <ToggleField
          label="Enable UI animations"
          checked={props.uiSettings.enableAnimations}
          onChange={(value) => props.onPatch({ enableAnimations: value })}
        />
        <ToggleField
          label="Auto-show sidebar on hover"
          checked={props.uiSettings.autoHoverSidebar}
          onChange={(value) => props.onPatch({ autoHoverSidebar: value })}
        />
      </div>
    </section>
  );
}
