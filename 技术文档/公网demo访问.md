# 公网 demo 访问（本机隧道）操作手册

让信任的人远程访问**本机真实平台**（真 claude / openclaw，非 mock）的开关操作。
原理与决策见记忆 `public-demo-exposure`；核心：杭州 ECS 访问 Anthropic 受限只能 mock，故改为「暴露本机 + cloudflared 隧道 + Basic Auth 密码」。

> ⚠️ 改动只在 `frontend/vite.config.ts`：`DEMO_AUTH="用户名:密码"` 控制的 Basic Auth 插件 + `allowedHosts`。**不设 `DEMO_AUTH` 时完全不影响本地开发。**

---

## 一、三条安全底线（先看）

1. **只发信任的人** —— 本机无沙箱，访客让 agent 跑的命令是在你电脑、你的权限下执行。
2. **限时开放** —— 演示完按下面「关闭」操作关掉，别 7×24 挂着。
3. **笔记本保持开机联网** —— 合盖/断网公网即不可达；访客对话消耗你的 claude 订阅额度。

---

## 二、前置（只需确认一次）

| 依赖 | 检查命令 | 期望 |
|---|---|---|
| 后端 FastAPI | `lsof -iTCP:8000 -sTCP:LISTEN -P` | 8000 在听（没在跑见下「启动后端」） |
| claude 已登录 | `curl -s localhost:8000/api/health` | `"claude_code":true` |
| cloudflared | `which cloudflared` | 有路径（没有：`brew install cloudflared`） |

启动后端（若没在跑）：
```bash
cd backend && CLAUDE_BIN=$(which claude) uvicorn main:app --port 8000   # 勿加 --reload
```

---

## 三、开启公网访问

```bash
cd frontend

# 1) 设一组密码（用户名:密码，自己改），带鉴权启动前端（5173 代理 /api→后端 8000）
DEMO_AUTH="demo:换成你的密码" npm run dev &

# 2) 起隧道，拿公网网址
cloudflared tunnel --url http://localhost:5173
```

- 第 2 条命令会打印形如 `https://xxx-xxx-xxx.trycloudflare.com` 的**临时网址**（每次重启都会变）。
- 把【网址 + 用户名 + 密码】发给信任的人即可。无密码访问会被挡（401）。

> 想让隧道也转后台、把网址抓出来：
> ```bash
> cloudflared tunnel --url http://localhost:5173 > /tmp/aispace_tunnel.log 2>&1 &
> sleep 6; grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/aispace_tunnel.log | head -1
> ```

---

## 四、验证（可选）

```bash
URL="上一步拿到的网址"; CRED="demo:换成你的密码"
curl -s -o /dev/null -w "no-auth=%{http_code}\n" "$URL/"            # 期望 401
curl -s -o /dev/null -w "auth=%{http_code}\n" -u "$CRED" "$URL/"    # 期望 200
curl -s -u "$CRED" "$URL/api/health"                               # 期望 claude_code:true
```

---

## 五、关闭公网访问（演示完做）

```bash
# 关隧道：公网立刻失效（最关键，至少做这一步）
pkill -f "cloudflared tunnel"

# 关带鉴权的前端（可选；想恢复普通本地开发就关掉再不带 DEMO_AUTH 重启）
lsof -ti:5173 | xargs kill
```

恢复平时本地开发（无鉴权）：
```bash
cd frontend && npm run dev
```

---

## 六、排障

| 现象 | 处理 |
|---|---|
| 访客打开提示 `Blocked request / host not allowed` | `vite.config.ts` 的 `allowedHosts: true` 没生效——确认改动在、重启前端 |
| 对话回的是假数据（mock） | `curl localhost:8000/api/health` 看 `claude_code` 是否 true；为 false 则后端找不到 claude，用 `CLAUDE_BIN=$(which claude)` 重启后端 |
| 网址打不开 | 笔记本是否睡眠/断网；`pgrep -f "cloudflared tunnel"` 看隧道是否还在 |
| 想要**固定 IP** | 走 frp 经 ECS 中转方案（ECS 只当 TCP relay 不跑 agent，不撞 Anthropic 限制）——需要时再搭 |

---

## 七、当前这次的访问信息（会随重启失效）

| | |
|---|---|
| 网址 | `https://correctly-composer-cabinets-software.trycloudflare.com` |
| 用户名 | `demo` |
| 密码 | `aispace-731e03` |
