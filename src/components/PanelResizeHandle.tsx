import React, { useEffect, useRef } from "react";
import {
  resolvePanelResizeKeyboardWidth,
  resolvePanelResizeWidth,
  type PanelResizeDirection,
} from "../lib/panel-layout.ts";

type PanelResizeHandleProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  direction: PanelResizeDirection;
  onChange: (value: number) => void;
  onResizeActiveChange?: (active: boolean) => void;
  className?: string;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startValue: number;
};

export function PanelResizeHandle(props: PanelResizeHandleProps) {
  const dragStateRef = useRef<DragState | null>(null);
  const onResizeActiveChangeRef = useRef(props.onResizeActiveChange);
  const className = `panel-resize-handle${props.className ? ` ${props.className}` : ""}`;

  useEffect(() => {
    onResizeActiveChangeRef.current = props.onResizeActiveChange;
  }, [props.onResizeActiveChange]);

  useEffect(() => {
    return () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        onResizeActiveChangeRef.current?.(false);
      }
    };
  }, []);

  const finishDrag = (element: HTMLElement, pointerId: number) => {
    if (dragStateRef.current?.pointerId !== pointerId) {
      return;
    }
    dragStateRef.current = null;
    onResizeActiveChangeRef.current?.(false);
    try {
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser after cancellation.
    }
  };

  return (
    <div
      role="separator"
      aria-label={props.label}
      aria-orientation="vertical"
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      aria-valuenow={Math.round(props.value)}
      aria-valuetext={`${Math.round(props.value)} pixels`}
      className={className}
      tabIndex={0}
      title={props.label}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) {
          return;
        }
        event.preventDefault();
        dragStateRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startValue: props.value,
        };
        onResizeActiveChangeRef.current?.(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        props.onChange(
          resolvePanelResizeWidth({
            initialWidth: dragState.startValue,
            deltaX: event.clientX - dragState.startClientX,
            direction: props.direction,
            min: props.min,
            max: props.max,
          }),
        );
      }}
      onPointerUp={(event) => finishDrag(event.currentTarget, event.pointerId)}
      onPointerCancel={(event) => finishDrag(event.currentTarget, event.pointerId)}
      onLostPointerCapture={(event) => {
        const pointerId = event.pointerId;
        if (dragStateRef.current?.pointerId === pointerId) {
          dragStateRef.current = null;
          onResizeActiveChangeRef.current?.(false);
        }
      }}
      onKeyDown={(event) => {
        const nextWidth = resolvePanelResizeKeyboardWidth({
          currentWidth: props.value,
          key: event.key,
          shiftKey: event.shiftKey,
          direction: props.direction,
          min: props.min,
          max: props.max,
        });
        if (nextWidth === null) {
          return;
        }
        event.preventDefault();
        props.onChange(nextWidth);
      }}
    />
  );
}
