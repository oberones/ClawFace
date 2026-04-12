import { normalizeModelKey, normalizeThinkingValue } from "./runtime-controls.ts";

export type SessionRuntimePatchDecision = {
  patch: {
    model?: string;
    thinkingLevel?: string | null;
  };
  nextModel: string | undefined;
  nextThinkingLevel: string | null | undefined;
  refreshModels: boolean;
  shouldPatch: boolean;
};

function clearOverride<T extends string>(
  map: Record<string, T>,
  key: string,
): Record<string, T> {
  if (!(key in map)) {
    return map;
  }
  const next = { ...map };
  delete next[key];
  return next;
}

export function buildSessionRuntimePatchDecision(params: {
  model?: string;
  thinkingLevel?: string | null;
}): SessionRuntimePatchDecision {
  const nextModel = typeof params.model === "string" ? params.model.trim() : undefined;
  const nextThinkingLevel =
    params.thinkingLevel === undefined
      ? undefined
      : params.thinkingLevel === null
        ? null
        : normalizeThinkingValue(params.thinkingLevel);

  return {
    patch: {
      ...(nextModel !== undefined ? { model: nextModel } : {}),
      ...(nextThinkingLevel !== undefined ? { thinkingLevel: nextThinkingLevel } : {}),
    },
    nextModel,
    nextThinkingLevel,
    refreshModels: nextModel !== undefined,
    shouldPatch: nextModel !== undefined || nextThinkingLevel !== undefined,
  };
}

export function applyModelRuntimeOverride(
  map: Record<string, string>,
  key: string,
  nextModel: string | undefined,
): Record<string, string> {
  if (nextModel === undefined) {
    return map;
  }
  if (!nextModel || normalizeModelKey(nextModel) === "default") {
    return clearOverride(map, key);
  }
  if (map[key] === nextModel) {
    return map;
  }
  return { ...map, [key]: nextModel };
}

export function applyThinkingRuntimeOverride(
  map: Record<string, string>,
  key: string,
  nextThinkingLevel: string | null | undefined,
): Record<string, string> {
  if (nextThinkingLevel === undefined) {
    return map;
  }
  if (nextThinkingLevel === null) {
    return clearOverride(map, key);
  }
  if (map[key] === nextThinkingLevel) {
    return map;
  }
  return { ...map, [key]: nextThinkingLevel };
}
