import { normalizeMediaDirectivePath } from "./chat-message-attachments.ts";
import { normalizeHttpImageUrl, normalizeRuntimeImageSourceData } from "./message-image-source.ts";
import type { DraftMediaReference, MediaArtifact } from "./media-browser-items.ts";
import type { Attachment } from "./types.ts";

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

export type DraftMediaReferenceInsertResult = {
  references: DraftMediaReference[];
  reuseRequest: MediaReuseRequest;
};

export type DraftMediaReferenceSendPlan = {
  mediaLines: string[];
  optimisticAttachments: Attachment[];
  unresolvedReferences: DraftMediaReference[];
};

function cloneRenderRef(renderRef: DraftMediaReference["renderRef"]) {
  return { ...renderRef };
}

function readRenderRefString(renderRef: DraftMediaReference["renderRef"], key: string): string {
  const value = renderRef[key];
  return typeof value === "string" ? value.trim() : "";
}

function readReferenceMimeType(reference: DraftMediaReference): string {
  return readRenderRefString(reference.renderRef, "mimeType") || "image/png";
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

export function createMediaReuseRequest(
  reference: DraftMediaReference,
  sessionKey: string | null,
  status: MediaReuseRequest["status"],
): MediaReuseRequest {
  return {
    artifactId: reference.artifactId,
    chatReference: createDraftMediaReference({
      id: reference.artifactId,
      displayName: reference.displayName,
      sourceKey: reference.sourceKey,
      sourceLabel: reference.sourceLabel,
      renderRef: reference.renderRef,
    }),
    sessionKey,
    status,
  };
}

export function insertDraftMediaReferenceForSession(
  references: readonly DraftMediaReference[],
  artifact: Pick<MediaArtifact, "id" | "displayName" | "sourceKey" | "sourceLabel" | "renderRef">,
  sessionKey: string | null,
): DraftMediaReferenceInsertResult {
  const reference = createDraftMediaReference(artifact);
  if (!sessionKey) {
    return {
      references: [...references],
      reuseRequest: createMediaReuseRequest(reference, null, "failed"),
    };
  }
  return {
    references: upsertDraftMediaReference(references, reference),
    reuseRequest: createMediaReuseRequest(reference, sessionKey, "inserted"),
  };
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

export function resolveDraftMediaReferenceTransportValue(reference: DraftMediaReference): string | null {
  const mimeType = readReferenceMimeType(reference);
  const explicitSourcePath = readRenderRefString(reference.renderRef, "sourcePath");
  if (explicitSourcePath) {
    return normalizeMediaDirectivePath(explicitSourcePath);
  }
  const rawSource = readRenderRefString(reference.renderRef, "dataUrl");
  if (!rawSource) {
    return null;
  }
  const normalized = normalizeRuntimeImageSourceData(rawSource, mimeType);
  if (normalized.sourcePath) {
    return normalizeMediaDirectivePath(normalized.sourcePath);
  }
  return normalizeHttpImageUrl(normalized.dataUrl) ?? normalizeHttpImageUrl(rawSource);
}

export function buildDraftMediaReferenceAttachment(reference: DraftMediaReference): Attachment | null {
  const mimeType = readReferenceMimeType(reference);
  const rawSource =
    readRenderRefString(reference.renderRef, "dataUrl") ||
    readRenderRefString(reference.renderRef, "sourcePath");
  if (!rawSource) {
    return null;
  }
  const normalized = normalizeRuntimeImageSourceData(rawSource, mimeType);
  if (!normalized.dataUrl) {
    return null;
  }
  const normalizedSourcePath = normalized.sourcePath
    ? normalizeMediaDirectivePath(normalized.sourcePath)
    : undefined;
  return {
    id: `media-ref:${reference.artifactId}`,
    name: reference.displayName,
    size: 0,
    type: mimeType,
    dataUrl: normalized.dataUrl,
    sourcePath: normalizedSourcePath,
    isImage: true,
  };
}

export function buildDraftMediaReferenceSendPlan(
  references: readonly DraftMediaReference[],
): DraftMediaReferenceSendPlan {
  const seenTransportValues = new Set<string>();
  const seenAttachmentKeys = new Set<string>();
  const mediaLines: string[] = [];
  const optimisticAttachments: Attachment[] = [];
  const unresolvedReferences: DraftMediaReference[] = [];

  for (const reference of references) {
    const optimisticAttachment = buildDraftMediaReferenceAttachment(reference);
    if (optimisticAttachment) {
      const attachmentKey = `${optimisticAttachment.type}:${optimisticAttachment.dataUrl}`;
      if (!seenAttachmentKeys.has(attachmentKey)) {
        seenAttachmentKeys.add(attachmentKey);
        optimisticAttachments.push(optimisticAttachment);
      }
    }
    const transportValue = resolveDraftMediaReferenceTransportValue(reference);
    if (!transportValue) {
      unresolvedReferences.push(reference);
      continue;
    }
    if (!seenTransportValues.has(transportValue)) {
      seenTransportValues.add(transportValue);
      mediaLines.push(`MEDIA:${transportValue}`);
    }
  }

  return {
    mediaLines,
    optimisticAttachments,
    unresolvedReferences,
  };
}
