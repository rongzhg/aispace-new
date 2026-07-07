---
name: MCP 工具
last amended: 2026-06-29
version: 7
description: 工具选择抽屉、MCP 页面（注册/卡片/平台全局空间内启停/详情看标准 mcpServers 配置/空间归属）、自定义工具接入、工具版本
---

# MCP 工具 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> **2026-07-06 增量（Spec [S](./2026-07-06/S-mcp-remote-register.md)）**：注册升级为**远程优先·仅 Streamable HTTP**（**禁 SSE**、禁 stdio；表单+JSON 双录入）、新增**发布范围**（公开/本空间）与详情页**实时接口探测**、列表改**高密度行式**，并补齐下文长期 ⬜（连通性校验/拉工具清单、导出 `.mcp.json`）+ 打通 Claude Code/OpenClaw 运行时接 MCP。本文以下若干 AC（尤其「MCP 页面」AC2/3/4、「自定义工具接入」）以 S 为准。

## MODIFIED Requirements

### Requirement: 工具选择 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望从分类组织的工具列表中选择有权限的工具，以便精准扩展 Agent 的能力。

#### Acceptance Criteria
1. WHEN 用户在创建/编辑页点击"选择工具"按钮 THEN 系统 SHALL 打开工具选择抽屉（`AssetDrawer`，type=tool，与技能复用同一组件），按来源分区展示，每个工具显示名称、描述、MCP（命令）标签，顶部提供搜索框支持按名称过滤；数据**只来自本空间已注册 MCP**（`GET /api/tools?ws=`），mock `TOOLS` 已弃用
2. WHILE 用户浏览工具列表 系统 SHALL 保留锁定渲染能力（灰显 + LockOutlined + 不可勾选）；当前实现下本空间工具一律 `locked:false`，权限联动(H)尚未接入 ❓待确认
3. WHEN 用户在抽屉中完成选择并确认 THEN 系统 SHALL 更新已选工具列表，并在主页面以 Tag 形式展示已选项名称和数量
4. WHEN 用户移除某个已选工具 Tag THEN 系统 SHALL 从已选列表中移除该工具
5. WHEN 搜索无匹配 THEN 系统 SHALL 展示空状态

#### 引用 / 影响
- 术语：Tool(SystemTool/CustomTool), AssetPermission, MCP
- 组件：Drawer、Input.Search、Checkbox/List、Tag、Tooltip、LockOutlined
- 现有功能：与权限(H)联动

#### 待确认 / 假设
- ❓锁定资产点击时是否提示"如何申请权限"
- ❓是否展示工具所属 MCP server 信息

---

### Requirement: MCP 页面 🔸MVP
**User Story:** 作为项目成员，我希望在「MCP」页面里**注册**自定义 MCP 接口（填写命令/参数/凭证），以便创建/编辑本空间 Agent 时能直接选用。

> 关键约定：
> - MCP 页面**只承载用户自己注册的 MCP**，不展示公共目录；Agent 工具选择抽屉仍可展示平台系统工具（如 web_search/code_runner）与空间注册 MCP。
> - **注册的 MCP 归属于操作时所在的空间(Workspace)**，仅该空间的 Agent 可见可选；空间之间互不可见。

#### Acceptance Criteria
1. WHERE 平台导航 系统 SHALL 提供独立「MCP」入口，并在页面内显示当前空间
2. WHERE MCP 页面 系统 SHALL 顶部显示「本空间可用 MCP（N）· 含平台全局（所有空间共享）+ 本空间私有」与「注册 MCP」按钮，并以**卡片**（共享 `MarketCard`，与技能页同款；auto-fill 最小 300px 列）列出本空间可用 MCP（每张含名称、用途、分类、命令+前 2 个参数预览、所需凭证标签及「详情」/操作）
3. WHEN 用户「注册 MCP」并填写名称、用途、分类、启动命令、参数（每行一个）、所需环境变量（凭证名，逗号/换行分隔）、主页 THEN 系统 SHALL 校验必填项（名称、命令）后 `POST /api/market/mcp/register?ws=` 登记进**当前空间**的工具目录，并在该空间创建/编辑 Agent 的工具选择中可见、可选
4. WHEN 用户点击某 MCP 卡片的「详情」 THEN 系统 SHALL 弹窗（`McpDetailModal`）展示其**标准 mcpServers 配置**（MCP 协议形态：stdio 的 type/command/args/env；远程为 type:http + url + headers）及分类、来源（自定义/官方/社区）、所需环境变量、主页，可一键复制
5. WHERE 本空间私有 MCP 系统 SHALL 提供「删除」（`DELETE /api/tools/{id}?ws=`），仅从当前空间的工具目录移除（其它空间与已选用它的 Agent 配置不受追溯影响）
6. WHERE 平台全局 MCP（`scope==='platform'`，徽标「全局」/「全局·已禁用」） 系统 SHALL **不可删除**，仅可在本空间**禁用/启用**（`POST /api/scope/mcp/{id}/{enable|disable}?ws=`），不影响其它空间与平台定义；禁用态卡片 meta 灰显
7. WHERE MCP 页面 系统 SHALL 经 `GET /api/tools?ws=` 拉取本空间可用 MCP（平台全局 + 本空间私有）；WHERE Agent 工具选择抽屉 系统 SHALL 展示本空间可用 MCP，但不得展示其它空间的 MCP
8. WHERE 同一 MCP 在不同空间 系统 SHALL 允许各空间独立注册/删除、互不影响
9. WHEN 本空间无 MCP THEN 系统 SHALL 展示空状态（Empty「本空间还没有 MCP」+「注册 MCP」按钮）；WHILE 加载中显示 Spin

#### 引用 / 影响
- 术语：MCP, Tool, Agent, Workspace
- 组件：`McpMarket`（页面）、`McpDetailModal`（详情弹窗）、`MarketCard`（共享卡片，与技能页 `SkillMarket` 复用同一组件）；Modal/Field 注册表单、Popconfirm、Tag、Empty、Spin
- 数据字段（MCP 行）：`id, name, summary, category, command, args[], env[], scope('platform'|空间私有), disabled, homepage, official`
- 端点：`GET /api/tools?ws=`、`POST /api/market/mcp/register?ws=`、`DELETE /api/tools/{id}?ws=`、`POST /api/scope/mcp/{id}/{enable|disable}?ws=`
- 挂载：`App.tsx` nav==='mcp' → `<McpMarket wsId={curWs} />`；技能与 MCP 各自独立 nav（`Market` Tabs 合一组件当前未被导航使用）
- 现有功能：与「工具选择」（本 Spec 上文）联动——本空间注册的 MCP 进入工具选择抽屉

#### 待确认 / 假设
- 已定：注册/移出为项目成员自助；归属空间；MCP 页面为独立导航而非「市场总入口」
- 已定：平台全局 MCP 在本空间只读，仅可空间内启停，不可删除
- ⬜后续：注册/加入时校验连通性并真正拉取工具清单（见下「自定义工具接入」）；凭证（token）的安全托管；导出为 Agent 工作目录的 .mcp.json

---

### Requirement: 自定义工具接入 ⬜后续
**User Story:** 作为管理员，我希望接入新的 MCP server 并登记其工具，以便平台资产库可扩展。

#### Acceptance Criteria
1. WHEN 管理员录入 MCP server 连接信息 THEN 系统 SHALL 校验连通性并拉取其工具清单
2. WHEN 登记成功 THEN 系统 SHALL 将这些工具加入"自定义工具"分区，带 MCP 标签与版本
3. IF 连接失败 THEN 系统 SHALL 提示失败原因，不登记

#### 待确认 / 假设
- ❓接入是管理员后台行为还是项目成员自助
- ❓鉴权方式（token/oauth）

---

### Requirement: 工具版本管理 ⬜后续
**User Story:** 作为项目成员，我希望看到工具的版本并在配置中锁定版本，以便行为稳定可控。

#### Acceptance Criteria
1. WHERE 工具存在多个版本 系统 SHALL 在选择时允许指定版本
2. WHEN 工具有新版本 THEN 系统 SHALL ❓（待确认：是否提示已选 Agent 升级）

#### 待确认 / 假设
- ❓版本升级对已发布 Agent 的影响策略
