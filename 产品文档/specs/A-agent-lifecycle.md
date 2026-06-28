---
name: Agent 生命周期管理
last amended: 2026-06-28
version: 4
description: Agent Operations 列表、Agent 工作台、创建、编辑、删除等全生命周期操作
---

# Agent 生命周期管理 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态标注：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: Agent Operations 列表 ✅已确认
**User Story:** 作为项目成员，我希望以高密度运营列表查看当前空间的 Agent，以便快速判断负责人、线上状态、发布方式、草稿关系和下一步操作。

#### Acceptance Criteria
1. WHEN 用户进入 Agent 页 THEN 系统 SHALL 展示当前空间的 **Agent Operations** 列表，默认按「最近编辑」倒序
2. WHERE 列表 系统 SHALL NOT 展示顶部聚合 KPI 概览条（原 ALL AGENTS、PUBLISHED LIVE、RUNNING LIVE、ATTENTION 四指标已移除）；运营判断改由每行的 Live 状态与 Draft 状态承载，避免顶部聚合指标替用户做发布判断
3. WHERE 每行 Agent 系统 SHALL 展示：名称、描述、Agent id、框架、最近更新时间、创建人/负责人、Live 状态、Draft 状态、操作入口
4. WHERE Agent 行 系统 SHALL **不展示大模型字段**；模型属于配置详情，不是列表页主决策信息
5. WHERE Live 状态 系统 SHALL 展示该 Agent 是否未发布、运行中、已停止、部署中或失败，并在二级信息中展示 Live 版本与部署方式（如 共享(L1)、独立(L2)）
6. WHERE Draft 状态 系统 SHALL 展示 Head 与 Live 的关系：仅草稿、与 Live 一致、与 Live 不同；该状态只是事实陈述，不等价于“必须发布”
7. WHEN 用户切换当前空间(见 Spec K) THEN 系统 SHALL 刷新列表为新空间内的 Agent，并清空搜索/过滤条件
8. WHEN 用户在搜索框输入关键词 THEN 系统 SHALL 按名称或描述实时过滤
9. WHEN 用户使用过滤器 THEN 系统 SHALL 支持按创建人过滤、按 Live 状态过滤、按「Draft 与 Live 不同」过滤
10. WHEN 用户切换排序方式 THEN 系统 SHALL 支持按「最近编辑」和「名称」排序
11. WHEN 列表为空 THEN 系统 SHALL 展示空状态与「创建 Agent」引导
12. WHERE Agent 行 系统 SHALL 不把整行点击作为进入入口；进入工作台仅通过明确的「管理」按钮，避免与行选择/表格操作产生歧义
13. WHERE 行操作区 系统 SHALL 提供「管理」与「删除」；删除需二次确认并执行软删除（见删除需求）

#### 引用 / 影响
- 术语：Agent, Framework, HeadVersion, LiveVersion, DraftStatus, Workspace, Creator, DeploymentMode
- 组件：Table、Input.Search、Select(创建人/Live 状态/排序)、Empty、Popconfirm
- 现有功能：作用域为当前空间(见 Spec K)；Live/运行态/部署方式见 Spec I；版本关系见 Spec F
- 设计决策：列表页只回答“谁负责、线上是否可用、发布方式是什么、草稿与线上是否一致、是否有异常”；配置细节（模型、参数、工具/技能）放进工作台

#### 待确认 / 假设
- 假设：默认排序为「最近编辑」倒序
- 假设：列表始终限定在当前空间；创建的 Agent 归属当前空间

---

### Requirement: Agent 工作台 / 详情 ✅已确认
**User Story:** 作为项目成员，我希望进入单个 Agent 的工作台，在同一处完成查看、编辑、试跑、发布、版本与回滚，以便遵循「创建 → 调试 → 发布 → 更新」的完整动线。

#### Acceptance Criteria
1. WHEN 用户在列表点击「管理」 THEN 系统 SHALL 进入该 Agent 的工作台，而非再展示一个与编辑页分离的详情页
2. WHERE 工作台顶部 系统 SHALL 展示返回、名称、框架、当前 Head 版本、版本与回滚入口，以及主操作「保存为新版本」
3. WHERE 工作台左侧 系统 SHALL 展示并允许编辑描述、框架（仅创建时可改）、模型、参数、指令文件、工具与技能绑定
4. WHERE 工作台右侧 系统 SHALL 常驻展示「线上发布与运行」与「试跑」两块；线上发布与运行必须区分 Head、Live、Runtime 三个概念
5. WHERE Agent 已有多个版本 系统 SHALL 提供「版本与回滚」入口，可查看历史版本、对比版本、直接发布某历史版本或载入历史配置生成新版本（见 Spec F）
6. IF 用户无该 Agent 权限 THEN 系统 SHALL 阻止进入并提示无权限

#### 引用 / 影响
- 术语：Agent, Version, HeadVersion, LiveVersion, Service, ConfigPreview, Tool, Skill
- 组件：AgentWorkbench、Tabs、Monospace Editor、Drawer、Segmented、VersionHistory Drawer
- 现有功能：与版本管理(F)、配置预览(G)联动
- 设计决策：详情、编辑、发布与回滚收敛到同一个 Agent 工作台，避免“点行”和“进入控制台”等重复入口

---

### Requirement: 创建 Agent ✅已确认
> 交互更新：从「分步表单」改为**双栏 Builder**（单页，不分步）。左栏为配置区（基本信息/框架/模型/参数/配置文件/工具技能），右栏为线上发布与运行、试跑。创建只负责生成 v1，不自动发布。

**User Story:** 作为项目成员，我希望在一个双栏 Builder 中创建新的 Agent，并根据框架类型配置差异化的配置文件、随手调试，以便高效定义 Agent 的行为和能力。

#### Acceptance Criteria
1. WHEN 用户点击"创建 Agent"按钮 THEN 系统 SHALL 导航至 Agent 创建页面
2. WHEN 用户进入创建页面 THEN 系统 SHALL 在工作台元信息区展示紧凑框架选择控件，包含 Claude Code(可选)、OpenClaw(可选)、Custom(禁用,标注"coming soon")、Hermes(禁用)
3. WHERE 任意可选框架 系统 SHALL 均展示模型选择区（所有框架都需选择模型，见 Spec C）
4. WHERE 用户选择 Claude Code 系统 SHALL 展示：基本信息(名称必填,中英文均可,2-50字符;描述选填)、模型选择、配置编辑器(claude.md,等宽字体,默认模板预填)、工具选择(抽屉)、技能选择(抽屉)、配置预览入口（次级工具，见 Spec G）
5. WHERE 用户选择 OpenClaw 系统 SHALL 展示：基本信息(同上)、模型选择、user.md / agent.md / role.md 三个独立配置编辑器(均默认模板预填)、工具选择(同上)、技能选择(同上)、配置预览入口（同上）
6. WHEN 用户填写完所有必填项并点击「创建 Agent」 THEN 系统 SHALL 创建 Agent 及其初始版本(v1)，并停留在该 Agent 工作台
6a. WHERE 刚创建的 Agent 系统 SHALL 处于「未发布 / 无 Live 版本」状态；用户可先试跑当前配置，再选择是否发布
7. WHILE Agent 名称已创建 系统 SHALL 禁止修改该 Agent 的名称
8. IF 名称为空或不符合 2-50 字符规则 THEN 系统 SHALL 阻止保存并行内提示
9. IF 名称已存在 THEN 系统 SHALL 阻止保存并提示重名

#### 引用 / 影响
- 术语：Agent, Framework, ConfigFile, Version, Tool, Skill, ConfigPreview
- 组件：AgentWorkbench、Segmented(框架)、Select(模型)、Monospace Editor、Drawer
- 现有功能：与框架(B)、模型(C)、工具(D)、技能(E)、预览(G)联动
- 设计决策：所有框架均含模型选择；配置编辑器默认预填框架模板（见 Spec B）

#### 待确认 / 假设
- 假设：必填项 = 名称 + 框架 + 模型 + 至少 claude.md/role.md 等核心配置非空（具体必填项待 B 细化）

---

### Requirement: 编辑 Agent ✅已确认
> 交互：复用创建用的**双栏 Builder**；名称只读；右栏「试跑」可在当前配置与线上服务之间切换。

**User Story:** 作为项目成员，我希望在双栏 Builder 中基于某个版本修改配置、随手调试并保存为新版本，以便调优 Agent 的行为表现。

#### Acceptance Criteria
1. WHEN 用户点击「编辑」进入编辑页 THEN 系统 SHALL 以工作副本预填配置，默认取自最新版本(vN)，名称字段 SHALL 显示为只读
2. WHERE 用户从某历史版本进入编辑 系统 SHALL 以该历史版本配置作为工作副本（此即回滚路径，见 Spec F）
3. WHEN 用户修改配置并点击「保存为新版本」 THEN 系统 SHALL 创建新版本(版本号 +1)并设为 Head，历史版本保持只读不变
4. IF 工作副本相对来源版本无任何变更 THEN 系统 SHALL 禁用保存按钮，不生成新版本
5. WHILE 工作副本存在未保存修改 系统 SHALL 禁止直接发布，并提示「先保存为新版本，再选择是否发布」
6. WHEN 用户在有未保存修改时离开编辑页 THEN 系统 SHALL 二次确认

#### 引用 / 影响
- 术语：Agent, Version, HeadVersion, ConfigFile
- 组件：同创建页（复用）、Modal(离开确认)
- 现有功能：与版本管理(F)联动
- 设计决策（版本模型）：编辑始终基于某版本的工作副本→保存生成 N+1→历史只读；无变更不生成版本

---

### Requirement: 保存草稿 ⬜后续（本期不做，后续版本再实现）
> 决策：草稿与版本两条线虽清晰，但本期为聚焦核心流程暂不做；demo 已移除相关 UI。下方需求保留为后续设计依据。
> 注意：本需求里的“保存草稿”是未提交工作副本的持久化；它不同于 Agent Operations 列表里的 **Draft 状态**（Head 与 Live 的关系）。

**User Story:** 作为项目成员，我希望在创建/编辑 Agent 过程中保存草稿，以便未完成时先存着、之后接着改，而不立即生成版本。

#### Acceptance Criteria
1. WHERE 创建/编辑页 系统 SHALL 提供「保存草稿」操作，与「保存为新版本/创建」并列
2. WHEN 用户点击保存草稿 THEN 系统 SHALL 暂存当前全部配置为草稿，且 SHALL NOT 生成新版本、SHALL NOT 改变 Agent 当前版本
3. WHEN 用户重新进入该 Agent 的编辑（或新建）THEN 系统 SHALL 优先以草稿内容预填，并提示"正在编辑草稿（保存时间）"
4. WHERE 存在草稿 系统 SHALL 在列表对应 Agent 上以「草稿」标记提示；新建草稿 SHALL 在列表提供「继续编辑/放弃」入口
5. WHEN 用户放弃草稿 THEN 系统 SHALL 丢弃草稿：编辑态回到最新版本、新建态清空
6. WHEN 用户正式「保存为新版本/创建」THEN 系统 SHALL 提交并清除对应草稿

#### 引用 / 影响
- 术语：Agent, Version
- 组件：Button（保存草稿）、Tag（草稿标记）、提示 Banner
- 现有功能：与编辑/创建、版本(F)联动
- 设计决策：草稿不占版本号；草稿与版本是两条线——草稿是"未提交的工作副本"，版本是"已提交的快照"

#### 待确认 / 假设
- ❓草稿存储位置与多端同步（本期 demo 为前端内存；生产可后端持久化）
- ❓是否自动保存草稿（本期手动；自动保存可后续）
- 假设：每个 Agent 至多一份编辑草稿；另有一份"新建草稿"

---

### Requirement: 复制 Agent ⬜后续
**User Story:** 作为项目成员，我希望基于现有 Agent 快速复制一个新 Agent，以便在相似配置上做改动而不从零开始。

#### Acceptance Criteria
1. WHERE 用户对某 Agent 有权限 系统 SHALL 提供「复制」入口；无权限的 Agent 不可复制
2. WHEN 用户对某 Agent 选择「复制」 THEN 系统 SHALL 以其最新版本配置预填创建页，名称要求重新填写
3. WHERE 源 Agent 含工具/技能 系统 SHALL 仅复制当前用户**有权限**的工具/技能，无权限项自动剔除并提示被剔除项
4. WHEN 用户保存复制出的 Agent THEN 系统 SHALL 作为全新 Agent 创建并生成其 v1

#### 引用 / 影响
- 术语：Agent, Version, Tool, Skill, AssetPermission
- 现有功能：与权限(H)联动
- 设计决策：仅能复制有权限的 Agent；复制时无权限资产剔除并提示

---

### Requirement: 删除 Agent（软删） ✅已确认
**User Story:** 作为项目成员，我希望删除不再需要的 Agent，同时保留可追溯性，以便管理列表又不丢失记录。

#### Acceptance Criteria
1. WHEN 用户对某 Agent 选择「删除」 THEN 系统 SHALL 二次确认后执行**软删除**：标记为已删除、从列表隐藏，但数据与版本保留
2. WHERE Agent 已软删 系统 SHALL 不再在常规列表与选择项中出现
3. WHEN 软删发生 THEN 系统 SHALL 记录删除人与时间（为后续审计预留）

#### 引用 / 影响
- 术语：Agent
- 组件：Popconfirm/Modal
- 设计决策：软删，不做硬删；本期不引入"停用"语义

#### 待确认 / 假设
- ⬜后续：软删数据的恢复/彻底清理入口（本期不做）
