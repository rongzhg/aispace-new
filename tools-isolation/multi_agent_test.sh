#!/usr/bin/env bash
# 单 sandbox（≈本机）跑多个 agent 的验证：依赖隔离 / 并发运行 / 故障隔离
# 用法：bash multi_agent_test.sh [根目录]   默认 ~/aispace-agents-iso
set -u
ROOT="${1:-$HOME/aispace-agents-iso}"
AGENTS=(
  "excel-报表|jinja2==3.0.3 markdown"
  "web-摘要|jinja2==3.1.4 requests"
  "ascii-banner|pyfiglet==1.0.2"
)
echo "根目录: $ROOT"; echo

echo "== 准备各 agent 独立 venv =="
for entry in "${AGENTS[@]}"; do
  name="${entry%%|*}"; deps="${entry#*|}"; dir="$ROOT/$name"
  mkdir -p "$dir"
  [ -x "$dir/.venv/bin/python" ] || python3 -m venv "$dir/.venv"
  "$dir/.venv/bin/pip" -q install $deps
done

echo; echo "===== TC1 依赖隔离（各 venv 内版本应互不影响）====="
for entry in "${AGENTS[@]}"; do
  name="${entry%%|*}"; py="$ROOT/$name/.venv/bin/python"
  printf "%-14s " "$name"
  "$py" - <<'PY'
import importlib.metadata as m
out=[]
for p in ["jinja2","markdown","requests","pyfiglet"]:
    try: out.append(f"{p}={m.version(p)}")
    except Exception: pass
print("  ".join(out))
PY
done

echo; echo "===== TC2 并发运行（3 个 agent 同时各跑自己的依赖，互不干扰）====="
pids=""
"$ROOT/excel-报表/.venv/bin/python" -c 'from jinja2 import Template;print("[excel-报表] 渲染:",Template("Hi {{n}}").render(n="Excel"))' & pids="$pids $!"
"$ROOT/web-摘要/.venv/bin/python" -c 'import requests;print("[web-摘要] requests",requests.__version__,"就绪")' & pids="$pids $!"
"$ROOT/ascii-banner/.venv/bin/python" -c 'import pyfiglet;print("[ascii-banner] banner:",repr(pyfiglet.figlet_format("Hi").splitlines()[0]))' & pids="$pids $!"
ok=0; for p in $pids; do wait $p && ok=$((ok+1)); done
echo "并发完成，成功 $ok/3"

echo; echo "===== TC3 故障隔离（一个 agent 崩溃，不影响其他）====="
"$ROOT/web-摘要/.venv/bin/python" -c 'raise RuntimeError("模拟 web-摘要 崩溃")' 2>/dev/null; echo "web-摘要 退出码: $? (非0=已崩)"
"$ROOT/excel-报表/.venv/bin/python" -c 'from jinja2 import Template;print("excel-报表 仍正常:",Template("{{x}}").render(x="OK"))'; echo "excel-报表 退出码: $?"
"$ROOT/ascii-banner/.venv/bin/python" -c 'import pyfiglet;print("ascii-banner 仍正常: OK")'; echo "ascii-banner 退出码: $?"
