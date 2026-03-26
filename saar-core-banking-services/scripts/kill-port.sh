#!/usr/bin/env bash
# Kills any process listening on the given TCP port (macOS-compatible)
# Usage: ./kill-port.sh 5004
set -euo pipefail

PORT="${1:-}"
if [[ -z "${PORT}" ]]; then
  echo "Usage: $0 <port>" >&2
  exit 1
fi

PIDS=$(lsof -ti tcp:${PORT} || true)
if [[ -n "${PIDS}" ]]; then
  echo "Killing process(es) on port ${PORT}: ${PIDS}"
  # Use SIGKILL as a last resort to ensure port is freed quickly for demos
  kill -9 ${PIDS} || true
  # Give the OS a moment to release the port
  sleep 0.5
else
  echo "No process found on port ${PORT}"
fi

exit 0
