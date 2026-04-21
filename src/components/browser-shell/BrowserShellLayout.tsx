import React from "react";

type BrowserShellLayoutProps = {
  areaClassName?: string;
  scrollClassName?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function BrowserShellLayout(props: BrowserShellLayoutProps) {
  return (
    <section className={joinClasses("claw-chat-area", props.areaClassName)}>
      <header className="chat-header">
        <div className="chat-header-main">
          <div className="chat-brand-title">{props.title}</div>
          {props.meta ? <div className="topbar-status">{props.meta}</div> : null}
        </div>
        {props.actions ? <div className="chat-header-actions">{props.actions}</div> : null}
      </header>

      <div className={joinClasses("chat-scroll", props.scrollClassName)}>
        {props.children}
      </div>
    </section>
  );
}
