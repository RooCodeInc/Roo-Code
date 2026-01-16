#!/bin/bash
set -e

PORT=${PORT:-8443}

# Install code-server if missing
if ! command -v code-server &> /dev/null; then
  echo "Installing code-server..."
  curl -fsSL https://code-server.dev/install.sh | sh
fi

# Set up extension symlink for live development
EXT_DIR="$HOME/.local/share/code-server/extensions"
mkdir -p "$EXT_DIR"
ln -sfn "$(pwd)/src" "$EXT_DIR/roo-cline"

echo "=============================================="
echo "Setting up environment variables for watchers"
echo "=============================================="

# Enable polling for file watchers (helps with symlinks and various environments)
# Chokidar (used by Vite and now esbuild)
export CHOKIDAR_USEPOLLING=true
export CHOKIDAR_INTERVAL=1000
echo "CHOKIDAR_USEPOLLING=$CHOKIDAR_USEPOLLING"
echo "CHOKIDAR_INTERVAL=$CHOKIDAR_INTERVAL"

# Watchpack (used by webpack)
export WATCHPACK_POLLING=true

# TypeScript watch mode - use polling instead of fs events
export TSC_WATCHFILE=UseFsEventsWithFallbackDynamicPolling
export TSC_WATCHDIRECTORY=UseFsEventsWithFallbackDynamicPolling

# Disable atomic writes so file watchers detect changes properly
export DISABLE_ATOMICWRITES=true

# Set development environment (from .vscode/launch.json)
export NODE_ENV=development
export VSCODE_DEBUG_MODE=true

# Trap to clean up all background processes on exit
cleanup() {
  echo "Stopping all processes..."
  jobs -p | xargs -r kill 2>/dev/null
}
trap cleanup EXIT INT TERM

# Build all workspace packages first
echo ""
echo "=============================================="
echo "Building workspace packages..."
echo "=============================================="
pnpm build

# Start code-server in background FIRST
echo ""
echo "=============================================="
echo "Starting code-server on port $PORT"
echo "Extension files are at: $(pwd)/src"
echo "Symlinked to: $EXT_DIR/roo-cline"
echo "=============================================="
code-server --auth none --bind-addr 0.0.0.0:${PORT} . &
CODE_SERVER_PID=$!

# Give code-server a moment to start
sleep 2

# Start watchers with explicit env vars using env command
echo ""
echo "=============================================="
echo "Starting file watchers..."
echo "=============================================="

# Run webview watcher (custom chokidar-based script)
env CHOKIDAR_USEPOLLING=true CHOKIDAR_INTERVAL=1000 pnpm --filter @roo-code/vscode-webview dev:watch &

# Run bundle watcher (custom chokidar-based script)
env CHOKIDAR_USEPOLLING=true CHOKIDAR_INTERVAL=1000 pnpm --filter roo-cline watch:bundle &

# Run tsc watcher
env TSC_WATCHFILE=UseFsEventsWithFallbackDynamicPolling pnpm --filter roo-cline watch:tsc &

echo ""
echo "=============================================="
echo "All processes started!"
echo "code-server running at http://localhost:${PORT}"
echo "Watchers are running - file changes should trigger rebuilds"
echo "Press Ctrl+C to stop all processes"
echo "=============================================="
echo ""

# Wait for all background processes
wait
