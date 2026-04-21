import { normalizeRuntimeImageSourceData } from "./message-image-source.ts";
import {
  dedupeMediaArtifacts,
  type MediaArtifact,
  type MediaArtifactProvenanceKind,
  type MediaKind,
  type MediaPreviewState,
  type MediaSourceRoot,
} from "./media-browser-items.ts";
import type { Attachment, ChatMessage, GatewaySessionRow, SessionPreviewItem } from "./types.ts";

export type MediaBrowserLoadedHistory = {
  sessionKey: string;
  messages: ChatMessage[];
};

export type MediaBrowserSourceInput = {
  sessions: GatewaySessionRow[];
  sessionPreviews?: Record<string, SessionPreviewItem[]>;
  loadedHistories?: Record<string, MediaBrowserLoadedHistory>;
};

export type MediaBrowserSourceData = {
  roots: MediaSourceRoot[];
  artifacts: MediaArtifact[];
};

const SOURCE_LABELS: Record<string, string> = {
  all: "All media",
  generated: "Generated",
  uploaded: "Uploaded",
  "session-linked": "Session-linked",
};

function inferMediaKind(type: string, isImage: boolean): MediaKind {
  if (isImage || type.startsWith("image/")) {
    return "image";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  if (type.startsWith("audio/")) {
    return "audio";
  }
  if (type === "application/pdf") {
    return "pdf";
  }
  return "file";
}

function toPreviewState(kind: MediaKind, hasRenderableData: boolean): MediaPreviewState {
  if (kind !== "image") {
    return "unsupported";
  }
  return hasRenderableData ? "ready" : "error";
}

function deriveSessionLabel(sessionKey: string, sessionRow?: GatewaySessionRow) {
  return (
    sessionRow?.label ??
    sessionRow?.displayName ??
    sessionRow?.derivedTitle ??
    sessionRow?.lastMessagePreview ??
    sessionKey
  );
}

function isUploadedPath(value: string) {
  return /(?:^|\/)\.openclaw\/media\/inbound\//i.test(value) || /(?:^|\/)openclaw\/media\/inbound\//i.test(value);
}

function isManagedMediaPath(value: string) {
  return /(?:^|\/)\.openclaw\/media\//i.test(value) || /(?:^|\/)openclaw\/media\//i.test(value);
}

function deriveSourceKind(
  attachment: Attachment,
  message: ChatMessage,
): MediaArtifactProvenanceKind {
  const sourcePath = attachment.sourcePath ?? "";
  if (sourcePath && isUploadedPath(sourcePath)) {
    return "uploaded";
  }
  if (sourcePath && isManagedMediaPath(sourcePath)) {
    return "generated";
  }
  if (message.role === "user") {
    return "uploaded";
  }
  return "session-linked";
}

function deriveSourceKey(kind: MediaArtifactProvenanceKind) {
  if (kind === "generated" || kind === "uploaded" || kind === "session-linked") {
    return kind;
  }
  return "session-linked";
}

function createArtifactFromAttachment(
  sessionKey: string,
  sessionRow: GatewaySessionRow | undefined,
  message: ChatMessage,
  attachment: Attachment,
): MediaArtifact {
  const kind = inferMediaKind(attachment.type, attachment.isImage);
  const sourceKind = deriveSourceKind(attachment, message);
  const sourceKey = deriveSourceKey(sourceKind);
  const sourceLabel = SOURCE_LABELS[sourceKey];
  const normalizedRender = normalizeRuntimeImageSourceData(
    attachment.dataUrl || attachment.sourcePath || "",
    attachment.type || "application/octet-stream",
  );
  const renderRef = {
    dataUrl: normalizedRender.dataUrl,
    sourcePath: normalizedRender.sourcePath ?? attachment.sourcePath ?? null,
    mimeType: attachment.type,
    fromBase64: normalizedRender.fromBase64,
    isImage: attachment.isImage,
  };
  const displayName = attachment.name || deriveSessionLabel(sessionKey, sessionRow);
  const artifactId = `${sessionKey}:${message.id}:${attachment.id}`;

  return {
    id: artifactId,
    kind,
    displayName,
    sourceKey,
    sourceLabel,
    sessionKey,
    runId: message.runId ?? null,
    createdAt: message.timestamp,
    previewState: toPreviewState(kind, Boolean(normalizedRender.dataUrl)),
    renderRef,
    chatReference: {
      kind: "media-reference",
      artifactId,
      displayName,
      sourceKey,
      sourceLabel,
      renderRef,
    },
    provenance: {
      kind: sourceKind,
      label: deriveSessionLabel(sessionKey, sessionRow),
    },
  };
}

function buildSourceRoots(artifacts: readonly MediaArtifact[]): MediaSourceRoot[] {
  const counts = {
    all: artifacts.length,
    generated: artifacts.filter((artifact) => artifact.sourceKey === "generated").length,
    uploaded: artifacts.filter((artifact) => artifact.sourceKey === "uploaded").length,
    "session-linked": artifacts.filter((artifact) => artifact.sourceKey === "session-linked").length,
  };

  return [
    { key: "all", label: SOURCE_LABELS.all, count: counts.all, supportsFilter: true },
    { key: "generated", label: SOURCE_LABELS.generated, count: counts.generated, supportsFilter: true },
    { key: "uploaded", label: SOURCE_LABELS.uploaded, count: counts.uploaded, supportsFilter: true },
    { key: "session-linked", label: SOURCE_LABELS["session-linked"], count: counts["session-linked"], supportsFilter: true },
  ];
}

export function buildMediaBrowserSourceData(input: MediaBrowserSourceInput): MediaBrowserSourceData {
  const sessionRowByKey = new Map(input.sessions.map((session) => [session.key, session]));
  const loadedHistories = input.loadedHistories ?? {};
  const artifacts: MediaArtifact[] = [];

  for (const [sessionKey, history] of Object.entries(loadedHistories)) {
    const sessionRow = sessionRowByKey.get(sessionKey);
    for (const message of history.messages) {
      for (const attachment of message.attachments ?? []) {
        artifacts.push(createArtifactFromAttachment(sessionKey, sessionRow, message, attachment));
      }
    }
  }

  const dedupedArtifacts = dedupeMediaArtifacts(artifacts);
  return {
    roots: buildSourceRoots(dedupedArtifacts),
    artifacts: dedupedArtifacts,
  };
}

export function createEmptyMediaBrowserSourceData(): MediaBrowserSourceData {
  return {
    roots: buildSourceRoots([]),
    artifacts: [],
  };
}
