#!/usr/bin/env bash
# 自愈保活：防 Mac 睡眠 + 看门狗（后端 8000 / 前端 5173 / cloudflared 隧道 任一挂掉自动拉起）。
# 启动：nohup ./keepalive.sh > /tmp/aispace-keepalive.log 2>&1 & disown
# 停止：pkill -f keepalive.sh; pkill -f caffeinate; pkill -f "cloudflared tunnel"; pkill -f "uvicorn main:app"; pkill -f "node.*vite"
# 当前公网网址随时看：cat /tmp/aispace-public-url.txt
ROOT="/Users/rongzhang/Claude/Projects/aispace-new"
AUTH_FILE=/tmp/aispace-demo-auth.txt
URL_FILE=/tmp/aispace-public-url.txt
TUN_LOG=/tmp/aispace-tunnel.log
BE_LOG=/tmp/aispace-backend.log
FE_LOG=/tmp/aispace-frontend.log
log(){ echo "[$(date '+%F %T')] $*"; }

# 防睡眠：本看门狗存活期间阻止系统/磁盘/显示睡眠
if ! pgrep -f "caffeinate -dimsu -w $$" >/dev/null 2>&1; then
  caffeinate -dimsu -w $$ &
  log "caffeinate 已启动（阻止睡眠，绑定 pid $$）"
fi

start_backend(){
  pkill -f "uvicorn main:app" 2>/dev/null; sleep 1
  nohup zsh -c "source ~/.zshrc >/dev/null 2>&1; cd $ROOT/backend && exec .venv/bin/uvicorn main:app --port 8000" > "$BE_LOG" 2>&1 &
  log "后端已(重)启动"
}
start_frontend(){
  pkill -f "node.*vite" 2>/dev/null; sleep 1
  nohup zsh -c "cd $ROOT/frontend && DEMO_AUTH=\"$(cat $AUTH_FILE)\" exec npm run dev" > "$FE_LOG" 2>&1 &
  log "前端已(重)启动"
}
start_tunnel(){
  pkill -f "cloudflared tunnel" 2>/dev/null; sleep 1; : > "$TUN_LOG"
  nohup cloudflared tunnel --protocol http2 --url http://localhost:5173 > "$TUN_LOG" 2>&1 &
  for i in $(seq 1 30); do
    U=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$TUN_LOG" | head -1)
    [ -n "$U" ] && { echo "$U" > "$URL_FILE"; log "隧道已(重)启动: $U"; return; }
    sleep 1
  done
  log "隧道启动后 30s 未取到网址，下轮重试"
}

log "看门狗启动，巡检间隔 10s"
while true; do
  curl -s -o /dev/null --max-time 4 http://localhost:8000/api/health || start_backend
  curl -s -o /dev/null --max-time 4 http://localhost:5173            || start_frontend
  pgrep -f "cloudflared tunnel" >/dev/null                           || start_tunnel
  sleep 10
done
