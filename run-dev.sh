#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PID=""
FRONTEND_PID=""
OLLAMA_PID=""
BACKEND_ARGS=("app:app")

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${OLLAMA_PID}" ]] && kill -0 "${OLLAMA_PID}" 2>/dev/null; then
    kill "${OLLAMA_PID}" 2>/dev/null || true
  fi

  # Bring the background backend service back up now that dev mode is done
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.aryanjain.personal-api.plist" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run: cd \"$FRONTEND_DIR\" && npm install"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found."
  exit 1
fi

# Find an interpreter that actually has the backend deps. Plain `python3` may
# resolve to a different install than the one they were installed into (e.g.
# conda/miniforge shadowing pyenv on PATH), so probe candidates in order and
# prefer the interpreter the launchd service uses.
PYTHON_BIN=""
for candidate in \
  "$HOME/.pyenv/versions/3.12.10/bin/python3.12" \
  "$(command -v python3 || true)" \
  "$(command -v python3.12 || true)"
do
  if [[ -n "$candidate" ]] && "$candidate" -c "import fastapi, uvicorn, multipart" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "Backend dependencies are missing from every Python found."
  echo "Install them with: cd \"$BACKEND_DIR\" && pip3 install -r requirements.txt"
  echo "Interpreters checked:"
  echo "  $HOME/.pyenv/versions/3.12.10/bin/python3.12"
  echo "  $(command -v python3 || echo 'python3 not on PATH')"
  exit 1
fi

# Stop the background launchd backend service first — it has KeepAlive set,
# so just killing the port would race it and it'd reclaim 8000 instantly.
launchctl bootout "gui/$(id -u)/com.aryanjain.personal-api" 2>/dev/null || true

# Kill anything still holding the ports
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true

if command -v ollama >/dev/null 2>&1; then
  if ! curl -sf http://localhost:11434 >/dev/null 2>&1; then
    ollama serve >/dev/null 2>&1 &
    OLLAMA_PID=$!
    echo "Starting Ollama..."
    sleep 2
  fi
fi

if [[ "${1:-}" != "--no-reload-backend" ]]; then
  BACKEND_ARGS+=("--reload")
fi

echo ""
echo "Starting backend on http://127.0.0.1:8000 (using $PYTHON_BIN)"
(cd "$BACKEND_DIR" && "$PYTHON_BIN" -m uvicorn "${BACKEND_ARGS[@]}") &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:5173"
(cd "$FRONTEND_DIR" && npm run dev -- --host 127.0.0.1) &
FRONTEND_PID=$!

echo ""
echo "Personal is starting up."
echo "Frontend: http://127.0.0.1:5173"
echo "Backend:  http://127.0.0.1:8000"
if [[ "${1:-}" != "--no-reload-backend" ]]; then
  echo "Backend reload: enabled"
else
  echo "Backend reload: off"
fi
echo "Press Ctrl+C to stop both."
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
