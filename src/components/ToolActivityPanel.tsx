import React from "react";
import type { ToolItem } from "../lib/types.ts";

function summarizeTool(tool: ToolItem) {
  const outputPreview = (tool.output ?? "").replace(/\s+/g, " ").trim();
  const argsPreview = JSON.stringify(tool.args ?? {}).replace(/\s+/g, " ").trim().slice(0, 120);
  const normalizedOutput = outputPreview.toLowerCase();
  const looksFailed = /\b(error|failed|exception|denied|not found|timeout)\b/.test(normalizedOutput);
  const phase = tool.status === "result" ? (looksFailed ? "failed" : "completed") : "running";
  const statusLabel = phase === "failed" ? "Needs attention" : phase === "completed" ? "Completed" : "Running";
  const summarySource = outputPreview || argsPreview;
  const summary = summarySource.slice(0, 120);
  const summaryLabel = outputPreview ? (looksFailed ? "Issue" : "Output") : argsPreview ? "Args" : null;

  return {
    phase,
    statusLabel,
    summary,
    summaryLabel,
  };
}

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
          const summaryInfo = summarizeTool(tool);
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
                  <span
                    className={`tool-status-dot ${summaryInfo.phase === "completed" ? "done" : summaryInfo.phase === "failed" ? "failed" : "running"}`}
                  />
                  <span className="tool-title">{tool.name}</span>
                  <span className="tool-status-text" style={{ fontSize: props.toolMinorFontSize }}>
                    {summaryInfo.statusLabel}
                  </span>
                </span>
                {!expanded && summaryInfo.summary && (
                  <span className="tool-summary" style={{ fontSize: props.toolMinorFontSize }}>
                    {summaryInfo.summaryLabel ? `${summaryInfo.summaryLabel}: ` : ""}{summaryInfo.summary}
                  </span>
                )}
              </button>

              {expanded && (
                <div className="tool-expanded">
                  <div className="tool-expanded-meta" style={{ fontSize: props.toolMinorFontSize }}>
                    <span
                      className={`tool-status-chip ${summaryInfo.phase === "completed" ? "done" : summaryInfo.phase === "failed" ? "failed" : "running"}`}
                    >
                      {summaryInfo.statusLabel}
                    </span>
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
                    <pre className="tool-pre">{tool.output ?? (tool.status === "result" ? "(no output returned)" : "(still running)")}</pre>
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
