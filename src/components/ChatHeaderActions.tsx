import React from "react";
import type { AppearanceMode } from "../lib/appearance-mode.ts";
import type { ModelListItem, SessionInfo } from "../lib/types.ts";
import { AppearanceModeToggle } from "./AppearanceModeToggle.tsx";
import { SessionRuntimeControls } from "./SessionRuntimeControls.tsx";

type ChatHeaderActionsProps = {
  sessionKey: string | null;
  sessionInfo: SessionInfo;
  models: ModelListItem[];
  modelBadgeScale: number;
  canAbort: boolean;
  dreamsOpen?: boolean;
  appearanceMode: AppearanceMode;
  onAbort: () => void;
  onToggleDreams?: () => void;
  onToggleAppearanceMode: () => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
  onModelSelect: (model: string) => void;
  onThinkingSelect: (level: string) => void;
  onRuntimeControlsMenuOpenChange: (open: boolean) => void;
};

/** Groups chat-header controls by intent so future surfaces do not crowd runtime settings. */
export function ChatHeaderActions(props: ChatHeaderActionsProps) {
  return (
    <div className="chat-header-actions">
      <div className="chat-header-action-group is-runtime" role="group" aria-label="Session runtime controls">
        <SessionRuntimeControls
          sessionKey={props.sessionKey}
          sessionInfo={props.sessionInfo}
          models={props.models}
          modelBadgeScale={props.modelBadgeScale}
          onModelSelect={props.onModelSelect}
          onThinkingSelect={props.onThinkingSelect}
          onMenuOpenChange={props.onRuntimeControlsMenuOpenChange}
        />

        {props.canAbort && (
          <button type="button" onClick={props.onAbort} className="ui-btn ui-btn-light chat-header-stop-action">
            &#9632; Stop
          </button>
        )}
      </div>

      {props.onToggleDreams ? (
        <div className="chat-header-action-group is-surfaces" role="group" aria-label="Interface surfaces">
          <button type="button" onClick={props.onToggleDreams} className="ui-btn ui-btn-light chat-header-surface-action">
            <span aria-hidden="true">☁️</span>{" "}
            {props.dreamsOpen ? "Hide Dreams" : "Dreams"}
          </button>
        </div>
      ) : null}

      <div className="chat-header-action-group is-shell" role="group" aria-label="Application actions">
        <AppearanceModeToggle
          mode={props.appearanceMode}
          onToggle={props.onToggleAppearanceMode}
        />
        <button type="button" onClick={props.onCreateSession} className="ui-btn ui-btn-light">
          New Session
        </button>
        <button type="button" onClick={props.onOpenSettings} className="ui-btn ui-btn-primary">
          Settings
        </button>
      </div>
    </div>
  );
}
