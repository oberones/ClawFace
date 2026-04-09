import React from "react";
import type { ToolItem } from "../lib/types.ts";

type ToolActivityPanelProps = {
  tools: ToolItem[];
  panelKey: string;
  panelFlyIn: boolean;
  panelMotionStyle?: React.CSSProperties;
  toolFontSize: string;
  toolMinorFontSize: string;
  expandedById: Record<string, boolean>;
  poppingToolIdSet: Set<string>;
  sessionFlyInToolIdSet: Set<string>;
  buildMotionVars: (id: string) => React.CSSProperties;
  onToggleExpanded: (toolId: string, nextExpanded: boolean) => void;
  snapshotMode?: boolean;
};

export function ToolActivityPanel(props: ToolActivityPanelProps) {
  if (props.tools.length === 0) {
    return null;
  }

  return (
    <section
      key={props.panelKey}
      className={`tool-panel ${props.panelFlyIn ? "session-fly-in" : ""}`}
      data-tool-panel-key={props.panelKey}
      style={props.panelMotionStyle}
    >
      <div className="tool-panel-header">
        <div className="tool-panel-title" style={{ fontSize: props.toolMinorFontSize }}>
          Tool Activity ({props.tools.length})
        </div>
      </div>

      <div className="tool-grid">
        {props.tools.map((tool) => {
          const expanded = props.snapshotMode ? false : (props.expandedById[tool.id] ?? false);
          const isDone = tool.status === "result";
          const statusLabel = isDone ? "Completed" : "Running";
          const outputPreview = (tool.output ?? "").replace(/\s+/g, " ").trim();
          const argsPreview = JSON.stringify(tool.args ?? {}).replace(/\s+/g, " ").trim().slice(0, 120);
          const summarySource = outputPreview || argsPreview;
          const summary = summarySource.slice(0, 120);
          const summaryLabel = outputPreview ? "Output" : argsPreview ? "Args" : null;
          const drawerPop = !props.snapshotMode && props.poppingToolIdSet.has(tool.id);
          const sessionFlyIn = !props.snapshotMode && props.sessionFlyInToolIdSet.has(tool.id);
          const motionStyle = props.buildMotionVars(tool.id);

          return (
            <article
              key={tool.id}
              className={`tool-entry ${expanded ? "is-expanded" : ""} ${drawerPop ? "drawer-pop" : ""} ${sessionFlyIn ? "session-fly-in" : ""}`}
              data-tool-id={tool.id}
              style={{ ...motionStyle, fontSize: props.toolFontSize }}
            >
              <button
                type="button"
                onClick={() => {
                  if (props.snapshotMode) {
                    return;
                  }
                  props.onToggleExpanded(tool.id, !expanded);
                }}
                className="tool-entry-toggle"
                aria-expanded={expanded}
              >
                <span className="tool-title-wrap">
                  <span className={`tool-status-dot ${isDone ? "done" : "running"}`} />
                  <span className="tool-title">{tool.name}</span>
                  <span className="tool-status-text" style={{ fontSize: props.toolMinorFontSize }}>
                    {statusLabel}
                  </span>
                </span>
                {!expanded && summary && (
                  <span className="tool-summary" style={{ fontSize: props.toolMinorFontSize }}>
                    {summaryLabel ? `${summaryLabel}: ` : ""}{summary}
                  </span>
                )}
              </button>

              {expanded && (
                <div className="tool-expanded">
                  <div className="tool-expanded-meta" style={{ fontSize: props.toolMinorFontSize }}>
                    <span className={`tool-status-chip ${isDone ? "done" : "running"}`}>{statusLabel}</span>
                    {tool.startedAt > 0 && (
                      <span className="tool-meta-time">
                        Started {new Date(tool.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="tool-expanded-title" style={{ fontSize: props.toolMinorFontSize }}>
                      Args
                    </div>
                    <pre className="tool-pre">{JSON.stringify(tool.args ?? {}, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="tool-expanded-title" style={{ fontSize: props.toolMinorFontSize }}>
                      Output
                    </div>
                    <pre className="tool-pre">{tool.output ?? "(no output)"}</pre>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
