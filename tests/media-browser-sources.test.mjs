import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.window = {
  desktopInfo: {
    isDesktop: false,
    homeDir: "/Users/oberon",
    workspaceDir: "/Users/oberon/.openclaw/workspace/ClawFace",
  },
  location: {
    protocol: "http:",
    origin: "http://localhost",
  },
};

function loadMediaBrowserSourcesModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/media-browser-sources.ts"));
}

function createAttachment(overrides = {}) {
  return {
    id: "attachment-1",
    name: "artifact.png",
    size: 10,
    type: "image/png",
    dataUrl: "claw-local-image://image.png",
    sourcePath: "/Users/oberon/.openclaw/media/image.png",
    isImage: true,
    ...overrides,
  };
}

function createMessage(overrides = {}) {
  return {
    id: "message-1",
    role: "assistant",
    text: "",
    timestamp: 100,
    attachments: [createAttachment()],
    ...overrides,
  };
}

test("buildMediaBrowserSourceData derives source roots from loaded history and ignores preview-only sessions", () => {
  const mediaBrowserSources = loadMediaBrowserSourcesModule();

  const sourceData = mediaBrowserSources.buildMediaBrowserSourceData({
    sessions: [
      { key: "loaded-session", kind: "direct", label: "Loaded session", updatedAt: 10 },
      { key: "preview-only-session", kind: "direct", label: "Preview only", updatedAt: 20 },
    ],
    sessionPreviews: {
      "preview-only-session": [{ role: "assistant", text: "preview text only" }],
    },
    loadedHistories: {
      "loaded-session": {
        sessionKey: "loaded-session",
        messages: [
          createMessage({
            attachments: [
              createAttachment({
                id: "generated-1",
                name: "generated.png",
                sourcePath: "/Users/oberon/.openclaw/media/generated.png",
              }),
            ],
          }),
          createMessage({
            id: "message-2",
            role: "user",
            attachments: [
              createAttachment({
                id: "uploaded-1",
                name: "upload.png",
                sourcePath: "/Users/oberon/.openclaw/media/inbound/upload.png",
              }),
            ],
          }),
          createMessage({
            id: "message-3",
            attachments: [
              createAttachment({
                id: "linked-1",
                name: "linked.png",
                sourcePath: "/tmp/project/linked.png",
              }),
            ],
          }),
        ],
      },
    },
  });

  assert.equal(sourceData.artifacts.length, 3);
  assert.deepEqual(
    sourceData.artifacts.map((artifact) => artifact.sourceKey),
    ["generated", "uploaded", "session-linked"],
  );
  assert.deepEqual(sourceData.roots, [
    { key: "all", label: "All media", count: 3, supportsFilter: true },
    { key: "generated", label: "Generated", count: 1, supportsFilter: true },
    { key: "uploaded", label: "Uploaded", count: 1, supportsFilter: true },
    { key: "session-linked", label: "Session-linked", count: 1, supportsFilter: true },
  ]);
});

test("buildMediaBrowserSourceData preserves portable render references for remote-only image artifacts", () => {
  const mediaBrowserSources = loadMediaBrowserSourcesModule();

  const sourceData = mediaBrowserSources.buildMediaBrowserSourceData({
    sessions: [{ key: "remote-session", kind: "direct", label: "Remote session", updatedAt: 10 }],
    loadedHistories: {
      "remote-session": {
        sessionKey: "remote-session",
        messages: [
          createMessage({
            attachments: [
              createAttachment({
                id: "remote-1",
                name: "remote.png",
                dataUrl: "https://gateway.example/__claw/media/artifact/remote-1",
                sourcePath: undefined,
              }),
            ],
          }),
        ],
      },
    },
  });

  assert.equal(sourceData.artifacts.length, 1);
  assert.equal(
    sourceData.artifacts[0]?.renderRef.dataUrl,
    "https://gateway.example/__claw/media/artifact/remote-1",
  );
  assert.equal(sourceData.artifacts[0]?.renderRef.sourcePath, null);
});

test("buildMediaBrowserSourceData preserves session and provenance metadata needed for source-specific narrowing", () => {
  const mediaBrowserSources = loadMediaBrowserSourcesModule();

  const sourceData = mediaBrowserSources.buildMediaBrowserSourceData({
    sessions: [
      { key: "session-generated", kind: "direct", label: "Generator chat", updatedAt: 10 },
      { key: "session-upload", kind: "direct", label: "Upload chat", updatedAt: 20 },
    ],
    loadedHistories: {
      "session-generated": {
        sessionKey: "session-generated",
        messages: [
          createMessage({
            attachments: [
              createAttachment({
                id: "generated-asset",
                name: "generated.png",
                sourcePath: "/Users/oberon/.openclaw/media/generated.png",
              }),
            ],
          }),
        ],
      },
      "session-upload": {
        sessionKey: "session-upload",
        messages: [
          createMessage({
            id: "message-upload",
            role: "user",
            attachments: [
              createAttachment({
                id: "uploaded-asset",
                name: "uploaded.png",
                sourcePath: "/Users/oberon/.openclaw/media/inbound/uploaded.png",
              }),
            ],
          }),
        ],
      },
    },
  });

  const generated = sourceData.artifacts.find((artifact) => artifact.id.includes("generated-asset"));
  const uploaded = sourceData.artifacts.find((artifact) => artifact.id.includes("uploaded-asset"));

  assert.deepEqual(
    {
      sessionKey: generated?.sessionKey,
      sourceKey: generated?.sourceKey,
      provenance: generated?.provenance,
    },
    {
      sessionKey: "session-generated",
      sourceKey: "generated",
      provenance: { kind: "generated", label: "Generator chat" },
    },
  );
  assert.deepEqual(
    {
      sessionKey: uploaded?.sessionKey,
      sourceKey: uploaded?.sourceKey,
      provenance: uploaded?.provenance,
    },
    {
      sessionKey: "session-upload",
      sourceKey: "uploaded",
      provenance: { kind: "uploaded", label: "Upload chat" },
    },
  );
});
