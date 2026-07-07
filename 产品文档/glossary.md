# 术语表 (Glossary)

> 共享契约的一部分。这是 agent 写 spec、开发命名代码、设计组件时**唯一的术语来源**。
> 同一个概念全链路只用同一个词；新增/修改术语必须先改这里，再改代码和 spec。

## 版本
- last amended: 2026-06-28
- version: 4（补齐 Agent Operations / Head / Live / Draft / 部署方式等当前产品术语）

---

## 核心领域术语

| 中文 | 英文 / 代码命名 | 定义 |
|---|---|---|
| 智能体 | Agent | 平台管理的 AI 智能体，具有特定的框架、模型、配置文件、工具和技能配置 |
| 框架 | Framework | Agent 运行的底层框架类型，不同框架有不同的配置文件模板（如 Claude Code 用 `claude.md`，OpenClaw 用 `user.md`/`agent.md`） |
| 配置文件 | ConfigFile | 框架特定的 Markdown 配置文件，定义 Agent 的行为、角色和能力 |
| MCP 工具 | Tool (MCP Tool) | Agent 可调用的外部工具能力，可来自系统工具或当前空间注册的 MCP；绑定到 Agent 后进入运行时工具集 |
| 技能 | Skill | Agent 具备的高级能力模块；可来自内置 skill 或当前空间上传的 `SKILL.md` 技能包 |
| 版本 | Version | Agent 配置的快照记录，每次保存/更新生成新版本（v1、v2…） |
| Head 版本 | HeadVersion | Agent 当前最新已保存配置版本；编辑保存后生成新的 Head |
| Live 版本 | LiveVersion | 当前线上发布所指向的版本；可能落后于 Head，也可能直接指向某个历史版本 |
| Draft 状态 | DraftStatus | Agent 列表上的版本关系状态，表示 Head 与 Live 是否一致；不是“保存草稿”功能 |
| 配置预览 | ConfigPreview | 将 Agent 所有配置项合并生成的结构化配置文件（JSON/YAML），只读 |
| 资产权限 | AssetPermission | 用户对资产（Agent/Skill/Tool）的访问权限，在「项目空间 + 角色 + 资产」维度下判定 |

## 组织与权限术语

| 中文 | 英文 / 代码命名 | 定义 |
|---|---|---|
| 项目空间（工作空间） | Workspace | 权限与协作的边界，资产归属其下并按空间隔离；用户须在某"当前空间"下操作，可切换 |
| 当前空间 | CurrentWorkspace | 用户当前所处的空间上下文，决定其操作与资产可见范围 |
| 默认空间 | DefaultWorkspace | 新用户开通时自带的初始项目空间 |
| 空间 Owner | Owner | 项目空间的拥有者/管理者（即"项目管理员"），可管理成员与资产；一个空间可有多个 Owner |
| 空间成员 | Member | 加入某空间的用户（即"项目成员"），在空间内使用其有权限的资产 |
| 平台管理员 | PlatformAdmin | 凌驾于所有空间之上，管理全平台项目、用户、资产与角色 |
| 创建人 | Creator | 创建某 Agent 的用户；是「会话 Tab」可见性的唯一判据——只能看到自己是创建人的 Agent 的会话明细。区别于「对话发起人」 |
| 对话发起人 | Initiator | 与某 Agent 发起某次会话的用户（可能不是该 Agent 的创建人）；旧的会话可见性维度（看自己发起的会话） |
| 会话 Tab / 会话控制台 | Session Console | 面向创建人的观测入口，把「我创建的所有 Agent（L1/L2/L3）」曾活跃过的会话聚合展示、可检索、可回看明细（见 specs/N） |

## 框架运行时术语（发布/服务）

> 仅产品级概念；具体运行方式（进程/网关/沙箱）属实现，见 ../技术文档/。

| 中文 | 英文 / 代码命名 | 定义 |
|---|---|---|
| 框架适配 | Adapter | 让发布/服务/对话主流程支撑不同框架的适配层——新增框架=加一个适配，不改主流程。具体每框架"怎么跑"属实现 |
| 运行服务 | Service | 「已发布 Agent 的运行态」，对外暴露统一的对话/调用接口（运行中 / 已停止） |
| 发布 | Publish | 将某个已保存版本设为 Live，并按所选部署方式启动或替换运行服务 |
| 部署方式 | DeploymentMode / Isolation | Live 运行服务的运行形态选择：共享 L1、独立 L2、即用即弃 L3；L0 租户隔离始终生效，不是用户可选项 |
| 全局默认模型 / 每 Agent 模型 | default model / per-agent model | 某框架运行时的兜底默认模型 vs 单个 Agent 覆盖的模型（支持同框架多 Agent 各用各的模型） |
| 定时任务 | Deployment | 可触发的任务模板 = Agent + 版本策略 + 任务指令 + 调度（运行环境复用 Agent 发布设置）；对齐 Claude Managed Agents 的 deployment，非「常驻服务开关」。见 specs/O |
| 版本策略 | VersionPolicy | 定时任务解析用哪一版的规则：`跟随最新`（触发时解析为 Head）或 `钉住 vN`；版本在**触发时**解析，回滚=改策略不算新部署 |
| 调度 | Schedule / Cron | 定时任务的触发计划：重复(5 字段 cron)、一次性(指定时刻)、仅手动 |
| 运行 | Run | 定时任务的一次执行台账：触发方式、解析版本、状态(运行中/成功/失败/跳过)、耗时、指向的会话 id；过程与结果即其会话 |
| 归集来源 | Source | 会话进入平台台账的路径：平台界面(platform)、定时任务(schedule)、网关直连(gateway)、云端回传(cloud-callback,未接通) |

## 框架枚举（Framework）

| 取值 | 显示名 | 状态 |
|---|---|---|
| `CLAUDE_CODE` | Claude Code | 可选 |
| `OPENCLAW` | OpenClaw | 可选 |
| `CUSTOM` | Custom | 禁用（标注 "coming soon"） |
| `HERMES` | Hermes | 禁用 |

## 状态/行为术语

| 中文 | 英文 / 代码命名 | 定义 |
|---|---|---|
| 锁定状态 | Locked | 无权限资产的展示状态（灰色 + 锁定图标，不可勾选） |
| 抽屉 | Drawer | 工具/技能选择的侧滑面板 |
| Agent Operations | AgentOperations | Agent 列表运营页，用于扫视负责人、Live 状态、部署方式、Draft 状态和异常项 |
| Agent 工作台 | AgentWorkbench | 创建、编辑、调试、发布、版本与回滚的统一操作界面 |
| 双栏 Builder | Builder | Agent 工作台的主布局：左侧配置，右侧线上发布与运行、试跑 |
| 等宽字体文本域 | Monospace Editor | 配置文件编辑用的等宽字体编辑器（如 Monaco） |

---

## 命名规则
- 代码中实体、字段、接口路径一律用上表的英文命名，不自创同义词。
- 枚举值用大写下划线（`CLAUDE_CODE`）；前端展示用「显示名」。
- 同一概念出现歧义时，以本表为准；本表没有的，先在此登记再使用。
