#!/usr/bin/env bash
# 一键启动 AISpace（后端 FastAPI + 前端 Vite）。
# 用法：从一个【已加载 ~/.zshrc 的交互终端】里跑  ./start.sh
#   - 后端 → http://localhost:8000   （API 文档 /docs，健康 /api/health）
#   - 前端 → http://localhost:5173
# Ctrl-C 同时停掉两端。

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 前提 1：Claude Code 鉴权 key ───────────────────────────────
# 本机实测：后端以 headless（claude -p, stdin=DEVNULL）跑 agent，读不到 keychain
# 订阅登录，必须有有效的 ANTHROPIC_API_KEY（在 ~/.zshrc 里 export）。
# 没有它，agent 会报「⚠️ 运行环境的 Claude Code 未登录」。详见 技术文档/运维排障.md。
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "❌ ANTHROPIC_API_KEY 未设置。请从加载了 ~/.zshrc 的终端启动，"
  echo "   否则所有 Claude Code agent 都会报「未登录」。"
  echo "   （确认：echo \${ANTHROPIC_API_KEY:0:8}）"
  exit 1
fi
echo "✅ ANTHROPIC_API_KEY 已就绪（${ANTHROPIC_API_KEY:0:8}…）"

# ── 前提 2：后端 venv ─────────────────────────────────────────
if [ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  echo "⚙️  后端 venv 缺失，正在创建并安装依赖…"
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

# ── 前提 3：前端依赖 ──────────────────────────────────────────
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "⚙️  前端 node_modules 缺失，正在 npm i…"
  (cd "$ROOT/frontend" && npm i)
fi

# ── 启动 ─────────────────────────────────────────────────────
pids=()
cleanup() { echo; echo "🛑 停止…"; for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "🚀 后端  http://localhost:8000   （/docs, /api/health）"
( cd "$ROOT/backend" && exec .venv/bin/uvicorn main:app --port 8000 ) &
pids+=($!)

echo "🚀 前端  http://localhost:5173"
( cd "$ROOT/frontend" && exec npm run dev ) &
pids+=($!)

echo "—— 两端已启动，Ctrl-C 一并退出 ——"
wait
