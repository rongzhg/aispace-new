# 阿里云 AgentRun 部署（L2：一沙箱一 agent / 多框架）

> 目标：在阿里云上以「**一个沙箱一个 agent**」部署不同框架的单 agent（对应架构设计 §10 的 L2，可延伸 L3 每 session）。
> 选型：**函数计算 FC 的 AgentRun**（AI-agent 专用 serverless 底座）。模型走**百炼/通义千问**（内网，无需公网出口）。
> 状态：✅ 接入与连通已验证；⏳ 单 agent 最小纵切待部署。

## 选定栈
- **计算/隔离**：AgentRun `AgentRuntime`（每个 = 一个基于 FC 的会话沙箱容器，MicroVM 级隔离）。
- **模型**：百炼 DashScope（OpenAI 兼容端点 `https://dashscope.aliyuncs.com/compatible-mode/v1`），模型如 `qwen-plus`。
- **镜像**：阿里云 ACR（本机无 Docker → 用 **ACR 云构建** 或 Code 包，免本地 Docker）。
- **记忆**：NAS 持久卷（`nasConfig`）。
- **Region**：cn-hangzhou。

## 已验证（2026-06-26）
| 项 | 结果 |
|---|---|
| 账号凭证 | ✅ 可用（注意：当前用的是**主账号 root key**，建议轮换为 RAM 子账号） |
| 函数计算 FC 3.0 | ✅ 已开通，`functions` 空（干净环境） |
| 百炼 qwen-plus | ✅ OpenAI 兼容端点正常出文 |
| AgentRun 程序化访问 | ✅ `ListAgentRuntimes` 返回 `SUCCESS`，空列表 |
| 访问方式 | 通用 `aliyun` CLI **未内置** agentrun 元数据；改用官方 **Python SDK** `alibabacloud_agentrun20250910`（见 `cloud/ar.py`） |

## AgentRuntime 资源模型（部署单位）
产品 `agentrun`，API 版本 `2025-09-10`。每个 agent = 一个 AgentRuntime。关键字段：
- `agentRuntimeName`、`artifactType`(`Container`|`Code`)、`containerConfiguration`/`codeConfiguration`
- `cpu`、`memory`、`diskSize`、`port`（应用须监听 `0.0.0.0:port`）、`environmentVariables`
- **会话隔离/亲和（核心，正是「一沙箱一 agent/session」）**：`enableSessionIsolation`、`sessionAffinityType`(`NONE`|`HEADER_FIELD`|`GENERATED_COOKIE`)、`headerFieldName`、`sessionConcurrencyLimitPerInstance`、`sessionIdleTimeoutSeconds`
- `networkConfiguration`(VPC)、`nasConfig`(记忆持久化)、`ossMountConfig`
- `executionRoleArn`（需 `AliyunAgentRunFullAccess`）、`healthCheckConfiguration`、`logConfiguration`
- 模型经环境变量 `MODEL_NAME`（引用 AgentRun 模型管理中已注册的 qwen）；`SANDBOX_NAME` 可选

调用入口：`create_agent_runtime` → `create_agent_runtime_endpoint`（对外 HTTP）。

## 映射到隔离级别
- **L2 每 agent 一沙箱** = 一个 AgentRuntime（常驻可休眠，缩容到 0）。
- **L3 每 session 一沙箱** = 同一 AgentRuntime 开 `enableSessionIsolation` + `sessionAffinityType=HEADER_FIELD`（按 session/agentId 头路由），空闲 `sessionIdleTimeoutSeconds` 回收。

## ✅ 最小纵切已部署并验证（2026-06-26）
一个 `Code`(python3.12, stdlib 无依赖) 的 agent → AgentRuntime → endpoint → 公网调用 → qwen-plus 真实回话。
- 资源：runtime `aispace-min-1`(id 158e64f6…)、endpoint `ep1`、workspace 默认。
- 调用：`POST https://<accountId>.agentrun-data.cn-hangzhou.aliyuncs.com/agent-runtimes/<name>/endpoints/<ep>/invocations/<容器内路径>`
  - **路径映射**：`/invocations/chat` → 容器 `/chat`（`/invocations` 后的路径透传给容器）。
  - **会话亲和/隔离**：请求头 `X-AgentRun-Session-ID: <任意唯一串>`（同 ID 落同实例）。
  - **鉴权**：`disablePublicNetworkAccess=false` 时公网 URL 可直接 POST（本验证未签名即通）；要收紧再走凭证/RAM。
  - 数据面只转 POST（GET /health 会 404，正常）。
- 验证结果：`{"reply":"我是通义千问（Qwen）…","engine":"qwen","model":"qwen-plus"}` HTTP 200。

## ✅ 多框架验证（一沙箱一 agent）
用通用部署器 `cloud/deployer.py`（任意代码目录 + language + 启动命令 → 一个 AgentRuntime + endpoint）部署了两个**不同框架/运行时**的 agent，各自独立沙箱、各自 endpoint、都经百炼 qwen-plus 回话：

| Agent | 运行时 | 依赖 | engine | 结果 |
|---|---|---|---|---|
| `aispace-min-1` | python3.12 (stdlib) | 无 | qwen | ✅ |
| `node-agent` | nodejs20 + openai SDK | 打包 node_modules | qwen-node | ✅ |

**关键发现：AgentRun 的 Code 部署不在云端装依赖**（python 不 pip install、nodejs 不 npm install），只是解压代码到 `/code` 跑启动命令。所以：
- 纯解释型/无依赖 → 直接 Code。
- 有第三方依赖（纯 JS/纯 py）→ **本地装好依赖一起打进 zip**（node_modules / site-packages），跨平台 OK（如 `openai` 纯 JS）。
- 重框架/含 native 依赖（如 **OpenClaw**：全局 CLI + 原生模块，Mac 装的 node_modules 不能跑在 Linux）→ 走 **Container 镜像**（需镜像构建：本地 Docker 或 ACR 云构建）。
- 内联 `zip_file`(base64) 适合中小包（node-agent ~2.3MB 通过）；更大用 OSS（`oss_bucket_name`/`oss_object_name`）。

### 踩坑记录（复刻避雷）
- `CodeConfiguration.command` 必须是 **list**（`["python3","server.py"]`），不是字符串；python3.12 运行时是 `python3` 不是 `python`。
- `NetworkConfiguration.networkMode` 取值 **`PUBLIC`**（大写；`Public` 报 invalid）。
- 建 endpoint 前必须先 `publish_runtime_version` 发布版本（否则 `TargetVersion not found`）。
- 更新代码流程：`update_agent_runtime` → 等 READY → `publish_runtime_version`(得新版本号) → `update_agent_runtime_endpoint`(repoint 到新版本)。
- 控制面 SDK 无 invoke 方法；调用走数据面 HTTP（上面的 URL）。
- 脚本：`cloud/deploy_minimal.py`（create/get/endpoint/redeploy/delete），客户端封装 `cloud/ar.py`。

## ✅✅ OpenClaw 已部署到 AgentRun 并验证（绕过 ACR，走 OSS Code 制品）
三个不同框架的单 agent 现已在 AgentRun 上各自独立沙箱运行、都经百炼 qwen：Python(`aispace-min-1`)、Node(`node-agent`)、**OpenClaw(`openclaw-agent`)**。
OpenClaw 实测：`{"engine":"openclaw","model":"qwen-plus","reply":"…当前模型是 qwen-compatible/qwen-plus…"}` ✅

**为什么没用 ACR**：本账号个人版 ACR 的 docker push 在 blob 端点返回 403（token 服务对 push scope 授予 `access:None`，凭证无推送权），EE 又无法 API 创建（需购买）。改走 **OSS Code 制品**完全绕开镜像仓库。

**OpenClaw OSS Code 制品配方（已验证，脚本 `cloud/deploy_oss_openclaw.py`）**：
1. 在 linux/amd64 容器里 `npm install openclaw@2026.6.10`（本地装，非 -g），得可独立运行的 `node_modules`。
2. bundle = `node_modules/` + `server.js`（用 `/code/bin/node` 跑 `node_modules/openclaw/openclaw.mjs agent --local --agent main --json`）+ `openclaw.json`（百炼 provider）+ `bin/node`。
3. **关键坑：AgentRun 的 `nodejs22` 运行时是 v22.15，但 OpenClaw 要 ≥22.19** → 把 node:22-slim 的 `node`(22.23) 二进制打进 bundle，server.js 用 `/code/bin/node` 跑 openclaw（runtime 自带 node 只跑 server.js）。
4. zip(~114MB) → 上传 OSS（bucket `aispace-code-<acct>`）→ `create_agent_runtime(artifactType=Code, codeConfiguration.oss_bucket_name/oss_object_name, language=nodejs22, command=["node","/code/server.js"], disk_size=10240)`。
5. **坑：`disk_size` 只能 512 或 10240**（359MB 解压需 10240）；初始化（`agents add main`）放进 server.js 启动逻辑（AgentRun 对 `sh -c` 复合命令会拆坏，别用）。

**复用脚本**：`cloud/ar.py`(客户端) `cloud/acr.py`(ACR/令牌) `cloud/deployer.py`(通用 Code 部署) `cloud/deploy_oss_openclaw.py`(OpenClaw OSS 部署) `cloud/openclaw_agent/`(镜像版，备用)。

---

## OpenClaw 容器化（本地已验证；ACR 推送被账号 403 挡住，已改走 OSS）
镜像 `cloud/openclaw_agent/`（Dockerfile + server.js + entrypoint.sh + openclaw.json），本地 colima 构建并运行验证：
`POST /chat` → `{"engine":"openclaw","model":"qwen-plus","reply":"…"}` ✅ —— OpenClaw 真实经百炼 qwen 回话。

**OpenClaw↔百炼 配方（关键，已验证）**：`~/.openclaw/openclaw.json`（镜像里经 `OPENCLAW_CONFIG_PATH` 指定）配自定义 OpenAI 兼容 provider：
```json
{"agents":{"defaults":{"model":{"primary":"qwen-compatible/qwen-plus"},
  "models":{"qwen-compatible/qwen-plus":{"alias":"qwen"}}}},
 "models":{"mode":"merge","providers":{"qwen-compatible":{
   "baseUrl":"https://dashscope.aliyuncs.com/compatible-mode/v1",
   "apiKey":"${DASHSCOPE_API_KEY}","api":"openai-completions",
   "models":[{"id":"qwen-plus","contextWindow":200000,"maxTokens":8192}]}}}}
```
- 两步：`models.providers` 定义 provider + `agents.defaults.models` allowlist `provider/model`；默认 `agents.defaults.model.primary`。`apiKey` 用 `${ENV}`。
- 调用：容器内 `openclaw agent --local --agent main -m <msg> --json`（embedded，无需 daemon），回复取 `payloads[0].text`，模型取 `meta.executionTrace.winnerModel`。

**镜像踩坑**：
- 必须 **Node ≥22.19**（用 `node:22-slim`；node:20 报错）。
- `npm i -g openclaw` 要**固定版本** `openclaw@2026.6.10`——不固定可能偶发装到占位包 `openclaw@0.0.1`(无 bin)。
- 装 `python3 make g++ git`（native 依赖构建）。
- 入口先 `openclaw agents add main --non-interactive` 建默认 agent，再起 HTTP server。
- 镜像 ~1.47GB；AgentRun 跑 x86_64 → push 前用 `docker buildx --platform linux/amd64` 构建。

> **此容器路线最终未用于云上**：本账号个人版 ACR 的 docker push 始终 403（见上「为什么没用 ACR」），故改走 **OSS Code 制品**（上节，已部署验证）。镜像本身本地验证可用，留作备用（`cloud/openclaw_agent/` + `cloud/deploy_container.py`）；若换成可正常 push 的仓库（如 ACR 企业版），按 `ContainerConfiguration{image, image_registry_type, registry_config.auth_config, command, port}` 部署即可。

## ✅✅✅ 发布按钮 → 云端（L2/L3）已接通并验证（前后端打通）
平台「发布」选**独立环境(L2)/即用即弃(L3)** 时，自动部署到 AgentRun 独立沙箱；选**共享环境(L1)** 仍走本地。实测：发布 OpenClaw agent 选 L2 → 异步部署 → `service-chat` 回 `engine:openclaw, model:qwen-plus, 📊 <该 agent 人设>`。

**实现（可插拔云适配器）**：
- `backend/cloud_adapter.py`：`CloudRuntimeAdapter` 抽象接口 + `AgentRunCloudAdapter` 实现（换云厂商=换实现）。`deploy/stop/chat`。
- `backend/main.py`：`_start_service` 按 `isolation` 派发——L1=本地（不变）；L2/L3=`_start_cloud_service`（**异步**：立即登记 `status:deploying` + 确定性 endpoint URL，后台线程部署完转 `running`）。`_stop_service` 云分支删 runtime；`service-chat[/stream]` 云分支走 `cloud_adapter.chat`（流式以单 done 包装）；`/api/services` 带 `location/status`。
- **R1 单主实例**：换版本/换环境=停旧起新（迁移）。L3 → `enable_session_isolation` + 会话亲和头。
- **一份共享 OSS bundle 起多 agent**：每个 L2 agent = 同一 bundle(`openclaw/oc-code-vN.zip`) + **每 agent 环境变量**（`MODEL_ID` + `PERSONA_ROLE/AGENT/USER` base64）→ `server.js` 启动时写 `/tmp/openclaw.json` + `SOUL.md/USER.md`，起出各自人设/模型。后端只调 API、不构建。
- 凭证：阿里云读 `~/.aliyun`(profile)；模型出网 `DASHSCOPE_API_KEY`(后端 env)。bundle 对象键经 `AGENTRUN_BUNDLE_OBJECT` 配置。

**踩坑（复刻避雷）**：
- **agent 名不能用 `main`**（撞 OpenClaw 保留/全局默认 → 走 bootstrap 自我介绍、不读 SOUL.md）；用唯一名（如 `platform`）。
- **人设写入顺序**：先 `agents add` 再覆盖 `SOUL.md/USER.md`（agents add 会铺默认 scaffold）。
- **改 bundle 要换对象键**（`oc-code-vN.zip`）：AgentRun 按 runtime 名/对象缓存代码，覆盖同名对象不一定重新拉取；换 agent 名或新对象键可强制刷新。
- `delete_agent_runtime(rid)` 只收 id（无 request 参数）；删除是**异步**（先进 deleting 再消失）。
- 生成的 `openclaw.json` 模型项需带 `name` 字段。

**未尽（后续）**：云端 Claude Code（需 Anthropic 公网出口，百炼-only 不支持）；前端展示 `location/status`（部署中/运行中-云）；改 bundle 的对象键版本管理自动化。

## 工具与脚本
- `cloud/ar.py`：AgentRun 客户端封装（凭证读本地 `~/.aliyun/config.json` profile `aispace`，不硬编码密钥）。`python ar.py list` 只读连通检查。
- 凭证配置：`aliyun configure set --profile aispace --mode AK --region cn-hangzhou ...`（密钥落本地 `~/.aliyun`）。

## 安全备注
- 当前用主账号 root key（已在对话中暴露）→ **完成后务必轮换**，并改用最小权限 RAM 子账号。
- 百炼 API Key 同样建议用完轮换。
- 后付费仍可能产生欠费：优先 `缩容到 0` + 按量；建大资源前确认；建议在控制台设费用预警。
