---
name: 权限与资产管理
last amended: 2026-06-29
version: 3
description: 资产（Agent/Tool/Skill）访问权限模型、锁定态展示、权限分配后台
---

# 权限与资产管理 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 权限粒度（已落定，见 Spec J）

资产权限在 **「项目 + 角色 + 资产」** 三维度下判定：所有资产（Agent、MCP 工具、Skill）归属项目并按项目隔离；用户在项目内的角色（平台管理员 / 项目管理员 / 项目成员）决定其对资产的可见与可用。

## MODIFIED Requirements

### Requirement: 资产权限消费（锁定态） 🔸MVP（锁定态 UI 已实现，锁定数据待接入）
**User Story:** 作为项目成员，我希望只能选择我有权限的工具和技能，以便平台资产受控使用。

> 实现现状：工具/技能选择抽屉（AssetDrawer）已实现完整的锁定态 UI——`locked` 资产显示置灰、锁图标（LockOutlined，Tooltip「当前空间无该资产权限」）、Checkbox 禁用、点击不可勾选（`toggle` 对 locked 直接 return）。但**当前数据流尚未产出 locked 资产**：抽屉只展示本空间经 `/api/tools`、`/api/skills`（按 ws 过滤）注册的资产，且前端把这些资产的 `locked` 硬编码为 `false`；早期内置 mock TOOLS/SKILLS（含 locked:true 样例）已弃用、不再注入抽屉。故锁定态当前在运行时不会出现，AC2/AC3 的渲染逻辑已就绪但缺锁定数据。

#### Acceptance Criteria
1. WHILE 用户浏览工具/技能选择抽屉 系统 SHALL 仅允许选择有权限的资产；🔸当前抽屉数据源 = 本空间已注册资产（按 ws 过滤），权限隔离主要靠"本空间是否注册"承载
2. WHERE 资产无权限（locked=true） 系统 SHALL 显示为锁定状态(灰色 + 锁定图标 + Tooltip)且不可勾选 —— UI 已实现
3. WHEN 用户尝试与锁定资产交互 THEN 系统 SHALL 阻止勾选并以 Tooltip 提示「当前空间无该资产权限」；❓是否额外提示申请方式（待确认）
4. ❓WHERE 资产的 locked 标记 系统 SHALL 由后端按当前用户/空间权限下发 —— 当前前端硬编码 locked=false，待后端补该字段

#### 引用 / 影响
- 术语：AssetPermission, Tool, Skill
- 组件：Drawer(AssetDrawer)、Tooltip、LockOutlined、Checkbox(disabled)、置灰样式
- 现有功能：被 D/E 复用；资产来源见 D(MCP)/E(技能) 的注册/市场

#### 待确认 / 假设
- 已定：权限粒度 = 项目 + 角色 + 资产（见 Spec J）
- ❓locked 标记的真实来源（当前前端写死 false，未由接口下发）

---

### Requirement: 权限数据来源 🔸MVP（demo 可 mock）
**User Story:** 作为系统，我需要知道某用户对哪些资产有权限，以便前端正确渲染可选/锁定态。

#### Acceptance Criteria
1. ❓WHEN 前端加载工具/技能列表 THEN 系统 SHALL 同时返回每项对当前用户的权限标记 —— 当前 `/api/tools`、`/api/skills` 返回 id/name/summary/source/command 等，**未返回权限标记**，前端统一置 locked=false
2. WHERE demo 阶段 系统 MAY 以 mock / 后端按空间隔离数据提供权限标记（当前以「本空间是否注册该资产」隐式承载隔离）

#### 引用 / 影响
- 术语：AssetPermission
- 现有功能：影响 D/E 接口契约（见 dod 接口契约要求）；列表接口 `/api/tools?ws=`、`/api/skills?ws=`

#### 待确认 / 假设
- ❓权限标记随列表返回，还是单独接口（当前两者都无，靠 ws 过滤）

---

### Requirement: 权限分配后台 ⬜后续
**User Story:** 作为管理员，我希望给用户/角色分配资产权限，以便管控谁能用哪些工具和技能。

#### Acceptance Criteria
1. WHEN 管理员为某用户/角色授予资产权限 THEN 系统 SHALL 持久化该授权并即时生效
2. WHEN 管理员撤销权限 THEN 系统 SHALL 使该资产对相关用户变为锁定态
3. WHERE 已被某 Agent 使用的资产被撤权 系统 SHALL ❓（待确认：是否影响已有 Agent）

#### 待确认 / 假设
- 已定：资产权限与 RBAC(Spec J)统一，在「项目 + 角色 + 资产」维度下判定；权限分配后台为 ⬜后续
