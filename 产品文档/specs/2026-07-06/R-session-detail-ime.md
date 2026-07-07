---
name: 会话明细对齐与输入法组合守卫（Session 明细 / Composer）
last amended: 2026-07-06
version: 1
description: Session 明细页按 Chat/Playground 同款展示历史（Markdown 正文 + 执行链路 + 用量脚注）；对话输入框在输入法组合态下回车不误发——今日增量，作用于 N(Session 控制台) / L(Chat) / I(Playground 调试)
---

# 会话明细对齐与输入法组合守卫 Feature Specification（2026-07-06 增量）

> 术语见 ../../glossary.md；格式见 ../../spec-template.md；视觉以 ../../视觉规范.dc.html 为准
> 本文件只描述功能与验收标准（WHAT），不绑定实现。状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> 增量说明：本组是当日晚间（20:00 后）两处细化——①把 Session 明细页的历史展示对齐到 Chat/Playground 的同一套组件（`Md` / `TraceSteps` / `UsageLine`，见 Q 增量），②给对话 Composer 补输入法组合守卫。分别细化主 spec N-session-console（v3）与 L-assistant（v5，AC10），不改变既有数据契约。

## 定位

历史会话的价值在于「能原样回看当时发生了什么」。此前 Session 明细页只用纯文本 `pre-wrap` 展示 AI 回复，看不到 Markdown 排版、思考/工具链路与用量——与 Chat/Playground 的实时展示不一致。本增量让明细页**复用同一套只读展示组件**，做到「实时看到什么、历史就回放什么」。同时修复一个高频体验问题：中文等输入法在拼音**组合过程中**回车会把半截字（如「a gen t」）误发出去。

| 概念 | 说明 |
|---|---|
| 明细回放 | Session 明细抽屉按落库的 `steps` / `usage` / `model` / `stop` 完整回放某轮回复 |
| 组合态（composition） | 输入法从起键到上屏之间的中间态（拼音/五笔/注音等），期间的回车不应触发发送 |

## MODIFIED Requirements

### Requirement: Session 明细页对齐 Chat/Playground 展示（Markdown + 执行链路 + 用量） 🔸MVP（已实现）
> 决策：Session 明细页的历史消息复用与 Chat/Playground 完全相同的展示组件（`Md` / `TraceSteps` / `UsageLine`），只读回看，不新增交互。与 Q 增量「执行链路 / 用量 / Markdown」协议一致。

**User Story:** 作为查看历史会话的用户，我希望 Session 明细页里的 AI 回复也像 Chat/Playground 那样按 Markdown 排版、展示思考与工具链路、显示用量，而不是一坨纯文本。

#### Acceptance Criteria
1. WHERE Session 明细抽屉的 AI（assistant）消息 系统 SHALL 用 `Md` 组件按 GitHub-Flavored Markdown 渲染回复正文（表格/代码/列表/加粗/引用/链接等），与 Q「AI 回复按 Markdown 渲染」一致
2. WHERE Session 明细抽屉的用户消息 系统 SHALL 保持纯文本（`white-space: pre-wrap`），不做 Markdown 解析
3. WHERE AI 消息带执行链路（`steps`） 系统 SHALL 在回复气泡上方复用 `TraceSteps` 展示思考 / 工具调用链路（入参/结果/状态）/ MCP 徽标 / 子代理 / 图片占位 / 压缩标记，与 Q 一致
4. WHERE AI 消息带用量（`usage` / `model` / `stop`） 系统 SHALL 在回复气泡下方复用 `UsageLine` 展示用量脚注（token/成本/耗时/模型/异常停止），与 Q 一致
5. WHERE 消息时间 系统 SHALL 使用 meta 色（`#94A3B8`）小字展示
6. WHERE 明细页性质 系统 SHALL 保持**只读回看**——不提供输入/继续对话；WHERE 历史旧消息缺 `steps`/`usage` THEN 系统 SHALL 只展示正文，不显示空的链路/用量区

#### 引用 / 影响
- 视觉规范：§02 tokens（meta `#94A3B8`）、§05 Table/代码、§07 会话明细；与 Q 共用同一展示协议
- 组件：`SessionConsole` 明细抽屉复用 `Md` / `TraceSteps` / `UsageLine`（`components.tsx`）
- 实现：`components.tsx` `SessionConsole` 明细渲染——assistant 走 `Md` + `TraceSteps` + `UsageLine`，user 走 `pre-wrap` 纯文本
- 现有功能：细化 N-session-console AC3（v2→v3）；展示协议与 Q 增量对齐；数据来自 M/N 的落库 `messages[].{steps,usage,model,stop}`

#### 待确认 / 假设
- ✅已确认：明细页只读，不加输入框
- ❓早期落库、无 `steps`/`usage` 的历史消息只回放正文（无链路/用量），符合预期

---

### Requirement: 对话 Composer 输入法组合守卫（拼音未完不误发） 🔸MVP（已实现）
> 决策：对话输入框在输入法组合态（composition 中）**不因回车触发发送**，只有组合结束后的回车才发送。修复截图中「a gen t」半截拼音被误发的问题。

**User Story:** 作为中文/多语输入用户，我希望在拼音等输入法组合过程中回车不会把半截字发出去，只有我真正打完上屏后回车才发送。

#### Acceptance Criteria
1. WHILE 输入法处于组合态（composition 中） 系统 SHALL **不**因回车触发发送——避免半截拼音（如「a gen t」）被误发
2. WHERE 组合结束后的回车 系统 SHALL 正常发送并清空输入框
3. WHERE 判定依据 系统 SHALL 使用组合事件（`compositionstart` / `compositionend`）与回车事件的 `isComposing` / `keyCode 229`（双保险，兼容不同浏览器/输入法）
4. WHERE 适用范围 系统 SHALL 覆盖 Chat 与 Agent 配置调试（DebugPanel）的对话输入框；Playground 试跑输入框如共用同一 Composer 亦适用

#### 引用 / 影响
- 组件：`ChatPanel` / `DebugPanel` Composer（`components.tsx`）
- 实现：`composingRef` + `onCompositionStart`/`onCompositionEnd` + `onPressEnter` 守卫（组合中或 `isComposing`/`keyCode 229` 直接 return）
- 现有功能：已并入 L-assistant AC10（v5）；与 P 增量「会话轨 Composer」同属外壳交互
- 视觉规范：无新增视觉，仅交互行为修复

#### 待确认 / 假设
- ✅已确认：组合中回车不发送、组合结束回车正常发送（已实测：组合态 Enter 消息数不变且保留输入；普通 Enter 发送并清空）
- ⬜后续：粘贴多行/Shift+Enter 换行策略统一（当前 Enter 发送、组合态豁免）
