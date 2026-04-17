import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function withWindow(nextWindow, fn) {
  const previousWindow = globalThis.window;
  globalThis.window = nextWindow;
  try {
    return fn();
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

function loadAttachmentModules() {
  const loader = createTsModuleLoader();
  return {
    attachments: loader.loadModule(path.join(repoRoot, "src/lib/chat-message-attachments.ts")),
    pathMappings: loader.loadModule(path.join(repoRoot, "src/lib/path-prefix-mappings.ts")),
  };
}

test("extractMediaAttachmentsFromText resolves mapped MEDIA directives and strips directive lines", () => {
  withWindow(
    {
      desktopInfo: {
        homeDir: "/Users/oberon",
        isDesktop: true,
        workspaceDir: "/Users/oberon/.openclaw/workspace",
      },
      location: {
        origin: "file://",
        protocol: "file:",
      },
    },
    () => {
      const { attachments, pathMappings } = loadAttachmentModules();
      pathMappings.setActivePathPrefixMappingsText("/home/node/.openclaw/media => ~/.openclaw/media", {
        homeDir: "/Users/oberon",
      });

      const result = attachments.extractMediaAttachmentsFromText(
        "Rendered preview\nMEDIA:/home/node/.openclaw/media/cat---uuid.png\nDone",
        {
          homeDir: "/Users/oberon",
          workspaceDir: "/Users/oberon/.openclaw/workspace",
        },
      );

      assert.equal(result.cleanedText, "Rendered preview\nDone");
      assert.equal(result.attachments.length, 1);
      assert.equal(result.attachments[0].name, "cat---uuid.png");
      assert.equal(result.attachments[0].sourcePath, "/home/node/.openclaw/media/cat---uuid.png");
      assert.equal(
        result.attachments[0].dataUrl,
        "claw-local-image://open?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fcat---uuid.png",
      );
    },
  );
});

test("toChatMessageSafe turns MEDIA tool output into an assistant attachment message", () => {
  withWindow(
    {
      desktopInfo: {
        homeDir: "/Users/oberon",
        isDesktop: true,
        workspaceDir: "/Users/oberon/.openclaw/workspace",
      },
      location: {
        origin: "file://",
        protocol: "file:",
      },
    },
    () => {
      const { attachments } = loadAttachmentModules();

      const message = attachments.toChatMessageSafe(
        {
          role: "toolResult",
          runId: "run-123",
          content: "MEDIA:monkey-gangster---uuid.png",
        },
        {
          fallbackTimestamp: 4242,
          runtimeHints: {
            homeDir: "/Users/oberon",
            workspaceDir: "/Users/oberon/.openclaw/workspace",
          },
        },
      );

      assert.ok(message);
      assert.equal(message.role, "assistant");
      assert.equal(message.text, "");
      assert.equal(message.timestamp, 4242);
      assert.equal(message.runId, "run-123");
      assert.equal(message.attachments?.length, 1);
      assert.equal(message.attachments?.[0].sourcePath, "/Users/oberon/.openclaw/media/monkey-gangster---uuid.png");
      assert.equal(
        message.attachments?.[0].dataUrl,
        "claw-local-image://open?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
      );
    },
  );
});
