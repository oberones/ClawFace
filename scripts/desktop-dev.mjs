#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`ClawFace desktop dev runner

Starts the Vite dev server, waits for it to come up, then launches Electron pointed at it.

Options:
  --port <number>   Dev server port (default: 5178)
  --host <value>    Dev server host (default: 127.0.0.1)
  --help, -h        Show this help
`);
  process.exit(0);
}

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

const host = readOption("--host", process.env.CLAWFACE_DEV_HOST || "127.0.0.1");
const port = readOption("--port", process.env.CLAWFACE_DEV_PORT || "5178");
const devServerUrl = `http://${host}:${port}`;
const electronBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

function killChild(child, signal = "SIGTERM") {
  if (!child || child.killed) {
    return;
  }
  try {
    child.kill(signal);
  } catch {
    // ignore shutdown races
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  killChild(electronProcess);
  killChild(viteProcess);
  setTimeout(() => {
    killChild(electronProcess, "SIGKILL");
    killChild(viteProcess, "SIGKILL");
  }, 1500).unref();
  process.exit(code);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastError = "server-not-ready";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 404) {
        return;
      }
      lastError = `http-${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch-failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  shutdown(1);
});

viteProcess = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "--", "--host", host, "--port", port, "--strictPort"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
    },
  },
);

viteProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  if (!electronProcess) {
    console.error(`Vite exited before Electron started (${signal ?? code ?? "unknown"}).`);
    shutdown(typeof code === "number" ? code : 1);
    return;
  }
  console.error(`Vite exited while Electron was still running (${signal ?? code ?? "unknown"}).`);
  shutdown(typeof code === "number" ? code : 1);
});

console.log(`Waiting for Vite dev server at ${devServerUrl} ...`);
await waitForServer(devServerUrl);
console.log(`Launching Electron against ${devServerUrl}`);

electronProcess = spawn(electronBin, ["."], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    CLAWFACE_DEV_SERVER_URL: devServerUrl,
    CLAWUI_IMAGE_PROXY_PORT: port,
  },
});

electronProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  if (signal) {
    console.error(`Electron exited via ${signal}.`);
    shutdown(1);
    return;
  }
  shutdown(typeof code === "number" ? code : 0);
});
