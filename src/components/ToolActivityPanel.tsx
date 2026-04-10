import React from "react";
import type { ToolItem } from "../lib/types.ts";

function formatArgsPreview(args: unknown): string {
  if (args == null) {
    return "";
  }
  try {
    return JSON.stringify(args).replace(/\s+/g, " ").trim().slice(0, 120);
  } catch {
    return String(args).replace(/\s+/g, " ").trim().slice(0, 120);
  }
}

function formatArgsExpanded(args: unknown): string {
  if (args == null) {
    return "(no args)";
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function summarizeTool(tool: ToolItem) {
  const outputPreview = (tool.output ?? "").replace(/\s+/g, " ").trim();
  const argsPreview = formatArgsPreview(tool.args);
  const errorPreview = (tool.errorMessage ?? "").replace(/\s+/g, " ").trim();
  const phase = tool.outcome;
  const statusLabel = phase === "failed" ? "Failed" : phase === "succeeded" ? "Succeeded" : "Running";
  const summary =
    phase === "failed"
      ? (errorPreview || outputPreview || "Failed without a structured error message")
      : phase === "succeeded"
        ? (outputPreview || "No output returned")
        : (outputPreview || argsPreview);
  const summaryLabel =
    phase === "failed"
      ? "Error"
      : phase === "succeeded"
        ? "Result"
        : outputPreview
          ? "Update"
          : argsPreview
            ? "Args"
            : null;

  return {
    phase,
    statusLabel,
    summary: summary.slice(0, 120),
    summaryLabel,
  };
}

function summarizeToolGroup(tools: ToolItem[]) {
  let running = 0;
  let succeeded = 0;
  let failed = 0;
  for (const tool of tools) {
    if (tool.outcome === "failed") {
      failed += 1;
    } else if (tool.outcome === "succeeded") {
      succeeded += 1;
    } else {
      running += 1;
    }
  }
  const tone = failed > 0 ? "failed" : running > 0 ? "running" : "succeeded";
  return { running, succeeded, failed, tone };
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

  const isSingleToolPanel = props.tools.length === 1;
  const isDenseMultiToolPanel = props.tools.length >= 3;
  const groupSummary = isSingleToolPanel ? null : summarizeToolGroup(props.tools);

  return (
    <section
      className={`tool-panel ${isSingleToolPanel ? "is-single" : `is-multi is-${groupSummary?.tone}-group${isDenseMultiToolPanel ? " is-dense" : ""}`} ${props.panelFlyIn ? "session-fly-in" : ""}`}
      data-tool-panel-key={props.panelKey}
      style={props.panelMotionStyle}
    >
      {!isSingleToolPanel && (
        <div className="tool-panel-header">
          <div className="tool-panel-title" style={{ fontSize: props.toolMinorFontSize }}>
            Tools ({props.tools.length})
          </div>
          <div className="tool-panel-stats" style={{ fontSize: props.toolMinorFontSize }}>
            {groupSummary && groupSummary.running > 0 && (
              <span className="tool-panel-stat is-running">{groupSummary.running} running</span>
            )}
            {groupSummary && groupSummary.failed > 0 && (
              <span className="tool-panel-stat is-failed">{groupSummary.failed} failed</span>
            )}
            {groupSummary && groupSummary.succeeded > 0 && (
              <span className="tool-panel-stat is-succeeded">{groupSummary.succeeded} done</span>
            )}
          </div>
        </div>
      )}

      <div className="tool-grid">
        {props.tools.map((tool) => {
          const expanded = props.snapshotMode ? false : (props.expandedById[tool.id] ?? false);
          const summaryInfo = summarizeTool(tool);
          const showCollapsedSummary = !expanded && Boolean(summaryInfo.summary) && (!isDenseMultiToolPanel || summaryInfo.phase !== "succeeded");
          const drawerPop = !props.snapshotMode && props.poppingToolIdSet.has(tool.id);
          const sessionFlyIn = !props.snapshotMode && props.sessionFlyInToolIdSet.has(tool.id);
          const motionStyle = props.buildMotionVars(tool.id);
          const phaseClass = summaryInfo.phase === "succeeded" ? "done" : summaryInfo.phase === "failed" ? "failed" : "running";

          return (
            <article
              key={tool.id}
              className={`tool-entry is-${summaryInfo.phase} ${expanded ? "is-expanded" : ""} ${drawerPop ? "drawer-pop" : ""} ${sessionFlyIn ? "session-fly-in" : ""}`}
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
                  <span className={`tool-status-dot ${phaseClass}`} />
                  <span className="tool-title">{tool.name}</span>
                  <span className="tool-status-text" style={{ fontSize: props.toolMinorFontSize }}>
                    {summaryInfo.statusLabel}
                  </span>
                </span>
                {showCollapsedSummary && (
                  <span className="tool-summary" style={{ fontSize: props.toolMinorFontSize }}>
                    {summaryInfo.summaryLabel ? `${summaryInfo.summaryLabel}: ` : ""}{summaryInfo.summary}
                  </span>
                )}
              </button>

              {expanded && (
                <div className="tool-expanded">
                  <div className="tool-expanded-meta" style={{ fontSize: props.toolMinorFontSize }}>
                    <span className={`tool-status-chip ${phaseClass}`}>
                      {summaryInfo.statusLabel}
                    </span>
                    {tool.startedAt > 0 && (
                      <span className="tool-meta-time">
                        Started {new Date(tool.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  {tool.outcome === "failed" && tool.errorMessage?.trim().length ? (
                    <div>
                      <div className="tool-expanded-title" style={{ fontSize: props.toolMinorFontSize }}>
                        Error
                      </div>
                      <pre className="tool-pre tool-pre-error">{tool.errorMessage}</pre>
                    </div>
                  ) : null}
                  <div>
                    <div className="tool-expanded-title" style={{ fontSize: props.toolMinorFontSize }}>
                      Args
                    </div>
                    <pre className="tool-pre">{formatArgsExpanded(tool.args)}</pre>
                  </div>
                  <div>
                    <div className="tool-expanded-title" style={{ fontSize: props.toolMinorFontSize }}>
                      Output
                    </div>
                    <pre className="tool-pre">
                      {tool.output?.trim().length
                        ? tool.output
                        : tool.status === "result"
                          ? "(no output returned)"
                          : "(still running)"}
                    </pre>
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
