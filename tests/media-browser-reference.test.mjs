import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadMediaBrowserReferenceModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/media-browser-reference.ts"));
}

function createReference(overrides = {}) {
  return {
    kind: "media-reference",
    artifactId: "artifact-1",
    displayName: "Preview image",
    sourceKey: "generated",
    sourceLabel: "Generated",
    renderRef: {
      dataUrl: "https://gateway.example/__claw/media/artifact-1",
      sourcePath: null,
      mimeType: "image/png",
    },
    ...overrides,
  };
}

test("createDraftMediaReference normalizes a media artifact into a draft reference", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const draftReference = mediaBrowserReference.createDraftMediaReference({
    id: "artifact-1",
    displayName: "Preview image",
    sourceKey: "generated",
    sourceLabel: "Generated",
    renderRef: {
      dataUrl: "https://gateway.example/__claw/media/artifact-1",
      sourcePath: null,
      mimeType: "image/png",
    },
  });

  assert.deepEqual(draftReference, createReference());
});

test("upsertDraftMediaReference inserts new references and replaces matching artifact ids without duplication", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const first = createReference();
  const second = createReference({ artifactId: "artifact-2", displayName: "Second image" });
  const replaced = createReference({ displayName: "Updated image" });

  const inserted = mediaBrowserReference.upsertDraftMediaReference([first], second);
  assert.deepEqual(inserted.map((item) => item.artifactId), ["artifact-1", "artifact-2"]);

  const updated = mediaBrowserReference.upsertDraftMediaReference(inserted, replaced);
  assert.deepEqual(updated.map((item) => item.displayName), ["Updated image", "Second image"]);
});

test("insertDraftMediaReferenceForSession preserves references and fails cleanly when no active session exists", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const existing = [createReference()];
  const result = mediaBrowserReference.insertDraftMediaReferenceForSession(existing, {
    id: "artifact-2",
    displayName: "Second image",
    sourceKey: "generated",
    sourceLabel: "Generated",
    renderRef: {
      dataUrl: "https://gateway.example/__claw/media/artifact-2",
      sourcePath: null,
      mimeType: "image/png",
    },
  }, null);

  assert.deepEqual(result.references, existing);
  assert.equal(result.reuseRequest.status, "failed");
  assert.equal(result.reuseRequest.sessionKey, null);
  assert.equal(result.reuseRequest.artifactId, "artifact-2");
});

test("removeDraftMediaReference drops only the requested artifact id", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const remaining = mediaBrowserReference.removeDraftMediaReference(
    [createReference(), createReference({ artifactId: "artifact-2" })],
    "artifact-1",
  );

  assert.deepEqual(remaining.map((item) => item.artifactId), ["artifact-2"]);
});

test("serializeDraftMediaReferences and send payload helpers preserve portable render metadata", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const serialized = mediaBrowserReference.serializeDraftMediaReferences([
    createReference(),
    createReference({ artifactId: "artifact-2", sourceLabel: "Uploaded" }),
  ]);

  assert.deepEqual(serialized[0], createReference());
  assert.equal(
    mediaBrowserReference.formatDraftMediaReferenceLabel(createReference()),
    "Preview image · Generated",
  );
  assert.deepEqual(
    mediaBrowserReference.toMediaReferenceSendPayload(createReference({ artifactId: "artifact-2" })),
    {
      artifactId: "artifact-2",
      displayName: "Preview image",
      sourceKey: "generated",
      sourceLabel: "Generated",
      renderRef: {
        dataUrl: "https://gateway.example/__claw/media/artifact-1",
        sourcePath: null,
        mimeType: "image/png",
      },
    },
  );
});

test("buildDraftMediaReferenceSendPlan produces media lines and optimistic attachments for local and remote references", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const sendPlan = mediaBrowserReference.buildDraftMediaReferenceSendPlan([
    createReference({
      artifactId: "artifact-local",
      displayName: "Local image",
      renderRef: {
        dataUrl: "https://gateway.example/__claw/media/artifact-local",
        sourcePath: "/Users/oberon/.openclaw/media/artifact-local.png",
        mimeType: "image/png",
      },
    }),
    createReference({
      artifactId: "artifact-remote",
      displayName: "Remote image",
      renderRef: {
        dataUrl: "https://gateway.example/__claw/media/artifact-remote",
        sourcePath: null,
        mimeType: "image/png",
      },
    }),
  ]);

  assert.deepEqual(sendPlan.mediaLines, [
    "MEDIA:/Users/oberon/.openclaw/media/artifact-local.png",
    "MEDIA:https://gateway.example/__claw/media/artifact-remote",
  ]);
  assert.equal(sendPlan.optimisticAttachments.length, 2);
  assert.deepEqual(sendPlan.unresolvedReferences, []);
});

test("buildDraftMediaReferenceSendPlan reports unresolved references when no portable send source can be derived", () => {
  const mediaBrowserReference = loadMediaBrowserReferenceModule();

  const unresolved = createReference({
    artifactId: "artifact-inline",
    renderRef: {
      dataUrl: "data:image/png;base64,YWJjMTIz",
      sourcePath: null,
      mimeType: "image/png",
    },
  });

  const sendPlan = mediaBrowserReference.buildDraftMediaReferenceSendPlan([unresolved]);

  assert.deepEqual(sendPlan.mediaLines, []);
  assert.deepEqual(sendPlan.optimisticAttachments, [
    {
      id: "media-ref:artifact-inline",
      name: "Preview image",
      size: 0,
      type: "image/png",
      dataUrl: "data:image/png;base64,YWJjMTIz",
      sourcePath: undefined,
      isImage: true,
    },
  ]);
  assert.deepEqual(sendPlan.unresolvedReferences, [unresolved]);
});
