# 通用助手（General Agent）初版

让 **Claude Code** 当平台通用 agent：用订阅登录（无需 API key），通过 **aispace MCP 工具**真正操作平台。

## 组成
- `CLAUDE.md` — 通用 agent 的系统提示（角色 + 工具用法 + 约束）
- `../../backend/mcp_server.py` — 平台工具（MCP 服务），调后端 API
- `mcp.json` — MCP 接入配置（复制为 `.mcp.json` 用）

## 跑起来
1. 后端在跑：`cd backend && uvicorn main:app --port 8000`
2. 装依赖：`pip install mcp httpx`
3. 准备工作目录（本目录即可）：
   - 把 `mcp.json` 复制为 `.mcp.json`，把 `args` 改成 `mcp_server.py` 的**绝对路径**；
   - 或：`claude mcp add aispace -- python3 /绝对路径/backend/mcp_server.py`
4. 在本目录运行 `claude`（首次会让你批准 aispace MCP）。然后直接对话：
   - “列出我的项目空间” → 调 `list_workspaces`
   - “在 w1 里创建一个客服 agent，负责一线答疑” → 调 `create_agent`
   - “有哪些已发布的 agent” → 调 `list_published`
   - “把 a1 发布到本机” → 调 `publish_agent`

## 它怎么工作
通用 agent = Claude Code + 一组平台工具。Claude 理解你的话 → 选择并调用工具（先 `list_*` 查、再行动）→ 用工具返回结果回答。写操作前会先确认。

## 与平台 Chat 的关系
平台里的「Chat · 通用助手」当前是轻量意图映射（demo）。**生产版**就把它接到这套 MCP 工具上：同一组工具，既能在终端用 `claude` 调，也能由平台后端驱动。这就是"通用 agent 能执行平台所有操作"的正式实现路径（架构里的阶段三）。

## 扩展
往 `mcp_server.py` 加一个 `@mcp.tool()` 就多一个能力（如 edit_agent、delete_agent、成员管理）。工具的 docstring 就是给模型看的说明。
