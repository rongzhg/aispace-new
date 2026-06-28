---
name: 框架配置
last amended: 2026-06-28
version: 3
description: 多框架支持、框架差异化配置文件编辑、配置模板
---

# 框架配置 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 配置文件与 Prompt 映射（关键约定）

不同框架用户需填写的配置文件不同，prompt（角色 + 指令）的落点也不同。**界面直接以原始文件名呈现各编辑器**，与 OpenClaw 自身约定保持一致，降低用户理解成本；具体职责由各文件的默认模板（见 ../templates/）通过注释引导：

| 框架 | 文件（界面直接显示文件名） | 默认模板引导的内容职责 |
|---|---|---|
| Claude Code | `claude.md`（单文件） | Agent 的角色 + 指令，即 system prompt 的全部内容。**不另设 system.md**，claude.md 即主指令文件 |
| OpenClaw | `role.md` | 角色 / 人设（"我是谁"） |
| OpenClaw | `agent.md` | 行为 / 能力 / 工作方式（"我怎么做事"） |
| OpenClaw | `user.md` | 面向用户的上下文 / 偏好 |

> 设计决策：不对 OpenClaw 文件做语义重命名，直接展示 `user.md` / `agent.md` / `role.md` 三个文件名让用户分别填写，与 OpenClaw 最一致。文件内容职责由模板注释承载，若与框架 owner 的实际约定有出入，只需调整 ../templates/ 下对应模板。

## MODIFIED Requirements

### Requirement: 框架选择 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望在创建 Agent 时选择底层框架，以便系统据此展示差异化的配置项。

#### Acceptance Criteria
1. WHEN 用户进入创建页面 THEN 系统 SHALL 在 Agent 工作台中展示紧凑框架选择控件：Claude Code(可选)、OpenClaw(可选)、Custom(禁用,标注"coming soon")、Hermes(禁用)
2. WHEN 用户选择某个可选框架 THEN 系统 SHALL 据该框架渲染对应的配置区域
3. WHILE 框架为禁用态 系统 SHALL 置灰该选项且不可选择
4. WHILE Agent 已创建 系统 SHALL 禁止变更其框架

#### 引用 / 影响
- 术语：Framework（枚举：CLAUDE_CODE / OPENCLAW / CUSTOM / HERMES）
- 组件：Segmented/紧凑选择控件、Tooltip
- 现有功能：与创建 Agent(A)联动

#### 设计决策
- Custom 与 Hermes 均作为**未开放的 Agent 框架占位**：选项置灰禁用、不可选择，Custom 标注 "coming soon"。未来开放后的配置形态另行设计。

---

### Requirement: 框架差异化配置文件编辑 ✅已确认
**User Story:** 作为项目成员，我希望按所选框架编辑对应的配置文件，以便定义 Agent 的行为、角色和能力。

#### Acceptance Criteria
1. WHERE 框架为 Claude Code 系统 SHALL 提供一个等宽字体配置编辑器（对应 claude.md）
2. WHERE 框架为 OpenClaw 系统 SHALL 以 **Tab 切换**方式提供三个独立等宽字体编辑器：user.md、agent.md、role.md，每个编辑器占满宽度
3. WHERE 某个 Tab 已有内容 系统 SHALL 在该 Tab 上以小圆点等标识提示有内容
4. WHEN 用户在配置编辑器中输入 THEN 系统 SHALL 实时同步内容用于配置预览(见 Spec G)
5. WHERE 编辑器为 Markdown 系统 SHALL 提供 Markdown 语法高亮、行号、自动换行，以等宽字体（见组件库 fontFamilyCode）呈现
6. WHERE 本期范围 系统 SHALL NOT 对配置内容做结构/schema 校验（仅高亮，不做强校验）

#### 引用 / 影响
- 术语：ConfigFile, Framework, ConfigPreview
- 组件：Monaco(markdown)、Tabs(OpenClaw 三文件)
- 现有功能：与配置预览(G)联动

#### 设计决策
- 三个编辑器用 Tab 切换（非并排）：该页还含模型/工具/技能/预览，并排会过挤；Tab 让当前编辑器占满宽度、降低认知负担。
- Markdown 只做高亮 + 行号 + 换行，不做 schema 校验（业界配置类 .md 编辑器通行做法）。
- ⬜后续 action：对配置做"必含段落"等软性 lint。

---

### Requirement: 配置文件模板 ✅已确认（提供预填）
**User Story:** 作为项目成员，我希望新建配置文件时有框架默认模板，以便不从空白开始、降低上手成本。

#### Acceptance Criteria
1. WHEN 用户在创建页首次进入某框架的配置编辑器 THEN 系统 SHALL 预填该框架对应文件的默认模板骨架（claude.md / role.md / agent.md / user.md，模板内容见 ../templates/）
2. WHERE 模板存在占位说明 系统 SHALL 以注释/占位文本提示各段落含义
3. WHEN 用户清空后想恢复 THEN 系统 SHALL 提供"重置为模板"操作还原默认模板

#### 设计决策
- 本期模板内容**写死在前端**（取自 ../templates/ 下的文件），不做后台配置。
- ⬜后续 action：模板改为后台可配置（由管理员维护、支持多版本）。

#### 模板资产（已生成）
- Claude Code：`../templates/claude-code/claude.md`
- OpenClaw：`../templates/openclaw/role.md`、`agent.md`、`user.md`

#### 引用 / 影响
- 术语：ConfigFile, Framework
- 组件：Monaco、Button

#### 待确认 / 假设
- 已定：模板写死在前端；后台可配置列为后续 action。模板内容已生成（见上）。
