---
name: 会话控制台（会话 Tab）
last amended: 2026-06-29
version: 2
description: 一个新的「会话」Tab，按「创建人」维度聚合并展示我创建的 Agent（含 L1/L2/L3 三种运行方式）曾经活跃过的全部会话明细；只能看到自己是创建人的 Agent 的会话。
---

# 会话控制台 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 关系：本模块是 **M（调用契约与会话）** 的**消费/观测面**——M 定义「会话怎么产生、怎么落库」，N 定义「会话怎么被它的创建人看见、检索、回看」。N 不新增调用契约，只新增聚合查询与展示。
> 数据归集/上云的实现（各隔离级别如何把会话写回平台）见 ../../技术文档/会话数据归集与上云.md。
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 定位

平台已有「统一会话（M）」：与任意 Agent（copilot 或已发布 Agent）的每一轮对话都由**服务端落库**。但当前只有「按当前用户（对话发起人）」看自己的会话，缺一个**面向 Agent 创建人的观测入口**：

```
我创建的 Agent（A/B/C…，分别跑在 L1 共享 / L2 独立 / L3 即用即弃）
        ↓ 谁都可能与它对话，产生很多 Session
会话 Tab：把「我创建的所有 Agent」的会话聚合到一处，可检索、可回看明细
        ↓ 边界
只看得到「自己是创建人」的 Agent 的会话；别人创建的 Agent 的会话一律不可见
```

一句话：**Agent 列表是「我的 Agent 配置」，会话 Tab 是「我的 Agent 被怎么用了」。**

## ADDED Requirements

### Requirement: 会话 Tab 入口与跨 Agent 聚合列表 ✅已确认（已落地）
**User Story:** 作为 Agent 创建人，我希望有一个「会话」Tab，把我创建的所有 Agent（不论跑在哪种环境）曾经活跃过的会话聚合成一个列表，以便集中了解我的 Agent 都被怎么使用。

#### Acceptance Criteria
1. WHEN 用户点击左侧导航「会话」 THEN 系统 SHALL 进入会话 Tab，并展示一个跨 Agent 的会话列表
2. WHERE 会话列表 系统 SHALL 每行展示：会话标题（含状态药丸，如「● 活跃」）、所属 Agent 名称、运行环境（共享 L1 / 独立 L2 / 即用即弃 L3 · 本地/云端）、发起人（非本人时加「他人」标记）、对话轮次数（缺省按消息数 ⌈count/2⌉ 估算）、最后活跃时间
3. WHERE 一个 Agent 跑在 L1/L2/L3 任意一种环境 系统 SHALL 同等纳入聚合，不因隔离级别不同而遗漏或区别对待（隔离与归集正交）
4. WHERE 通用助手 copilot 系统 SHALL 视作一个**特殊 Agent** 同样纳入本 Tab——其会话归该会话的发起人本人可见（copilot 无独立创建人，发起人即可见人）
5. WHERE 某会话**一轮对话都没有发生**（只新建、无任何 user/assistant 消息）系统 SHALL **不计入**列表（“曾经活跃过”口径=至少 1 轮）
6. WHERE 列表排序 系统 SHALL 默认按「最后活跃时间」倒序
7. IF 当前用户名下尚无任何已创建 Agent 产生过会话 THEN 系统 SHALL 展示空状态文案，并引导前往 Agent 列表/部署
8. WHERE 列表超过单页阈值（默认 20 条/页）系统 SHALL 分页加载，不一次性拉全量

#### 引用 / 影响
- 术语：Session, Agent, Environment, 创建人（Creator）, 隔离级别(L1/L2/L3)
- 组件：Table、Tag（环境/状态用 pill）、Segmented/Select（过滤）、Empty（空状态）
- 现有功能：复用 M 的会话落库；与 A（Agent 列表）互补——A 看配置，N 看使用
- 设计决策：聚合维度=**Agent 创建人**，区别于 Chat/Playground 的「当前对话发起人」维度；copilot 作特例并入

#### 待确认 / 假设
- ✅copilot 作为特殊 Agent 并入本 Tab（已确认）；✅空会话不计入（已确认）
- ⬜后续：会话状态机（active/archived/失败）丰富后，状态列取值随之扩展（对齐 M Phase 4）

---

### Requirement: 创建人维度的可见性与隔离 ✅
**User Story:** 作为平台，我希望会话明细只对「该 Agent 的创建人」可见，以便满足"只能搜索到自己是创建人的 Agent 的 session 明细"这一硬约束。

#### Acceptance Criteria
1. WHERE 会话 Tab 的列表与明细 系统 SHALL 仅返回 `agent.creator == 当前用户` 的 Agent 所产生的会话；copilot 会话则按 `发起人 == 当前用户` 可见
2. IF 某会话所属 Agent 的创建人不是当前用户（且非 copilot 本人会话）THEN 系统 SHALL 不在列表中展示该会话，且直接按会话 id 访问其明细 SHALL 返回 404/无权（不泄露存在性）
3. WHERE 跨项目空间 系统 SHALL 以「创建人」为唯一可见性判据——只要 Agent 是我创建的，其会话即对我可见，不受我当前所在空间限制（创建人 ⊇ 空间维度）
4. WHERE 同一 Agent 被多个不同对话发起人使用 系统 SHALL 把这些会话都归到该 Agent 的创建人名下可见（创建人可见「别人怎么用我的 Agent」）
5. WHERE 创建人查看其 Agent 的会话明细 系统 SHALL 展示**完整对话内容**（非仅元数据、不脱敏）——满足"session 明细"的字面要求

#### 引用 / 影响
- 术语：创建人（Creator）、对话发起人、Workspace、PlatformAdmin
- 现有功能：M 现有按「对话发起人(user)」隔离；本模块叠加「按 Agent 创建人」的查询维度，二者并存不冲突
- 数据：需要 Agent 记录其**创建人**（见 技术文档/会话数据归集与上云.md「数据模型变更」）

#### 待确认 / 假设
- ✅**内容隐私**：创建人可见他人使用其 Agent 的**完整对话内容**、不脱敏（已确认，见 AC5）
- ❓「创建人」是否可转移/继承（Agent 易主、创建人离职）：假设本期固定为初始创建人，转移留后续

---

### Requirement: 平台管理员全局可见 ⬜后续（正式要求，本期不做）
**User Story:** 作为平台管理员（PlatformAdmin），我希望可以越过创建人边界查看全平台所有会话，以便审计、合规与排障。

#### Acceptance Criteria
1. WHERE 当前用户为 PlatformAdmin 系统 SHALL 允许其在会话 Tab 查看**全平台**会话，不受「创建人 == 自己」限制
2. WHERE PlatformAdmin 查看 系统 SHALL 标注其为「管理员视角」，并对越权访问留审计记录（对齐 J 审计）
3. WHERE 非 PlatformAdmin 系统 SHALL 始终受创建人边界约束（本要求不放宽普通用户可见性）

#### 引用 / 影响
- 术语：PlatformAdmin、创建人、审计
- 现有功能：与 J（RBAC/审计）联动
- 设计决策：作为正式要求固化，**本期(MVP)不实现**，仅创建人可见；待 J 的 RBAC/审计后台就绪后落地

#### 待确认 / 假设
- ⬜后续：管理员视角是否需空间级管理员（Owner）中间层，还是仅平台级——假设仅平台级

---

### Requirement: 会话明细回看 ✅已确认（已落地）
**User Story:** 作为 Agent 创建人，我希望点开某条会话看到完整的对话过程与运行上下文，以便排查问题、评估效果、复盘使用方式。

#### Acceptance Criteria
1. WHEN 用户点击某条会话 THEN 系统 SHALL 打开该会话明细，按时间顺序完整展示每一轮 user / assistant 消息
2. WHERE 会话明细 系统 SHALL 展示运行上下文：标题、会话 id、状态（标题区）；并在元数据条展示**列表未覆盖**的运行上下文——调用时的版本号（`v{agentVersion}`）、归集来源（平台界面/网关直连/云端回传）、创建时间（其余如所属 Agent/环境/发起人/最后活跃已在列表呈现，不在明细重复）
3. WHERE 每条消息 系统 SHALL 按 user/assistant 区分气泡左右，并各自带时间戳；`role==='sys'` 的系统提示居中弱化展示
4. WHERE 某轮消息标记为出错（`m.err`）系统 SHALL 在该轮可视化标注「出错」并以错误色气泡呈现，便于定位失败轮次
5. WHERE 会话明细 系统 SHALL 为**只读**——创建人只能回看，不能在此续写或修改历史（底部固定「只读 · 创建人视角回看」提示）
6. WHERE 明细抽屉 系统 SHALL 可左右拖拽改变宽度（默认 560px，可拖拽范围 420px～视口宽-120px）
7. WHEN 用户从明细返回 THEN 系统 SHALL 回到聚合列表并保留此前的过滤/分页状态

#### 引用 / 影响
- 术语：Session, Version, Environment, 对话发起人
- 组件：Drawer/详情页、消息气泡（复用 Chat/Playground 的消息渲染）、Descriptions（元数据）
- 现有功能：复用 M 的 `GET /api/sessions/{id}`（扩展返回 agent/version/isolation/发起人等元数据）

#### 待确认 / 假设
- ⬜后续：导出会话（JSON/纯文本）、按会话发起「再调试」或「转为用例」
- ❓L3 即用即弃：沙箱内的工具调用日志/产物（非对话文本）是否也要回看——假设 MVP 只回看**对话文本**（已落平台库），沙箱内产物属后续（需外置存储）

---

### Requirement: 会话检索与过滤 ✅已确认（已落地）
**User Story:** 作为创建人，当我有很多 Agent、很多会话时，我希望按 Agent、环境、时间、状态过滤并搜索，以便快速定位目标会话。

#### Acceptance Criteria
1. WHERE 会话 Tab 系统 SHALL 提供按「所属 Agent」过滤；候选项来自服务端返回的 `facets.agents`（含每个 Agent 的会话计数，作为下拉文案 `名称（N）`），可搜索
2. WHERE 会话 Tab 系统 SHALL 提供按「运行环境/隔离级别（L1/L2/L3）」过滤（Segmented：全部环境 / 共享 L1 / 独立 L2 / 即用即弃 L3）
3. WHERE 会话 Tab 系统 SHALL 提供按关键词搜索会话标题；输入**防抖 300ms** 后才打服务端（`q` 参数），并回到第 1 页；搜索 SHALL 仅在「我可见」的会话范围内进行
4. WHEN 用户施加任一过滤/搜索 THEN 系统 SHALL 重置到第 1 页并刷新列表与分页计数（工具条显示「共 N 条」，有过滤时附「（已过滤）」），匹配为 0 时展示「没有匹配的会话」空状态
5. WHERE 过滤条件 系统 SHALL 可组合（Agent + 环境 + 关键词同时生效，取交集）；`facets`（概览/候选全集）取自服务端且**不随过滤变化**
6. WHERE 列表刷新 系统 SHALL 由过滤/搜索/翻页变更驱动，并提供手动「刷新」按钮；**不做自动轮询**（明细打开后亦为一次性拉取，不实时跟流）

#### 引用 / 影响
- 术语：Agent, 隔离级别(L1/L2/L3), Session
- 组件：Select（Agent/环境）、Input.Search（关键词）
- 现有功能：扩展 `GET /api/sessions` 的查询参数（`creator`/`agent`/`isolation`/`q`/分页）

#### 待确认 / 假设
- ⬜后续：按对话内容全文检索（涉及落库结构/索引，量大时另行设计）
- ⬜后续：按「对话发起人」过滤（创建人想看某个用户怎么用我的 Agent）

---

### Requirement: 全量归集——L1/L2/L3 与平台外直连均不遗漏 🔸MVP（部分 ⬜后续）
**User Story:** 作为创建人，我希望"曾经活跃过"的会话**真的全都在**，不论 Agent 当时跑在共享/独立/即用即弃环境，也不论是经平台界面还是经稳定地址被外部系统调用，以便会话 Tab 是可信的全集而非样本。

#### Acceptance Criteria
1. WHERE Agent 跑在 L1/L2/L3 任一环境且经平台统一会话接口对话 THEN 系统 SHALL 已**逐轮把会话落到平台库**，会话 Tab 据此即可完整呈现（无需各环境另做归集）
2. WHERE L3 即用即弃——沙箱用完即焚 系统 SHALL 保证**对话明细不随沙箱销毁而丢失**（明细由平台侧持有，非仅存于临时沙箱）
3. WHERE 外部系统经**稳定地址/网关**直连已发布 Agent（不经平台会话接口）产生的会话 系统 SHALL 同样被归集进平台库，并对该 Agent 创建人可见
4. IF 某条会话的归集发生延迟或失败 THEN 系统 SHALL 不致使会话 Tab 报错或串号——失败的那条最坏「暂不出现」，已归集的不受影响
5. WHERE 一条会话被归集 系统 SHALL 记录其归集来源（平台界面 / 网关直连 / 云端回传），便于审计与排障

#### 引用 / 影响
- 术语：Session, Environment, 隔离级别, 稳定寻址, 网关(Gateway)
- 现有功能：M 已实现「经平台接口的逐轮落库」（含云端 L2/L3 由后端代理时同样落库）——AC1/AC2 基本已满足；AC3/AC5 需新增（网关旁路归集）
- 实现：见 ../../技术文档/会话数据归集与上云.md（归集通道、幂等、字段映射）

#### 待确认 / 假设
- 🔸MVP=AC1/AC2（经平台接口的 L1/L2/L3 全覆盖，已基本就绪）
- ⬜后续=AC3/AC5（外部直连旁路归集：需网关/云端运行时把会话异步回传平台；涉及契约与可靠投递）
- ✅「曾经活跃过」=至少 1 轮对话（空会话不计入，见 N1-AC5）（已确认）

---

## 对外契约（规范性 · 端点面，归 M 扩展）

> 本 Tab 不新增调用语义，仅在 M 的统一 Session API 上**扩展只读聚合查询维度**；完整 schema 见 ../../技术文档/接口契约.md。

- `GET /api/sessions?scope=created&page={0-based}&size=20[&agent=&isolation=&q=]` → 按「当前用户为创建人」聚合（含 copilot 本人会话），仅返回**至少 1 轮**的会话。响应 `{ items:[…], total, facets:{ agents:[{value,label,count}] } }`；每行字段含 `id`、`title`、`agentName`/`agent`、`isolation`、`location`、`initiator`、`rounds`（或由 `count` 推算）、`status`、`updatedAt`。缺省 `scope=mine`（沿用旧语义=按发起人看自己的）。
- `GET /api/sessions/{id}`（扩展返回）→ 在原 `messages:[{role,text,ts,err?}]`（**完整内容、不脱敏**；`role` ∈ user/assistant/sys）基础上补充 `title`、`status`、`agentVersion`、`source`（platform/gateway/cloud-callback，明细以「平台界面/网关直连/云端回传」呈现）、`createdAt` 等元数据；服务端先校验「当前用户是该会话所属 Agent 的创建人，或 copilot 本人，或 PlatformAdmin（后续）」，否则 404。
- **可见性判据（规范性）**：一条会话对用户 U 可见 ⟺ `session.agent_ref` 对应 Agent 的 `creator == U`（创建人维度）**或** `session.agent_ref=='copilot' 且 session.user == U`（copilot 本人）**或** `U 为 PlatformAdmin`（⬜后续）。会话 Tab 主用创建人维度。

## 落地路线（分阶段）

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 1 | Agent 记录创建人；`GET /api/sessions?scope=created`；会话 Tab 列表 + 明细 + 基础过滤（基于已落库的 L1/L2/L3 会话） | ✅已落地 |
| Phase 2 | 明细元数据补全（版本/环境/发起人/来源）、按 Agent/环境/关键词过滤完善、防抖搜索、facets 候选、可拖拽明细抽屉 | ✅已落地 |
| Phase 3 | 外部直连（网关/云端）会话旁路归集 + 来源标记 + 可靠投递（前端已能渲染 `source`=网关直连/云端回传；后端旁路归集投递尚未实现） | 🔸部分（仅前端展示位） |
| Phase 4 | 内容全文检索、导出、按发起人过滤、内容脱敏策略、归档/保留期、PlatformAdmin 全局视角 | ⬜ |
