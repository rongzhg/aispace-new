---
name: Chat（统一入口 / Copilot）
last amended: 2026-06-28
version: 3
description: Chat 统一入口——会话轨、默认通用 agent、slash 唤起内置 skill；目标：平台所有功能都能通过 chat 解决
---

# Chat Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 定位

侧边栏「**Chat**」是平台统一入口（copilot）：界面能做的 chat 都能做，chat 还能理解需求。Chat 采用**会话轨 + 主对话区**：左侧管理会话，右侧默认连通用 agent；输入 `/` 唤起内置 skill。

| 角色 | 说明 |
|---|---|
| 通用 agent（默认） | 编排者，用对话**直接执行平台操作**（列出/创建 Agent、创建空间、查已发布…）；也能调用 skill |
| 内置 skill（slash 唤起） | `/agent-creator`（创建 Agent）、`/skill-creator`（生成技能草稿）；可扩展 |

> 设计与分阶段见 ../../技术文档/架构设计.md（阶段二：需求追问→EARS spec；阶段三：完整工具调用 + 派发 vibe-coding agent）。

## MODIFIED Requirements

### Requirement: Chat 入口（会话轨 + 通用 Agent + slash） 🔸MVP（已在 demo 实现，阶段一）
**User Story:** 作为用户，我希望有一个统一聊天入口，默认就能对话/操作，并能用 / 选择内置技能。

#### Acceptance Criteria
1. WHERE 侧边栏 系统 SHALL 提供「Chat」入口，与 Agents/Playground/成员并列
2. WHEN 用户进入 Chat THEN 系统 SHALL 展示左侧会话轨与右侧主对话区；会话轨支持新建、切换、重命名、删除会话
3. WHERE Chat 主对话区为空 系统 SHALL 展示高信号空状态与可点击建议，而不是只展示大面积空白
4. WHERE 后端可用且通用 Agent 开启 系统 SHALL 默认连接后端常驻通用 Agent；后端不可用或用户关闭时，系统 MAY 回退为前端轻量意图匹配
5. WHEN 用户输入 `/` THEN 系统 SHALL 弹出内置 skill 菜单（`/agent-creator`、`/skill-creator`，按输入过滤），点击或输入命令即进入该 skill
6. WHERE 处于某 skill 系统 SHALL 显示当前技能标识并提供「× 退出」回到通用 agent
7. WHERE skill 菜单由注册表驱动 系统 SHALL 支持后续扩展（内置/用户 skill 自动出现）

#### 引用 / 影响
- 组件：Chat 会话轨、主对话区、Composer、slash 下拉菜单、当前技能 chip
- 现有功能：复用对话气泡；通用 agent 执行见下；与 Skill 概念(E)对齐
- 设计决策：去掉三选一切换器，改为会话轨 + slash（更像 copilot）；输入框下方不得留无意义大空白

---

### Requirement: 通用助手 — 轻量真执行 🔸MVP（已在 demo 实现）
> 决策（MVP 阶段）：**轻量真执行**——识别常用意图并真正执行（非完整 LLM 工具调用）。完整工具调用（覆盖全部操作）列为后续。

**User Story:** 作为用户，我希望通过通用助手用对话直接在平台上做操作，而不必逐个点界面。

#### Acceptance Criteria
1. WHEN 用户说"列出 Agent / 有哪些 agent" THEN 系统 SHALL 列出当前空间 Agent（含是否已发布）
2. WHEN 用户说"列出已发布" THEN 系统 SHALL 列出全部已发布的 Agent
3. WHEN 用户说"创建 Agent <名称>" THEN 系统 SHALL 真实创建（默认 Claude Code + 模型 + 模板），并回报结果
4. WHEN 用户说"创建项目空间 <名称>" 且为平台管理员 THEN 系统 SHALL 创建该空间；非管理员 SHALL 拒绝并说明
5. WHEN 意图无法识别 THEN 系统 SHALL 回复可执行的能力清单（帮助）
6. WHERE 运行环境未就绪 系统 SHALL 提示需先就绪才能真正执行
7. WHERE 操作执行成功 系统 SHALL 刷新相关列表数据（如 Agent 列表、空间列表），让结果在 UI 里立即可见

#### 引用 / 影响
- 现有功能：操作结果实时反映到列表/空间；权限沿用平台管理员校验(K)
- 设计决策：意图→操作的轻量映射

#### 待确认 / 假设
- ⬜后续：**完整工具调用**——覆盖平台全部操作（删除/编辑/发布/成员管理等），并带确认与权限校验
- ❓写操作是否需二次确认（如删除）

---

### Requirement: Agent Creator 🔸MVP（已在 demo 实现）
**User Story:** 作为用户，我希望描述想要的 Agent，助手就帮我建好。

#### Acceptance Criteria
1. WHEN 用户描述"名称：职责" 或含名称的句子 THEN 系统 SHALL 解析出名称与角色，真实创建 Agent，并把角色写入其配置文件
2. WHEN 创建成功 THEN 系统 SHALL 回报并引导去「Agents」编辑完善或发布

#### 待确认 / 假设
- ⬜后续：多轮澄清（追问名称/框架/模型）后再创建（呼应需求 agent 设计）

---

### Requirement: Skill Creator ⬜后续（demo 仅草稿）
**User Story:** 作为用户，我希望描述一个技能，助手生成技能定义。

#### Acceptance Criteria
1. WHEN 用户描述一个技能 THEN 系统 SHALL 生成技能定义草稿（名称/描述/触发/步骤）展示在对话
2. WHERE 落库 系统 SHALL 依赖「技能注册」接口（见 Spec E，⬜后续），本期不持久化

#### 待确认 / 假设
- ❓技能的最终数据结构与注册接口

---

### Requirement: 通用助手 — 真编排（Copilot，阶段二）🔸MVP（骨架已落地）
> 决策（阶段二）：把「轻量真执行」升级为**真编排者**——一个常驻的 Claude Code agent，靠 **MCP 工具**真正调用平台 API、靠 **skill** 处理专项流程。替代正则意图匹配。

**User Story:** 作为用户，我希望通用助手是个真正能调用平台能力的编排者，而不是关键词匹配。

#### Acceptance Criteria
1. WHERE 每个用户 系统 SHALL 提供一个常驻「通用助手」（copilot），跑在该用户的 L0 沙箱里、**跨其所有空间复用**；按**用户身份**路由，「当前空间」作每请求上下文（见 架构设计 §10.5）
2. WHEN 用户与通用助手对话 THEN 系统 SHALL 经其 **platform-ops MCP** 真正执行平台操作（列出/创建/发布 Agent、创建空间等），结果实时反映
3. WHERE 单 agent 编排 系统 SHALL 支持挂载 **skill**（`.claude/skills/`）与 **MCP**（`.mcp.json`）两个扩展点，且 copilot 与用户 agent 复用同一套绑定
4. WHERE 出厂内置 系统 SHALL 自带 `agent-creator`、`skill-creator`、`requirement-clarify` 三个 skill，并与用户从市场安装的 skill/MCP 合并
5. WHEN 用户提平台改进/反馈类需求 THEN 系统 SHALL 进入 `requirement-clarify` 多轮追问收敛成 EARS，确认后调 `submit_requirement` 落地
6. WHERE 需求落地 系统 SHALL 用可插拔 sink：demo 写文件（FileSink），配置 webhook 后发往外部系统（HttpSink）

#### 引用 / 影响
- 后端：`backend/copilot.py`（人设+内置skill+platform-ops MCP）、`main.py` `/api/copilot/*` + `_materialize_skills/_materialize_mcp`、`mcp_server.py`（含 `submit_requirement`）、`agent_runner.py`（`.mcp.json` → `--mcp-config`）
- 设计：编排运行时与隔离级别正交（见 架构设计 §10.5）；copilot 按**用户身份**路由、ws 作上下文、`_resolve_copilot_endpoint(user)` 解析器可插拔（local→sandbox）；demo 用 Claude Code，正式版可换 Agent SDK 内嵌

#### 待确认 / 假设
- ✅已落地：多 session 会话轨（新建/切换/重命名/删除 + 服务端落库）
- ⬜后续：正式版换 Agent SDK 内嵌后端（不每会话起子进程）
- ❓写操作二次确认的统一策略（destructive 强制确认）
