---
name: 项目空间
last amended: 2026-06-28
version: 2
description: 项目空间（工作空间）的创建、查询、成员管理（多 Owner）、当前空间上下文与侧边栏切换
---

# 项目空间 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 关键概念

- **项目空间（Workspace）**：权限与协作的边界。所有资产（Agent、MCP 工具、Skill）归属某空间并按空间隔离。
- **角色映射**：空间内有两类角色——**Owner**（即"项目管理员"，可管理成员与资产，**一个空间可有多个 Owner**）和**Member**（即"项目成员"）。平台管理员凌驾于所有空间之上（见 Spec J）。
- **当前空间**：用户的所有操作都发生在某个"当前空间"上下文下，可切换。
- **默认空间**：新用户开通时自带一个默认空间（见 Spec J）。

## MODIFIED Requirements

### Requirement: 创建项目空间（仅平台管理员） ✅已确认
> 决策：创建项目空间是**平台管理员专属**操作；非管理员看不到入口、也不能创建。

**User Story:** 作为平台管理员，我希望创建新的项目空间，以便为不同团队/业务划分独立的工作与权限边界。

#### Acceptance Criteria
1. WHERE 当前用户为平台管理员 系统 SHALL 展示「新建项目空间」入口；非管理员 SHALL NOT 看到该入口
2. WHEN 管理员点击"新建项目空间" THEN 系统 SHALL 弹出表单，要求填写空间名称（必填）；空间描述为后续能力，不属于 MVP 必填项
3. WHEN 管理员提交合法表单 THEN 系统 SHALL 创建空间，并将其设为该空间 Owner
4. IF 空间名称为空或不合法 THEN 系统 SHALL 阻止提交并行内提示
5. IF 非管理员尝试创建（如直接调接口）THEN 系统 SHALL 拒绝
6. WHEN 空间创建成功 THEN 系统 SHALL 将其加入空间列表

#### 引用 / 影响
- 术语：Workspace, Owner, PlatformAdmin
- 组件：Modal、Input；入口按平台管理员显示
- 现有功能：与 J（角色/默认空间）、H（资产归属空间）联动；创建空间须校验平台管理员

#### 设计决策
- demo 当前 mock 用户为平台管理员（前端 `isPlatformAdmin`），故可见入口；生产由 SSO/RBAC 决定，且后端须校验。

#### 待确认 / 假设
- ❓空间名称是否全局唯一（假设：全局唯一）
- 已定：创建空间仅平台管理员

---

### Requirement: 查询 / 列出项目空间 ✅已确认
**User Story:** 作为用户，我希望查看我所属的项目空间列表，以便在其中切换与管理。

#### Acceptance Criteria
1. WHEN 用户打开空间切换器 THEN 系统 SHALL 展示其所属的全部空间名称，并标识当前空间
2. WHERE 当前用户为平台管理员 系统 SHALL 在空间切换器底部展示「新建项目空间」入口
3. WHERE 平台管理员 系统 SHALL 可查询全平台所有空间（见 Spec J）

#### 引用 / 影响
- 术语：Workspace, Owner, Member
- 组件：Table/List、Input.Search、Tag

#### 待确认 / 假设
- 已定：MVP 在侧边栏空间切换器内承载；独立空间管理页后续再做

---

### Requirement: 空间成员管理（增删改，多 Owner） ✅已确认
**User Story:** 作为空间 Owner，我希望增删改本空间成员及其角色，以便控制谁能进入和管理该空间。

#### Acceptance Criteria
1. WHERE 用户为某空间 Owner 系统 SHALL 允许其管理该空间成员；非 Owner 仅可查看成员
2. WHEN Owner 添加成员 THEN 系统 SHALL 按用户标识加入该成员并指定其角色（Owner 或 Member）
3. WHEN Owner 修改某成员角色 THEN 系统 SHALL 更新其角色，且允许将多个成员设为 Owner（一个空间可有多个 Owner）
4. WHEN Owner 移除某成员 THEN 系统 SHALL 二次确认后将其移出空间
5. IF 操作将导致空间没有任何 Owner THEN 系统 SHALL 阻止该操作并提示（空间至少保留一名 Owner）
6. WHERE 成员被移除 系统 SHALL 使其失去该空间内资产的访问权

#### 引用 / 影响
- 术语：Workspace, Owner, Member, AssetPermission
- 组件：Table、Modal、Select(角色)、Popconfirm
- 现有功能：与 H（资产权限）、J（RBAC）一致

#### 待确认 / 假设
- ❓成员来源：从集团目录搜索添加，还是邀请制（假设：按用户标识/目录搜索添加）

---

### Requirement: 当前空间上下文与切换 ✅已确认
**User Story:** 作为用户，我希望始终在某个当前空间下操作，并能切换空间，以便在不同工作边界间转换。

#### Acceptance Criteria
1. WHILE 用户已登录 系统 SHALL 始终处于某个"当前空间"上下文；首次进入默认选中其默认空间
2. WHERE 左侧导航顶部 系统 SHALL 提供空间切换器，展示当前空间并可切换至其所属的其他空间
3. WHEN 用户切换当前空间 THEN 系统 SHALL 使后续所有操作（Agent 列表、资产选择、创建等）作用于新当前空间
4. WHERE 所有资产相关操作 系统 SHALL 限定在当前空间范围内（Agent、工具、技能均按当前空间过滤）
5. WHERE demo 阶段 系统 MAY 仅含默认空间，切换器可展示但不强求多空间

#### 引用 / 影响
- 术语：Workspace
- 组件：左侧导航空间切换器（Select/Dropdown）
- 现有功能：是 A（Agent 列表）、D/E（资产选择）、H（权限）的作用域上下文

#### 设计决策
- 用户操作必须绑定当前空间；空间是 A/D/E/H 的统一作用域。
