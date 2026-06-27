# 后端（demo）

FastAPI + SQLite，本地优先。Agent 试跑走 Claude Code 无头模式；未配好时自动回退 mock。

## 前置（本机，macOS）

1. Python 3.10+：`python3 --version`
2. Node 18+：`node -v`（`brew install node`）
3. Claude Code：`npm i -g @anthropic-ai/claude-code`，`claude --version`
4. 鉴权（二选一）：
   - **订阅登录（推荐）**：跑过 `claude` 登录即可，后端调 `claude -p` 自动用登录态，**无需配 key**。⚠ 此时别设 `ANTHROPIC_API_KEY`，否则会改走 API 计费。
   - API key：设 `ANTHROPIC_API_KEY`（按 token 付费）。
5. 验证：在将运行 uvicorn 的同一终端执行 `claude -p "你好"`，能直接回话即可；启动后 `/api/health` 的 `claude_code` 应为 true。

> 第 2–4 步没配也能跑——`/chat` 会回退 mock，先把链路跑通。

## 运行

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 填 ANTHROPIC_API_KEY（可选）
uvicorn main:app --reload --port 8000
```

- 接口文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health （看 `claude_code` 是否 true）
- 数据库：首次启动自动建 `aispace.db` 并灌入种子数据

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/workspaces | 空间 + 成员列表 |
| POST | /api/workspaces | 新建空间 |
| PUT | /api/workspaces/{ws}/members/{uid} | 增改成员 |
| DELETE | /api/workspaces/{ws}/members/{uid} | 移除成员（至少留一名 Owner）|
| GET | /api/agents?ws=w1 | 列出空间内 Agent（不含软删）|
| POST | /api/agents | 创建 Agent（生成 v1）|
| GET | /api/agents/{id} | 详情（含版本快照）|
| PUT | /api/agents/{id} | 编辑（生成新版本）|
| DELETE | /api/agents/{id} | 软删除 |
| POST | /api/agents/{id}/chat | 试跑/调试（body 传 config 则用未保存配置）|

## 与前端对接（下一步）

前端 `demo/` 当前是纯 mock。接后端时把 mock 数据源替换为 `fetch('http://localhost:8000/api/...')`，数据结构已对齐（agent 字段、versions、members 等）。

## 说明 / 局限

- 试跑目前是把配置拼进 prompt 调 `claude -p` 的简化做法（demo 级）；生产应改用 Claude Agent SDK 并正确注入 system prompt、工具、记忆。
- SQLite 仅适合本地/单实例；上 FC 换 Tablestore（见 `../技术文档/架构设计.md`）。
