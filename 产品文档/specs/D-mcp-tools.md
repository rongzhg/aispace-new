---
name: MCP 工具
last amended: 2026-06-28
version: 6
description: 工具选择抽屉、MCP 页面（注册/卡片/详情看标准 mcpServers 配置/空间归属）、自定义工具接入、工具版本
---

# MCP 工具 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: 工具选择 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望从分类组织的工具列表中选择有权限的工具，以便精准扩展 Agent 的能力。

#### Acceptance Criteria
1. WHEN 用户在创建/编辑页点击"选择工具"按钮 THEN 系统 SHALL 打开工具选择抽屉，按类别分区展示：系统工具、自定义工具，每个工具显示名称、描述、MCP 标签、版本标签，顶部提供搜索框支持按名称过滤
2. WHILE 用户浏览工具列表 系统 SHALL 仅允许选择用户有权限的资产，无权限资产 SHALL 显示为锁定状态(灰色 + 锁定图标)且不可勾选
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
2. WHERE MCP 页面 系统 SHALL 提供「注册 MCP」按钮，并以**卡片**列出本空间已注册的 MCP（每张含名称、用途、分类、命令预览、所需凭证及「详情/删除」）
3. WHEN 用户「注册 MCP」并填写名称、用途、启动命令、参数、所需环境变量（凭证名）等 THEN 系统 SHALL 校验必填项（名称、命令）后登记进**当前空间**的工具目录，并在该空间创建/编辑 Agent 的工具选择中可见、可选
4. WHEN 用户点击某 MCP 卡片的「详情」 THEN 系统 SHALL 展示其**标准 mcpServers 配置**（MCP 协议形态：stdio 的 type/command/args/env；远程为 type:http + url + headers）及分类、来源、所需环境变量、主页，可一键复制
5. WHEN 用户删除某 MCP THEN 系统 SHALL 仅从当前空间的工具目录移除（其它空间与已选用它的 Agent 配置不受追溯影响）
6. WHERE MCP 页面 系统 SHALL 只展示当前空间注册的 MCP；WHERE Agent 工具选择抽屉 系统 MAY 同时展示系统工具与当前空间注册 MCP，但不得展示其它空间的 MCP
7. WHERE 同一 MCP 在不同空间 系统 SHALL 允许各空间独立注册/删除、互不影响

#### 引用 / 影响
- 术语：MCP, Tool, Agent, Workspace
- 现有功能：与「工具选择」（本 Spec 上文）联动——本空间加入/注册的工具进入工具选择抽屉
- 设计决策：MCP Server 目录来源、连接信息（命令/参数/凭证）的存储与导出、空间隔离的落库方式等实现细节见 ../../技术文档/

#### 待确认 / 假设
- 已定：注册/移出为项目成员自助；归属空间；MCP 页面不再作为“市场总入口”，而是独立导航
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
