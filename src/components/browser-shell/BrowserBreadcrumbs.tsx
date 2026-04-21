import React from "react";

export type BrowserBreadcrumbItem = {
  key: string;
  label: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
};

type BrowserBreadcrumbsProps = {
  items: BrowserBreadcrumbItem[];
  onSelect: (key: string) => void;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  separatorClassName?: string;
  separator?: React.ReactNode;
};

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function BrowserBreadcrumbs(props: BrowserBreadcrumbsProps) {
  return (
    <div className={props.className}>
      {props.items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <span className={props.separatorClassName}>{props.separator ?? "/"}</span> : null}
          <button
            type="button"
            title={item.title}
            disabled={item.disabled}
            className={joinClasses(props.itemClassName, item.active && props.activeItemClassName)}
            onClick={() => props.onSelect(item.key)}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
