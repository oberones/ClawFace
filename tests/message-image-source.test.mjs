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

function loadImageModules() {
  const loader = createTsModuleLoader();
  return {
    imageSource: loader.loadModule(path.join(repoRoot, "src/lib/message-image-source.ts")),
    pathMappings: loader.loadModule(path.join(repoRoot, "src/lib/path-prefix-mappings.ts")),
  };
}

test("filePathFromImageSource resolves generated bare filenames into the media directory", () => {
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
      const { imageSource } = loadImageModules();
      assert.equal(
        imageSource.filePathFromImageSource("monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png"),
        "/Users/oberon/.openclaw/media/monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png",
      );
    },
  );
});

test("filePathFromImageSource applies active prefix mappings for shared-volume container paths", () => {
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
      const { imageSource, pathMappings } = loadImageModules();
      pathMappings.setActivePathPrefixMappingsText(
        "/home/node/.openclaw/media => ~/.openclaw/media\n/home/node/.openclaw/workspace => ~/.openclaw/workspace",
        { homeDir: "/Users/oberon" },
      );

      assert.equal(
        imageSource.filePathFromImageSource("/home/node/.openclaw/media/monkey-gangster---uuid.png"),
        "/Users/oberon/.openclaw/media/monkey-gangster---uuid.png",
      );
      assert.equal(
        imageSource.filePathFromImageSource("/home/node/.openclaw/workspace/shot.png"),
        "/Users/oberon/.openclaw/workspace/shot.png",
      );
    },
  );
});

test("toRuntimeRenderableSrc uses the desktop scheme for desktop paths and the local proxy on web", () => {
  const desktopResult = withWindow(
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
      const { imageSource } = loadImageModules();
      return imageSource.toRuntimeRenderableSrc("monkey-gangster---uuid.png");
    },
  );

  const webResult = withWindow(
    {
      desktopInfo: {
        homeDir: "/Users/oberon",
        isDesktop: false,
        workspaceDir: "/Users/oberon/.openclaw/workspace",
      },
      location: {
        origin: "http://localhost:5173",
        protocol: "http:",
      },
    },
    () => {
      const { imageSource } = loadImageModules();
      return imageSource.toRuntimeRenderableSrc("monkey-gangster---uuid.png");
    },
  );

  assert.equal(
    desktopResult,
    "claw-local-image://open?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
  );
  assert.equal(
    webResult,
    "http://localhost:5173/__claw/local-image?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
  );
});

test("normalizeRuntimeImageSourceData reuses the shared runtime mapping for file URLs", () => {
  const desktopResult = withWindow(
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
      const { imageSource } = loadImageModules();
      return imageSource.normalizeRuntimeImageSourceData(
        "file:///Users/oberon/.openclaw/media/monkey-gangster---uuid.png",
        "image/png",
      );
    },
  );

  const webResult = withWindow(
    {
      desktopInfo: {
        homeDir: "/Users/oberon",
        isDesktop: false,
        workspaceDir: "/Users/oberon/.openclaw/workspace",
      },
      location: {
        origin: "http://localhost:5173",
        protocol: "http:",
      },
    },
    () => {
      const { imageSource } = loadImageModules();
      return imageSource.normalizeRuntimeImageSourceData(
        "file:///Users/oberon/.openclaw/media/monkey-gangster---uuid.png",
        "image/png",
      );
    },
  );

  assert.deepEqual(desktopResult, {
    dataUrl:
      "claw-local-image://open?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
    fromBase64: false,
    sourcePath: "/Users/oberon/.openclaw/media/monkey-gangster---uuid.png",
  });
  assert.deepEqual(webResult, {
    dataUrl:
      "http://localhost:5173/__claw/local-image?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
    fromBase64: false,
    sourcePath: "/Users/oberon/.openclaw/media/monkey-gangster---uuid.png",
  });
});

test("normalizeRuntimeImageSourceData maps desktop local image URLs through active path prefix mappings", () => {
  const result = withWindow(
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
      const { imageSource, pathMappings } = loadImageModules();
      pathMappings.setActivePathPrefixMappingsText(
        "/home/node/.openclaw/media => ~/.openclaw/media",
        { homeDir: "/Users/oberon" },
      );

      return imageSource.normalizeRuntimeImageSourceData(
        "claw-local-image://open?path=%2Fhome%2Fnode%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
        "image/png",
      );
    },
  );

  assert.deepEqual(result, {
    dataUrl:
      "claw-local-image://open?path=%2FUsers%2Foberon%2F.openclaw%2Fmedia%2Fmonkey-gangster---uuid.png",
    fromBase64: false,
    sourcePath: "/home/node/.openclaw/media/monkey-gangster---uuid.png",
  });
});
