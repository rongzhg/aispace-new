---
name: 技能
last amended: 2026-06-28
version: 7
description: 技能选择抽屉、Skill 页面（新建技能弹窗上传/解析 SKILL.md/技能卡片/详情页目录树/软删除/空间归属/用户注册技能）
---

# 技能 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: 技能选择 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望从分类组织的技能列表中选择有权限的技能，以便精准扩展 Agent 的能力。

#### Acceptance Criteria
1. WHEN 用户在创建/编辑页点击"选择技能"按钮 THEN 系统 SHALL 打开技能选择抽屉，按分类分区展示技能列表，每个技能显示名称、描述、分类标签，顶部提供搜索框支持按名称过滤
2. WHILE 用户浏览技能列表 系统 SHALL 仅允许选择用户有权限的资产，无权限资产 SHALL 显示为锁定状态(灰色 + 锁定图标)且不可勾选
3. WHEN 用户在抽屉中完成选择并确认 THEN 系统 SHALL 更新已选技能列表，并在主页面以 Tag 形式展示已选项名称和数量
4. WHEN 用户移除某个已选技能 Tag THEN 系统 SHALL 从已选列表中移除该技能
5. WHEN 搜索无匹配 THEN 系统 SHALL 展示空状态

#### 引用 / 影响
- 术语：Skill, AssetPermission
- 组件：Drawer、Input.Search、Checkbox/List、Tag、Tooltip、LockOutlined
- 现有功能：与权限(H)联动；与工具选择(D)交互一致

#### 待确认 / 假设
- ❓技能与工具的交互/视觉是否完全复用同一套抽屉组件（建议复用）

---

### Requirement: Skill 页面 🔸MVP
**User Story:** 作为项目成员，我希望在「Skill」页面里**上传技能包**把技能加入当前空间，以便创建/编辑本空间 Agent 时能直接选用。

> 关键约定：
> - **技能 = 一个 SKILL.md**（Claude Agent Skill 规格）：name + description（决定 Claude 何时调用）+ 正文。
> - Skill 页面**只承载用户自己注册的技能**——通过**上传技能包**（含 SKILL.md 的 tar/zip）创建；不展示公共注册表技能。
> - **技能归属于操作时所在的空间(Workspace)**，仅该空间的 Agent 可见可选；空间之间互不可见。

#### Acceptance Criteria
1. WHERE 平台导航 系统 SHALL 提供独立「Skill」入口；WHERE Skill 页面 系统 SHALL 提供「新建技能」按钮，并以**卡片**列出本空间已注册的技能；每张卡片含名称、描述、文件数、**创建人与创建时间**，以及主操作「详情」与次级的「删除」（删除为弱化的小图标，避免喧宾夺主）；显示当前空间
2. WHEN 用户点击「新建技能」 THEN 系统 SHALL 弹出对话框，内含**上传技能包**区域（.zip / .tar / .tar.gz）
3. WHEN 用户上传技能包 THEN 系统 SHALL 自动在包内定位 SKILL.md，解析 frontmatter 提取 **name** 与 **description**（及可选 allowed-tools 与正文）
4. IF 包内无 SKILL.md，或 name 不合规（非小写字母/数字/连字符、超 64、含保留词 anthropic/claude），或缺 description THEN 系统 SHALL 拒绝并给出明确原因
5. WHEN 解析成功 THEN 系统 SHALL 把该技能登记进**当前空间**的技能目录，并在该空间创建/编辑 Agent 的技能选择中可见、可选
6. WHEN 用户点击某技能卡片的「详情」 THEN 系统 SHALL 进入**独立详情页面**，以**目录树**展示该技能包内容，点击文件可查看其文本内容
7. WHEN 用户点击某技能卡片的「删除」并确认 THEN 系统 SHALL **软删除**该技能：从当前空间的可见列表与 Agent 技能选择中移除，但保留其记录与上传存档（可追溯；重新上传同名技能即恢复）；不影响其它空间与已选用它的 Agent 配置
8. WHERE Skill 页面 系统 SHALL 只展示当前空间上传的技能；WHERE Agent 技能选择抽屉 系统 MAY 同时展示平台内置技能与当前空间上传技能，但不得展示其它空间的技能
9. WHERE 同一技能在不同空间 系统 SHALL 允许各空间独立上传/移出、互不影响

#### 引用 / 影响
- 术语：Skill（= 一个 SKILL.md：name + description + 正文，详见 Agent Skills 开放标准）, Agent, Workspace
- 现有功能：与「技能选择」（本 Spec 上文）联动——本空间加入/注册的技能进入技能选择抽屉
- 设计决策：技能对齐 Claude Agent Skill（SKILL.md）规格；技能库来源（公共注册表）、SKILL.md 渲染、空间隔离的落库方式等实现细节见 ../../技术文档/
- 参考：Agent Skills 概览 https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

#### 待确认 / 假设
- 已定：上传/注册/移出为项目成员自助；归属空间；Skill 页面不再作为“市场总入口”，而是独立导航
- ⬜后续：加入/注册时把技能实体真正拉取/安装到运行环境（当前为登记进可选目录）；与「技能注册 / 上传」打通

---

### Requirement: 技能运行安装与高级注册 ⬜后续
**User Story:** 作为管理员/项目成员，我希望上传后的技能能被安装进运行环境并支持更完整的注册治理，以便扩充平台技能能力。

#### Acceptance Criteria
1. WHEN 技能上传并登记成功 THEN 系统 SHALL 在目标运行环境中物化该技能包，使 Agent 运行时可真正调用
2. WHERE 技能存在 allowed-tools 等运行约束 系统 SHALL 在安装与运行时遵守该约束
3. WHERE 管理员治理技能目录 系统 SHALL 支持审核、版本、下架与恢复

#### 待确认 / 假设
- ❓技能版本升级对已发布 Agent 的影响策略
- ❓是否需要平台级公共技能库与审批流
