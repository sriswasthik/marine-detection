#!/usr/bin/env bash
# Runs the API from the repository root: ./backend/run.sh [extra uvicorn options]
# Settings come from the environment, for example:
#   CORS_ORIGINS=http://localhost:5173 DEMO_MIN_STAGE_SECONDS=1.5 ./backend/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec python -m uvicorn backend.app.main:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}" "$@"
