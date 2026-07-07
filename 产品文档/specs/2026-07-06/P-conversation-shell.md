---
name: 会话轨与外壳交互（Chat / Playground / 主导航）
last amended: 2026-07-06
version: 1
description: 会话轨重做（小号新建 / 整行卡片 / hover 操作 / 可收起）、左侧主导航可收起、QA 消息时间展示——今日增量，作用于 L(Chat) / I(Playground) / 应用外壳
---

# 会话轨与外壳交互 Feature Specification（2026-07-06 增量）

> 术语见 ../../glossary.md；格式见 ../../spec-template.md；视觉以 ../../视觉规范.dc.html 为准
> 本文件只描述功能与验收标准（WHAT）。状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> 增量说明：本组需求是对 L-assistant（Chat 会话轨）、I-runtime-publish（Playground 会话轨）与应用外壳（视觉规范 §03/§07）的**交互与视觉细化**，不改变既有数据契约。

## MODIFIED Requirements

### Requirement: 会话轨重做（新建 / 卡片 / 操作 / 收起） 🔸MVP（已实现）
> 决策：会话轨按视觉规范 §07 收敛——新建是**轻量 rail action（小号按钮）而非整宽主 CTA**；会话项标题占满行宽，编辑/删除退为 hover 显形，避免常驻挤占标题。Chat 与 Playground 会话轨复用同一套视觉。

**User Story:** 作为用户，我希望会话列表清爽、标题看得全、次要操作不干扰，并能在需要时把列表收起腾出空间。

#### Acceptance Criteria
1. WHERE 会话轨顶部 系统 SHALL 展示「会话」标题 + 会话总数（`N 条`），并在同一行右侧提供**小号「+ 新建」按钮**与「收起」图标按钮；新建按钮 SHALL 为轻量 rail action（高 26px、圆角 5px），**不得**使用整宽或深色主 CTA 样式
2. WHERE 会话项 系统 SHALL 渲染为整行卡片：第一行标题占满行宽并溢出省略（`text-overflow: ellipsis`），第二行元信息为「更新时间 · N 条」
3. WHERE 会话项处于 hover 或选中态 系统 SHALL 显示行内操作图标（Chat：重命名 + 删除；Playground：删除），绝对定位于行右侧；非 hover/非选中态 SHALL 隐藏这些图标，使标题占满可用宽度
4. WHERE 会话项为当前选中 系统 SHALL 使用 `#E8EEF7` 作为选中背景、标题用链接/选中色（`#2563EB`）加粗
5. WHEN 用户点击「收起」 THEN 系统 SHALL 把会话轨收成约 46px 的细条带，仅保留「展开」与「新建会话」两个图标按钮；WHEN 用户点击「展开」 THEN 系统 SHALL 恢复完整会话轨（Chat 252px / Playground 224px）
6. WHERE 会话轨宽度 系统 SHALL 落在 210–252px 区间；删除会话 SHALL 二次确认

#### 引用 / 影响
- 视觉规范：§07 会话轨「标题/数量 + 小号新建按钮」「active `#E8EEF7`」「不要整宽深色主按钮」；§02 tokens（选中 `#2563EB`、meta `#94A3B8`）
- 组件：ChatPanel / Playground 会话轨、会话项卡片、`session-toolbar-actions`、收起细条带
- 实现：`components.tsx` `ChatPanel` / `Playground`；CSS `.chat-session-item`/`.playground-session-item`/`.session-item-actions`/`.session-toolbar-actions`
- 现有功能：细化 L-assistant「Chat 入口」AC2/AC3、I-runtime-publish「Playground」；数据接口不变

#### 待确认 / 假设
- ✅已确认：收起态仅留「展开 / 新建」两个图标（与 L-assistant AC3 一致）
- ❓窄屏/移动端会话轨是否改为抽屉（当前未做响应式抽屉）

---

### Requirement: 左侧主导航可收起 🔸MVP（已实现）
> 决策：在视觉规范 §03「固定 236px 侧栏」的**默认展开态**之上，增加用户可选的收起态（图标导航），腾出内容区宽度；展开即回到规范默认。

**User Story:** 作为用户，我希望在专注内容时把左侧主导航收成图标条，需要时再展开。

#### Acceptance Criteria
1. WHERE 顶栏左侧 系统 SHALL 提供「折叠 / 展开导航」按钮（`MenuFold`/`MenuUnfold`）
2. WHEN 用户点击折叠 THEN 系统 SHALL 把左侧栏从 236px 收至 72px 图标态：隐藏 App 名称文字、隐藏「工作空间」分组标题、菜单切换为 `inlineCollapsed`（仅图标）、底部状态改为居中状态点
3. WHERE 收起态 系统 SHALL 为工作空间选择器、状态点提供 Tooltip（右侧弹出），保证图标态下仍可辨认
4. WHEN 侧栏宽度变化 THEN 系统 SHALL 同步调整内容区左边距（236↔72），并以 0.18s 过渡平滑切换
5. WHERE 展开态 系统 SHALL 完全符合视觉规范 §03（236px、`#F8FAFC` 底、菜单项 34px 高）

#### 引用 / 影响
- 视觉规范：§03 应用外壳（展开态为规范默认；收起为可选扩展）
- 实现：`App.tsx` `siderCollapsed` 状态、`Sider width` + `Menu inlineCollapsed`、顶栏折叠按钮、`Layout marginLeft`
- 现有功能：不改导航项与路由，仅增加折叠态

#### 待确认 / 假设
- ⚠️ 视觉规范 §03 写「固定 236px」，本需求把收起作为**用户可选状态**扩展；建议后续在视觉规范补一条「侧栏可收起为 72px 图标态」以消歧
- ⬜后续：折叠态是否随视口宽度自动触发（当前仅手动）

---

## ADDED Requirements

### Requirement: 会话消息时间展示 🔸MVP（已实现）
**User Story:** 作为用户，我希望每条问答都能看到时间，便于回看会话节奏。

#### Acceptance Criteria
1. WHERE Chat 与 Playground 调试面板的对话区 系统 SHALL 在每条用户/AI 消息气泡下方展示该条消息时间（`HH:mm`）
2. WHERE 消息为系统提示（sys） 系统 SHALL **不**展示时间
3. WHERE 历史消息 系统 SHALL 使用后端为每条消息落库的 `ts`（`YYYY-MM-DD HH:mm`，展示时截取 `HH:mm`）；新产生的消息由前端补 `ts`，保证流式过程中即可见
4. WHERE 时间文本 系统 SHALL 使用 meta 色（`#94A3B8`）小字，不喧宾夺主

#### 引用 / 影响
- 视觉规范：§02 元信息 11–11.5px、meta 色 `#94A3B8`
- 实现：`components.tsx` `msgTime()`（截 `HH:mm`）、`ChatPanel`/`DebugPanel` 消息渲染；后端 `_sess_append` 每条消息打 `ts`
- 现有功能：呼应 N-session-console 明细的 QA 时间展示

#### 待确认 / 假设
- ❓是否需要按「今天/昨天/日期」分组或显示完整日期（当前仅 HH:mm）
