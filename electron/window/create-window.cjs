const fs = require("node:fs");
const path = require("node:path");
const { BrowserWindow, shell } = require("electron");

function createMainWindow(params) {
  const {
    electronRootDir,
    appIcon,
    devServerUrl,
    windowWidth,
    windowHeight,
    minWidth,
    minHeight,
    blankCheckDelayMs,
    maxBlankRecoveryAttempts,
    getIsQuitting,
    shouldHideOnClose,
    onRenderProcessGone,
    onClosed,
  } = params;

  const nextWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth,
    minHeight,
    autoHideMenuBar: true,
    icon: appIcon || undefined,
    webPreferences: {
      preload: path.join(electronRootDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (devServerUrl) {
    nextWindow.loadURL(devServerUrl);
  } else {
    const entryPath = path.join(electronRootDir, "..", "dist", "index.html");
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Desktop bundle is missing: ${entryPath}`);
    }
    nextWindow.loadFile(entryPath);
  }

  let blankRecoveryAttempts = 0;
  let blankCheckTimer = null;

  const clearBlankCheckTimer = () => {
    if (blankCheckTimer === null) {
      return;
    }
    clearTimeout(blankCheckTimer);
    blankCheckTimer = null;
  };

  const runBlankCheck = async () => {
    if (nextWindow.isDestroyed()) {
      return;
    }
    try {
      const state = await nextWindow.webContents.executeJavaScript(
        `(() => {
          const root = document.getElementById("root");
          const hasRoot = Boolean(root);
          const rootChildren = hasRoot ? root.childElementCount : 0;
          const rootText = hasRoot ? (root.textContent || "").trim().length : 0;
          return { hasRoot, rootChildren, rootText };
        })();`,
      );
      const looksBlank =
        !state ||
        typeof state !== "object" ||
        state.hasRoot !== true ||
        (((state.rootChildren ?? 0) === 0) && ((state.rootText ?? 0) === 0));
      if (!looksBlank) {
        return;
      }
    } catch {
      // If script execution fails, treat it as a blank state and recover.
    }

    if (blankRecoveryAttempts >= maxBlankRecoveryAttempts) {
      return;
    }
    blankRecoveryAttempts += 1;

    if (!nextWindow.isDestroyed()) {
      nextWindow.webContents.reloadIgnoringCache();
    }
  };

  const scheduleBlankCheck = () => {
    clearBlankCheckTimer();
    blankCheckTimer = setTimeout(() => {
      blankCheckTimer = null;
      void runBlankCheck();
    }, blankCheckDelayMs);
  };

  nextWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  nextWindow.webContents.on("did-finish-load", () => {
    scheduleBlankCheck();
  });

  nextWindow.webContents.on(
    "did-fail-load",
    (_event, _errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame || getIsQuitting() || nextWindow.isDestroyed()) {
        return;
      }
      if (blankRecoveryAttempts >= maxBlankRecoveryAttempts) {
        return;
      }
      blankRecoveryAttempts += 1;
      nextWindow.webContents.reloadIgnoringCache();
    },
  );

  nextWindow.webContents.on("render-process-gone", () => {
    if (getIsQuitting()) {
      return;
    }
    onRenderProcessGone();
  });

  nextWindow.on("close", (event) => {
    if (shouldHideOnClose()) {
      event.preventDefault();
      nextWindow.hide();
    }
  });

  nextWindow.on("closed", () => {
    clearBlankCheckTimer();
    onClosed();
  });

  return nextWindow;
}

module.exports = {
  createMainWindow,
};
