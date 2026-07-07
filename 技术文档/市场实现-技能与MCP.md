# 市场实现：技能市场 + MCP 市场

> 对应 Spec D（MCP 工具 · MCP 市场）、Spec E（技能 · 技能市场）。本文只写实现，功能/验收见 spec。

平台「市场」让成员浏览/搜索外部技能与 MCP Server，「加入平台」后登记进可选目录，
创建/编辑 Agent 时即可在工具/技能选择抽屉里选用。两个市场的数据来源不同、登记口径一致。

## 数据来源

| 市场 | 来源 | 说明 |
|---|---|---|
| 技能市场 | `clawhub` CLI（公共技能注册表，clawhub.ai） | 本机已安装、公开免登录。后端 shell 调用并解析其文本输出 |
| MCP 市场 | 精选真实 MCP Server 目录（代码内置） | 官方 `modelcontextprotocol/servers` + 主流社区 server，含命令/参数/所需凭证 |

> MCP 注册表无统一公共检索源，故内置精选目录（`backend/market.py:MCP_CATALOG`）。
> 换源 = 改 `market.py`：技能换注册表实现、MCP 换目录来源，API 与前端不变。

## 后端

### `backend/market.py`（数据源适配）
- 技能：`clawhub_available()` / `search_skills(q, limit)` / `inspect_skill(slug)`。
  - clawhub 输出是**文本**（无 `--json`）：
    - `clawhub search <q> --limit N` → 行 `slug␣␣name␣␣(score)`（2+ 空格分列，结尾括号是相关性分）。
    - `clawhub explore --limit N` → 行 `slug␣␣vX.Y␣␣Nm ago␣␣描述…`（无 q 时用，看最新）。
    - `clawhub inspect <slug>` → `key: value` 文本，首行 `slug␣␣name`。
  - 用 `re.split(r"\s{2,}")` 分列、`_SCORE` 提取分数、过滤 `Fetching/Searching` 噪声行。
- MCP：`MCP_CATALOG`（list）+ `search_mcp(q, category)` / `mcp_categories()` / `get_mcp(id)`。
  每条：`id/name/desc/category/command/args/env(所需环境变量)/homepage/official`。

### `backend/main.py`（接口 + 已装目录）

**空间归属（关键）**：加入/注册的技能与 MCP 都属于某个空间(ws)。两张表用**复合主键 (ws_id, id)**，
所有 list/install/register/delete 都带 `ws` 参数并按 ws 过滤；同一项可在多个空间各自启用、互不影响。
```
installed_skills(ws_id, id, name, description, instructions, allowed_tools(json),
                 source, added_at, archive_path, tree(json), deleted, creator,  PK(ws_id,id))
                 -- SKILL.md + 上传包 + 软删除 + 创建人(added_at 即创建时间)
installed_mcp   (ws_id, id, name, summary, category, command, args(json), env(json),
                 homepage, source, added_at, scope, default_on,
                 transport, url, headers(json),  PK(ws_id,id))
                 -- transport: 'http'(Streamable HTTP) | 'sse' | 'stdio'(仅平台内置项)
                 -- 远程(http/sse): url + headers(键值直接入库)；stdio: command/args/env(env 仅存变量名, 运行时 ${VAR} 展开)
                 -- scope: 'platform'(公开·全平台) | 'workspace'(本空间私有)；加列不改主键, 老库 ALTER 平滑迁移
```

> **2026-07-06 增量（Spec S）**：注册升级为**远程优先**——注册界面只收 Streamable HTTP / SSE（禁 stdio），`installed_mcp` 加 `transport/url/headers` 三列。stdio 仅保留平台内置项（如 platform-ops）的展示与运行。见 [Agent 运行时接 MCP](#agent-运行时接-mcpclaude-code--openclaw2026-07-06) 与 openclaw对接.md。
- **技能 = 一个 SKILL.md**（Claude Agent Skill 规格，见 platform.claude.com 文档）：
  - `name`：必填，正则 `^[a-z0-9-]{1,64}$` 且不含 `anthropic`/`claude`（`_validate_skill_name`，违反报 422）。**技能 id 就是 name**（name 本身即合法 slug、也是命令名 `/name`）。
  - `description`：必填、≤1024，写清“做什么 + 何时使用”——它是 Claude 判断是否调用该技能的依据。
  - `instructions`：SKILL.md 正文；`allowed_tools`：可选预批工具。
  - `_render_skill_md()` 把字段渲染成标准 SKILL.md（frontmatter + 正文），`GET /api/skills` 每条带 `skill_md`。
- **上传技能包（主入口）**：`POST /api/market/skills/upload`（multipart，需 `python-multipart`）：
  - `market.find_skill_md(filename, data)`：用 `zipfile`/`tarfile` 解包，定位最浅的 SKILL.md，`parse_skill_frontmatter()` 取 name/description/allowed-tools/正文；过滤 `__MACOSX`/`.DS_Store`/`._*` 噪声。
  - 原包存到 `SKILL_PKG_DIR/<ws>__<name>.<ext>`（`archive_path`）；文件清单 `[{path,size,dir}]` 存 `tree`。
  - `GET /api/skills/{id}/file?ws=&path=`：从存档按需读单个文件文本（详情目录树点开查看，限 200KB）。
  - **软删除**：`DELETE /api/skills/{id}` 改为 `UPDATE installed_skills SET deleted=1`（不删行、不删存档）；`GET /api/skills` 与文件读取均加 `AND deleted=0`；因上传走 `INSERT OR REPLACE`（不含 deleted 列 → 取默认 0），重新上传同名技能即恢复。老库由 `ALTER TABLE ... ADD COLUMN deleted` 平滑加列。
  - **只保留用户注册（上传）的技能**：`init_db` 启动时 `DELETE FROM installed_skills WHERE source='clawhub'`，前端也不再展示 clawhub；clawhub 的 search/install/register 端点保留备用但 UI 不再调用。
  - **MCP 同理只保留用户注册**：`init_db` 启动时 `DELETE FROM installed_mcp WHERE source!='custom'`，前端去掉内置目录浏览/搜索/分类；`MCP_CATALOG` 与 `/api/market/mcp`、`/install` 端点保留备用但 UI 不再调用。
- `source`：技能 `clawhub`/`custom`；MCP `catalog`/`custom`。
- **MCP** 自定义注册的 id：`_slug_id("custom", name)` = `custom-<ascii-slug>-<6位uuid>`（名可为中文/任意，故用 uuid 后缀保证唯一且 URL 安全）。技能不用此法——技能 name 受规格约束本就是合法 ascii slug。
- `init_db` 迁移：MCP 缺 `ws_id`、技能缺 `instructions`（旧 summary/owner/version 结构）即 `DROP TABLE` 重建（辅助表，无碍）。
- `_ws_guard(ws)`：ws 必填且须存在于 workspaces，否则 422/404。

接口（**ws 均必填**）：
| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/market/skills?q=&limit=` | 技能市场列表（全平台共享检索；有 q=搜索，无=最新）；`{available, items}` |
| GET | `/api/market/skills/{slug}` | 技能详情（clawhub inspect） |
| POST | `/api/market/skills/upload?ws=` | **上传技能包（tar/zip）→ 解析 SKILL.md → 加入当前空间**（主入口；表单字段 `creator` 记录创建人，前端传当前用户） |
| GET | `/api/skills/{id}/file?ws=&path=` | 读上传包内某文件文本（详情目录树） |
| POST | `/api/market/skills/{slug}/install?ws=` | 从 clawhub 加入（保留备用） |
| POST | `/api/market/skills/register?ws=` | 表单注册自定义技能（保留备用，body: name/description/instructions/allowed_tools） |
| GET | `/api/skills?ws=` | 某空间已启用技能（带 SKILL.md 与文件树，供 Agent 技能选择） |
| DELETE | `/api/skills/{slug}?ws=` | **软删除**（标记 deleted=1，保留行与存档） |
| GET | `/api/market/mcp?q=&category=` | MCP 市场目录（全平台共享）；`{items, categories}`（保留备用，UI 不再调用） |
| POST | `/api/market/mcp/{id}/install?ws=` | 把目录项加入当前空间（保留备用） |
| POST | `/api/market/mcp/register?ws=` | 表单注册**远程 MCP** 到当前空间（body: `name/desc/transport('http'\|'sse')/url/headers{}`；stdio 报 422） |
| POST | `/api/market/mcp/register-json?ws=` | 粘贴标准 mcpServers JSON 注册到当前空间（body: `config{}/name/desc`；一次可多个 server；stdio 报 422） |
| POST | `/api/platform/mcp/register` | **公开发布**（scope=platform，全平台可见）表单注册；body 同 register，无 ws |
| POST | `/api/platform/mcp/register-json` | 公开发布·JSON 注册；body 同 register-json，无 ws |
| POST | `/api/tools/{id}/probe?ws=` | **探测远程 MCP 接口**：连该 MCP 做 `initialize`+`tools/list`，返回 `{tools:[{name,description,input_schema}]}`；非 http/sse 报 422，连不上报 502 |
| GET | `/api/tools?ws=` | 某空间已启用 MCP（含 `transport/url/headers`），供该空间 Agent 工具选择 |
| DELETE | `/api/tools/{id}?ws=` | 从当前空间移出（本空间私有；平台全局项只能禁用/启用） |

> **2026-07-06 增量（Spec S）**：`McpRegisterIn` 加 `transport/url/headers`；新增 `McpRegisterJsonIn{config,name,desc,category}`。
> 校验：`_validate_mcp_register` 拒 stdio（仅 http/sse，url 必填）；`_parse_mcp_config` 解析三形态（`{mcpServers:{}}`/裸映射/单 server 对象）并拒 stdio。
> 探测：`_probe_mcp_tools(url,headers)` 用 urllib 手写 JSON-RPC，兼容 `application/json` 与 `text/event-stream` 两种响应帧。

> 注意：`/api/tools`、`/api/skills` 现返回**指定空间的已启用项**；前端把它们与内置 mock 清单合并展示。
> 市场的检索目录（clawhub / MCP_CATALOG）是全平台共享的，只有「加入/注册」后的启用项才归属空间。

## 前端

- `components.tsx`：`Market({wsId, wsName})`（Tabs：MCP 市场 / 技能市场，顶部标注当前空间）+ `McpMarket` / `SkillMarket` / `MarketCard` / `EnabledStrip`。
  - 每个 tab 都传 `wsId`，所有 `apiCall` 带 `?ws=`；顶部 `EnabledStrip` 展示「本空间已启用」清单（含自定义标识 + 移出）。
  - **技能市场**：顶部「新建技能」按钮 → `Modal` 内放 `Upload.Dragger`（`customRequest` 用 `fetch`+`FormData` 调 `/upload?ws=`，非 `apiCall`，因后者是 JSON）；已注册技能以 `MarketCard`（`installed`）卡片网格展示：主操作「详情」占宽，「删除」退化为小图标（`compactRemove`=有 onView 时；danger text 图标）+ `Popconfirm` 软删除确认；卡片含 `info` 行显示创建人（`creator`）与创建时间（`added_at`）。无 clawhub 浏览区。创建人由 `App → Market(me) → SkillMarket` 透传当前用户（demo 为 `u0` "Helena（我）"）。
  - 技能详情 `SkillTreePage`（**独立页面**，非 Modal，SkillMarket 内 `detail` 状态切换 + 返回按钮）：`buildTree()` 把扁平 `tree` 转成嵌套，用 antd `Tree.DirectoryTree` 渲染目录树，点文件 → `/skills/{id}/file` 取内容显示在浅色 `<pre>`。
  - `AssetDrawer`（Agent 技能选择）技能侧只用后端已注册技能，不再混入内置 mock `SKILLS`。
  - **MCP 市场（2026-07-06 Spec S 重做）**：顶部「注册 MCP」→ Modal，Segmented 切「表单 / JSON」两种录入，均**只收远程**（http/sse）：
    - 表单：Segmented 服务器类型（`Streamable HTTP`/`SSE`）+ 名称 + 简介 + 地址 + **请求头 Header 键值增删**；无分类/主页。
    - JSON：粘贴标准 mcpServers 配置（`submitReg` 前端 `JSON.parse` 后 `POST …/register-json`）。
    - 底部 Segmented「发布范围」：`仅本项目空间`(→`market/mcp/register[-json]?ws=`) / `公开（全平台可见）`(→`platform/mcp/register[-json]`)；选公开时确认按钮变「公开发布」。
    - 顶部提示来源：可接入 Aone 开放市场 / Zetta / 灵境 上的 MCP Server。
  - 已注册 MCP 以**高密度行式列表**（`McpRow`，替代 MCP 场景的 `MarketCard`）展示：列 MCP名称+简介 / 类型 / 接入地址 / 范围 / 操作；`transportTag`/`scopeTag`/`mtag` 语义标签；行 hover 高亮。平台全局项「本空间禁用/启用」不可删，私有项 Popconfirm 删除。
  - MCP 行点「详情」→ `McpDetailModal`：展示标准 `mcpServers` 配置（远程 `type`+`url`+`headers`）+ 复制；**远程项带「获取接口列表」**——`POST /api/tools/{id}/probe?ws=` 实时探测，状态机 `idle/loading/done/error`，列出工具名+描述，可「重新探测」，连不上优雅降级。
  - `AssetDrawer`（Agent 工具选择）：远程 MCP 徽标显示类型（`Streamable HTTP`/`SSE`）而非命令（`r.transport` 优先，回退 `r.command`）；两侧都只用后端已注册项，不再混入 mock `TOOLS`/`SKILLS`。
  - **视觉规范对齐**（产品文档/视觉规范.dc.html §02）：MCP 列表用 token `MT`（边 `#dfe3ea`、行分隔 `#edf0f4`、表头 `#f8fafc`、行 hover `#f8fafc`）；类型标签 Legacy Indigo `#eef0ff/#4f46e5`、范围「公开」成功绿 `#ecfdf5/#047857`、请求头药丸 `#fffbeb/#b45309`；注册主按钮墨色 `#0f172a`。（技能页仍沿用旧 `MarketCard` 卡片。）
- `App.tsx`：侧栏新增「市场」菜单（`AppstoreOutlined`）→ `<Market wsId={curWs} wsName={ws.name}/>`。
- `AssetDrawer({wsId})` / `AgentBuilder({wsId})`：抽屉按 `wsId` 拉 `/api/tools?ws=`、`/api/skills?ws=`，
  以「本空间 · (自定义) MCP / 技能」分类**合并进内置清单**一起勾选；选中 id 直接存进 Agent 的 `tools/skills`。
  AgentBuilder 的 ws 来源：create=当前空间 `curWs`，edit=`agent.wsId || curWs`。

## 验证

```bash
# 后端（用 .venv 里的 uvicorn）
cd backend && ./.venv/bin/uvicorn main:app --port 8000
curl 'localhost:8000/api/market/skills?q=postgres&limit=3'                        # -> 带 score 的技能
# 注册远程 MCP（表单口径）到 w1：
curl -X POST 'localhost:8000/api/market/mcp/register?ws=w1' -H 'Content-Type: application/json' \
  -d '{"name":"DeepWiki","transport":"http","url":"https://mcp.deepwiki.com/mcp"}'
# JSON 口径（可一次多个）：
curl -X POST 'localhost:8000/api/market/mcp/register-json?ws=w1' -H 'Content-Type: application/json' \
  -d '{"config":{"mcpServers":{"ms":{"type":"http","url":"https://learn.microsoft.com/api/mcp"}}}}'
# stdio 被拒（422）：
curl -X POST 'localhost:8000/api/market/mcp/register?ws=w1' -H 'Content-Type: application/json' \
  -d '{"name":"x","transport":"stdio","command":"npx"}'          # -> 422 仅支持远程
# 探测接口（真连远程 MCP，列 tools）：
MID=$(curl -s 'localhost:8000/api/tools?ws=w1' | python3 -c 'import sys,json;print([m["id"] for m in json.load(sys.stdin) if m["name"]=="DeepWiki"][0])')
curl -X POST "localhost:8000/api/tools/$MID/probe?ws=w1"          # -> {tools:[read_wiki_structure,…]} (3)
curl 'localhost:8000/api/tools?ws=w1'   # 含 transport/url/headers
curl 'localhost:8000/api/tools?ws=w2'   # [] —— 空间隔离
# 前端：dev server 经 /api 代理到 8000（vite --port 5173，API_TARGET 可改后端地址）
```

免鉴权公开验证服务器（可直接注册+探测）：DeepWiki `https://mcp.deepwiki.com/mcp`、Microsoft Learn `https://learn.microsoft.com/api/mcp`、Context7 `https://mcp.context7.com/mcp`、Hugging Face `https://huggingface.co/mcp`。

## Agent 运行时接 MCP（Claude Code + OpenClaw，2026-07-06）

绑定到 Agent 的 MCP（`config.tools` 存 installed_mcp 的 id）在**发布/绑定时**物化进运行时，两个框架各走一套：

- **Claude Code**（每 agent 一进程）：`_materialize_mcp(workdir, ws, mcp_ids)` 写 `<workdir>/.mcp.json`——远程为 `{"type":"http"|"sse","url",…,"headers"}`，stdio 为 `{command,args,env}`（env 用 `${VAR}` 运行时展开）。运行器 `agent_runner._mcp_args()` 检测到 `.mcp.json` 即加 `--mcp-config .mcp.json --dangerously-skip-permissions`。已验证 Claude Code 真连远程（`claude mcp list` 识别 HTTP、`✔ Connected`）。
- **OpenClaw**（共享 Gateway 托多 agent）：OpenClaw 的 `mcp.servers` 是**全局**配置（`~/.openclaw/openclaw.json`，无 per-agent 作用域）。
  - `main.py _openclaw_mcp_servers(ws, mcp_ids)` → OpenClaw 形态 `{as_<mcpid>: {url,transport:'streamable-http'|'sse',headers?} | {command,args,env?}}`，随绑定 payload `mcp` 下发（`_bind_openclaw_agent`）。
  - `openclaw_gateway.py`：`Binding.mcp` + `sync_global_mcp()`——把**所有在绑 agent 的 MCP 并集**写进 OpenClaw 全局配置（`openclaw mcp set`），回收无引用的平台项（`unset`），`reload` 让下一轮生效；接进 bind/unbind/restore。已验证 `openclaw mcp probe` 真连远程（DeepWiki → 3 tools）。
  - 详见 openclaw对接.md「MCP 接入」。

> 完整链路验证与公开服务器清单见 Spec S「复现要点」（产品文档/specs/2026-07-06/S-mcp-remote-register.md）。

## 后续（见 spec ⬜）
- 技能「加入平台」当前只登记进可选目录；真正把技能实体拉取/安装到运行环境待做（与「技能注册/上传」打通）。
- MCP：OAuth 型远程 MCP 的授权托管；老式「GET 事件流 + POST 消息」型 SSE 的探测补全（当前 `/probe` 按 Streamable-HTTP POST 尝试）；公开发布的管理员门控（demo 不强校验）。
