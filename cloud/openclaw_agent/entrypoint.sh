#!/bin/sh
set -e
# 确保有一个默认 agent（state 在镜像内固定目录）
mkdir -p /app/state/ws
openclaw agents add main --workspace /app/state/ws --non-interactive --json >/dev/null 2>&1 || true
exec node /app/server.js
