const { ipcMain, shell } = require("electron");

function registerDesktopIpcHandlers(params) {
  const {
    readImageFile,
    fetchImageUrl,
    setGatewayUrl,
    setFsServerUrl,
  } = params || {};

  if (
    typeof readImageFile !== "function" ||
    typeof fetchImageUrl !== "function" ||
    typeof setGatewayUrl !== "function" ||
    typeof setFsServerUrl !== "function"
  ) {
    throw new Error("registerDesktopIpcHandlers requires all handler callbacks");
  }

  ipcMain.handle("desktop:beep", () => {
    try {
      shell.beep();
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("desktop:read-image-file", (_event, rawPath) => {
    return readImageFile(rawPath);
  });

  ipcMain.handle("desktop:fetch-image-url", (_event, rawUrl) => {
    return fetchImageUrl(rawUrl);
  });

  ipcMain.handle("desktop:set-gateway-url", (_event, rawGatewayUrl) => {
    return setGatewayUrl(rawGatewayUrl);
  });

  ipcMain.handle("desktop:set-fs-server-url", (_event, rawUrl) => {
    return setFsServerUrl(rawUrl);
  });
}

module.exports = {
  registerDesktopIpcHandlers,
};
