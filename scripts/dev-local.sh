#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "Starting Gravu locally"
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:8000"
echo

(cd "${ROOT_DIR}/backend" && bun run dev) &
BACKEND_PID=$!

(cd "${ROOT_DIR}/webapp" && bun run dev) &
FRONTEND_PID=$!

while kill -0 "${BACKEND_PID}" 2>/dev/null && kill -0 "${FRONTEND_PID}" 2>/dev/null; do
  sleep 1
done

cleanup
