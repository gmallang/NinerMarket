#!/bin/bash

echo "======================================="
echo "  NinerMarket - Starting Dev Servers"
echo "======================================="
echo ""

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/Backend/venv"

# ---- Setup venv ----
echo "[1/3] Checking Python virtual environment..."
if [ ! -f "$VENV/bin/activate" ]; then
  echo "      Creating venv..."
  python3 -m venv "$VENV"
fi

echo "[2/3] Installing backend dependencies..."
source "$VENV/bin/activate"
pip install -r "$DIR/Backend/requirements.txt" --quiet

echo "[3/3] Launching servers..."
echo ""

BACKEND_CMD="source '$VENV/bin/activate' && cd '$DIR/Backend' && uvicorn main:app --reload"
FRONTEND_CMD="cd '$DIR/frontend' && npm run dev"

if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e "tell application \"Terminal\" to do script \"echo '=== Backend ===' && $BACKEND_CMD\""
  sleep 1
  osascript -e "tell application \"Terminal\" to do script \"echo '=== Frontend ===' && $FRONTEND_CMD\""
elif command -v gnome-terminal &>/dev/null; then
  gnome-terminal --title="NinerMarket - Backend" -- bash -c "$BACKEND_CMD; exec bash"
  gnome-terminal --title="NinerMarket - Frontend" -- bash -c "$FRONTEND_CMD; exec bash"
elif command -v xterm &>/dev/null; then
  xterm -title "NinerMarket - Backend" -e "bash -c '$BACKEND_CMD; exec bash'" &
  xterm -title "NinerMarket - Frontend" -e "bash -c '$FRONTEND_CMD; exec bash'" &
else
  # Headless fallback
  echo "No GUI terminal found — running in background (logs: backend.log, frontend.log)"
  bash -c "$BACKEND_CMD" > "$DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  bash -c "$FRONTEND_CMD" > "$DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "Backend PID:  $BACKEND_PID"
  echo "Frontend PID: $FRONTEND_PID"
  echo "Press Ctrl+C to stop both."
  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT
  wait
fi

echo ""
echo "Servers starting:"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
