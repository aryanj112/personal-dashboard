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
}

trap cleanup EXIT INT TERM

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run: cd \"$FRONTEND_DIR\" && npm install"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found."
  exit 1
fi

if ! python3 -c "import fastapi, uvicorn, multipart" >/dev/null 2>&1; then
  echo "Backend dependencies are missing. Run: cd \"$BACKEND_DIR\" && pip3 install -r requirements.txt"
  exit 1
fi

# Kill anything already holding the ports
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
echo "Starting backend on http://127.0.0.1:8000"
(cd "$BACKEND_DIR" && python3 -m uvicorn "${BACKEND_ARGS[@]}") &
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
