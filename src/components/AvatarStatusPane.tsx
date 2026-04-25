import type { AvatarState } from "../lib/avatar-state.ts";
import { AVATAR_STATE_LABELS } from "../lib/avatar-state.ts";
import { AnimatedAvatar } from "./AnimatedAvatar.tsx";

type AvatarStatusPaneProps = {
  state: AvatarState;
  animationsEnabled: boolean;
  collapsed: boolean;
};

const AVATAR_STATUS_DETAILS: Record<AvatarState, string> = {
  idle: "Ready for the next session action.",
  thinking: "Preparing the next response.",
  streaming: "Writing into the active thread.",
  "tool-running": "A tool is active in this session.",
  success: "The last response completed.",
  serious: "The last response used a careful tone.",
  caution: "The last response carried caution.",
  warning: "A blocked, denied, or failed state needs attention.",
  "approval-needed": "Waiting on an approval decision.",
  disconnected: "Gateway connection or pairing needs attention.",
};

/** Desktop-native status companion for the active OpenClaw session. */
export function AvatarStatusPane(props: AvatarStatusPaneProps) {
  const label = AVATAR_STATE_LABELS[props.state];
  const paneClassName = `avatar-status-pane${props.collapsed ? " is-collapsed" : ""}`;

  return (
    <section
      className={paneClassName}
      data-avatar-state={props.state}
      aria-label={`OpenClaw status: ${label}`}
      title={`OpenClaw status: ${label}`}
    >
      <AnimatedAvatar
        state={props.state}
        animationsEnabled={props.animationsEnabled}
        className="avatar-status-pane-avatar"
      />
      {!props.collapsed && (
        <div className="avatar-status-copy">
          <div className="avatar-status-title">OpenClaw</div>
          <div className="avatar-status-label">{label}</div>
          <div className="avatar-status-detail">{AVATAR_STATUS_DETAILS[props.state]}</div>
        </div>
      )}
    </section>
  );
}
