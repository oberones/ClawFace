const fs = require("node:fs");
const path = require("node:path");
const { app, nativeImage, protocol } = require("electron");
const { createImageContextMenuHandler } = require("./ipc/image-context-menu.cjs");
const { registerDesktopIpcHandlers } = require("./ipc/register-desktop-ipc.cjs");
const { createClawFsProtocolHandler } = require("./protocols/claw-fs.cjs");
const {
  createLocalImageTransport,
  resolveGatewayHttpBaseCandidates,
  hasRemoteGatewayCandidates,
} = require("./protocols/local-image.cjs");
const {
  registerDesktopProtocolSchemes,
  registerDesktopProtocolHandlers,
} = require("./protocols/register-desktop-protocols.cjs");
const { createMainWindow: createDesktopWindow } = require("./window/create-window.cjs");

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 820;
const DESKTOP_LOCAL_IMAGE_SCHEME = "claw-local-image";
const CLAW_FS_SCHEME = "claw-fs";
const APP_ICON_FILE = "clawface-logo.png";
const BLANK_CHECK_DELAY_MS = 1400;
const MAX_BLANK_RECOVERY_ATTEMPTS = 2;
const DESKTOP_DEV_SERVER_URL = typeof process.env.CLAWFACE_DEV_SERVER_URL === "string"
  ? process.env.CLAWFACE_DEV_SERVER_URL.trim().replace(/\/+$/g, "")
  : "";
let gatewayHttpBaseCandidates = [];
let gatewayUsesRemoteHost = false;
let clawFsServerUrl = "";
let mainWindow = null;
let isQuitting = false;
let cachedAppIcon = undefined;

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, "..", "dist", APP_ICON_FILE),
    path.join(__dirname, "..", "public", APP_ICON_FILE),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getAppIcon() {
  if (cachedAppIcon !== undefined) {
    return cachedAppIcon;
  }
  const iconPath = resolveAppIconPath();
  if (!iconPath) {
    cachedAppIcon = null;
    return cachedAppIcon;
  }
  const image = nativeImage.createFromPath(iconPath);
  cachedAppIcon = image.isEmpty() ? null : image;
  return cachedAppIcon;
}

function mapOpenClawPathToLocalHome(rawPath, homeDir, dirName) {
  const normalized = normalizePathSeparators(rawPath).trim();
  const marker = `/.openclaw/${dirName}/`;
  const markerIndex = normalized.toLowerCase().indexOf(marker);
  if (markerIndex < 0) {
    const rootMarker = `/.openclaw/${dirName}`;
    if (normalized.toLowerCase().endsWith(rootMarker)) {
      return path.join(homeDir, ".openclaw", dirName);
    }
    return null;
  }
  const suffix = normalized.slice(markerIndex + marker.length);
  if (!suffix) {
    return path.join(homeDir, ".openclaw", dirName);
  }
  return path.join(homeDir, ".openclaw", dirName, suffix);
}

function mapWorkspacePathToLocalHome(rawPath, homeDir) {
  return mapOpenClawPathToLocalHome(rawPath, homeDir, "workspace");
}

function mapMediaPathToLocalHome(rawPath, homeDir) {
  return mapOpenClawPathToLocalHome(rawPath, homeDir, "media");
}

function resolveOpenClawRelativePath(rawPath, homeDir, dirName) {
  const normalized = normalizePathSeparators(rawPath)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const dotRelativeMarker = `.openclaw/${dirName}/`;
  const bareRelativeMarker = `openclaw/${dirName}/`;
  if (lower === `.openclaw/${dirName}` || lower === `openclaw/${dirName}`) {
    return path.join(homeDir, ".openclaw", dirName);
  }
  if (lower.startsWith(dotRelativeMarker)) {
    return path.join(homeDir, normalized);
  }
  if (lower.startsWith(bareRelativeMarker)) {
    return path.join(homeDir, `.${normalized}`);
  }
  return null;
}

function resolveWorkspaceRelativePath(rawPath, homeDir) {
  const resolved = resolveOpenClawRelativePath(rawPath, homeDir, "workspace");
  if (resolved) {
    return resolved;
  }
  const normalized = normalizePathSeparators(rawPath)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  if (!normalized.includes("/") && isLikelyImageFileName(normalized)) {
    return path.join(homeDir, ".openclaw", "workspace", normalized);
  }
  return null;
}

function resolveMediaRelativePath(rawPath, homeDir) {
  return resolveOpenClawRelativePath(rawPath, homeDir, "media");
}

function getCachedImage(pathKey, mimeType, stat) {
  const entry = imageDataCache.get(pathKey);
  if (!entry) {
    return null;
  }
  if (entry.mimeType !== mimeType) {
    imageDataCache.delete(pathKey);
    return null;
  }
  if (stat && (entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs)) {
    imageDataCache.delete(pathKey);
    return null;
  }
  // Refresh insertion order for LRU behavior.
  imageDataCache.delete(pathKey);
  imageDataCache.set(pathKey, entry);
  return entry;
}

function setCachedImage(pathKey, value) {
  if (imageDataCache.has(pathKey)) {
    imageDataCache.delete(pathKey);
  }
  imageDataCache.set(pathKey, value);
  while (imageDataCache.size > IMAGE_CACHE_LIMIT) {
    const oldestKey = imageDataCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    imageDataCache.delete(oldestKey);
  }
}

registerDesktopProtocolSchemes({
  protocol,
  localImageScheme: DESKTOP_LOCAL_IMAGE_SCHEME,
  fsScheme: CLAW_FS_SCHEME,
});

const handleClawFsRequest = createClawFsProtocolHandler({
  homeDir: app.getPath("home"),
  getServerUrl: () => clawFsServerUrl,
});

const localImageTransport = createLocalImageTransport({
  homeDir: app.getPath("home"),
  localImageScheme: DESKTOP_LOCAL_IMAGE_SCHEME,
  getGatewayBaseCandidates: () => gatewayHttpBaseCandidates,
  viteDevServerPort: process.env.CLAWUI_IMAGE_PROXY_PORT || "3000",
});

function updateDesktopGatewayUrl(rawGatewayUrl) {
  if (typeof rawGatewayUrl !== "string") {
    gatewayHttpBaseCandidates = [];
    gatewayUsesRemoteHost = false;
    return { ok: true, remote: false, candidates: 0 };
  }
  const nextCandidates = resolveGatewayHttpBaseCandidates(rawGatewayUrl);
  gatewayHttpBaseCandidates = nextCandidates;
  gatewayUsesRemoteHost = hasRemoteGatewayCandidates(nextCandidates);
  return {
    ok: true,
    remote: gatewayUsesRemoteHost,
    candidates: gatewayHttpBaseCandidates.length,
  };
}

function updateDesktopFsServerUrl(url) {
  clawFsServerUrl = typeof url === "string" ? url.trim() : "";
  return { ok: true, url: clawFsServerUrl };
}

registerDesktopIpcHandlers({
  readImageFile: localImageTransport.readDesktopImageFile,
  fetchImageUrl: localImageTransport.fetchDesktopImageUrl,
  showImageContextMenu: createImageContextMenuHandler({
    readImageFile: localImageTransport.readDesktopImageFile,
    fetchImageUrl: localImageTransport.fetchDesktopImageUrl,
    localImageScheme: DESKTOP_LOCAL_IMAGE_SCHEME,
  }),
  setGatewayUrl: updateDesktopGatewayUrl,
  setFsServerUrl: updateDesktopFsServerUrl,
});

function hasLiveMainWindow() {
  return Boolean(mainWindow && !mainWindow.isDestroyed());
}

function recreateMainWindow() {
  if (hasLiveMainWindow()) {
    const staleWindow = mainWindow;
    mainWindow = null;
    try {
      staleWindow.destroy();
    } catch {
      // ignore stale-window teardown errors
    }
  }
  return createMainWindow();
}

function focusMainWindow() {
  if (!hasLiveMainWindow()) {
    return false;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  return true;
}

function createMainWindow() {
  if (focusMainWindow()) {
    return mainWindow;
  }

  const appIcon = getAppIcon();
  const nextWindow = createDesktopWindow({
    electronRootDir: __dirname,
    appIcon,
    devServerUrl: DESKTOP_DEV_SERVER_URL,
    windowWidth: WINDOW_WIDTH,
    windowHeight: WINDOW_HEIGHT,
    minWidth: 1000,
    minHeight: 640,
    blankCheckDelayMs: BLANK_CHECK_DELAY_MS,
    maxBlankRecoveryAttempts: MAX_BLANK_RECOVERY_ATTEMPTS,
    getIsQuitting: () => isQuitting,
    shouldHideOnClose: () => process.platform === "darwin" && !isQuitting,
    onRenderProcessGone: () => {
      recreateMainWindow();
    },
    onClosed: () => {
      if (mainWindow === nextWindow) {
        mainWindow = null;
      }
    },
  });

  mainWindow = nextWindow;

  return nextWindow;
}

app.whenReady().then(() => {
  const appIcon = getAppIcon();
  if (process.platform === "darwin" && appIcon && app.dock) {
    app.dock.setIcon(appIcon);
  }
  registerDesktopProtocolHandlers({
    protocol,
    localImageScheme: DESKTOP_LOCAL_IMAGE_SCHEME,
    fsScheme: CLAW_FS_SCHEME,
    handleLocalImageRequest: localImageTransport.handleDesktopLocalImageRequest,
    handleFsRequest: handleClawFsRequest,
  });
  createMainWindow();

  app.on("activate", () => {
    if (!focusMainWindow()) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
