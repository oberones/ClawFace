import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ModelListItem, SessionInfo } from "../lib/types.ts";
import { THINKING_LEVEL_CHOICES } from "../lib/runtime-controls.ts";

type SessionRuntimeControlsProps = {
  sessionKey: string | null;
  sessionInfo: SessionInfo;
  models: ModelListItem[];
  modelBadgeScale: number;
  onModelSelect: (model: string) => void;
  onThinkingSelect: (level: string) => void;
  onMenuOpenChange?: (open: boolean) => void;
};

export function SessionRuntimeControls(props: SessionRuntimeControlsProps) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const thinkingMenuRef = useRef<HTMLDivElement | null>(null);
  const menusOpen = modelMenuOpen || thinkingMenuOpen;
  const modelBadgeFontSize = `${Math.round(12 * props.modelBadgeScale)}px`;
  const modelBadgePaddingY = `${Math.round(4 * props.modelBadgeScale)}px`;
  const modelBadgePaddingX = `${Math.round(12 * props.modelBadgeScale)}px`;

  const modelChoices = useMemo(() => {
    const unique = new Map<string, ModelListItem>();
    for (const model of props.models) {
      const full = `${model.provider}/${model.id}`;
      if (!unique.has(full)) {
        unique.set(full, model);
      }
    }
    return [...unique.entries()]
      .map(([full, model]) => ({ full, ...model }))
      .sort((a, b) => a.full.localeCompare(b.full));
  }, [props.models]);

  const activeModel = props.sessionInfo.modelId || props.sessionInfo.modelLabel || "";
  const activeThinking = (props.sessionInfo.thinkingLevel ?? "off").toLowerCase();

  useLayoutEffect(() => {
    props.onMenuOpenChange?.(menusOpen);
  }, [menusOpen, props.onMenuOpenChange]);

  useLayoutEffect(() => {
    return () => props.onMenuOpenChange?.(false);
  }, [props.onMenuOpenChange]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(event.target)) {
        setThinkingMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  useLayoutEffect(() => {
    closeMenus();
  }, [props.sessionKey]);

  const closeMenus = () => {
    setModelMenuOpen(false);
    setThinkingMenuOpen(false);
  };

  return (
    <>
      <div className="session-runtime-controls">
        <div className={`relative ${modelMenuOpen ? "menu-open-ctx" : ""}`} ref={modelMenuRef}>
          <button
            type="button"
            onClick={() => setModelMenuOpen((prev) => !prev)}
            className="ui-btn ui-btn-light session-runtime-control session-runtime-control-primary"
            style={{
              fontSize: modelBadgeFontSize,
              padding: `${modelBadgePaddingY} ${modelBadgePaddingX}`,
            }}
          >
            Agent: {props.sessionInfo.agentLabel || "-"} · Model: {props.sessionInfo.modelLabel || "-"}
          </button>

          {modelMenuOpen && (
            <div className="floating-menu session-runtime-menu" style={{ fontSize: modelBadgeFontSize }}>
              {modelChoices.length === 0 && <div className="floating-empty">No available models.</div>}
              {modelChoices.map((model) => {
                const isActive = model.full === activeModel || model.id === activeModel || model.name === activeModel;
                return (
                  <button
                    key={model.full}
                    type="button"
                    onClick={() => {
                      setModelMenuOpen(false);
                      props.onModelSelect(model.full);
                    }}
                    className={`floating-item ${isActive ? "active" : ""}`}
                  >
                    <div className="floating-item-title">{model.full}</div>
                    <div className="floating-item-subtitle">{model.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`relative ${thinkingMenuOpen ? "menu-open-ctx" : ""}`} ref={thinkingMenuRef}>
          <button
            type="button"
            onClick={() => setThinkingMenuOpen((prev) => !prev)}
            className="ui-btn ui-btn-light session-runtime-control"
            style={{
              fontSize: modelBadgeFontSize,
              padding: `${modelBadgePaddingY} ${modelBadgePaddingX}`,
            }}
          >
            Thinking: {activeThinking}
          </button>

          {thinkingMenuOpen && (
            <div
              className="floating-menu session-runtime-menu session-runtime-thinking-menu"
              style={{ fontSize: modelBadgeFontSize }}
            >
              {THINKING_LEVEL_CHOICES.map((level) => {
                const isActive = level === activeThinking;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setThinkingMenuOpen(false);
                      props.onThinkingSelect(level);
                    }}
                    className={`thinking-item ${isActive ? "active" : ""}`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {menusOpen &&
        createPortal(
          <div className="menu-scrim" onClick={closeMenus} />,
          document.body,
        )}
    </>
  );
}
