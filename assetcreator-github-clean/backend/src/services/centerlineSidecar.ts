/**
 * Centerline Vectorizer Sidecar Launcher
 *
 * Spawns the vendored Python raster-dxf-centerline service as a child process
 * when CENTERLINE_VECTORIZER_URL is configured to point at localhost.
 * This runs inside the Bun process so it works regardless of which startup
 * script is used (scripts/start, dev-with-centerline.sh, etc.).
 */

import { spawn, type Subprocess } from "bun";
import { existsSync } from "fs";
import { resolve } from "path";

const VECTORIZER_DIR = resolve(import.meta.dir, "../../vendor/raster-dxf-centerline");
const MAIN_PY = resolve(VECTORIZER_DIR, "app/main.py");
const DEFAULT_PORT = 8001;
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_INTERVAL_MS = 1_000;

let sidecarProcess: Subprocess | null = null;

function shouldAutoStart(): boolean {
  const url = process.env.CENTERLINE_VECTORIZER_URL ?? "";
  // Only auto-start if URL points to localhost on the expected port
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) return false;
  if (!existsSync(MAIN_PY)) {
    console.warn("[centerline-sidecar] MAIN_PY not found at", MAIN_PY);
    return false;
  }
  return true;
}

function parsePort(): number {
  const url = process.env.CENTERLINE_VECTORIZER_URL ?? "";
  try {
    return new URL(url).port ? Number(new URL(url).port) : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

async function waitForHealth(port: number): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const url = `http://127.0.0.1:${port}/health`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await Bun.sleep(HEALTH_INTERVAL_MS);
  }
  return false;
}

export async function startCenterlineSidecar(): Promise<void> {
  if (!shouldAutoStart()) return;

  const port = parsePort();

  // Check if something is already listening on that port
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    if (res.ok) {
      console.log(`[centerline-sidecar] Already running on port ${port}`);
      return;
    }
  } catch {
    // Nothing listening — proceed to start
  }

  // Resolve Python: prefer venv with uvicorn, fall back to system python3
  const venvPython = resolve(VECTORIZER_DIR, ".venv/bin/python");
  const venvUvicorn = resolve(VECTORIZER_DIR, ".venv/bin/uvicorn");
  const python = (existsSync(venvPython) && existsSync(venvUvicorn)) ? venvPython : "python3";

  console.log(`[centerline-sidecar] Starting on port ${port} with ${python}`);

  sidecarProcess = spawn({
    cmd: [python, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    cwd: VECTORIZER_DIR,
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
    stdout: "inherit",
    stderr: "inherit",
  });

  const healthy = await waitForHealth(port);
  if (healthy) {
    console.log(`[centerline-sidecar] Healthy (PID=${sidecarProcess.pid})`);
  } else {
    console.error(`[centerline-sidecar] Health check failed after ${HEALTH_TIMEOUT_MS / 1000}s`);
  }
}

// Clean shutdown
process.on("exit", () => {
  if (sidecarProcess) {
    try { sidecarProcess.kill(); } catch {}
  }
});
process.on("SIGTERM", () => {
  if (sidecarProcess) {
    try { sidecarProcess.kill(); } catch {}
  }
  process.exit(0);
});

