export const SESSION_PANEL_WIDTH_MIN = 220;
export const SESSION_PANEL_WIDTH_MAX = 420;
export const MEMORY_PANEL_WIDTH_MIN = 360;
export const MEMORY_PANEL_WIDTH_MAX = 680;
export const MEMORY_PANEL_WIDTH_DEFAULT = 520;
export const PANEL_RESIZE_KEYBOARD_STEP = 10;
export const PANEL_RESIZE_KEYBOARD_LARGE_STEP = 40;

export type PanelResizeDirection = "increase-right" | "increase-left";

export function clampPanelWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function resolvePanelResizeWidth(params: {
  initialWidth: number;
  deltaX: number;
  direction: PanelResizeDirection;
  min: number;
  max: number;
}): number {
  const signedDelta = params.direction === "increase-right" ? params.deltaX : -params.deltaX;
  return clampPanelWidth(params.initialWidth + signedDelta, params.min, params.max);
}

export function resolvePanelResizeKeyboardWidth(params: {
  currentWidth: number;
  key: string;
  shiftKey: boolean;
  direction: PanelResizeDirection;
  min: number;
  max: number;
}): number | null {
  if (params.key !== "ArrowLeft" && params.key !== "ArrowRight") {
    return null;
  }
  const step = params.shiftKey ? PANEL_RESIZE_KEYBOARD_LARGE_STEP : PANEL_RESIZE_KEYBOARD_STEP;
  const deltaX = params.key === "ArrowRight" ? step : -step;
  return resolvePanelResizeWidth({
    initialWidth: params.currentWidth,
    deltaX,
    direction: params.direction,
    min: params.min,
    max: params.max,
  });
}
