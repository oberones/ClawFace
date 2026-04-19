const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MAX_READ_BYTES = 100 * 1024 * 1024; // 100 MB

function createClawFsProtocolHandler(params) {
  const { homeDir, getServerUrl, maxReadBytes = DEFAULT_MAX_READ_BYTES } = params || {};

  if (typeof homeDir !== "string" || !homeDir.trim() || typeof getServerUrl !== "function") {
    throw new Error("createClawFsProtocolHandler requires homeDir and getServerUrl");
  }

  const configPath = path.join(homeDir, ".openclaw", "clawui-fs.json");

  function defaultRoots() {
    return [
      {
        label: "Workspace",
        path: path.join(homeDir, ".openclaw", "workspace"),
      },
    ];
  }

  function clawFsLoadConfig() {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.roots)) {
        return parsed;
      }
    } catch {
      // ignore invalid/missing config and fall back to defaults
    }
    return { roots: defaultRoots() };
  }

  function clawFsSaveConfig(config) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  function clawFsIsPathUnderRoots(candidate, roots) {
    const resolved = path.resolve(candidate);
    for (const root of roots) {
      const rootResolved = path.resolve(root.path);
      if (resolved === rootResolved || resolved.startsWith(rootResolved + path.sep)) {
        return true;
      }
    }
    return false;
  }

  function clawFsResolveAndValidate(rawPath, roots) {
    if (!rawPath) {
      return { error: "missing path parameter", status: 400 };
    }
    const resolved = path.resolve(rawPath);
    if (!clawFsIsPathUnderRoots(resolved, roots)) {
      return { error: "path outside allowed roots", status: 403 };
    }
    return { resolved };
  }

  function clawFsMimeFromExt(ext) {
    const map = {
      ".html": "text/html",
      ".htm": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".json": "application/json",
      ".jsonl": "application/x-ndjson",
      ".xml": "application/xml",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon",
      ".pdf": "application/pdf",
      ".zip": "application/zip",
      ".gz": "application/gzip",
      ".tar": "application/x-tar",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".otf": "font/otf",
      ".md": "text/markdown",
      ".markdown": "text/markdown",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".tsv": "text/tab-separated-values",
      ".yaml": "text/yaml",
      ".yml": "text/yaml",
      ".toml": "text/plain",
      ".log": "text/plain",
      ".sh": "text/x-shellscript",
      ".bash": "text/x-shellscript",
      ".zsh": "text/x-shellscript",
      ".py": "text/x-python",
      ".rs": "text/x-rust",
      ".go": "text/x-go",
      ".java": "text/x-java",
      ".c": "text/x-c",
      ".cpp": "text/x-c++",
      ".h": "text/x-c",
      ".hpp": "text/x-c++",
      ".ts": "text/typescript",
      ".tsx": "text/typescript",
      ".jsx": "text/javascript",
      ".r": "text/x-r",
      ".sql": "text/x-sql",
    };
    return map[(ext || "").toLowerCase()] || "application/octet-stream";
  }

  function clawFsJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function clawFsErrorResponse(status, message) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function clawFsProxyToRemote(request) {
    const base = String(getServerUrl() || "").trim().replace(/\/+$/, "");
    const fsUrl = new URL(request.url);
    const route = fsUrl.pathname.replace(/^\/+/, "");
    const proxyUrl = `${base}/__claw/fs/${route}${fsUrl.search}`;

    const init = { method: request.method, headers: {} };
    if (request.method === "POST" || request.method === "DELETE") {
      const ct = request.headers.get("content-type");
      if (ct) {
        init.headers["content-type"] = ct;
      }
      init.body = await request.arrayBuffer();
    }

    try {
      return await fetch(proxyUrl, init);
    } catch (err) {
      return clawFsErrorResponse(502, `proxy error: ${err.message || err}`);
    }
  }

  return async function handleClawFsRequest(request) {
    if (String(getServerUrl() || "").trim()) {
      return clawFsProxyToRemote(request);
    }

    try {
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/+/, "");
      const config = clawFsLoadConfig();

      switch (route) {
        case "roots": {
          if (request.method === "GET") {
            return clawFsJsonResponse({ roots: config.roots });
          }
          if (request.method === "POST") {
            const payload = await request.json();
            if (!Array.isArray(payload?.roots)) {
              return clawFsErrorResponse(400, "expected { roots: [...] }");
            }
            const newRoots = [];
            for (const root of payload.roots) {
              if (!root?.path || typeof root.path !== "string") {
                continue;
              }
              const label =
                typeof root.label === "string" ? root.label : path.basename(root.path);
              try {
                const stat = fs.statSync(root.path);
                if (!stat.isDirectory()) {
                  continue;
                }
              } catch {
                continue;
              }
              newRoots.push({ label, path: path.resolve(root.path) });
            }
            const newConfig = { roots: newRoots };
            clawFsSaveConfig(newConfig);
            return clawFsJsonResponse({ roots: newConfig.roots });
          }
          return clawFsErrorResponse(405, "method not allowed");
        }

        case "list": {
          if (request.method !== "GET") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const dirPath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(dirPath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          const stat = fs.statSync(result.resolved);
          if (!stat.isDirectory()) {
            return clawFsErrorResponse(400, "not a directory");
          }
          const entries = fs.readdirSync(result.resolved, { withFileTypes: true });
          const items = entries
            .filter((entry) => !entry.name.startsWith("."))
            .map((entry) => {
              const fullPath = path.join(result.resolved, entry.name);
              try {
                const entryStat = fs.statSync(fullPath);
                return {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: entry.isDirectory(),
                  size: entryStat.size,
                  mtime: entryStat.mtimeMs,
                  mime: entry.isDirectory()
                    ? null
                    : clawFsMimeFromExt(path.extname(entry.name)),
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          return clawFsJsonResponse({ path: result.resolved, items });
        }

        case "list-all": {
          if (request.method !== "GET") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const dirPath = url.searchParams.get("path") || "";
          const maxDepthStr = url.searchParams.get("maxDepth");
          const maxDepth =
            maxDepthStr !== null ? Math.max(1, parseInt(maxDepthStr, 10) || 10) : 10;
          const result = clawFsResolveAndValidate(dirPath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }

          const items = [];
          const queue = [{ dir: result.resolved, depth: 0 }];
          while (queue.length > 0) {
            const { dir, depth } = queue.shift();
            if (depth > maxDepth) {
              continue;
            }
            let entries;
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              continue;
            }
            for (const entry of entries) {
              if (entry.name.startsWith(".")) {
                continue;
              }
              const fullPath = path.join(dir, entry.name);
              try {
                const entryStat = fs.statSync(fullPath);
                items.push({
                  name: entry.name,
                  path: fullPath,
                  isDirectory: entry.isDirectory(),
                  size: entryStat.size,
                  mtime: entryStat.mtimeMs,
                  mime: entry.isDirectory()
                    ? null
                    : clawFsMimeFromExt(path.extname(entry.name)),
                });
                if (entry.isDirectory()) {
                  queue.push({ dir: fullPath, depth: depth + 1 });
                }
              } catch {
                // skip invalid entries
              }
            }
          }
          return clawFsJsonResponse({ path: result.resolved, items });
        }

        case "read": {
          if (request.method !== "GET") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const readPath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(readPath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          const readStat = fs.statSync(result.resolved);
          if (readStat.isDirectory()) {
            return clawFsErrorResponse(400, "is a directory");
          }
          if (readStat.size > maxReadBytes) {
            return clawFsErrorResponse(413, "file too large");
          }
          const mime = clawFsMimeFromExt(path.extname(result.resolved));
          const data = fs.readFileSync(result.resolved);
          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": mime,
              "Content-Length": String(data.length),
            },
          });
        }

        case "stat": {
          if (request.method !== "GET") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const statPath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(statPath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          const stat = fs.statSync(result.resolved);
          return clawFsJsonResponse({
            path: result.resolved,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            size: stat.size,
            mtime: stat.mtimeMs,
            mime: stat.isDirectory()
              ? null
              : clawFsMimeFromExt(path.extname(result.resolved)),
          });
        }

        case "upload": {
          if (request.method !== "POST") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const uploadDir = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(uploadDir, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }

          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data")) {
            return clawFsErrorResponse(400, "expected multipart/form-data");
          }

          const formData = await request.formData();
          const uploaded = [];
          for (const [key, value] of formData.entries()) {
            if (typeof value === "object" && value.arrayBuffer) {
              const fileName = value.name || key;
              const safeName = path.basename(fileName);
              const dest = path.join(result.resolved, safeName);
              if (!clawFsIsPathUnderRoots(dest, config.roots)) {
                continue;
              }
              const buffer = Buffer.from(await value.arrayBuffer());
              fs.writeFileSync(dest, buffer);
              uploaded.push({ name: safeName, path: dest, size: buffer.length });
            }
          }
          return clawFsJsonResponse({ uploaded });
        }

        case "mkdir": {
          if (request.method !== "POST") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const mkdirPath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(mkdirPath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          fs.mkdirSync(result.resolved, { recursive: true });
          return clawFsJsonResponse({ created: result.resolved });
        }

        case "delete": {
          if (request.method !== "DELETE" && request.method !== "POST") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const deletePath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(deletePath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          for (const root of config.roots) {
            if (path.resolve(root.path) === result.resolved) {
              return clawFsErrorResponse(403, "cannot delete a root directory");
            }
          }
          const deleteStat = fs.statSync(result.resolved);
          if (deleteStat.isDirectory()) {
            fs.rmSync(result.resolved, { recursive: true, force: true });
          } else {
            fs.unlinkSync(result.resolved);
          }
          return clawFsJsonResponse({ deleted: result.resolved });
        }

        case "rename": {
          if (request.method !== "POST") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const fromPath = url.searchParams.get("from") || "";
          const toPath = url.searchParams.get("to") || "";
          const resultFrom = clawFsResolveAndValidate(fromPath, config.roots);
          if (resultFrom.error) {
            return clawFsErrorResponse(resultFrom.status, resultFrom.error);
          }
          const resultTo = clawFsResolveAndValidate(toPath, config.roots);
          if (resultTo.error) {
            return clawFsErrorResponse(resultTo.status, resultTo.error);
          }
          fs.renameSync(resultFrom.resolved, resultTo.resolved);
          return clawFsJsonResponse({
            from: resultFrom.resolved,
            to: resultTo.resolved,
          });
        }

        case "write": {
          if (request.method !== "POST") {
            return clawFsErrorResponse(405, "method not allowed");
          }
          const writePath = url.searchParams.get("path") || "";
          const result = clawFsResolveAndValidate(writePath, config.roots);
          if (result.error) {
            return clawFsErrorResponse(result.status, result.error);
          }
          const bodyBuffer = Buffer.from(await request.arrayBuffer());
          fs.writeFileSync(result.resolved, bodyBuffer);
          const writeStat = fs.statSync(result.resolved);
          return clawFsJsonResponse({
            written: result.resolved,
            size: writeStat.size,
          });
        }

        default:
          return clawFsErrorResponse(404, `unknown fs route: ${route}`);
      }
    } catch (err) {
      const code = err?.code;
      if (code === "ENOENT") {
        return clawFsErrorResponse(404, "not found");
      }
      if (code === "EACCES" || code === "EPERM") {
        return clawFsErrorResponse(403, "permission denied");
      }
      return clawFsErrorResponse(500, String(err));
    }
  };
}

module.exports = {
  createClawFsProtocolHandler,
};
