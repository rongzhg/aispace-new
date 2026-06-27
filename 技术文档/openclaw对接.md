# OpenClaw 真实对接（已落地并端到端验证）

> 状态：✅ 已接通真实 OpenClaw（`engine: openclaw`，非 mock）。实测版本 OpenClaw `2026.6.10`。
> 平台侧改动集中在 `backend/openclaw_gateway.py`；`main.py` 编排不变。

## 模型回顾
- **平台侧**：`main.py` `_start_service` 按 framework 分派；OpenClaw 走 `backend/openclaw_gateway.py`（一个共享 Gateway 托多 agent，按 agentId 路由）。这层是平台 HTTP 契约（`/chat`、`/chat/stream`、`/agents` 热绑定）与 OpenClaw CLI 之间的适配层，**不动平台主流程**。
- **OpenClaw 侧**：OpenClaw 自带常驻 Gateway 守护进程（macOS LaunchAgent `ai.openclaw.gateway`，`ws://127.0.0.1:18789`）。平台不自起 OpenClaw 守护进程，只通过 CLI 把 agent 注册进它、把每轮对话路由给它（CLI 在 Gateway 不可用时自动回退 embedded 执行）。

## 真实接口（实测）
| 用途 | 命令 |
|---|---|
| 安装 | `npm i -g openclaw` |
| 注册 agent | `openclaw agents add <ocid> --workspace <dir> --non-interactive --json` |
| 列出 agent | `openclaw agents list --json` |
| 删除 agent | `openclaw agents delete <ocid> --force --json` |
| 跑一轮（按 id 路由） | `openclaw agent --agent <ocid> -m <msg> --json [--session-id <sid>]` |
| 健康 | `openclaw health` |

**对话返回 JSON 结构**（`openclaw agent --json`）：
- 回复文本：`payloads[0].text`（兜底 `meta.finalAssistantVisibleText`）
- 会话 id：`meta.agentMeta.sessionId`（下一轮 `--session-id` 带回即续接）
- 执行轨迹：`meta.executionTrace.{winnerProvider,winnerModel,attempts[].result}`

## 人设映射（平台配置 → OpenClaw workspace）
OpenClaw agent 的 workspace 用约定文件承载人设：`SOUL.md`(人设) / `AGENTS.md`(行为，含 OpenClaw 默认运维段) / `USER.md`(用户上下文) / `IDENTITY.md` 等。平台映射：

| 平台文件（Spec B） | → OpenClaw workspace 文件 |
|---|---|
| `role.md` + `agent.md` | `SOUL.md`（每次发布覆盖，幂等） |
| `user.md` | `USER.md` |

> 不整体覆盖 `AGENTS.md`（保留 OpenClaw 默认运维指令）；人设通过 `SOUL.md` 注入即生效——实测改 `SOUL.md` 后新会话立刻按新人设回应。

## 平台 agent id ↔ OpenClaw agent id
- 映射：`_oc_id(agent_id)` = `as-<sanitized agent_id>`（如平台 `a2` → openclaw `as-a2`）。前缀 `as-` 避免撞上 OpenClaw 保留的默认 agent `main`。

## 模型 / 鉴权
- OpenClaw 用其自身配置的 **provider auth-profile**（实测经 anthropic auth-profile 出网，**无需在平台设 API key**；与 Claude Code CLI 的登录态相互独立）。
- **模型是分层的，不是 gateway 启动时锁死一个**：
  - **全局默认**：`agents.defaults.model.primary`（gateway 兜底默认）。
  - **每 agent 可不同**：`openclaw agents add <id> --model <openclaw模型id>` 给该 agent 设默认模型，覆盖全局——这就是「不同 agent 不同模型」的能力（已端到端验证：一个 agent 跑 sonnet-4-6、另一个跑 opus-4-7，同一 Gateway 并存）。
  - **白名单**：目标模型须在 `agents.defaults.models` 列表内，否则报 `Model override ... is not allowed`。
- **平台已接通**：`register_openclaw_agent` 用 `_map_model` 把平台 `model` → OpenClaw 模型 id（`claude-*` → `anthropic/claude-*`；含 `/` 的原样；`qwen` 等非 claude → None 用默认），在 `agents add --model` 下发；若该模型不在白名单则**自动回退**到默认模型注册，保证 agent 可用。`service-chat` 返回里带 `model` 字段（实际命中的模型）。
- **启用更高/更新模型**（如 opus-4-8）：把它加进 `agents.defaults.models` 白名单即可，随后平台里 `model=claude-opus-4-8` 的 agent 就会用上它。

### OpenClaw 输出两种形态（解析需兼容）
`openclaw agent --json` 有时直接是 `{payloads, meta}`，有时包一层 `{runId, status, summary, result:{payloads, meta}}`（如带 `--model` 覆盖时）。`oc_invoke` 已兼容：顶层无 `payloads` 且有 `result` 时下钻 `result`。模型取 `meta.executionTrace.winnerModel`。

## 端到端验证（已通过）
两个 OpenClaw agent（数据洞察 Bot / 客服助手）经平台发布 → 注册进同一个 OpenClaw → 经 `POST /api/agents/{id}/service-chat[/stream]`：
- ✅ `engine: openclaw`（真实，非 mock），回复由 anthropic 模型生成
- ✅ 按 agentId 路由到正确人设（📊 数据分析师 vs 🤗 售后客服）
- ✅ 多轮续接（`session_id` 记住上一轮）、SSE 流式
- ✅ 停服从 OpenClaw 删除该 agent，不影响同 Gateway 其他 agent；最后一个停 → 平台 Gateway 停

## 排障
- **`protocol mismatch`（1002）**：OpenClaw 守护进程的服务定义（LaunchAgent plist）由旧版本装的、入口指向旧二进制。修：`openclaw gateway install --force` 重装服务定义；端口被占先 `openclaw gateway stop` / `lsof -ti:18789 | xargs kill`。
- **config invalid / 退役模型**：`openclaw doctor --fix`。
- **macOS 无 `timeout` 命令**：脚本里别用 `timeout`，用 `subprocess` 的 `timeout=` 参数。
