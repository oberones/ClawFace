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
