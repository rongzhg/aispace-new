---
name: MCP 远程注册与运行时接入（表单/JSON · 发布范围 · 接口探测 · Agent 接 MCP）
last amended: 2026-07-06
version: 2
description: MCP 注册升级为远程优先（**仅 Streamable HTTP，禁 SSE**，禁本地 stdio；表单+JSON 两种录入）、发布范围可选（公开/本空间）、详情页实时探测接口、列表按视觉规范重做为高密度行式；并打通 Claude Code 与 OpenClaw 两个运行时真正连上所绑 MCP——今日增量，作用于 D(MCP 工具)、并落到 I/M 的运行时物化
---

# MCP 远程注册与运行时接入 Feature Specification（2026-07-06 增量）

> 术语见 ../../glossary.md；格式见 ../../spec-template.md；视觉以 ../../视觉规范.dc.html 为准
> 本文件只描述功能与验收标准（WHAT），不绑定实现。状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> 增量说明：本组需求把 D-mcp-tools「MCP 页面 / 自定义工具接入」从**本地命令(stdio)口径**升级为**远程 MCP 优先**，新增「发布范围」与「实时接口探测」，并补齐 D 长期 ⬜ 的两项（连通性校验/拉工具清单、导出 `.mcp.json`），同时把 OpenClaw 运行时接 MCP 一并打通。数据契约在 installed_mcp 上**加列不改主键**（`transport/url/headers`），向后兼容。

## 定位

MCP 的真实使用形态正在从「本机起子进程(stdio)」转向「连远程 HTTP 服务」（Aone 开放市场、Zetta、灵境等平台直接给出 Streamable HTTP 地址）。本增量让平台**以远程为一等公民**：录入即填地址+请求头，注册前后可实时探测其暴露的接口，绑定到 Agent 后**两个运行时（Claude Code / OpenClaw）都能真正连上并调用**。

> **注册仅支持 Streamable HTTP（`transport=http`）**：SSE 型 MCP Server **不支持注册**（表单不提供 SSE 选项、JSON 含 `type:"sse"` 报 422）。数据模型/运行时仍保留 `sse` 分支仅为**存量兼容**（老库里可能存在的 sse 行不炸），但不能再新注册。

| 概念 | 说明 |
|---|---|
| 远程 MCP | 经 HTTP 连接的 MCP Server，**注册仅 `transport=http`(Streamable HTTP)**（`sse` 仅存量兼容，不可新注册），用 `url` + 可选 `headers` 接入；对应 Claude Code `.mcp.json` 的 `{type:"http",url,headers}` 与 OpenClaw `mcp.servers` 的 `{url,transport:"streamable-http",headers}` |
| 发布范围 | 注册时选：`公开`(scope=platform，全平台可引用) / `仅本项目空间`(scope=workspace，仅本空间可见) |
| 接口探测 | 对已注册的远程 MCP 发 `initialize`+`tools/list`，列出它暴露的工具接口（名称/描述/入参 schema） |

## MODIFIED Requirements

### Requirement: MCP 注册（仅 Streamable HTTP · 表单/JSON · 发布范围） 🔸MVP（已实现）
> 修订 D-mcp-tools「MCP 页面」AC3/AC4：注册对象由「本地命令(stdio)」改为「远程 MCP（**仅 Streamable HTTP**）」，表单删除「分类」「主页/文档」，新增「请求头」与「发布范围」，并提供「JSON 直接粘贴」通道。**注册不支持 SSE、也不再支持 stdio 本地命令型 MCP**（既有平台内置 stdio 项如 platform-ops 仍可展示/使用；老库里可能存在的 sse 行仍可展示/运行，仅不可新注册）。

**User Story:** 作为项目成员，我希望把一个远程 MCP Server（填地址+请求头，或直接粘它的标准 mcpServers JSON）注册进平台，并选择公开或仅本空间可见，以便 Agent 能选用它。

#### Acceptance Criteria
1. WHERE 注册弹窗 系统 SHALL 提供「表单 / JSON」两种录入方式（Segmented 切换），并在顶部提示可接入 Aone 开放市场 / Zetta / 灵境 等平台上的 MCP Server（复制其 Streamable HTTP 地址即可注册）
2. WHEN 用户用**表单**方式 THEN 系统 SHALL 采集：服务器类型（**仅 `Streamable HTTP` 一种，不提供 SSE**）、服务器名称（必填）、用途简介、服务器地址（必填 url）、请求头 Header（可选，键值对，可逐条增删），**不再采集分类与主页/文档**
3. WHEN 用户用 **JSON** 方式 THEN 系统 SHALL 接受标准 mcpServers 配置（`{"mcpServers":{name:{...}}}`、裸 `{name:{...}}` 映射、或单个 server 对象三种形态），一次可注册多个 server；`POST /api/market/mcp/register-json`
4. IF 表单或 JSON 中出现 **SSE 型** server（`type:"sse"`）THEN 系统 SHALL 拒绝并报 422「注册暂不支持 SSE 模式的 MCP Server，仅支持 Streamable HTTP」；IF 出现**本地命令(stdio)**型（缺 url / 仅有 command）THEN 系统 SHALL 拒绝并报 422「仅支持注册远程 MCP（Streamable HTTP），不支持本地命令(stdio)」
5. WHERE 注册弹窗底部 系统 SHALL 提供「发布范围」选择：`仅本项目空间`（默认，scope=workspace，`POST /api/market/mcp/register[-json]?ws=`）/ `公开（全平台可见）`（scope=platform，`POST /api/platform/mcp/register[-json]`）；选公开时确认按钮文案变为「公开发布」
6. WHEN 注册成功 THEN 系统 SHALL 关闭弹窗、刷新列表，并 toast 提示注册/公开发布的数量或名称；该 MCP 随即在（本空间或全平台）Agent 工具选择中可见可选
7. WHERE installed_mcp 系统 SHALL 以 `transport('http'|'sse'|'stdio')` + `url` + `headers(json)` 承载接入信息（加列不改主键，向后兼容旧库）；**新注册只会写入 `http`**，`sse`/`stdio` 仅为存量/平台内置项的读兼容

#### 引用 / 影响
- 术语：MCP, Tool, Workspace, Scope(platform/workspace)
- 组件：`McpMarket`（页面）、注册 `Modal`（Segmented 表单/JSON、服务器类型段**仅 Streamable HTTP 一项**、Header 键值增删、Segmented 发布范围）、`Field`、`Input`、`antMsg`
- 端点：`POST /api/market/mcp/register?ws=`、`POST /api/market/mcp/register-json?ws=`、`POST /api/platform/mcp/register`、`POST /api/platform/mcp/register-json`
- 数据字段（新增）：`transport, url, headers`
- 现有功能：修订 D「MCP 页面」；发布范围复用 H/scope 的 platform/workspace 模型

#### 待确认 / 假设
- 已定：**注册只收 Streamable HTTP（http）**；SSE 不支持注册（存量 sse 行仅读兼容）；stdio 仅保留平台内置项的展示/运行，不再经界面新增
- 已定：请求头值直接入库（远程连接所需）；与 stdio 的 env「仅存变量名、运行时 `${VAR}` 展开」口径不同
- ⬜后续：公开发布的管理员门控（demo 不强校验，UI 侧门控）；OAuth 型远程 MCP 的授权托管

---

### Requirement: MCP 详情与接口探测 🔸MVP（已实现）
> 修订 D-mcp-tools「MCP 页面」AC4 + 补齐「自定义工具接入」AC1（连通性校验/拉工具清单）。

**User Story:** 作为项目成员，我希望在 MCP 详情里实时看到这个远程 MCP 到底暴露了哪些接口，以便判断它能干什么、值不值得绑。

#### Acceptance Criteria
1. WHEN 用户点某 MCP 行「详情」 THEN 系统 SHALL 弹窗展示：名称、范围标签（公开/本空间）、类型标签（Streamable HTTP/SSE）、简介、地址、请求头名，以及**标准 mcpServers 配置**（远程为 `type` + `url` + `headers`）可一键复制
2. WHERE 远程 MCP 详情 系统 SHALL 提供「获取接口列表」按钮，点击后 `POST /api/tools/{id}/probe?ws=` 实时连接该 MCP（`initialize` + `tools/list`），列出其工具接口（名称 + 描述）
3. WHILE 探测进行中 系统 SHALL 显示加载态；WHEN 成功 THEN 展示接口条目与计数并支持「重新探测」
4. IF 探测失败（不可达/鉴权失败等）THEN 系统 SHALL 优雅提示失败原因，不阻塞其余展示（按需触发，非打开即探测，避免不可达服务每次报错）
5. WHERE 非远程（stdio）MCP 系统 SHALL 不提供探测（`/probe` 对非 http/sse 返回 422）

#### 引用 / 影响
- 组件：`McpDetailModal`（探测状态机 idle/loading/done/error）、`Button(ReloadOutlined)`、`Spin`
- 端点：`POST /api/tools/{id}/probe?ws=`（后端 `_probe_mcp_tools` 手写 JSON-RPC，兼容 application/json 与 text/event-stream 帧）

#### 待确认 / 假设
- 已定：探测按需触发；SSE 传输按 Streamable-HTTP 的 POST 方式尝试，老式「GET 事件流 + POST 消息」型 SSE 可能探测不到（不影响注册与运行）⬜后续补全

---

### Requirement: MCP 列表视觉重做（高密度行式） 🔸MVP（已实现）
> 修订 D-mcp-tools「MCP 页面」AC2：卡片网格（`MarketCard`，≥300px 列、minHeight 140）信息密度不足，按视觉规范改为**高密度行式列表**。

#### Acceptance Criteria
1. WHERE MCP 页面 系统 SHALL 以**带表头的行式列表**（列：MCP 名称+简介 / 类型 / 接入地址 / 范围 / 操作）展示本空间可用 MCP，行高约 52px、悬停高亮，遵循 ../../视觉规范.dc.html 的 token（边 `#dfe3ea`、行分隔 `#edf0f4`、表头 `#f8fafc`）
2. WHERE 每行 系统 SHALL 用语义标签标注类型（`Streamable HTTP`/`SSE` 用 Legacy Indigo `#eef0ff/#4f46e5`；`本地 stdio` 用中性灰）与范围（公开用成功绿 `#ecfdf5/#047857`；本空间用中性灰）
3. WHERE 每行操作 系统 SHALL 提供「详情」；本空间私有项提供「删除」（Popconfirm），平台全局项提供「本空间禁用/启用」而不可删（沿用 D AC5/AC6）
4. WHERE Agent 工具选择抽屉 系统 SHALL 对远程 MCP 显示其类型（`Streamable HTTP`/`SSE`）而非命令，以便区分

#### 引用 / 影响
- 组件：`McpRow`（新增，替代 MCP 场景下的 `MarketCard`）、列表容器/表头、`mtag`/`transportTag`/`scopeTag`
- 视觉：../../视觉规范.dc.html §02 token；MCP 页面由卡片网格 → 行式列表

---

## ADDED Requirements

### Requirement: Agent 运行时接 MCP（Claude Code + OpenClaw） 🔸MVP（已实现）
> 补齐 D-mcp-tools 长期 ⬜「导出为 Agent 工作目录的 .mcp.json」，并把 OpenClaw 运行时一并接通——此前 OpenClaw 分支**跳过** MCP 物化，OpenClaw agent 绑了 MCP 也调不到。

**User Story:** 作为 Agent 作者，我希望把注册好的 MCP 绑到 Agent 上，发布后 Agent 在运行时能真正连上并调用这些 MCP 的工具，无论 Agent 用 Claude Code 还是 OpenClaw 框架。

#### Acceptance Criteria
1. WHEN 发布一个 **Claude Code** Agent（绑定了 MCP）THEN 系统 SHALL 把绑定 MCP 物化成工作目录 `.mcp.json`（远程为 `{type:http|sse,url,headers}`；stdio 为 `{command,args,env}`，env 用 `${VAR}` 运行时展开），运行器以 `--mcp-config .mcp.json --dangerously-skip-permissions` 加载
2. WHEN 发布一个 **OpenClaw** Agent（绑定了 MCP）THEN 系统 SHALL 把绑定 MCP 转成 OpenClaw `mcp.servers` 形态随绑定下发给共享 Gateway，Gateway 侧把**所有在绑 agent 的 MCP 并集**同步进 OpenClaw 全局配置（`openclaw mcp set` + `reload`），下一轮生效
3. WHEN 停服/解绑某 OpenClaw Agent THEN 系统 SHALL 回收仅该 agent 引用、现已无 agent 需要的平台 MCP（`openclaw mcp unset`）
4. WHERE server 命名 系统 SHALL 用 `as_<mcpid>` 前缀（平台托管、可跨 agent 去重与精准回收，避免与用户手工配置混淆）
5. WHERE OpenClaw 的 mcp.servers 系统 SHALL 承认其为**全局**配置（OpenClaw 无 per-agent MCP 作用域）——同一共享 Gateway 下所有 OpenClaw agent 共享这批 server（架构约束，如实标注）

#### 引用 / 影响
- 组件/函数：`main.py` `_materialize_mcp`（Claude Code，远程分支）、`_openclaw_mcp_servers`（OpenClaw 形态）、`_bind_openclaw_agent`(payload 带 `mcp`)；`openclaw_gateway.py` `Binding.mcp`、`sync_global_mcp`（bind/unbind/restore 触发）
- 端点/CLI：Claude Code `claude --mcp-config`；OpenClaw `openclaw mcp set/unset/reload/probe`
- 现有功能：发布/服务/对话主流程不变（I/M）；OpenClaw 对接见 ../../技术文档/openclaw对接.md

#### 待确认 / 假设
- 已定：OpenClaw MCP 全局共享（其 CLI 无 per-agent 作用域）；stdio 的 env 值对 OpenClaw 取运行环境同名变量下发（OpenClaw 存字面值）
- 假设：探测/连接层已对真实公开 MCP（DeepWiki / Microsoft Learn / Context7 / Hugging Face）验证；带模型/登录凭证的完整 LLM 回合依赖运行环境已登录（Claude Code）/ 已配 provider auth-profile（OpenClaw）

---

## 复现要点（开发快速上手）

> 详细实现锚点见 ../../技术文档/市场实现-技能与MCP.md、../../技术文档/openclaw对接.md。

1. **数据模型**：`installed_mcp` 加 `transport/url/headers`（`init_db` 的 ALTER 列表，向后兼容）。
2. **注册（仅 Streamable HTTP）**：`McpRegisterIn` 加 `transport/url/headers`；`McpRegisterJsonIn(config,name,desc,category)`；`_validate_mcp_register` 与 `_parse_mcp_config` 均**拒 `sse`（422）与 stdio（422）**，只放行 `http`；四个端点 `market/platform × register/register-json`。
3. **探测**：`_probe_mcp_tools(url,headers)`（urllib 手写 `initialize`+`tools/list`，兼容 json/SSE 帧）；`POST /api/tools/{id}/probe?ws=`。
4. **物化**：Claude Code 走 `_materialize_mcp`（远程 `{type,url,headers}`）；OpenClaw 走 `_openclaw_mcp_servers` → 绑定 payload `mcp` → gateway `sync_global_mcp`（`openclaw mcp set/unset/reload`）。
5. **前端**：`McpMarket` 行式列表 + `McpRow`；注册 `Modal` 双模式(表单/JSON)+类型段仅 Streamable HTTP+Header 增删+发布范围；`McpDetailModal` 探测状态机；`AssetDrawer` 远程显示类型。
6. **公开验证服务器**（免鉴权 Streamable HTTP，可直接注册+探测）：DeepWiki `https://mcp.deepwiki.com/mcp`、Microsoft Learn `https://learn.microsoft.com/api/mcp`、Context7 `https://mcp.context7.com/mcp`、Hugging Face `https://huggingface.co/mcp`。
