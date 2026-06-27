---
name: 权限与资产管理
last amended: 2026-06-24
version: 2
description: 资产（Agent/Tool/Skill）访问权限模型、锁定态展示、权限分配后台
---

# 权限与资产管理 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 权限粒度（已落定，见 Spec J）

资产权限在 **「项目 + 角色 + 资产」** 三维度下判定：所有资产（Agent、MCP 工具、Skill）归属项目并按项目隔离；用户在项目内的角色（平台管理员 / 项目管理员 / 项目成员）决定其对资产的可见与可用。

## MODIFIED Requirements

### Requirement: 资产权限消费（锁定态） ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望只能选择我有权限的工具和技能，以便平台资产受控使用。

#### Acceptance Criteria
1. WHILE 用户浏览工具/技能列表 系统 SHALL 仅允许选择有权限的资产
2. WHERE 资产无权限 系统 SHALL 显示为锁定状态(灰色 + 锁定图标)且不可勾选
3. WHEN 用户尝试与锁定资产交互 THEN 系统 SHALL ❓（待确认：是否提示申请方式）

#### 引用 / 影响
- 术语：AssetPermission, Tool, Skill
- 组件：Tooltip、LockOutlined、置灰样式
- 现有功能：被 D/E 复用

#### 待确认 / 假设
- 已定：权限粒度 = 项目 + 角色 + 资产（见 Spec J）

---

### Requirement: 权限数据来源 🔸MVP（demo 可 mock）
**User Story:** 作为系统，我需要知道某用户对哪些资产有权限，以便前端正确渲染可选/锁定态。

#### Acceptance Criteria
1. WHEN 前端加载工具/技能列表 THEN 系统 SHALL 同时返回每项对当前用户的权限标记
2. WHERE demo 阶段 系统 MAY 以 mock 数据提供权限标记

#### 引用 / 影响
- 术语：AssetPermission
- 现有功能：影响 D/E 接口契约（见 dod 接口契约要求）

#### 待确认 / 假设
- ❓权限标记随列表返回，还是单独接口

---

### Requirement: 权限分配后台 ⬜后续
**User Story:** 作为管理员，我希望给用户/角色分配资产权限，以便管控谁能用哪些工具和技能。

#### Acceptance Criteria
1. WHEN 管理员为某用户/角色授予资产权限 THEN 系统 SHALL 持久化该授权并即时生效
2. WHEN 管理员撤销权限 THEN 系统 SHALL 使该资产对相关用户变为锁定态
3. WHERE 已被某 Agent 使用的资产被撤权 系统 SHALL ❓（待确认：是否影响已有 Agent）

#### 待确认 / 假设
- 已定：资产权限与 RBAC(Spec J)统一，在「项目 + 角色 + 资产」维度下判定；权限分配后台为 ⬜后续
