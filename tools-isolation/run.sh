#!/usr/bin/env bash
# 每个 agent 一个独立 venv → 工具/包依赖隔离（本机方案验证）
# 用法：bash run.sh [隔离根目录]   默认 ~/aispace-agents-iso
set -e
ROOT="${1:-$HOME/aispace-agents-iso}"
echo "隔离根目录: $ROOT"
echo

# 三个 agent，工具依赖各不相同；前两个故意都用 jinja2 但版本冲突
AGENTS=(
  "excel-报表|jinja2==3.0.3 markdown"
  "web-摘要|jinja2==3.1.4 requests"
  "ascii-banner|pyfiglet==1.0.2"
)

for entry in "${AGENTS[@]}"; do
  name="${entry%%|*}"; deps="${entry#*|}"
  dir="$ROOT/$name"
  echo "== 准备 [$name]  依赖: $deps =="
  mkdir -p "$dir"
  python3 -m venv "$dir/.venv"
  "$dir/.venv/bin/pip" -q install --upgrade pip >/dev/null 2>&1 || true
  "$dir/.venv/bin/pip" -q install $deps
  printf '%s\n' $deps > "$dir/requirements.txt"
done

echo
echo "===== 隔离验证：各 agent venv 内的实际版本 ====="
for entry in "${AGENTS[@]}"; do
  name="${entry%%|*}"
  py="$ROOT/$name/.venv/bin/python"
  printf "%-14s " "$name"
  "$py" - <<'PY'
import importlib.metadata as m
out=[]
for pkg in ["jinja2","markdown","requests","pyfiglet"]:
    try: out.append(f"{pkg}={m.version(pkg)}")
    except Exception: pass
print("  ".join(out))
PY
done

echo
echo "结论：excel-报表 与 web-摘要 同装 jinja2 但版本不同(3.0.3 vs 3.1.4)，互不影响 → 依赖隔离成立。"
echo "每个 agent 的依赖在各自 $ROOT/<agent>/.venv，互相独立。"
