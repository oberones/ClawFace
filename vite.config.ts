import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import pkg from "./package.json";
import { clawFsPlugin } from "./vite-fs-plugin.ts";

const devPort = Number(process.env.PORT) || 5178;
const WORKSPACE_DIR = path.join(os.homedir(), ".openclaw", "workspace");
const MEDIA_DIR = path.join(os.homedir(), ".openclaw", "media");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function decodeLocalImagePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isWindowsAbsolute(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function isPosixAbsolute(value: string): boolean {
  return value.startsWith("/");
}

function mapOpenClawPathToLocalRoot(raw: string, localRoot: string, dirName: "workspace" | "media"): string | null {
  const normalized = raw.trim().replace(/\\/g, "/");
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const absoluteMarker = `/.openclaw/${dirName}/`;
  const absoluteRootMarker = `/.openclaw/${dirName}`;
  const dotRelativeMarker = `.openclaw/${dirName}/`;
  const bareRelativeMarker = `openclaw/${dirName}/`;
  if (lower === absoluteRootMarker || lower === dotRelativeMarker.slice(0, -1) || lower === bareRelativeMarker.slice(0, -1)) {
    return localRoot;
  }
  const absoluteIndex = lower.indexOf(absoluteMarker);
  if (absoluteIndex >= 0) {
    const suffix = normalized.slice(absoluteIndex + absoluteMarker.length);
    return suffix ? path.join(localRoot, suffix) : localRoot;
  }
  if (lower.startsWith(dotRelativeMarker)) {
    return path.join(localRoot, normalized.slice(dotRelativeMarker.length));
  }
  if (lower.startsWith(bareRelativeMarker)) {
    return path.join(localRoot, normalized.slice(bareRelativeMarker.length));
  }
  return null;
}

function normalizeIncomingPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const mappedMediaPath = mapOpenClawPathToLocalRoot(trimmed, MEDIA_DIR, "media");
  if (mappedMediaPath) {
    return path.normalize(mappedMediaPath);
  }
  const mappedWorkspacePath = mapOpenClawPathToLocalRoot(trimmed, WORKSPACE_DIR, "workspace");
  if (mappedWorkspacePath) {
    return path.normalize(mappedWorkspacePath);
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    if (isWindowsAbsolute(trimmed) || isPosixAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }
    return "";
  }
  return path.join(WORKSPACE_DIR, trimmed);
}

function isAllowedLocalPath(candidate: string): boolean {
  const normalized = path.resolve(candidate);
  if (!normalized) {
    return false;
  }
  const allowedRoots = [WORKSPACE_DIR, MEDIA_DIR, "/tmp"].map((root) => path.resolve(root));
  return allowedRoots.some((root) => normalized === root || normalized.startsWith(`${root}${path.sep}`));
}

function localImageProxyPlugin() {
  return {
    name: "clawui-local-image-proxy",
    configureServer(
      server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } },
    ) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ?? "";
        if (req.method !== "GET" || !requestUrl.startsWith("/__claw/local-image")) {
          next();
          return;
        }
        const url = new URL(requestUrl, "http://127.0.0.1");
        const rawPath = decodeLocalImagePath(url.searchParams.get("path") ?? "");
        const resolvedPath = normalizeIncomingPath(rawPath);
        if (!resolvedPath || !isAllowedLocalPath(resolvedPath)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        const extension = path.extname(resolvedPath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          res.statusCode = 415;
          res.end("unsupported media type");
          return;
        }
        try {
          const stat = await fs.stat(resolvedPath);
          if (!stat.isFile()) {
            res.statusCode = 404;
            res.end("not found");
            return;
          }
          if (stat.size > MAX_IMAGE_BYTES) {
            res.statusCode = 413;
            res.end("file too large");
            return;
          }
          const contentType =
            extension === ".png"
              ? "image/png"
              : extension === ".jpg" || extension === ".jpeg"
              ? "image/jpeg"
              : extension === ".webp"
              ? "image/webp"
              : extension === ".gif"
              ? "image/gif"
              : extension === ".bmp"
              ? "image/bmp"
              : "image/svg+xml";
          const binary = await fs.readFile(resolvedPath);
          res.statusCode = 200;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "private, max-age=30");
          res.end(binary);
        } catch {
          res.statusCode = 404;
          res.end("not found");
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), localImageProxyPlugin(), clawFsPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: devPort,
    strictPort: false,
  },
});
