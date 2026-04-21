import React from "react";

export type BrowserRootTab = {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
};

type BrowserRootTabsProps = {
  tabs: BrowserRootTab[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
};

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function BrowserRootTabs(props: BrowserRootTabsProps) {
  return (
    <div className={props.className}>
      {props.tabs.map((tab) => {
        const isActive = props.activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            title={tab.title}
            disabled={tab.disabled}
            className={joinClasses(props.tabClassName, isActive && props.activeTabClassName)}
            onClick={() => props.onSelect(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
