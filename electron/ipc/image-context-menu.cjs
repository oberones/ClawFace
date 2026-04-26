const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, Menu, dialog } = require("electron");

const IMAGE_EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

const IMAGE_FILTER_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"];

function normalizePayloadString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMenuPoint(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
}

function decodeDataImageUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+)(?:;[a-z0-9.+-]+=[^;,]+)*;base64,([\s\S]+)$/i.exec(
    normalizePayloadString(dataUrl),
  );
  if (!match) {
    return { ok: false, error: "invalid-data-url" };
  }
  try {
    const data = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
    if (data.length === 0) {
      return { ok: false, error: "empty-image" };
    }
    return {
      ok: true,
      mimeType: match[1].toLowerCase(),
      data,
    };
  } catch {
    return { ok: false, error: "invalid-data-url" };
  }
}

function imagePathFromDesktopLocalUrl(rawUrl, localImageScheme) {
  try {
    const parsed = new URL(normalizePayloadString(rawUrl));
    if (parsed.protocol !== `${localImageScheme}:`) {
      return "";
    }
    const queryPath = parsed.searchParams.get("path");
    if (queryPath) {
      return queryPath;
    }
    let pathname = decodeURIComponent(parsed.pathname || "");
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return "";
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(normalizePayloadString(value));
}

function isPathLikeImageSource(value) {
  const trimmed = normalizePayloadString(value);
  if (!trimmed || /^data:/i.test(trimmed) || isHttpUrl(trimmed) || /^blob:/i.test(trimmed)) {
    return false;
  }
  return true;
}

function pushUnique(target, value) {
  const trimmed = normalizePayloadString(value);
  if (trimmed && !target.includes(trimmed)) {
    target.push(trimmed);
  }
}

function imageSourcePathCandidates(payload, localImageScheme) {
  const candidates = [];
  for (const value of [payload.sourcePath, payload.dataUrl]) {
    pushUnique(candidates, imagePathFromDesktopLocalUrl(value, localImageScheme));
    if (isPathLikeImageSource(value)) {
      pushUnique(candidates, value);
    }
  }
  return candidates;
}

function httpImageSourceCandidates(payload) {
  const candidates = [];
  for (const value of [payload.dataUrl, payload.sourcePath]) {
    if (isHttpUrl(value)) {
      pushUnique(candidates, value);
    }
  }
  return candidates;
}

async function dataUrlFromReadResult(result) {
  const dataUrl = result && result.ok ? normalizePayloadString(result.dataUrl) : "";
  if (!dataUrl) {
    return null;
  }
  const decoded = decodeDataImageUrl(dataUrl);
  if (!decoded.ok) {
    return null;
  }
  return {
    data: decoded.data,
    mimeType: decoded.mimeType,
  };
}

async function loadImageForSave(payload, readers, localImageScheme) {
  const direct = decodeDataImageUrl(payload.dataUrl);
  if (direct.ok) {
    return {
      data: direct.data,
      mimeType: direct.mimeType,
    };
  }

  for (const sourcePath of imageSourcePathCandidates(payload, localImageScheme)) {
    try {
      const loaded = await dataUrlFromReadResult(await readers.readImageFile(sourcePath));
      if (loaded) {
        return loaded;
      }
    } catch {
      // Try the next source candidate.
    }
  }

  for (const url of httpImageSourceCandidates(payload)) {
    try {
      const loaded = await dataUrlFromReadResult(await readers.fetchImageUrl(url));
      if (loaded) {
        return loaded;
      }
    } catch {
      // Try the next source candidate.
    }
  }

  throw new Error("Unable to load image bytes for saving.");
}

function baseNameFromSource(value, localImageScheme) {
  let rawValue = normalizePayloadString(value);
  if (!rawValue || /^data:/i.test(rawValue)) {
    return "";
  }
  const fromDesktopUrl = imagePathFromDesktopLocalUrl(rawValue, localImageScheme);
  if (fromDesktopUrl) {
    rawValue = fromDesktopUrl;
  } else if (isHttpUrl(rawValue)) {
    try {
      rawValue = new URL(rawValue).pathname;
    } catch {
      return "";
    }
  }
  const normalized = rawValue.replace(/\\/g, "/").split("?")[0].split("#")[0];
  const encodedBaseName = normalized.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(encodedBaseName);
  } catch {
    return encodedBaseName;
  }
}

function sanitizeFileName(value) {
  const stripped = normalizePayloadString(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+$/, "")
    .trim();
  return stripped || "image";
}

function ensureImageExtension(fileName, mimeType) {
  const ext = path.extname(fileName).replace(/^\./, "").toLowerCase();
  if (IMAGE_FILTER_EXTENSIONS.includes(ext)) {
    return fileName;
  }
  const inferredExt = IMAGE_EXT_BY_MIME[normalizePayloadString(mimeType).toLowerCase()] || "png";
  return `${fileName}.${inferredExt}`;
}

function defaultImageSavePath(payload, mimeType, localImageScheme) {
  const baseName =
    baseNameFromSource(payload.name, localImageScheme) ||
    baseNameFromSource(payload.sourcePath, localImageScheme) ||
    baseNameFromSource(payload.dataUrl, localImageScheme) ||
    "image";
  const fileName = ensureImageExtension(sanitizeFileName(baseName), mimeType);
  return path.join(app.getPath("downloads"), fileName);
}

async function showImageSaveError(ownerWindow, error) {
  const detail = error instanceof Error ? error.message : String(error || "Unknown error");
  const options = {
    type: "error",
    message: "Unable to save image",
    detail,
  };
  if (ownerWindow) {
    await dialog.showMessageBox(ownerWindow, options);
    return;
  }
  await dialog.showMessageBox(options);
}

async function saveImageAs(payload, readers, ownerWindow, localImageScheme) {
  const loaded = await loadImageForSave(payload, readers, localImageScheme);
  const options = {
    title: "Save Image As",
    defaultPath: defaultImageSavePath(payload, loaded.mimeType, localImageScheme),
    filters: [
      { name: "Images", extensions: IMAGE_FILTER_EXTENSIONS },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  const result = ownerWindow
    ? await dialog.showSaveDialog(ownerWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) {
    return;
  }
  await fs.promises.writeFile(result.filePath, loaded.data);
}

function normalizeImageContextPayload(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  return {
    name: normalizePayloadString(payload.name),
    dataUrl: normalizePayloadString(payload.dataUrl),
    sourcePath: normalizePayloadString(payload.sourcePath),
    x: normalizeMenuPoint(payload.x),
    y: normalizeMenuPoint(payload.y),
  };
}

function createImageContextMenuHandler(params) {
  const {
    readImageFile,
    fetchImageUrl,
    localImageScheme = "claw-local-image",
  } = params || {};

  if (typeof readImageFile !== "function" || typeof fetchImageUrl !== "function") {
    throw new Error("createImageContextMenuHandler requires image reader callbacks");
  }

  return async function showImageContextMenu(event, rawPayload) {
    const payload = normalizeImageContextPayload(rawPayload);
    if (!payload.dataUrl && !payload.sourcePath) {
      return { ok: false, error: "invalid-image-source" };
    }
    const ownerWindow =
      BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const readers = { readImageFile, fetchImageUrl };
    const menu = Menu.buildFromTemplate([
      {
        label: "Save Image As...",
        click: () => {
          void saveImageAs(payload, readers, ownerWindow, localImageScheme).catch((error) => {
            void showImageSaveError(ownerWindow, error);
          });
        },
      },
    ]);
    menu.popup({
      window: ownerWindow || undefined,
      x: payload.x,
      y: payload.y,
    });
    return { ok: true };
  };
}

module.exports = {
  createImageContextMenuHandler,
};
