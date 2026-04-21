import type { DraftMediaReference, MediaArtifact } from "./media-browser-items.ts";

export type MediaReferenceSendPayload = {
  artifactId: string;
  displayName: string;
  sourceKey: string;
  sourceLabel: string;
  renderRef: DraftMediaReference["renderRef"];
};

export type MediaReuseRequest = {
  artifactId: string;
  chatReference: DraftMediaReference;
  sessionKey: string | null;
  status: "idle" | "inserting" | "inserted" | "failed";
};

function cloneRenderRef(renderRef: DraftMediaReference["renderRef"]) {
  return { ...renderRef };
}

export function createDraftMediaReference(
  artifact: Pick<MediaArtifact, "id" | "displayName" | "sourceKey" | "sourceLabel" | "renderRef">,
): DraftMediaReference {
  return {
    kind: "media-reference",
    artifactId: artifact.id,
    displayName: artifact.displayName,
    sourceKey: artifact.sourceKey,
    sourceLabel: artifact.sourceLabel,
    renderRef: cloneRenderRef(artifact.renderRef),
  };
}

export function upsertDraftMediaReference(
  references: readonly DraftMediaReference[],
  reference: DraftMediaReference,
) {
  const normalized = createDraftMediaReference({
    id: reference.artifactId,
    displayName: reference.displayName,
    sourceKey: reference.sourceKey,
    sourceLabel: reference.sourceLabel,
    renderRef: reference.renderRef,
  });
  const existingIndex = references.findIndex((item) => item.artifactId === normalized.artifactId);
  if (existingIndex === -1) {
    return [...references, normalized];
  }
  return references.map((item, index) => (index === existingIndex ? normalized : item));
}

export function removeDraftMediaReference(
  references: readonly DraftMediaReference[],
  artifactId: string,
) {
  return references.filter((reference) => reference.artifactId !== artifactId);
}

export function serializeDraftMediaReference(reference: DraftMediaReference) {
  return {
    kind: "media-reference" as const,
    artifactId: reference.artifactId,
    displayName: reference.displayName,
    sourceKey: reference.sourceKey,
    sourceLabel: reference.sourceLabel,
    renderRef: cloneRenderRef(reference.renderRef),
  };
}

export function serializeDraftMediaReferences(references: readonly DraftMediaReference[]) {
  return references.map(serializeDraftMediaReference);
}

export function formatDraftMediaReferenceLabel(reference: DraftMediaReference) {
  return `${reference.displayName} · ${reference.sourceLabel}`;
}

export function toMediaReferenceSendPayload(reference: DraftMediaReference): MediaReferenceSendPayload {
  return {
    artifactId: reference.artifactId,
    displayName: reference.displayName,
    sourceKey: reference.sourceKey,
    sourceLabel: reference.sourceLabel,
    renderRef: cloneRenderRef(reference.renderRef),
  };
}
