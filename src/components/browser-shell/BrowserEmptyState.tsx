import React from "react";

type BrowserEmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  copy?: React.ReactNode;
  actions?: React.ReactNode;
  disableAnimation?: boolean;
};

export function BrowserEmptyState(props: BrowserEmptyStateProps) {
  return (
    <div className="empty-state" style={{ animation: props.disableAnimation ? "none" : undefined }}>
      {props.icon ? <div className="empty-state-icon">{props.icon}</div> : null}
      <div className="empty-state-title">{props.title}</div>
      {props.copy ? <div className="empty-state-copy">{props.copy}</div> : null}
      {props.actions ? <div className="empty-state-hints">{props.actions}</div> : null}
    </div>
  );
}
