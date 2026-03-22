#!/usr/bin/env bash
set -euo pipefail

# Resolve backend root directory (this script lives in ./scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

VECTORIZER_DIR="${ROOT_DIR}/vendor/raster-dxf-centerline"

# Default local URL for the Python raster-to-DXF centerline service
export CENTERLINE_VECTORIZER_URL="${CENTERLINE_VECTORIZER_URL:-http://127.0.0.1:8001}"

echo "[start-with-centerline] Using CENTERLINE_VECTORIZER_URL=${CENTERLINE_VECTORIZER_URL}"

if [ ! -d "${VECTORIZER_DIR}" ]; then
  echo "[start-with-centerline] ERROR: Vectorizer directory not found at ${VECTORIZER_DIR}"
  echo "Please copy the raster-dxf-centerline project into backend/vendor/raster-dxf-centerline/"
  exit 1
fi

# Ensure PATH includes user-local pip binaries
export PATH="${HOME}/.local/bin:${PATH}"

# Use venv if available, otherwise fall back to system Python
VECTORIZER_VENV="${VECTORIZER_DIR}/.venv"
if [ -d "${VECTORIZER_VENV}" ] && [ -x "${VECTORIZER_VENV}/bin/python" ]; then
  PYTHON="${VECTORIZER_VENV}/bin/python"
  PIP="${VECTORIZER_VENV}/bin/pip"
else
  if python3 -m venv "${VECTORIZER_VENV}" 2>/dev/null; then
    PYTHON="${VECTORIZER_VENV}/bin/python"
    PIP="${VECTORIZER_VENV}/bin/pip"
  else
    echo "[start-with-centerline] venv unavailable, using system Python with --user packages"
    PYTHON="python3"
    PIP="python3 -m pip"
  fi
fi

# Install requirements if needed
if [ -f "${VECTORIZER_DIR}/requirements.txt" ]; then
  echo "[start-with-centerline] Installing Python dependencies"
  $PIP install --break-system-packages -r "${VECTORIZER_DIR}/requirements.txt" 2>/dev/null \
    || $PIP install -r "${VECTORIZER_DIR}/requirements.txt" 2>/dev/null \
    || echo "[start-with-centerline] WARNING: pip install failed, assuming deps are present"
fi

cd "${VECTORIZER_DIR}"

echo "[start-with-centerline] Starting raster-dxf-centerline via uvicorn on 127.0.0.1:8001"
$PYTHON -m uvicorn app.main:app --host 127.0.0.1 --port 8001 &
VECTORIZER_PID=$!
echo "[start-with-centerline] Vectorizer PID=${VECTORIZER_PID}"

cleanup() {
  echo "[start-with-centerline] Shutting down vectorizer (PID=${VECTORIZER_PID})"
  if kill -0 "${VECTORIZER_PID}" 2>/dev/null; then
    kill "${VECTORIZER_PID}" || true
  fi
}

trap cleanup EXIT INT TERM

# Wait for health check
HEALTH_URL="http://127.0.0.1:8001/health"
echo "[start-with-centerline] Waiting for vectorizer health at ${HEALTH_URL}"

ATTEMPTS=30
SLEEP_SECONDS=1

for ((i=1; i<=ATTEMPTS; i++)); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "[start-with-centerline] Vectorizer is healthy"
    break
  fi
  echo "[start-with-centerline] Health check attempt ${i}/${ATTEMPTS} failed; retrying in ${SLEEP_SECONDS}s..."
  sleep "${SLEEP_SECONDS}"
done

if ! curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[start-with-centerline] ERROR: Vectorizer health check failed after ${ATTEMPTS} attempts"
  exit 1
fi

# Start Bun backend
cd "${ROOT_DIR}"
echo "[start-with-centerline] Starting Bun backend"
exec bun run src/index.ts
