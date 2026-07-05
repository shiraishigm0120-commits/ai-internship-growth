#!/bin/bash
set -e

cd "/Users/maze/Documents/Claude code/ai-internship-growth"

# Rebuild to pick up any code changes
echo "[$(date)] Building..."
npx next build 2>&1 | tail -3

# Start production server
echo "[$(date)] Starting server..."
exec npx next start -p 3000
