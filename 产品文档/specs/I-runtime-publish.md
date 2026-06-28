---
name: 运行与发布
last amended: 2026-06-29
version: 11
description: Agent 试跑、Head/Live/Runtime 发布模型、部署方式、对外调用协议、Playground、部署控制台、运行服务运维、实例约束与管理、框架可插拔、运行时隔离级别
---

# 运行与发布 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> **本文件只描述功能与验收标准（WHAT），不绑定实现/架构/后端。** 复刻方可用任意架构实现；引擎对接、部署形态、接口契约等技术细节见 ../../技术文档/。
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: Agent 试跑 / 调试 🔸MVP
> 决策：试跑前置进创建/编辑流程。调试与试跑复用同一个对话组件——创建/编辑右栏「调试」喂当前未保存配置，详情页「试跑」喂已保存的某个版本。

**User Story:** 作为项目成员，我希望在配置 Agent 的同时随手对话试跑，以便边配边验证是否符合预期。

#### Acceptance Criteria
1. WHERE 创建/编辑右栏 系统 SHALL 提供可收起的「调试」对话面板，按**当前未保存配置**运行
2. WHERE Agent 详情页 系统 SHALL 提供「试跑」入口，按**所选已保存版本**运行，并标明版本号
3. WHEN 用户发送消息 THEN 系统 SHALL 返回 Agent 的真实响应
4. WHERE 多轮对话 系统 SHALL 续接上下文/记忆
5. WHERE 配置含工具/技能 系统 SHALL 在试跑中按权限实际调用
6. IF 运行出错 THEN 系统 SHALL 原样展示错误信息便于排查（不静默）
7. WHERE 运行引擎不可用 系统 SHALL 回退占位响应，保证链路可跑通
8. WHERE 调试与试跑 系统 SHALL 复用同一对话组件，仅输入的配置来源不同

#### 引用 / 影响
- 术语：Agent, Version, Tool, Skill
- 组件：对话窗口（创建/编辑右栏 + 详情试跑 复用）
- 现有功能：与创建/编辑(A)、版本(F)联动

#### 待确认 / 假设
- ❓生产计费 / 调用隔离策略

---

### Requirement: 发布为 Live 服务 🔸MVP
> 决策：发布 = 选择一个**已保存版本**作为 Live + 选择部署方式 + 启动或替换 Runtime。发布不隐式保存配置；有未保存改动时必须先保存为新版本。

**User Story:** 作为项目成员，我希望把某个已保存版本发布成 Live，并选好部署方式，以便把它跑成可对话/可调用的服务。

#### Acceptance Criteria
1. WHERE Agent 工作台 系统 SHALL 在右侧「线上发布与运行」面板展示 Head、Live、Runtime 三行状态
2. WHERE 工作副本存在未保存改动 系统 SHALL 禁用发布入口并提示「先保存为新版本，再选择是否发布」
3. WHEN Agent 尚未发布且无运行服务 THEN 系统 SHALL 提供「发布 vN」，N 为当前 Head 版本
4. WHEN Agent 已运行 THEN 系统 SHALL 提供「重新发布…」与「停服」；重新发布会替换当前运行实例
5. WHEN Agent 已发布但服务停止 THEN 系统 SHALL 提供「启动 Live」与「发布其他版本…」
6. WHEN 用户点击发布类操作 THEN 系统 SHALL 弹出发布选择器，允许选择 Live 版本与部署方式
7. WHERE 部署方式 系统 SHALL 使用意图文案：共享 L1（默认）、独立 L2、即用即弃 L3；同时说明 L0 租户隔离始终生效、不是可选项
8. WHERE 用户选择即用即弃 L3 系统 SHALL 当场提示“每次会话起临时沙箱，跑完销毁；长期记忆需外置”
9. WHERE 措辞 系统 SHALL **不**以“依赖隔离”作为独立环境的主要卖点；独立 L2 的卖点是爆炸半径（故障/资源/安全）+ 系统级依赖
10. WHEN 发布成功 THEN 系统 SHALL 将所选版本设为 Live，并把该 Agent 运行成一个可对话服务，返回稳定调用入口
11. WHERE 同一 Agent 为**单主实例** 系统 SHALL 同一时刻只跑一个 Live Runtime：同版本可复用，换版本或换部署方式则停旧起新
12. WHERE 一个 Agent 同时仅保留**一个 Live 版本** 系统 SHALL 在重新发布或直接发布历史版本时覆盖之前的 Live 指针
13. WHERE 运行引擎未就绪 / 服务未启动 系统 SHALL 给出相应提示

#### 引用 / 影响
- 术语：Version, HeadVersion, LiveVersion, Service, DeploymentMode, Agent, Framework
- 组件：Agent 工作台「线上发布与运行」面板、PublishChooser、PublishModal、VersionHistory Drawer
- 现有功能：与版本(F)、Agent Operations 列表(A)、部署控制台(I)联动

#### 待确认 / 假设
- ⬜后续：云端发布、灰度发布、发布审批、运行日志
- 已定：同一 Agent 当前只有一个 Live 版本；多版本同时在线只通过灰度能力承载（后续）

---

### Requirement: Agent 服务对外调用协议（一次性 / 流式 / 异步）
> Agent 服务对外要支持三种调用形态，按场景选用。一次性与流式为 MVP，异步为后续。

**User Story:** 作为调用方，我希望根据场景用合适的协议调用 Agent 服务，以兼顾简单调用、流式体验与长任务。

#### Acceptance Criteria
1. **协议1 一次性** 🔸：一次返回完整结果（含回复与会话标识），适合短回答 / 内部调用
2. **协议2 流式** 🔸：按序推送增量事件——文本增量、工具调用、完成（含最终回复与会话标识）、错误；适合逐字展示
3. **协议3 异步作业** ⬜后续：长任务提交后返回作业号，经轮询或回调取结果，适合长跑 / 自治 agent
4. WHERE 请求在三种协议间 系统 SHALL 保持一致的输入（消息 + 可选会话标识），仅传输方式不同
5. WHERE 多轮 系统 SHALL 由调用方带回上次会话标识以续接
6. WHERE 运行引擎不可用 系统 SHALL 在各协议下回退占位响应

#### 引用 / 影响
- 现有功能：与发布/运行服务、Playground 联动
- **契约归口**：调用契约与会话(Managed Agent 标准：Agent+Environment+Session、事件驱动、统一 Session)见 [M-agent-api.md](./M-agent-api.md)
- 设计决策：默认交互用流式（行业标准、过代理友好）；长任务用异步作业

#### 待确认 / 假设
- ⬜后续：协议3 的状态模型与回调；双向/打断协议

---

### Requirement: 调用入口稳定（按 id 寻址，端口是内部细节）🔸MVP（已落地）
> 决策：对外调用入口必须**稳定**——按 Agent id / 空间经网关寻址，**不暴露易变的运行端口**。Agent 重启 / 换版本 / 迁移运行环境，入口不变，上游无需改代码。这是"框架/隔离级别正交"得以成立的前提。

**User Story:** 作为集成方，我希望调用 Agent 服务的地址是稳定的，这样 Agent 在后台重启或换环境时，我的应用不用跟着改。

#### Acceptance Criteria
1. WHERE 发布返回调用入口 系统 SHALL 给出**稳定地址**（按 id / 空间经网关路由）；运行端口等易变信息标为**内部细节**，不作为对外契约
2. WHEN Agent 重启 / 换版本 / 迁移运行环境（如共享→独立）THEN 稳定地址 SHALL **保持不变**，上游调用方无需改动
3. WHERE 平台自身重启 系统 SHALL **自动对账**恢复仍在运行的服务并保持路由稳定，不依赖"下次调用才自愈"
4. WHERE 注册表条目指向已失效的运行实例 系统 SHALL 自愈（探活→重起→转发）或返回明确错误，不静默串到死端口
5. WHERE 展示 / 文档 / 调用示例 系统 SHALL 引导上游绑**稳定地址**，并明确"端口是内部细节、勿直连"

#### 引用 / 影响
- 现有功能：与发布、调用协议、运行服务运维、框架可插拔、隔离级别联动
- 设计决策：稳定面 = 按 id 的网关地址；内部面 = 运行端点（端口/实例），二者解耦，使隔离级别可在不动上游的前提下升级
- 落地（注册表落库 + 启动对账 + 自愈 + stable_url/internal_url 字段）属实现，见 ../../技术文档/接口契约.md「对外调用：稳定寻址」

#### 待确认 / 假设
- ⬜后续：多实例/生产用共享注册中心（替代单机内存+落库）；后端入口走反代/域名固定
- ✅已落地：stable_url 字段、SERVICES 落库 + 启动对账、对话前探活自愈

---

### Requirement: Playground（与已发布 Agent 对话） 🔸MVP（已落地）
**User Story:** 作为项目成员，我希望在一个集中入口与所有已发布的 Agent 对话，以便试用线上版本。

#### Acceptance Criteria
1. WHERE 侧边栏 系统 SHALL 提供「Playground」入口
2. WHEN 用户进入 Playground THEN 系统 SHALL 列出**全部已发布**的 Agent（来源 `GET /api/published`），并在选择器中展示名称、Live 版本号（等宽码片 `vN`）与框架（Tag）；模型作为下拉项的补充信息呈现，不作为主选择信息
3. WHEN 用户进入 Playground THEN 系统 SHALL **默认选中列表第一个**已发布 Agent 并自动开始对话，无需用户先手动选择
4. WHEN 用户选择某个已发布 Agent THEN 系统 SHALL 用其**已发布版本**配置开始对话（复用调试对话组件 DebugPanel、真实运行、流式逐字显示），并按 `agentId + version + 当前会话` 作为对话组件的 key 在切换时重置
5. WHERE Playground 系统 SHALL 提供该 Agent 名下会话侧栏，支持新建会话、切换历史会话、删除会话，并通过统一 Session API（`GET /api/sessions?agent=` 列表、`GET /api/sessions/{id}` 详情回显、`POST /api/sessions` 新建、`DELETE /api/sessions/{id}` 删除）维护
6. WHEN 选中某 Agent 且其名下已有会话 THEN 系统 SHALL 自动打开**最近一条**会话并回显历史；若无会话则**自动新建一条**（建会话即确保云端沙箱就绪）
7. WHERE 对话发生在某条会话中 系统 SHALL 走统一 Session 事件端点 `POST /api/sessions/{sid}/events[/stream]`；未绑定会话时回退到无状态服务调用 `POST /api/agents/{id}/service-chat[/stream]`
8. WHERE 新建会话 系统 SHALL **复用已存在的空会话**（消息数为 0）而非重复创建，并对 StrictMode 双跑 / 连点做并发去重
9. WHERE 删除当前会话 系统 SHALL 自动切到剩余最近一条；若已无会话则为当前 Agent 自动新建一条
10. WHERE 会话侧栏 系统 SHALL 可整体收起 / 展开（收起态保留「新建会话」「展开」两个图标按钮）
11. WHERE 选中 Agent 的运行态可得（来源 `GET /api/services`）系统 SHALL 在对话区头部以徽标展示隔离级别（名称 + L 级）、本地 / 云端沙箱与运行状态（running / failed / 其他）
12. WHERE 还没有已发布 Agent 系统 SHALL 展示空状态并引导「去详情或编辑页点『发布』」（此时不渲染 Agent 选择器）
13. WHERE 运行引擎不可用 / 未连后端 系统 SHALL 走本地 mock 占位响应（副标题标注「未连后端 · 本地 mock」），保证链路可跑通
14. WHERE Playground 系统 MAY 以**内嵌（embedded）**形态复用同一组件（隐藏页头、压缩选择器），供其他页面承载

#### 引用 / 影响
- 术语：Agent, Version, Session
- 组件：Playground 页（Agent 选择器 + 可收起会话侧栏 + 右侧对话 + 运行态徽标）；复用调试对话组件 DebugPanel
- 现有功能：与发布 / 运行服务（`/api/services` 运行态）/ M 统一 Session 联动

#### 待确认 / 假设
- ✅已落地：Playground 接入统一 Session（已发布 Agent 在界面获得多会话历史、回显、增删切）
- ❓选中后用其**已发布版本**配置：当前按 `/api/published` 返回的版本取配置；多版本灰度在线时的版本选择策略待灰度能力（⬜后续）落地后明确

---

### Requirement: 运行服务（状态与运维） 🔸MVP
> 决策：服务是“已发布 Agent 的运行态”。普通用户有两个入口：Agent Operations/工作台看单个 Agent 状态，部署控制台集中管理已发布服务；跨用户全局总览仍是平台管理员后续能力。

**User Story:** 作为项目成员，我希望直接在列表/详情看到 Agent 服务的运行态并能启停，以便管理已发布的服务。

#### Acceptance Criteria
1. WHERE Agent Operations 列表 系统 SHALL 在 Live 列显示未发布、运行中、已停止、部署中、失败，以及 Live 版本和部署方式
2. WHERE Agent 工作台 系统 SHALL 提供「线上发布与运行」区：Head、Live、Runtime、稳定调用入口、运行版本、部署方式、可复制调用示例
3. WHERE 服务运行中 系统 SHALL 提供「停服」；已停止时提供「启动 Live」；部署中禁用操作并提示；失败提供「重新发布」
4. WHERE 侧边栏 系统 MAY 提供「停止所有 Agent 服务」（二次确认后停掉全部，用于 demo / 本地调试清理）
5. WHERE 侧边栏「部署」系统 SHALL 作为发布与运行控制台，列出已发布 Agent 的稳定地址、生产版本、部署方式、运行态，并支持管理、停服、重启、版本钉选与部署方式变更
6. WHEN 启停发生 / 云端异步部署进行中 THEN 系统 SHALL 刷新运行态（部署中自动轮询直至运行中/失败）

#### 引用 / 影响
- 组件：Agent Operations Live 列、Agent 工作台运行面板、部署控制台、侧栏「停止所有 Agent 服务」
- 现有功能：与发布、列表(A)、运行环境选择联动

#### 待确认 / 假设
- ⬜后续：start/restart、全局运维总览（平台管理员）、资源/健康监控

---

### Requirement: 运行服务的实例约束与管理（单主实例 / 灰度 / 运行总览） 🔸MVP（单主实例已落地）
> 决策：用「一个已发布 Agent = 一个主运行实例」做不变量把复杂度摁住；多服务只为**灰度发布**一个真实场景存在。隔离级别是单一选择、不可叠加。

**User Story:** 作为项目成员，我希望一个 Agent 的运行服务清晰可控、默认只有一个在跑，避免同一 Agent 在多环境/多版本下起出一堆难管理的服务。

#### Acceptance Criteria
1. WHERE 一个 Agent 已有运行服务 系统 SHALL 默认**单主实例**——再次发布即**替换**（停旧起新）；发布弹窗文案为"将替换当前运行实例"，而非"新增一个"
2. WHERE 运行环境（共享/独立/即用即弃）系统 SHALL **单选**；改环境 = 重新发布**迁移**（停旧起新），**不**允许同一 Agent 在多个环境同时各起一个
3. WHERE 需要"多版本同时在线" 系统 SHALL 仅以**灰度**形态提供：**主版本 + 灰度版本**两档 + 流量比，**不**允许任意多版本平铺（灰度属在线 serving 高级能力，⬜后续）
4. WHERE 即用即弃（每会话临时）系统 SHALL 按会话起销、跑完即焚，**不**进入常驻"运行服务"的实例管理
5. WHERE 展示运行服务 系统 SHALL 让服务**从属于 Agent**；Agent Operations/工作台展示单个 Agent 的 Live 与 Runtime，部署控制台展示当前用户/当前空间下已发布服务的集中运维视图
6. WHERE 多数 Agent（单实例）系统 SHALL 以**极简单行**呈现运行服务；仅开启灰度时才呈现"主 + 灰度 + 流量"
7. WHERE L2/L3/云端等计费运行 系统 SHALL 显示**成本/用量**并支持**闲置自动回收**，让用户自管
8. WHERE 跨 Agent / 跨用户的全局运行总览 系统 SHALL 作为**平台管理员**视图（筛选/批量/成本，⬜后续），不同于普通用户的部署控制台

#### 引用 / 影响
- 术语：Agent, Version, Service
- 现有功能：与发布、运行服务（状态与运维）、运行环境选择、版本(F)联动
- 设计决策：单主实例为不变量；多版本并跑窄化为灰度；隔离级别单选不可叠加。落地形态（进程/沙箱/路由）属实现，见 ../../技术文档/

#### 待确认 / 假设
- ✅已落地：R1 单主实例（换版本/环境=替换迁移）
- ⬜后续：灰度（主+灰度+流量）、成本/用量与闲置回收、平台管理员运行总览

---

### Requirement: 框架可插拔（同一发布/服务/对话流程支撑多框架） 🔸MVP
> 决策：发布/服务/对话主流程与具体框架解耦——新增框架不改主流程，只增加该框架的运行方式适配。框架与隔离级别**正交**。

**User Story:** 作为平台，我希望同一套发布/服务/对话流程能支撑不同 Agent 框架，以便接入新框架而不改主流程。

#### Acceptance Criteria
1. WHERE 创建 Agent 系统 SHALL 支持选择框架（如 Claude Code、OpenClaw），并据框架呈现差异化配置（见 Spec B）
2. WHEN 发布起服务 THEN 系统 SHALL 据 Agent 的框架选择对应运行方式，对外暴露**统一的对话/调用接口**
3. WHERE 新增一个框架 系统 SHALL 只需增加该框架的运行适配，**不改动**发布/服务/对话主流程
4. WHERE 列表 / 详情 / Playground 系统 SHALL 显示 Agent 的框架
5. WHERE 某框架的运行引擎未就绪 系统 SHALL 回退占位响应，保证主流程可跑通

#### 引用 / 影响
- 术语：Agent, Framework
- 现有功能：与发布/服务/对话联动；与隔离级别正交；OpenClaw 多 Agent 部署见下；配置文件差异见 Spec B
- 设计决策：不同框架"怎么跑"的实现差异属技术细节，见 ../../技术文档/

---

### Requirement: OpenClaw 框架的多 Agent 部署 🔸MVP
> 决策：支持同时部署多个 OpenClaw 框架的单 Agent 为服务；各 Agent 相互隔离、按 Agent 路由、可各自选模型、各自人设。具体部署形态（进程 / 网关 / 沙箱）属实现，见 ../../技术文档/。

**User Story:** 作为项目成员，我希望部署多个 OpenClaw 框架的 Agent 并各自发布成可对话服务，以便同时运行多个该框架的 Agent 且互不影响。

#### Acceptance Criteria
1. WHERE 框架为 OpenClaw 系统 SHALL 支持同时部署并运行**多个**该框架的 Agent，每个都是独立可对话的服务
2. WHEN 对某 OpenClaw Agent 发起对话 THEN 系统 SHALL 路由到**该 Agent 本身**，不与其他 Agent 串台
3. IF 对话指向一个未部署 / 未托管的 Agent THEN 系统 SHALL 返回明确错误，而非静默串台
4. WHEN 停止某个 OpenClaw Agent 的服务 THEN 系统 SHALL **不影响**同时运行的其他 OpenClaw Agent
5. WHERE 多轮对话 系统 SHALL 续接该 Agent 的上下文 / 记忆
6. WHERE 各 OpenClaw Agent 系统 SHALL 以其自身配置文件（角色 / 行为 / 用户上下文，见 Spec B）决定人设
7. WHERE 同时运行多个 OpenClaw Agent 系统 SHALL 允许它们各自使用**不同模型**（见 Spec C）
8. WHERE 运行引擎未就绪 系统 SHALL 回退占位响应，保证发布 / 对话 / 流式 / 停服全链路可跑通

#### 引用 / 影响
- 术语：Agent, Framework, Version
- 现有功能：与「框架可插拔」「发布」「调用协议」「Playground」「运行服务运维」联动；每 Agent 模型见 Spec C；配置文件见 Spec B
- 设计决策：OpenClaw 引擎对接、部署形态、模型映射、人设文件映射等实现细节见 ../../技术文档/

#### 待确认 / 假设
- 前提：目标运行环境具备 OpenClaw 运行引擎（否则走占位回退）

---

### Requirement: 运行时隔离级别 🔸MVP（产品入口已落地，生产编排继续演进）
> 决策：Agent/会话运行时隔离是"隔离强度 ↔ 成本"的连续谱，**按 agent（甚至按操作）可配**，默认从粗到细升级。发布时的**运行环境选择**（共享/独立/即用即弃）即此策略的用户侧入口。

**User Story:** 作为平台，我需要按重要性/安全性给 Agent 选择合适的运行时隔离级别，以在隔离与成本间取得平衡。

#### Acceptance Criteria
1. WHERE 任意运行 系统 SHALL 以**每用户边界**为底线——跨用户**绝不**共享运行环境
2. WHERE 默认 系统 SHALL 用**同一用户内多 Agent 共享环境 L1**（最省）
3. WHERE Agent 重要 / 需更强隔离 系统 SHALL 支持**每 Agent 独立环境 L2**
4. WHERE 需会话级隔离（如跑不可信代码）系统 SHALL 支持**每会话临时环境 L3**（跑完即焚）
5. WHERE 选择级别 系统 SHALL 由判定维度驱动（不可信代码 / 爆炸半径 / 依赖冲突 / 资源 / 合规），可按 Agent 配置，并允许按操作临时升级
6. WHERE 任一运行环境 系统 SHALL 明确隔离：进程、文件系统、网络出口、依赖、密钥/凭证、资源配额
7. WHERE 会话级临时环境 系统 SHALL 把长期记忆**外置**，会话结束不丢
8. WHERE 更细粒度隔离 系统 SHALL 兼顾成本与冷启动（预热 / 空闲回收）

#### 引用 / 影响
- 现有功能：与发布/服务、部署方式选择、Playground 会话联动
- 设计决策：隔离是按 agent/操作可配的策略，非固定三桶；用户层为必备底线；分级隔离的具体落地见 ../../技术文档/

#### 待确认 / 假设
- ❓默认升级策略与判定阈值（什么条件自动升级）
- ⬜后续：生产编排/调度（预热、空闲回收）、记忆外置存储方案、真实成本/用量展示

---

### Requirement: 运行日志与用量 ⬜后续
**User Story:** 作为项目成员/管理员，我希望查看 Agent 的运行日志与用量，以便监控与排查。

#### Acceptance Criteria
1. WHEN 用户进入某 Agent 的运行视图 THEN 系统 SHALL 展示调用记录、错误率、用量统计
2. WHERE 出现异常 系统 SHALL 可下钻到具体调用详情

#### 待确认 / 假设
- ❓统计维度与留存周期
- ❓是否本期范围
