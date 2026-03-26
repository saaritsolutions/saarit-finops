#!/usr/bin/env bash
# Run a .NET service on a fixed port. If port is occupied, kill the blocker and start the service on the same port.
# Usage: ./run-fixed-port.sh <service-dir> <port> [--watch]
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <service-dir> <port> [--watch]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$1"
PORT="$2"
WATCH_FLAG="${3:-}"

# Ensure absolute path
if [[ ! "$SERVICE_DIR" = /* ]]; then
  SERVICE_DIR="$(cd "$SERVICE_DIR" && pwd)"
fi

"${SCRIPT_DIR}/kill-port.sh" "${PORT}"

cd "$SERVICE_DIR"
DOTNET_URLS="http://localhost:${PORT}"
export ASPNETCORE_URLS="$DOTNET_URLS"
## Ensure Development environment so demo feature flags (like EnableExpressions) are on
export ASPNETCORE_ENVIRONMENT="Development"
export DOTNET_ENVIRONMENT="Development"

if [[ "$WATCH_FLAG" == "--watch" ]]; then
  echo "Starting $(basename "$SERVICE_DIR") on $DOTNET_URLS (watch mode)"
  dotnet watch run --no-launch-profile --no-restore --urls "$DOTNET_URLS"
else
  echo "Starting $(basename "$SERVICE_DIR") on $DOTNET_URLS"
  dotnet run --no-launch-profile --no-build --urls "$DOTNET_URLS"
fi
