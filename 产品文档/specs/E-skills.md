---
name: 技能
last amended: 2026-06-29
version: 8
description: 技能选择抽屉、Skill 页面（新建技能弹窗上传/解析 SKILL.md/技能卡片/KPI 概览/平台全局技能/详情页目录树+文件内容+SKILL.md 兜底/软删除/空间归属/用户注册技能）
---

# 技能 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: 技能选择 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望从分类组织的技能列表中选择有权限的技能，以便精准扩展 Agent 的能力。

#### Acceptance Criteria
1. WHEN 用户在创建/编辑页点击"选择技能"按钮 THEN 系统 SHALL 打开技能选择抽屉（`AssetDrawer`，type=skill，宽 440），按分区标题分组展示技能列表，每个技能显示名称与描述，顶部提供搜索框支持按名称过滤 ✅已确认
2. WHERE 抽屉数据来源 系统 SHALL **只拉取本空间已注册/上传的技能**（`GET /api/skills?ws=`），不再混入内置 mock 技能；分区标题按来源给出（如「本空间 · 技能」「本空间 · 自定义技能」），而非按用户自定义业务分类 ✅已确认
3. WHEN 用户在抽屉中完成选择并确认 THEN 系统 SHALL 更新已选技能列表，并在主页面以 Tag 形式展示已选项名称和数量 ✅已确认
4. WHEN 用户移除某个已选技能 Tag THEN 系统 SHALL 从已选列表中移除该技能 ✅已确认
5. WHEN 搜索无匹配 THEN 系统 SHALL 展示空状态（Empty「无匹配」） ✅已确认
6. WHERE 锁定/权限态 系统 SHALL 在抽屉内保留锁定渲染能力（灰显 + LockOutlined + 不可勾选）；当前实现下本空间技能一律 `locked:false`，权限联动尚未接入 ❓待确认

#### 引用 / 影响
- 术语：Skill, AssetPermission
- 组件：`AssetDrawer`（Drawer + Input(SearchOutlined) + Checkbox + Tag + Tooltip + LockOutlined + Empty）
- 实现：`components.tsx` `AssetDrawer`（与工具完全复用同一组件，type 区分）；mock `SKILLS`/`TOOLS` 已弃用但仍被旧版本/差异视图的名称回显引用
- 现有功能：与「Skill 页面」联动——本空间上传/注册的技能进入此抽屉；与工具选择(D)复用同一抽屉

#### 待确认 / 假设
- ✅已确认：技能与工具复用同一套抽屉组件（`AssetDrawer`，仅 type 不同）
- ❓权限锁定（H）尚未在抽屉接入：现状全部可选

---

### Requirement: Skill 页面 🔸MVP
**User Story:** 作为项目成员，我希望在「Skill」页面里**上传技能包**把技能加入当前空间，以便创建/编辑本空间 Agent 时能直接选用。

> 关键约定：
> - **技能 = 一个 SKILL.md**（Claude Agent Skill 规格）：name + description（决定 Claude 何时调用）+ 正文。
> - Skill 页面**只承载用户自己注册的技能**——通过**上传技能包**（含 SKILL.md 的 tar/zip）创建；不展示公共注册表技能。
> - **技能归属于操作时所在的空间(Workspace)**，仅该空间的 Agent 可见可选；空间之间互不可见。

#### Acceptance Criteria
1. WHERE 平台导航 系统 SHALL 提供独立「Skill」入口（侧栏，BulbOutlined）；Skill 页面顶部 SHALL 展示标题「技能」+ 副标题（说明：本空间可用的 Agent Skill，打包上传含 `SKILL.md` 的目录，在创建/编辑 Agent 时绑定），右上提供「刷新」与「新建技能」两个按钮 ✅已确认
2. WHERE Skill 页面 系统 SHALL 在标题下展示一行 KPI 概览：**可用技能** 总数、**平台全局**（`scope==='platform'`，所有空间共享）数、**本空间私有**数（= 总数 − 平台全局数） 🔸MVP
3. WHERE 技能列表 系统 SHALL 以**卡片网格**（auto-fill, 最小 320px 列）列出本空间可用技能；每张卡片含名称、技能 id（`sub`，等宽小字）、描述（最多 3 行）、**创建人与创建时间**（`creator · added_at`），以及一个右上角徽标 ✅已确认
4. WHERE 卡片徽标 系统 SHALL 按技能类型给出：平台全局技能显示「全局」（蓝底）；上传包技能显示「N 文件」（文件数 = tree 中非目录条目数）；其它来源显示来源名（`custom` → 「自定义」，否则原值） 🔸MVP
5. WHERE 卡片附加信息（meta） 系统 SHALL 在技能含 `allowed_tools` 时以小标签列出其声明的工具 🔸MVP
6. WHERE 卡片操作 系统 SHALL 提供主操作「详情」与次级「删除」；删除按钮在有「详情」主操作时退化为弱化的危险色小图标（DeleteOutlined），避免喧宾夺主 ✅已确认
7. WHERE 平台全局技能 系统 SHALL 在本空间**不可删除**（不渲染删除入口）；仅本空间私有技能可删除 🔸MVP
8. WHEN 用户点击「新建技能」 THEN 系统 SHALL 弹出对话框，内含说明（技能 = 含 `SKILL.md` 的目录）与**上传技能包**拖拽区（.zip / .tar / .tar.gz；包内根目录或子目录需含 SKILL.md） ✅已确认
9. WHEN 用户上传技能包 THEN 系统 SHALL 以 multipart（字段 `file` + `creator`=当前用户名）POST 至 `POST /api/market/skills/upload?ws=`，由后端在包内定位 SKILL.md，解析 frontmatter 提取 **name** 与 **description**（及可选 allowed-tools 与正文） ✅已确认
10. IF 包内无 SKILL.md，或 name 不合规（非小写字母/数字/连字符、超 64、含保留词 anthropic/claude），或缺 description THEN 系统 SHALL 拒绝并以 toast 给出后端返回的明确原因（`detail`） ✅已确认
11. WHEN 解析成功 THEN 系统 SHALL 把该技能登记进**当前空间**的技能目录，toast 提示新建的技能名、文件数与 SKILL.md 路径，关闭弹窗并刷新列表；该技能即在本空间创建/编辑 Agent 的技能选择中可见、可选 ✅已确认
12. WHEN 用户点击某技能卡片的「详情」 THEN 系统 SHALL 进入**独立详情页面**（非弹窗，`SkillTreePage`）：顶部「返回技能列表」+ 技能名 + 来源标签（upload→上传包 / custom→自定义 / 其它原值）+ 技能 id + 描述；下方为「技能文件」区 ✅已确认
13. WHERE 详情页技能文件区 IF 技能含上传包文件（`tree` 非空） THEN 系统 SHALL 左侧以目录树（DirectoryTree，目录在前、默认展开、叶子显示字节数）展示，点击文件经 `GET /api/skills/{id}/file?ws=&path=` 拉取并在右侧 `<pre>` 中展示其文本内容（含加载态与读取失败提示） ✅已确认
14. WHERE 详情页技能文件区 IF 技能无上传包文件 THEN 系统 SHALL 退化为直接展示该技能的 `SKILL.md` 全文（`skill.skill_md`） 🔸MVP
15. WHEN 用户点击某技能卡片的「删除」并确认 THEN 系统 SHALL 经 Popconfirm（文案「删除技能「name」？（软删除，可重新上传同名恢复）」）确认后 `DELETE /api/skills/{id}?ws=` **软删除**：从当前空间的可见列表与 Agent 技能选择中移除，但保留记录与上传存档（重新上传同名技能即恢复）；不影响其它空间与已选用它的 Agent 配置 ✅已确认
16. WHERE Skill 页面 系统 SHALL 只展示当前空间可用技能（本空间上传 + 平台全局）；WHERE Agent 技能选择抽屉 系统 SHALL 只展示本空间技能，不得展示其它空间的技能 ✅已确认
17. WHERE 同一技能在不同空间 系统 SHALL 允许各空间独立上传/移出、互不影响 ✅已确认
18. WHEN 本空间无任何技能 THEN 系统 SHALL 展示空状态（虚线框 + Empty「本空间还没有技能」+「新建技能」按钮）；WHILE 加载中 系统 SHALL 显示 Spin ✅已确认
19. WHERE 后端未启动（`API_ON` 为否） 系统 SHALL（在 `Market` Tabs 形态下）以 Empty 提示需先在本机启动后端；当前导航直接挂载 `SkillMarket`，无数据时回退空状态 ❓待确认

#### 引用 / 影响
- 术语：Skill（= 一个 SKILL.md：name + description + 正文，详见 Agent Skills 开放标准）, Agent, Workspace
- 组件：`SkillMarket`（页面）、`SkillTreePage`（详情页）、`MarketCard`（共享卡片，与 MCP 复用）、`buildTree`（扁平文件清单 → antd Tree）；Upload.Dragger、Popconfirm、Tag、Empty、Spin、Tree.DirectoryTree
- 数据字段（技能行）：`id, name, description, scope('platform'|空间私有), source('upload'|'custom'|…), tree[{path,size,dir}], skill_md, allowed_tools[], creator, added_at`
- 端点：`GET /api/skills?ws=`、`POST /api/market/skills/upload?ws=`（multipart：file+creator）、`GET /api/skills/{id}/file?ws=&path=`、`DELETE /api/skills/{id}?ws=`
- 挂载：`App.tsx` nav==='skill' → `<SkillMarket wsId={curWs} me={当前用户名} />`；`me` 作为上传 creator。注：`Market` 组件（MCP/技能 Tabs 合一）当前未被导航使用，技能与 MCP 各自独立 nav。
- 现有功能：与「技能选择」（本 Spec 上文）联动——本空间上传的技能进入技能选择抽屉
- 设计决策：技能对齐 Claude Agent Skill（SKILL.md）规格；空间隔离落库、平台全局技能下发等实现细节见 ../../技术文档/
- 参考：Agent Skills 概览 https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

#### 待确认 / 假设
- 已定：上传/移出为项目成员自助；归属空间；Skill 页面为独立导航而非「市场总入口」
- 已定：平台全局技能（`scope==='platform'`）只读，本空间不可删除
- ⬜后续：上传后把技能实体真正物化到运行环境（当前为登记进可选目录，见下「技能运行安装与高级注册」）
- ❓平台全局技能的来源与下发方式、是否支持本空间禁用（MCP 侧已有 scope 启停，技能侧暂只读）

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
