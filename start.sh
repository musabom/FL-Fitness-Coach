#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting FL Fitness Coach..."

# 1. Start database
echo "→ Starting database..."
docker start fl-fitness-db 2>/dev/null || true
sleep 1

# 2. Start API server
echo "→ Starting API server on port 8080..."
cd "$PROJECT_DIR/artifacts/api-server"
PORT=8080 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fl_fitness NODE_ENV=development ./node_modules/.bin/tsx ./src/index.ts &
API_PID=$!
sleep 2

# 3. Start frontend
echo "→ Starting frontend on port 5173..."
cd "$PROJECT_DIR/artifacts/web"
PORT=5173 BASE_PATH=/ ./node_modules/.bin/vite --host 0.0.0.0 &
WEB_PID=$!

echo ""
echo "✓ App running at http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop everything."

# Stop both servers on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $API_PID $WEB_PID 2>/dev/null; exit 0" INT
wait
