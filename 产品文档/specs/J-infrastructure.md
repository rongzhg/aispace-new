---
name: 基础设施
last amended: 2026-06-24
version: 2
description: 登录与 SSO、项目/工作空间、角色权限（RBAC）、审计日志
---

# 基础设施 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 关键概念：项目（工作空间）与角色

- **项目（Project / 工作空间）**：平台的权限与协作边界。所有资产（Agent、MCP 工具、Skill）都归属于项目并按项目做权限管理。
- **新用户默认项目**：每个新用户开通时获得一个默认项目作为其工作空间。
- **角色（三类）**：

| 角色 | 范围 | 主要能力 |
|---|---|---|
| 平台管理员 | 全平台 | 管理所有项目与用户、分配角色、管理全平台资产 |
| 项目管理员（空间 Owner） | 单个项目空间 | 管理本空间成员、配置本空间内资产权限；一个空间可有多个 |
| 项目成员（空间 Member） | 单个项目空间 | 在空间内创建/使用其有权限的 Agent 与资产 |

> 项目空间的创建、查询、成员管理与切换详见 **Spec K**。本 Spec 聚焦登录/SSO、RBAC 判定与审计。

## MODIFIED Requirements

### Requirement: 登录与身份 🔸MVP（demo 免登录）
**User Story:** 作为用户，我希望登录平台，以便系统识别我的身份并据此控制权限。

#### Acceptance Criteria
1. WHERE 生产环境 系统 SHALL 对接集团统一 SSO 完成登录
2. WHEN 登录成功 THEN 系统 SHALL 在后续请求中携带其身份（用户、角色、所属项目）用于权限判断
3. WHERE demo 阶段 系统 SHALL 免真实登录，以 mock 当前用户（含角色与默认项目）替代

#### 引用 / 影响
- 术语：AssetPermission, Project
- 现有功能：为 H 权限判断、RBAC 提供身份上下文

#### 设计决策
- 生产对接集团 SSO；demo 不做真实登录，用 mock 用户上下文。

---

### Requirement: 默认空间 ✅已确认（详细见 Spec K）
**User Story:** 作为新用户，我希望开通即拥有一个工作空间，以便立即开始使用。

#### Acceptance Criteria
1. WHEN 新用户开通 THEN 系统 SHALL 为其创建一个默认项目空间，并将其设为该空间 Owner
2. WHERE 资产（Agent、MCP 工具、Skill）存在 系统 SHALL 使其归属于某空间并按空间隔离

#### 引用 / 影响
- 术语：Workspace, DefaultWorkspace, Owner
- 现有功能：空间的增查/成员/切换详见 Spec K

---

### Requirement: 角色权限 RBAC ✅已确认（模型）/ ⬜后续（管理后台）
**User Story:** 作为管理员，我希望按角色与项目控制功能与资产访问，以便分级管控。

#### Acceptance Criteria
1. WHERE 用户具备某角色 系统 SHALL 据角色（平台管理员 / 项目管理员 / 项目成员）开放对应功能
2. WHERE 平台管理员 系统 SHALL 可管理所有项目、用户与全平台资产、并分配角色
3. WHERE 项目管理员 系统 SHALL 可管理本项目成员与本项目内资产权限
4. WHERE 项目成员 系统 SHALL 可在项目内创建/使用其有权限的 Agent 与资产
5. WHEN 用户访问无权限功能或资产 THEN 系统 SHALL 拒绝并提示
6. WHERE 资产权限(见 Spec H) 系统 SHALL 在「项目 + 角色 + 资产」三维度下统一判定

#### 引用 / 影响
- 术语：AssetPermission, Project
- 现有功能：与 H（资产权限消费）一致；角色管理后台属后续
- 设计决策：角色与项目模型本期确认；完整权限管理后台 ⬜后续；demo 用 mock 角色/项目上下文驱动锁定态(见 H)

#### 待确认 / 假设
- 已定：三角色 + 默认项目 + 资产按项目权限管理
- ⬜后续：角色/权限分配的管理后台 UI

---

### Requirement: 审计日志 ⬜后续（不在本期）
**User Story:** 作为管理员，我希望记录关键操作，以便合规追溯。

#### Acceptance Criteria
1. WHEN 用户执行关键写操作（Agent 创建/编辑/删除/复制、发布、版本回滚、权限授予/撤销、角色变更、资产注册）THEN 系统 SHALL 记录：操作人、角色、所属项目、对象类型+ID、动作、时间，可选前后差异摘要
2. WHERE 审计数据 系统 SHALL 以 append-only 方式存储，不可篡改
3. WHEN 管理员查询审计 THEN 系统 SHALL 支持按项目/对象/人/时间筛选

#### 设计决策（推荐方案，本期不做）
- 留存：热数据 90 天在线可查，冷归档保留 1 年（或按集团合规口径，通常 6–12 个月），周期可配置。
- 范围：仅关键写操作；读操作不入审计。

#### 待确认 / 假设
- ⬜后续：本期不实现，方案已记录待启用
