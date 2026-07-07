---
name: 定时任务（Deployment 任务模板与调度）
last amended: 2026-07-06
version: 1
description: 「部署」= 可触发的任务模板（Agent + 版本策略 + 指令 + 调度；运行环境复用 Agent 发布设置）；cron/一次性/手动触发均产出一次运行(Run)与一条会话(Session)，运行台账可回看，对齐 Claude Managed Agents 的 deployment 语义
---

# 定时任务 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> **本文件只描述功能与验收标准（WHAT），不绑定实现/架构/后端。** 引擎对接、cron 解析、调度器、表结构等技术细节见 ../../技术文档/。
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认
> 与 I（运行与发布）的边界：**I 管「把 Agent 发布成常驻可调用服务」；本 O 管「让 Agent 按计划自动跑一次并留台账」。** 二者共用 Agent/版本(F)/运行环境(I)/会话(M/N)，但入口与语义不同：发布是开关闸门 + 稳定地址，定时任务是任务模板 + 运行台账。

## 背景与定位

对齐 **Claude Managed Agents**：deployment **不是**「常驻服务的开关」，而是**可触发的任务模板** = Agent + 初始指令(+ 可选 cron)，运行环境复用 Agent 发布设置。手动触发或定时触发都产出一条 **Session**（真实执行一轮）+ 一条 **Run**（台账）。版本服务的是「触发时解析的活跃指针」，不是写死的实例；**回滚 = 改版本策略，不算一次新部署**。侧边栏「部署」tab 即为「定时任务」控制台。

---

## Requirements

### Requirement: 定时任务模板（Deployment）的增删改查 🔸MVP
> 决策：一个定时任务 = 一份模板（Agent + 版本策略 + 任务指令 + 调度；运行环境复用 Agent 发布设置）。模板可启用/停用、可编辑、可删除；删除保留历史运行台账与会话。

**User Story:** 作为项目成员，我希望把某个 Agent 配置成一份可按计划自动运行的任务模板，以便它无人值守地周期性执行。

#### Acceptance Criteria
1. WHERE 侧边栏 系统 SHALL 提供「定时任务」入口（原「部署」tab 重定位），并以列表 + 新建/编辑弹窗 + 运行历史抽屉承载
2. WHEN 用户点击「新建定时任务」 THEN 系统 SHALL 弹出表单，依次采集：任务名(必填,≤40字)、Agent(必填,**只列已发布 Agent**)、版本策略、任务指令、调度方式；**不采集运行环境**（复用 Agent 发布设置，见下）
3. WHERE **无任何已发布 Agent** 系统 SHALL 禁用「新建定时任务」入口并提示「需先发布至少一个 Agent」（空状态引导去「Agent」发布）
4. WHERE 列表每行 系统 SHALL 展示：任务名、所属 Agent、版本策略、运行环境、调度摘要、下次运行时间、上次运行结果(状态+耗时)、启用开关、操作(立即运行/运行历史/编辑/删除)
5. WHEN 用户切换某任务的启用开关 THEN 系统 SHALL 启用或停用其自动调度；停用时不再自动触发，且「下次运行」显示为空
6. WHEN 用户编辑任务 THEN 系统 SHALL 允许改名/版本策略/指令/调度（运行环境不可改，跟随发布）；WHILE 任务已创建 系统 SHALL 禁止改绑到另一个 Agent（换 Agent = 新建任务）
7. WHEN 用户删除任务 THEN 系统 SHALL 二次确认后删除模板，并**保留**其历史运行台账与已产生的会话
8. IF 未连后端 THEN 系统 SHALL 展示「需先在本机启动后端」的空状态，不静默白屏
9. WHERE 尚无任务但有已发布 Agent 系统 SHALL 展示空状态并引导「新建定时任务」（含三步说明）

#### 引用 / 影响
- 术语：Deployment(定时任务), Agent, Version, Isolation(运行环境), Session, Run
- 组件：SchedulePanel（任务列表 + 新建/编辑 Modal + 运行历史 Drawer）
- 现有功能：与 Agent(A)、版本(F)、运行环境(I)、会话(N)联动

#### 待确认 / 假设
- 假设：任务归属当前用户/当前空间；跨用户任务总览属平台管理员后续能力
- ⬜后续：任务级权限、模板复制、批量启停

---

### Requirement: 版本策略在触发时解析（跟随最新 / 钉住某版）🔸MVP
> 决策：对齐 Claude「session 创建时解析活跃版本」——定时任务不写死版本实例，而是存**策略**，每次触发时解析成具体版本。回滚 = 改钉选，不产生新部署。

**User Story:** 作为项目成员，我希望定时任务能「总是跑最新版」或「钉在某个稳定版本」，以便在迭代 Agent 时控制自动任务用哪一版。

#### Acceptance Criteria
1. WHERE 版本策略 系统 SHALL 提供两种：`跟随最新`（每次触发解析为当时 Head 版本）、`钉住 vN`（固定某已保存版本）
2. WHEN 任务被触发 THEN 系统 SHALL 在**触发时刻**把策略解析成具体版本号，并将该版本号记入本次运行台账
3. WHERE 策略为跟随最新且 Agent 已出新版本 系统 SHALL 使下次运行自动采用新版本，无需改任务
4. WHERE 用户从钉住改回跟随最新（或改钉另一版）系统 SHALL 视为**编辑模板**，不产生新的运行、不改历史台账

#### 引用 / 影响
- 术语：Version, HeadVersion, Deployment, Run
- 现有功能：与版本(F)、M 会话版本钉选一致（触发时解析）

---

### Requirement: 调度方式（重复 cron / 一次性 / 仅手动）🔸MVP
> 决策：三种调度覆盖常见场景。cron 用 5 字段标准表达式 + 常用预设；一次性到点即停用；仅手动只能「立即运行」。

**User Story:** 作为项目成员，我希望灵活地定运行计划——周期重复、指定某一时刻、或纯手动，以适配不同任务节奏。

#### Acceptance Criteria
1. WHERE 调度方式 系统 SHALL 提供三选一：重复(cron)、一次性、仅手动
2. WHERE 重复(cron) 系统 SHALL 提供常用预设（每5分钟/每小时/每天9点/每周一9点/每月1号）与「自定义 cron」，自定义时接受 5 字段表达式(分 时 日 月 周)
3. IF cron 表达式非法 THEN 系统 SHALL 在保存时阻止并提示，不写入非法计划
4. WHERE 一次性 系统 SHALL 采集具体运行时刻；WHEN 该时刻到达并触发后 THEN 系统 SHALL 自动停用该任务，「下次运行」清空
5. WHERE 仅手动 系统 SHALL 不自动触发，仅可通过「立即运行」执行
6. WHEN cron 任务到达触发点 THEN 系统 SHALL 触发一次运行，并把「下次运行」推进到下一个匹配时刻
7. WHERE 后端重启 系统 SHALL 对账恢复各启用任务的「下次运行」；错过的周期任务按 misfire=跳过处理（不补跑历史），过期的一次性任务直接停用
8. WHERE 后端重启前有运行中的 Run 系统 SHALL 将其收尾为失败（标注「运行中断」），不留悬挂态

#### 引用 / 影响
- 术语：Deployment, Run, Schedule/Cron
- 现有功能：调度器为后端常驻能力；cron 语义/解析实现见 ../../技术文档/
- 设计决策：misfire 默认跳过，避免重启后一次性补跑一大批

#### 待确认 / 假设
- ⬜后续：时区可配（当前按服务器本地时区）、misfire 补跑一次的可选策略、秒级 cron

---

### Requirement: 触发即产出一次运行(Run)与一条会话(Session) 🔸MVP
> 决策：手动/定时触发走同一条执行流——解析版本 → 确保 Agent 服务就绪 → 新建一条会话(source=schedule) → 发送任务指令跑一轮 → 落一条运行台账。运行的**完整过程与结果就是那条会话**，Run 只存指针与元数据。

**User Story:** 作为项目成员，我希望每次自动/手动运行都留下可追溯的记录，并能看到 Agent 当次的完整对话过程，以便验证任务是否如期完成。

#### Acceptance Criteria
1. WHEN 任务被触发（cron 到点 或 手动「立即运行」）THEN 系统 SHALL 解析版本 → 确保该 Agent 按解析版本 + **发布环境**就绪 → 新建一条会话 → 用任务指令发起一轮真实执行
2. WHERE 新建的会话 系统 SHALL 标注来源为「定时任务」(source=schedule)，归到任务创建人名下，标题含任务名与触发时间
3. WHERE 任务指令 系统 SHALL 支持模板变量 `{{date}}`、`{{time}}`、`{{task}}`，在触发时渲染为实际值后作为开场消息
4. WHEN 一次运行开始/结束 THEN 系统 SHALL 写一条运行台账：触发方式(定时/一次性/手动)、解析到的版本、状态、起止时间、耗时、指向的会话 id
5. WHERE 运行状态 系统 SHALL 覆盖：运行中、成功、失败、跳过；失败 SHALL 记录错误原因
6. WHERE 同一任务上一次运行尚未结束 系统 SHALL 采用并发策略「跳过」——记一条 `跳过` 台账并说明原因，不并行起第二次
7. WHERE 手动「立即运行」 系统 SHALL 异步执行（运行可能耗时数十秒），前端轮询运行历史看 运行中→成功/失败 的流转
8. WHERE 运行环境为云端(L2/L3)且异步部署中 系统 SHALL 等待就绪后再发起；部署失败则该次运行记为失败
9. IF Agent 运行引擎不可用/未登录 THEN 系统 SHALL 让该次运行的会话如实记录错误信息（不静默），运行状态仍可为成功但内容含错误提示

#### 引用 / 影响
- 术语：Run, Session, Deployment, Version, Isolation
- 现有功能：复用 M 统一 Session（服务端有状态、真实执行）；与运行环境(I)、发布/服务(I)联动
- 设计决策：Run 不复制会话大文本，只存 session_id + 元数据；过程/结果的单一事实来源是会话本身

#### 待确认 / 假设
- ✅已定：并发策略 P0 = 跳过（不排队、不并行）
- ⬜后续：并发策略可配（排队/并行）、超时与失败重试、结果产物/摘要卡片、运行完成通知(webhook/邮件)

---

### Requirement: 仅已发布 Agent 可建定时任务、运行环境复用发布设置 🔸MVP
> 决策：运行环境（隔离级别）与版本在**发布 Agent(I)** 时已经定过，定时任务不再单独配置——直接复用发布设置，发布是唯一事实来源。由此得出硬前提：**只能给已发布的 Agent 建定时任务**；未发布则没有可复用的运行环境，引导用户先发布。

**User Story:** 作为项目成员，我希望定时任务直接沿用我发布该 Agent 时选的运行环境，这样只在一处配置、不必重复选、也不会两处不一致；未发布的 Agent 则先让我去发布。

#### Acceptance Criteria
1. WHERE 新建定时任务 系统 SHALL 只允许选择**已发布**的 Agent；IF 目标 Agent 未发布 THEN 系统 SHALL 阻止创建并提示「请先发布该 Agent，再为它创建定时任务」
2. WHERE 新建/编辑定时任务 系统 SHALL **不**提供运行环境选择控件；改为只读展示「复用发布环境」+ 该 Agent 当前发布环境(如 L1/L2/L3)
3. WHEN 任务被触发 THEN 系统 SHALL 用该 Agent **发布时**的运行环境确保服务就绪（与发布保持同一环境）
4. WHERE 任务列表 系统 SHALL 展示该任务的有效运行环境（即 Agent 当前发布环境），并说明其来源为发布设置
5. WHERE 用户改变了 Agent 的发布环境（重新发布到别的隔离级别）系统 SHALL 使定时任务的后续运行自动跟随新的发布环境，无需改任务

#### 引用 / 影响
- 术语：Isolation(运行环境), Deployment, Publish
- 现有功能：运行环境/版本的选择归口到发布(I)；定时任务只消费不重复配置；语义/文案沿用 I 的 ISOLATIONS
- 设计决策：**未发布不建**——避免出现「没有运行环境的定时任务」；后端在创建接口硬校验，前端选择器只列已发布

#### 待确认 / 假设
- 已定：运行环境唯一来源是 Agent 发布设置；定时任务不再有独立 isolation（后端 isolation 列弃用）；未发布 Agent 不允许建定时任务
- ❓若未来需要「同一 Agent、不同定时任务用不同环境」，再引入任务级覆盖（当前不做）

---

### Requirement: 运行历史与会话回看（深链到会话 Tab）🔸MVP
> 决策：运行历史抽屉给「扫读」——每条 Run 一行状态/触发/版本/耗时/结果截断；看「完整过程」则深链跳到会话 Tab 打开对应会话明细，**不在定时任务里另建一套会话视图**（单一事实来源）。

**User Story:** 作为项目成员，我希望快速浏览某任务的历次运行，并能一键跳到某次运行的完整对话，以便排查与验证。

#### Acceptance Criteria
1. WHEN 用户点击某任务的「运行历史」 THEN 系统 SHALL 在抽屉中按时间倒序列出历次运行：状态、触发方式、解析版本、开始时间、耗时、结果/错误摘要(截断)
2. WHERE 运行历史抽屉打开期间 系统 SHALL 轮询刷新，反映 运行中→成功/失败 的实时流转
3. WHEN 用户点击某条运行的「查看会话」 THEN 系统 SHALL 跳转到「会话」Tab 并直接打开该运行对应的会话明细（完整往返对话）
4. WHERE 会话明细 系统 SHALL 复用会话 Tab(N) 既有的只读回看组件，不重复实现
5. WHERE 某次运行尚无会话（如极早期失败）系统 SHALL 不展示「查看会话」，仅显示错误原因

#### 引用 / 影响
- 术语：Run, Session
- 组件：运行历史 Drawer；深链目标为会话控制台(N) 明细抽屉
- 现有功能：与会话控制台(N)强联动；跳转由 App 层 nav 切换 + 传 sessionId 承接

#### 待确认 / 假设
- 边界：会话「完整过程」的粒度受 M 现状约束（messages 数组，暂无工具调用级事件日志）；事件日志升级属 M 的独立演进，不阻塞本功能

---

### Requirement: 会话来源标记与过滤（含定时任务）🔸MVP
> 决策：会话 Tab 需能区分「谁在什么时候创建了会话」。来源枚举暴露为过滤器，定时任务产生的会话带专属标记。

**User Story:** 作为 Agent 创建人，我希望在会话列表里一眼分辨哪些会话来自定时任务、哪些是我在界面里手动发起的，并能按来源筛选。

#### Acceptance Criteria
1. WHERE 会话列表每行 系统 SHALL 对 source=schedule 的会话展示「定时任务」标记（含时钟图标）
2. WHERE 会话 Tab 工具栏 系统 SHALL 提供来源过滤：平台界面(platform)、定时任务(schedule)、网关直连(gateway)，且每个选项附一句说明
3. WHERE 会话明细 系统 SHALL 在元数据区展示「归集来源」
4. WHERE 尚未接通的「云端回传(cloud-callback)」来源 系统 SHALL **不**作为过滤器可选项，直到该归集路径真实接通
5. WHEN 按来源过滤 系统 SHALL 与其他过滤条件(Agent/环境/关键词)及分页组合生效（服务端过滤）

#### 引用 / 影响
- 术语：Session, Source(归集来源)
- 组件：会话控制台(N) 工具栏来源 Select + 列表来源标记 + 明细归集来源
- 现有功能：扩展会话控制台(N)；来源枚举与 M 的会话来源字段一致

---

### Requirement: Playground 不展示定时任务会话 🔸MVP
> 决策：Playground 是「交互式试跑」场所，定时任务产生的无人值守会话不应混入其会话侧栏；这些会话仅在会话 Tab 可见。

**User Story:** 作为项目成员，我希望 Playground 的会话侧栏只保留我手动发起的交互会话，避免被大量定时运行的会话淹没。

#### Acceptance Criteria
1. WHERE Playground 的会话侧栏 系统 SHALL 排除 source=schedule 的会话
2. WHERE 会话 Tab 系统 SHALL 仍能看到这些定时任务会话（不受 Playground 的排除影响）

#### 引用 / 影响
- 现有功能：Playground(I) 的会话侧栏加来源排除；与会话控制台(N) 的可见范围互补

---

### Requirement: 定时任务 UI 遵循视觉规范 🔸MVP
> 决策：定时任务 tab 属「运营列表页」，须遵循 ../视觉规范.dc.html（authoritative）的骨架、密度、token 与状态色。

**User Story:** 作为使用者，我希望定时任务页与平台其余控制台页视觉一致、专业克制、信息高密度。

#### Acceptance Criteria
1. WHERE 页面结构 系统 SHALL 为「标题 + 工具栏 + 表格」；标题 22px/760、说明 12.5px，主入口唯一(「新建定时任务」)
2. WHERE 工具栏 系统 SHALL 提供搜索(任务名/Agent) + 启用状态过滤 + 计数 + 刷新
3. WHERE 颜色/圆角/间距 系统 SHALL 只用规范 token（中性 #0F172A/#64748B/#94A3B8、描边 #DFE3EA/#E2E8F0、下沉面 #F8FAFC）；状态用语义色（成功 #047857/#ECFDF5、失败 #DC2626/#FEE2E2、进行中 #B45309/#FFFBEB）
4. WHERE 表格 系统 SHALL 表头 11px/下沉底、发丝分割、行内主信息加粗、操作列固定右侧且按钮文字/Tooltip 说明动作
5. WHERE 删除等危险操作 系统 SHALL 二次确认；空/加载/错误三态显式处理
6. WHERE 运行历史/会话明细抽屉 系统 SHALL 支持左右拖拽调宽

#### 引用 / 影响
- 参照：../视觉规范.dc.html §03/§04/§05/§08/§09
- 现有功能：与会话控制台(N)、Agent 列表(A) 同一套控制台语言

---

### Requirement: 通用助手可用自然语言创建/查询定时任务 🔸MVP
> 决策：平台界面能做的，用户也能对通用助手(Copilot，spec L)说。定时任务的查询与新建等能力，作为平台操作工具(platform-ops MCP)暴露给通用助手，并配 `schedule-creator` 引导技能把自然语言频率翻成 cron。

**User Story:** 作为项目成员，我希望直接对通用助手说「每天 9 点让数据 Bot 生成竞品简报」，它就把定时任务建好；也能问它「有哪些定时任务 / 最近跑得怎么样」。

#### Acceptance Criteria
1. WHERE 通用助手 系统 SHALL 提供定时任务工具：列出任务、看某任务运行历史、新建、立即运行、启停、删除
2. WHEN 用户用自然语言描述频率（如「每周一早上九点」）THEN 通用助手 SHALL 翻成 cron 表达式并创建；拿不准时先复述确认
3. WHERE 新建时目标 Agent 未发布 THEN 通用助手 SHALL **不**创建，改为提示用户先发布该 Agent（可顺带代为发布）
4. WHERE 新建 系统 SHALL 默认版本=跟随最新、运行环境=复用发布，用户无需指定
5. WHEN 执行删除等破坏性操作前 THEN 通用助手 SHALL 先与用户确认
6. WHEN 写操作完成 THEN 通用助手 SHALL 简要回报结果（任务名、调度摘要、下次运行）

#### 引用 / 影响
- 术语：Deployment, Run, Copilot(通用助手)
- 现有功能：扩展通用助手(L) 的平台操作工具与内置技能；调用 O 的既有 REST 接口
- 设计决策：cron 由助手翻译（工具说明给格式+常用映射，后端校验兜底）；能力集与「平台界面能做的」对齐

#### 复现要点（供开发按此重建，非规范性 WHAT）
> 通用助手 = 一个常驻 Claude Code(copilot)，靠 **platform-ops MCP 工具**真正调用平台 O 的 REST 接口、靠 **内置 skill** 走引导流程（架构见 spec L）。要复现本能力，落三处：

**1. platform-ops MCP 新增 6 个工具**（`backend/mcp_server.py`，纯标准库 stdio JSON-RPC；每个工具=一个 `t_*()` 纯函数 + 注册表项 name/description/inputSchema/fn）：

| 工具 name | 入参 | 调用的 O 接口 | 说明 |
|---|---|---|---|
| `list_deployments` | `workspace_id?` | `GET /api/deployments[?ws=]` | 返回 名称/agent/调度摘要/下次运行/上次运行状态/启用态 |
| `list_deployment_runs` | `deployment_id` | `GET /api/deployments/{id}/runs` | 返回 状态/触发/版本/起止/摘要或错误/会话 id |
| `create_deployment` | `agent_id, name, prompt, schedule_type, cron_expr?, run_at?` | `POST /api/deployments` | 固定 `versionPolicy='latest'`、不传 isolation；agent 未发布则接口 400 |
| `run_deployment` | `deployment_id` | `POST /api/deployments/{id}/run` | 异步触发一次 |
| `set_deployment_enabled` | `deployment_id, enabled` | `PATCH /api/deployments/{id}` | 启停 |
| `delete_deployment` | `deployment_id` | `DELETE /api/deployments/{id}` | 破坏性，先确认 |

`create_deployment` 的 description **须内嵌 cron 格式与常用映射**，让助手把自然语言翻成表达式：每天9点=`0 9 * * *`、每小时=`0 * * * *`、每周一9点=`0 9 * * 1`、每月1号9点=`0 9 1 * *`、工作日8:30=`30 8 * * 1-5`。

**2. 内置引导技能 `schedule-creator`**（`backend/copilot.py` 的 BUILTIN_SKILLS，物化为 `.claude/skills/schedule-creator/SKILL.md`）：description 触发于「让某 Agent 按计划自动运行」；正文步骤 = 先用 list_agents/list_deployments 核对目标 Agent 是否已发布(未发布则引导发布，不硬试) → 澄清 Agent/任务名+指令/频率 → 翻 cron(拿不准复述确认) → 调 create_deployment → 回报任务名+调度+下次运行。system 提示(`system_md()`)的「能力来源」需列出这 6 个工具与该技能。

**3. 后端硬校验**：`POST /api/deployments`（`deployment_create`）在建之前查 `published` 表，未发布则 `HTTPException(400, "请先发布该 Agent…")`——保证助手与界面走同一道闸。

> 生效条件：改这三处后需重启后端；copilot 工作目录在 build 时刷新(`build_workdir`)，故新技能/工具要新开对话或重建 copilot 目录才加载。

---

## 与其它 spec 的关系
- **I 运行与发布**：共用 Agent 版本(F)、运行环境/隔离级别、Agent 服务就绪；定时任务触发时复用「按版本+环境确保服务」的发布路径。
- **M Agent 调用契约与会话**：每次触发复用统一 Session（服务端有状态、真实执行）；版本触发时解析与 M 一致。
- **N 会话控制台**：运行台账的「查看会话」深链至 N 的明细；来源标记/过滤/明细归集来源均为 N 的扩展。
