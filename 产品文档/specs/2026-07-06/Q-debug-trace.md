---
name: 调试执行链路与用量展示（思考 / 工具链 / MCP / 子代理 / 用量 / Markdown）
last amended: 2026-07-06
version: 2
description: Agent 对话调试中通用展示思考过程、工具调用链路（入参/结果/状态）、MCP 徽标、子代理、图片占位、上下文压缩标记、每轮用量脚注（token/成本/耗时/模型/异常停止），以及 AI 回复的 Markdown 渲染——今日增量，作用于 I(试跑/Playground) / L(Chat)，两个 runtime 统一协议
---

# 调试执行链路与用量展示 Feature Specification（2026-07-06 增量）

> 术语见 ../../glossary.md；格式见 ../../spec-template.md；视觉以 ../../视觉规范.dc.html 为准
> 本文件只描述功能与验收标准（WHAT），不绑定实现。状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> 增量说明：细化 I-runtime-publish「Agent 试跑 / 调试」AC3/AC5/AC6 与 L-assistant「通用助手真编排」——把调试对话从「只见最终回复」升级为「可见思考过程、工具调用链路与结果、每轮用量」，且 Chat / Playground / Agent 配置调试**三处统一**、Claude Code 与 OpenClaw **两个 runtime 统一协议**。

## 定位

调试/试跑的核心诉求是**看清 Agent 是怎么得出结论的**：先想了什么、调了哪些工具、传了什么参数、拿到什么结果、花了多少 token/钱/时间。本增量定义一套**通用执行链路（steps）+ 用量脚注**的展示协议，前端一份组件（`TraceSteps` / `UsageLine`）在三处复用，后端两个 runtime 各自适配到同一协议。

| 概念 | 说明 |
|---|---|
| 执行链路 step | 一次回合内按序发生的过程节点：`think`（思考）/ `tool`（工具调用，含入参/结果/状态）/ `info`（系统事件，如压缩） |
| 用量 usage | 一轮的 token（输入/输出/缓存）、成本、耗时、轮数 |
| 通用协议 | 流式 SSE 事件 `think`/`tool`/`tool_result`/`info`/`done(usage,model,stop)`；落库结构 `steps[]` + `usage`/`model`/`stop` 随 bot 消息持久化 |

## MODIFIED Requirements

### Requirement: 执行链路展示（思考 / 工具调用链 / 结果） 🔸MVP（已实现）
**User Story:** 作为调试 Agent 的用户，我希望看到 Agent 的思考过程和每一次工具调用的入参与结果，以便判断它的推理与行为是否正确。

#### Acceptance Criteria
1. WHERE Agent 回复 系统 SHALL 在回复气泡上方展示本轮执行链路面板，按发生顺序渲染 `think` / `tool` / `info` 节点；无链路时不展示面板
2. WHERE `think` 节点 系统 SHALL 以可折叠条目展示：折叠态显示图标 + 「思考」+ 首行预览，展开显示完整思考文本
3. WHERE `tool` 节点 系统 SHALL 以可折叠条目展示：工具名 + 状态徽标，展开显示「入参」(格式化 JSON) 与「结果」两段
4. WHERE `tool` 节点状态 系统 SHALL 区分三态：执行中（Spin +「执行中」）、成功（`✓ 完成`，成功色）、失败（`✕ 失败`，错误色 `#DC2626`）
5. IF 工具执行返回错误（`is_error`） THEN 系统 SHALL 以失败态展示且不静默（呼应 I 「原样展示错误」）
6. WHERE 模型省略明文思考（`display: omitted`，如 Opus 4.7/4.8 默认） 系统 SHALL 在无明文思考时不展示空的思考节点

#### 引用 / 影响
- 视觉规范：§02 tokens——思考 `#B45309`(警告色)、工具 `#4F46E5`(Legacy Indigo)、成功 `#047857/#16A34A`、失败 `#DC2626`、meta `#94A3B8`；§05 折叠用原生 `<details>`，发丝描边、小圆角
- 组件：`TraceSteps`（`components.tsx`），Chat/Playground/配置调试三处共用
- 实现：后端 SSE `think`/`tool`/`tool_result`；前端 `upSteps` 累积到最后一条 bot 消息 `steps`
- 现有功能：细化 I「试跑/调试」AC3/AC5/AC6

#### 待确认 / 假设
- ❓明文思考的可见性取决于 runtime/模型档位；本期只保证「有则展示」
- ⬜后续：入参/结果超长的分页或"查看全部"

---

### Requirement: 工具语义识别（MCP 徽标 / 子代理 / 图片占位） 🔸MVP（已实现）
**User Story:** 作为用户，我希望一眼看出某次工具调用是平台 MCP 工具、子代理任务，还是返回了图片，而不是只有一个裸工具名。

#### Acceptance Criteria
1. WHERE 工具名形如 `mcp__<server>__<tool>` 系统 SHALL 标注为「MCP」，用蓝色徽标展示 `<server>`，并只显示纯工具名部分
2. WHERE 工具名为 `Task`（子代理） 系统 SHALL 标注为「子代理」、用区分图标，并展示子任务的 `description`/`prompt` 预览
3. WHERE 工具结果包含图片内容块 系统 SHALL 以 `[图片]` 文本占位纳入结果，而不是丢弃该步骤或整条结果
4. WHERE 普通客户端工具（bash/read/glob…） 系统 SHALL 标注为「工具」并展示原工具名

#### 引用 / 影响
- 视觉规范：§02 MCP 徽标复用 Legacy Indigo（`#EEF0FF/#4F46E5`）；子代理图标用 accent `#2563EB`（token 内）
- 实现：`TraceSteps` 按 `name` 前缀/等值分派；后端 `_result_text`/`_tool_result_text`/OpenClaw transcript 图片块 → `[图片]`
- 现有功能：MCP 呼应 D-mcp-tools、L「platform-ops MCP」；子代理呼应多 agent 编排

#### 待确认 / 假设
- ⬜后续：图片结果内联缩略图（当前仅占位）
- ⬜后续：MCP 徽标点击跳转到对应 MCP 详情

---

### Requirement: 上下文压缩标记 🔸MVP（已实现，触发依赖 runtime）
**User Story:** 作为用户，我希望在长会话里知道上下文被压缩过，以理解为何早期细节可能被概括。

#### Acceptance Criteria
1. WHERE runtime 发生上下文压缩事件 系统 SHALL 在执行链路中插入 `info` 节点，渲染为虚线分隔的「上下文已压缩」提示
2. WHERE 非压缩系统事件 系统 SHALL 不误报为压缩

#### 引用 / 影响
- 实现：后端 Claude Code `system` 事件 `subtype` 含 `compact` → `info`；前端 `.trace-info` 虚线分隔
- 现有功能：与 M/N 的长会话/压缩语义对齐

#### 待确认 / 假设
- ⬜后续：展示压缩前后 token 变化

---

## ADDED Requirements

### Requirement: 每轮用量脚注（token / 成本 / 耗时 / 模型 / 异常停止） 🔸MVP（已实现）
**User Story:** 作为调试者，我希望每轮回复都显示消耗的 token、成本、耗时和实际模型，异常停止时能立刻看出来。

#### Acceptance Criteria
1. WHERE Agent 回复完成 系统 SHALL 在回复气泡下方脚注展示可得的用量：`↑输入 ↓输出 tok`、缓存命中、成本（`$x.xxxx`）、耗时（`x.xs`）、轮数、命中模型；缺失字段不展示
2. WHERE 存在异常停止原因（如 `error_max_turns`、执行异常） 系统 SHALL 在脚注末尾以警告色（`#B45309`）标出 `⚠ <原因>`
3. WHERE 用量脚注 系统 SHALL 使用等宽字体、meta 色小字，与时间戳同一行
4. WHERE 正常结束（`success`） 系统 SHALL 不展示停止原因标记

#### 引用 / 影响
- 视觉规范：§02 meta `#94A3B8`、警告 `#B45309`；等宽字体用于数值/ID
- 组件：`UsageLine`（`components.tsx`）
- 实现：Claude Code `result.usage`/`total_cost_usd`/`duration_ms`/`subtype`；OpenClaw `agentMeta.usage`/`durationMs`/`winnerModel` 归一化为同一 `usage` 结构
- 现有功能：新增；不改计费口径（仅透传 runtime 上报）

#### 待确认 / 假设
- ❓成本仅 Claude Code result 携带；OpenClaw 当前无 `cost_usd`（只出 token/耗时）

---

### Requirement: 三处统一 + 两 runtime 统一协议 + 流式与历史回放 🔸MVP（已实现）
**User Story:** 作为平台，我希望链路/用量展示在所有对话入口一致，且不同框架产出同一套结构，历史也能完整回放。

#### Acceptance Criteria
1. WHERE Chat、Playground、Agent 配置页调试 三处 系统 SHALL 复用同一套链路/用量展示（`TraceSteps` + `UsageLine`），行为一致
2. WHERE Claude Code 与 OpenClaw 两个 runtime 系统 SHALL 产出同一套链路协议：Claude Code 由 stream-json（assistant `thinking`/`tool_use`、user `tool_result`、system `compact`、result `usage`）映射；OpenClaw 由会话 transcript（`thinking`/`toolCall`/`toolResult`）+ `agentMeta.usage` 映射
3. WHILE 流式进行中 系统 SHALL 实时构建链路（工具节点先入「执行中」态，收到结果再转完成/失败），回复气泡在有链路时显示「执行中…（上方为实时链路）」
4. WHEN 一轮结束 THEN 系统 SHALL 把该轮 `steps[]` 连同 `usage`/`model`/`stop` 随 bot 消息落库；WHEN 用户切换会话或刷新 THEN 系统 SHALL 从落库数据完整回放链路与用量
5. WHERE 一次性（非流式）调用 系统 SHALL 在结果中直接带 `steps`/`usage`，与流式展示一致

#### 引用 / 影响
- 后端：`agent_runner.py`（`cc_stream`/`_result_text`/`_turn_usage`）、`main.py`（`run_claude_code`/`_steps_from_stream_lines`/`_session_stream_gen` 落库 steps+usage+model）、`openclaw_gateway.py`（`turn_steps_from_session`/`parse_agent_output` usage）
- 协议：SSE `think`/`tool`/`tool_result`/`info`/`done(usage,model,stop)`；落库进 `sessions.messages[].{steps,usage,model,stop}`
- 前端：`ChatPanel.handleCopilot` 与 `DebugPanel` 共用 `upSteps`/`finishSteps`/`TraceSteps`/`UsageLine`
- 对齐：会话/事件契约见 M（统一 Session API）

#### 待确认 / 假设
- ⬜后续：把消息级「链路 / 时间 / 用量」的样式补入视觉规范 §07（当前已全部用 §02 tokens，但规范文本尚未收录该模式）
- ❓子代理(Task) headless 不一定 spawn、MCP 徽标需 agent 绑定 MCP、压缩需长会话——展示逻辑已就绪，触发依赖 runtime 与配置

---

### Requirement: AI 回复按 Markdown 渲染 🔸MVP（已实现）
> 决策：对话页的 AI 回复常含表格、代码、列表、加粗、链接等 Markdown，按业界会话产品（ChatGPT/Claude 等）通行做法**渲染为 GitHub-Flavored Markdown**，而非原样输出标记文本。用户输入保持纯文本，生 HTML 不解析（安全）。

**User Story:** 作为用户，我希望 Agent 回复里的表格、代码块、列表、链接被正确排版，而不是看到一堆 `|`、`#`、反引号原文。

#### Acceptance Criteria
1. WHERE 对话页（Chat / Playground / Agent 配置调试）的 AI（bot/assistant）回复 系统 SHALL 以 GitHub-Flavored Markdown 渲染：段落、标题、**加粗**/斜体、有序/无序列表、任务列表、表格、行内代码、代码块、引用、分割线、链接
2. WHERE 单个换行 系统 SHALL 渲染为软换行（`<br>`），贴合聊天语感（不因 Markdown 规则吞掉单换行）
3. WHERE 用户消息 系统 SHALL 保持纯文本（`white-space: pre-wrap`），不做 Markdown 解析
4. WHERE 安全 系统 SHALL **不**解析回复中的原始 HTML（不启用 rehype-raw），链接以新窗口打开（`target=_blank rel=noreferrer`）
5. WHILE 流式输出中 系统 SHALL 对已到达的文本逐步 Markdown 渲染，并在末尾保留输入光标提示
6. WHERE Markdown 元素样式 系统 SHALL 使用视觉规范 §02 tokens：链接 `#2563EB`、表格发丝罫线 `#E2E8F0` + 表头浅底 `#F8FAFC`（§05 Table）、行内代码/代码块浅底 + 等宽、引用左罫线；表格/代码块过宽时在自身容器内横向滚动，不撑破气泡

#### 引用 / 影响
- 视觉规范：§02 tokens、§05 Table/代码；§07 待补「消息 Markdown 排版」模式
- 组件：`Md`（react-markdown + remark-gfm + remark-breaks），`components.tsx`；样式 `.md-body`（agent-redesign.css）
- 依赖：新增 `react-markdown` / `remark-gfm` / `remark-breaks`
- 现有功能：三处对话气泡复用，与执行链路/用量脚注并存

#### 待确认 / 假设
- ⬜后续：代码块语法高亮（当前仅等宽 + 浅底，未着色）
- ⬜后续：数学公式（KaTeX）、图表等富内容（当前不解析）
- ❓超宽表格/长代码在窄屏的最佳折行策略（当前容器内横向滚动）
