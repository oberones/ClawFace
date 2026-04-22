import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadMediaBrowserItemsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/media-browser-items.ts"));
}

function createArtifact(overrides = {}) {
  return {
    id: "artifact-1",
    kind: "image",
    displayName: "Sunrise",
    sourceKey: "generated",
    sourceLabel: "Generated",
    sessionKey: "session-1",
    runId: "run-1",
    createdAt: 100,
    previewState: "ready",
    renderRef: { src: "claw-local-image://artifact-1" },
    chatReference: {
      kind: "media-reference",
      artifactId: "artifact-1",
      displayName: "Sunrise",
      sourceKey: "generated",
      sourceLabel: "Generated",
      renderRef: { src: "claw-local-image://artifact-1" },
    },
    provenance: {
      kind: "generated",
      label: "Generated image",
    },
    ...overrides,
  };
}

test("getMediaArtifactPreviewStateForV1 keeps images previewable and marks other media unsupported", () => {
  const mediaBrowserItems = loadMediaBrowserItemsModule();

  assert.equal(
    mediaBrowserItems.getMediaArtifactPreviewStateForV1(createArtifact({ kind: "image", previewState: "ready" })),
    "ready",
  );
  assert.equal(
    mediaBrowserItems.getMediaArtifactPreviewStateForV1(createArtifact({ kind: "pdf", previewState: "ready" })),
    "unsupported",
  );
  assert.equal(mediaBrowserItems.isMediaArtifactReusableInV1(createArtifact({ kind: "image" })), true);
  assert.equal(mediaBrowserItems.isMediaArtifactReusableInV1(createArtifact({ kind: "video" })), false);
});

test("getVisibleMediaArtifacts applies lightweight query filtering and createdAt sorting", () => {
  const mediaBrowserItems = loadMediaBrowserItemsModule();

  const artifacts = [
    createArtifact({ id: "artifact-1", displayName: "Older", createdAt: 10 }),
    createArtifact({ id: "artifact-2", displayName: "Newest", createdAt: 30 }),
    createArtifact({ id: "artifact-3", displayName: "Match me", createdAt: 20, provenance: { kind: "uploaded", label: "Upload" } }),
  ];

  const visible = mediaBrowserItems.getVisibleMediaArtifacts(artifacts, {
    query: "match",
    sortKey: "createdAt",
    sortDir: "desc",
  });

  assert.deepEqual(visible.map((artifact) => artifact.id), ["artifact-3"]);
});

test("getVisibleMediaArtifacts supports session and provenance narrowing plus name sorting", () => {
  const mediaBrowserItems = loadMediaBrowserItemsModule();

  const artifacts = [
    createArtifact({
      id: "artifact-1",
      displayName: "Zebra",
      sessionKey: "session-1",
      provenance: { kind: "generated", label: "Morning run" },
    }),
    createArtifact({
      id: "artifact-2",
      displayName: "Alpha",
      sessionKey: "session-2",
      provenance: { kind: "uploaded", label: "Upload thread" },
      sourceKey: "uploaded",
      sourceLabel: "Uploaded",
    }),
    createArtifact({
      id: "artifact-3",
      displayName: "Bravo",
      sessionKey: "session-1",
      provenance: { kind: "generated", label: "Morning run" },
    }),
  ];

  const visible = mediaBrowserItems.getVisibleMediaArtifacts(artifacts, {
    sessionKey: "session-1",
    provenance: "generated",
    sortKey: "name",
    sortDir: "asc",
  });

  assert.deepEqual(visible.map((artifact) => artifact.id), ["artifact-3", "artifact-1"]);
});

test("media browser item helpers expose session and provenance filter options with stable labels", () => {
  const mediaBrowserItems = loadMediaBrowserItemsModule();

  const artifacts = [
    createArtifact({
      id: "artifact-1",
      sessionKey: "session-2",
      provenance: { kind: "uploaded", label: "Upload thread" },
      sourceKey: "uploaded",
      sourceLabel: "Uploaded",
    }),
    createArtifact({
      id: "artifact-2",
      sessionKey: "session-1",
      provenance: { kind: "generated", label: "Morning run" },
    }),
    createArtifact({
      id: "artifact-3",
      sessionKey: "session-1",
      provenance: { kind: "generated", label: "Morning run" },
    }),
  ];

  assert.deepEqual(
    mediaBrowserItems.getMediaArtifactSessionFilterOptions(artifacts),
    [
      { key: "session-1", label: "Morning run", count: 2 },
      { key: "session-2", label: "Upload thread", count: 1 },
    ],
  );
  assert.deepEqual(
    mediaBrowserItems.getMediaArtifactProvenanceFilterOptions(artifacts),
    [
      { key: "generated", label: "Generated", count: 2 },
      { key: "uploaded", label: "Uploaded", count: 1 },
    ],
  );
});

test("dedupeMediaArtifacts drops later duplicates with the same artifact kind and id", () => {
  const mediaBrowserItems = loadMediaBrowserItemsModule();

  const artifacts = [
    createArtifact({ id: "artifact-1", displayName: "First" }),
    createArtifact({ id: "artifact-1", displayName: "Second" }),
    createArtifact({ id: "artifact-2", displayName: "Third" }),
  ];

  const deduped = mediaBrowserItems.dedupeMediaArtifacts(artifacts);

  assert.deepEqual(deduped.map((artifact) => artifact.displayName), ["First", "Third"]);
});
