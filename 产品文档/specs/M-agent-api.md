---
name: Agent 调用契约与会话（Managed Agent 标准）
last amended: 2026-06-27
version: 1
description: 对齐业内 Managed Agents（Claude / Qoder / Gemini）的 Agent + Environment + Session 模型——统一会话(服务端有状态)、事件驱动调用、稳定寻址、单一 session_id 语义。这是对外/对内调用的核心契约。
---

# Agent 调用契约与会话 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> **例外说明**：本平台其余 spec 只写 WHAT、不含接口契约（契约见 技术文档/）。**本模块是有意的例外**——调用契约是平台对外/对内的根基约定，**非常重要**，故把规范性的端点面直接固化在 spec 内（见文末「对外契约（规范性）」），完整 schema 仍见 ../../技术文档/接口契约.md。
> 对标参考：[Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/sessions)、[Qoder Cloud Agents](https://qoder.com/en/cloud-agents)。
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 定位

把"调用一个 agent"标准化为业内 Managed Agents 的三资源模型,所有 agent（通用助手 copilot 与用户已发布 agent）走同一套：

```
Agent        版本化配置(模型/prompt/工具/MCP)                       —— 见 Spec A/B/C/D/E
Environment  运行环境/沙箱(隔离级别、网络、依赖),Session 创建时绑定    —— Phase 2 一等资源化
Session      有状态实例 = (Agent + Environment),服务端持有历史,按 id 寻址、事件驱动
```

## ADDED Requirements

### Requirement: Managed Agent 标准模型（Agent + Environment + Session）✅
**User Story:** 作为平台,我希望"调用 agent"用统一的标准模型,以便对外契约稳定、对内各类 agent 一致,并与业界（Claude/Qoder/Gemini）对齐。

#### Acceptance Criteria
1. WHERE 任意 agent 的调用 系统 SHALL 以 **Agent（配置）+ Environment（运行环境）+ Session（有状态实例）** 三者解耦建模
2. WHERE Session 系统 SHALL 是一个**有状态实例**,其对话历史由**服务端**持有(非调用方维护)
3. WHERE 通用助手与用户已发布 agent 系统 SHALL 走**同一套**会话与调用契约(不另起两套)
4. WHERE 隔离级别(L0–L3)/部署形态变化 系统 SHALL **不改变**对外调用契约(寻址与隔离正交)

#### 引用 / 影响
- 术语：Agent, Session, Environment, Version
- 现有功能：与发布/运行服务(I)、Chat(L)、隔离级别(I)、稳定寻址(I) 对齐
- 设计决策：以 Claude/Qoder Managed Agents 为标准；落地分阶段(见文末路线)

#### 待确认 / 假设
- ⬜后续：Environment 作为一等资源(Phase 2);事件状态机与异步任务事件(Phase 3)

---

### Requirement: 统一会话（服务端有状态，覆盖全部 agent）🔸MVP（Phase 1 已落地）
**User Story:** 作为用户/调用方,我希望与任意 agent 的对话历史由平台持有且可多会话管理,这样切换、刷新、断线都不丢,且各类 agent 行为一致。

#### Acceptance Criteria
1. WHERE 任意 agent（copilot 或已发布 agent）系统 SHALL 经**统一 Session 接口**对话
2. WHEN 每一轮对话 THEN 系统 SHALL 在**服务端**持久化该轮的用户消息与助手回复
3. WHERE 对外标识 系统 SHALL 用**单一 `session_id`（平台会话 id）**;运行引擎的续接 token 为**内部细节**,不作为对外契约
4. WHEN 用户切换会话 / 刷新页面 / 连接中断后重连 THEN 会话历史 SHALL 完整可恢复,不丢失
5. WHERE 会话 系统 SHALL 按**用户**隔离——一个用户看不到、改不了另一个用户的会话
6. WHERE 多会话 系统 SHALL 支持列表、新建、切换、**重命名**、删除;首条用户消息可自动作标题

#### 引用 / 影响
- 术语：Session, Agent
- 组件：Chat 会话侧栏(L)、Playground(I) 可复用同一会话接口
- 现有功能：替代"调用方事后回写整段历史"的易丢方案

#### 待确认 / 假设
- ⬜后续：把 Playground 也接入统一会话(已发布 agent 在界面上获得多会话历史)
- ❓会话保留期 / 归档策略(对应标准的 archive)

---

### Requirement: 事件驱动的调用契约（user.message + 流式）🔸MVP
**User Story:** 作为调用方,我希望用统一的事件把消息发给会话并按序拿到增量/完成/错误,以便流式展示与未来扩展(工具确认、异步任务)。

#### Acceptance Criteria
1. WHEN 向某会话发送 `user.message` 事件 THEN 系统 SHALL 驱动其 agent 执行并返回结果
2. WHERE 流式 系统 SHALL 以 **SSE** 按序推送：文本增量、完成(含最终回复)、错误
3. WHERE 请求体 系统 SHALL **兼容**标准事件形态 `{events:[{type:"user.message", content:[{type:"text", text}]}]}` 与简写 `{message}`
4. WHERE 运行引擎不可用 / 下游不可达 系统 SHALL 返回明确错误(不静默、不抛未处理异常)
5. WHERE 多轮 系统 SHALL 由平台用会话内部续接 token 续接上下文(调用方只带会话 id)

#### 引用 / 影响
- 现有功能：与"调用协议(一次性/流式/异步)"(I) 对齐——本契约把"流式"细化为事件流
- 设计决策：事件模型为后续 `tool.confirm` / 异步任务事件(Phase 3)预留扩展位

#### 待确认 / 假设
- ⬜后续：异步作业事件 + 工具确认事件(承载"派发需求澄清 / vibe-coding 任务")

---

### Requirement: 稳定寻址（按 id，端口是内部细节）🔸MVP（已落地）
**User Story:** 作为集成方,我希望调用地址稳定,agent 重启/换版本/迁移环境时我的应用不用改。

#### Acceptance Criteria
1. WHERE 对外调用 系统 SHALL 按 **agent id / 会话 id 经网关**寻址,不暴露易变的运行端口
2. WHEN agent 重启 / 换版本 / 迁移运行环境 THEN 稳定地址 SHALL 保持不变
3. WHERE 平台自身重启 系统 SHALL 自动对账恢复在跑服务并保持路由,不依赖"下次调用才自愈"
4. WHERE 展示/文档/示例 系统 SHALL 引导上游绑稳定地址,并标注"端口是内部细节、勿直连"

#### 引用 / 影响
- 现有功能：与 I「调用入口稳定」一致(本模块为其归口的契约表达)

---

## 对外契约（规范性 · 端点面）

> 这是被本 spec 固化的**对外约定**;完整请求/响应 schema 见 ../../技术文档/接口契约.md「统一 Session API」。

**统一 Session API（copilot 与已发布 agent 通用）**
- `POST /api/sessions` `{agent, environment_id?, title?}` → `{id, agent, status}`（`agent`='copilot' 或某 agent id）
- `POST /api/sessions/{id}/events[/stream]` `{events:[{type:"user.message",content:[{type:"text",text}]}]}`（或简写 `{message}`）→ SSE `delta|done|error`;**服务端每轮原子落库**;返回我方 `session_id`
- `GET /api/sessions[?agent=]` 列表 · `GET /api/sessions/{id}` 详情(含 messages) · `PUT /api/sessions/{id}` 改名 · `DELETE /api/sessions/{id}`

**兼容旧端点（薄适配器,不破坏上游）**
- `/api/copilot/chat[/stream]`、`/api/copilot/sessions/*` → 内部走统一 Session（`agent_ref='copilot'`）
- `/api/agents/{id}/service-chat[/stream]` → 保留为「调用方自管 session_id（续接 token）」的无状态服务调用

**约定**：`session_id` 单一语义 = 平台会话 id;续接 token 内部;错误用 HTTP 状态码 + `{detail}` 或 SSE `error` 事件。

## 对齐路线（分阶段，旧端点留适配器）

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 1 | 统一 Session（服务端历史、单一 session_id、覆盖全部 agent、事件体兼容） | ✅已落地 |
| Phase 2 | Environment 一等资源（`/api/environments`,Session 绑定） | ⬜ |
| Phase 3 | 事件状态机（`message.delta`/`status`/`tool.use`/`tool.confirm`/异步任务事件） | ⬜ |
| Phase 4 | session 状态机 / archive / vaults(MCP 凭证) / session 创建钉 agent 版本 | ⬜ |
