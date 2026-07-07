# 2026-07-06 增量 Spec

当日新增/细化功能的 spec，作为主 specs（`../`）的**增量**。每份遵循 [../../spec-template.md](../../spec-template.md)，术语引用 [../../glossary.md](../../glossary.md)，视觉以 [../../视觉规范.dc.html](../../视觉规范.dc.html) 为准。

本 README 是当日增量功能的**完整索引**：先看 **[清单](#清单)**（按模块 O/P/Q/R 看整体范围与文件），再看 **[功能 → Spec 索引](#功能--spec-索引按能力查)**（按单个能力反查它写在哪份 spec 的哪条 Requirement）。

## 清单

| 模块 | 文件 | 范围 | 影响的主 spec |
|---|---|---|---|
| O | [../O-scheduled-task.md](../O-scheduled-task.md) | **部署 tab 重构为「定时任务」**（deployment=可触发任务模板）：模板增删改查、cron/一次性/仅手动调度、触发即产出 Run+Session、运行台账深链会话、版本触发时解析、**运行环境复用 Agent 发布设置 + 仅已发布 Agent 可建**、会话来源标记/过滤（删云端回传）、Playground 排除定时会话、抽屉可拖拽调宽、按视觉规范重做、**通用助手可增删查定时任务**（schedule-creator 技能 + 6 个 platform-ops 工具） | **新增主模块 O**（与 A–N 并列，故置于 `../`，非日期目录）；I(发布/运行环境)、L(通用助手)、N(会话来源/深链) |
| P | [P-conversation-shell.md](./P-conversation-shell.md) | 会话轨重做（小号新建 / 整行卡片 / hover 操作 / 可收起）、左侧主导航可收起、QA 消息时间展示 | L(Chat)、I(Playground)、应用外壳(§03/§07) |
| Q | [Q-debug-trace.md](./Q-debug-trace.md) | 调试执行链路（思考 / 工具链 / MCP 徽标 / 子代理 / 图片占位 / 压缩标记）+ 每轮用量脚注 + **AI 回复 Markdown 渲染**；三处统一、两 runtime 统一协议、流式+历史回放 | I(试跑/调试)、L(通用助手) |
| R | [R-session-detail-ime.md](./R-session-detail-ime.md) | Session 明细页对齐 Chat/Playground 展示（Markdown 正文 + 执行链路 + 用量脚注，只读回放）+ 对话 Composer 输入法组合守卫（拼音未完不误发） | N(Session 控制台)、L(Chat)、I(Playground 调试) |

> 说明：Q 的「AI 回复 Markdown 渲染」与 R 为当日晚间（20:00 后）增量；R 的两块对应主 spec N-session-console(v3) 与 L-assistant(v5, AC10) 的细化。

> 注：O 是**新增的主功能模块**（部署/定时任务），与 A–N 同级、落在 `../O-scheduled-task.md`；P、Q、R 是对既有模块的**细化增量**，故留在本日期目录。均为 2026-07-06 当日产出。

## 功能 → Spec 索引（按能力查）

想找某个新能力写在哪，按下表定位到 spec 文件 + 具体 Requirement。

### 定时任务（模块 O，[../O-scheduled-task.md](../O-scheduled-task.md)）
| 新能力 | Requirement | 关联主 spec |
|---|---|---|
| 建 / 查 / 改 / 删定时任务、启停、仅已发布 Agent 可建 | 定时任务模板（Deployment）的增删改查 | 新模块 O |
| 版本策略：跟随最新 / 钉住某版，**触发时**解析 | 版本策略在触发时解析 | F(版本) |
| 调度：重复 cron / 一次性 / 仅手动（+ misfire、重启对账） | 调度方式（重复 cron / 一次性 / 仅手动） | — |
| 触发即产出一次 Run + 一条 Session、模板变量、并发跳过 | 触发即产出一次运行(Run)与一条会话(Session) | M(会话) |
| 运行环境复用 Agent 发布设置、未发布不给建 | 仅已发布 Agent 可建定时任务、运行环境复用发布设置 | I(发布/运行环境) |
| 运行历史抽屉 + 「查看会话」深链到会话 Tab | 运行历史与会话回看（深链到会话 Tab） | N(会话) |
| 会话来源标记 / 过滤（定时任务·平台·网关；删云端回传） | 会话来源标记与过滤（含定时任务） | N(会话) |
| Playground 不展示定时任务会话 | Playground 不展示定时任务会话 | I(Playground) |
| 定时任务 tab 视觉（标题/工具栏/表格/状态色/抽屉拖拽） | 定时任务 UI 遵循视觉规范 | 视觉规范 |
| **通用助手**用自然语言建/查定时任务（6 工具 + schedule-creator + 复现要点） | 通用助手可用自然语言创建/查询定时任务 | L(通用助手·真编排 AC2/6) |

### Chat / 应用外壳（模块 P，[P-conversation-shell.md](./P-conversation-shell.md)）
| 新能力 | Requirement | 关联主 spec |
|---|---|---|
| 会话轨重做（小号新建 / 整行卡片 / hover 操作 / 可收起） | 会话轨重做（新建 / 卡片 / 操作 / 收起） | L(Chat) |
| 左侧主导航可收起 | 左侧主导航可收起 | 应用外壳 §03 |
| 会话消息时间展示 | 会话消息时间展示 | L(Chat) |

### 调试 / 执行链路（模块 Q，[Q-debug-trace.md](./Q-debug-trace.md)）
| 新能力 | Requirement | 关联主 spec |
|---|---|---|
| 执行链路（思考 / 工具调用链 / 结果） | 执行链路展示（思考 / 工具调用链 / 结果） | I(试跑/调试) |
| 工具语义（MCP 徽标 / 子代理 / 图片占位） | 工具语义识别（MCP 徽标 / 子代理 / 图片占位） | I(调试) |
| 上下文压缩标记 | 上下文压缩标记 | I(调试) |
| 每轮用量脚注（token / 成本 / 耗时 / 模型 / 异常停止） | 每轮用量脚注 | I(调试)、L |
| 三处统一 + 两 runtime 统一协议 + 流式与历史回放 | 三处统一 + 两 runtime 统一协议 + 流式与历史回放 | I、L |
| AI 回复按 Markdown(GFM) 渲染 | AI 回复按 Markdown 渲染 | L、I |

### 会话明细 / 输入法（模块 R，[R-session-detail-ime.md](./R-session-detail-ime.md)）
| 新能力 | Requirement | 关联主 spec |
|---|---|---|
| Session 明细对齐 Chat/Playground（Markdown + 执行链路 + 用量，只读回放） | Session 明细页对齐 Chat/Playground 展示 | N(会话) |
| 输入法组合守卫（拼音未完不误发；三处对话框通用） | 对话 Composer 输入法组合守卫 | L(Chat·AC10)、I(Playground) |

## 视觉规范一致性

本日改动已按 [视觉规范.dc.html](../../视觉规范.dc.html) 核查并修正：
- ✅ **定时任务 tab（O）**按 §03/§04/§05/§08 落地：22px/760 标题 + 12.5px 说明；工具栏（搜索 + 启用状态过滤 + 计数 + 刷新）；表格表头 `#F8FAFC`/11px uppercase、发丝分割 `#EDF0F4`、行内主信息加粗、行 hover；状态用语义色（成功 `#047857/#ECFDF5`、失败 `#DC2626/#FEE2E2`、进行中 `#B45309/#FFFBEB`）；操作列固定右侧 + Tooltip 说明动作；运行历史 / 会话明细抽屉支持左右拖拽调宽
- ✅ 会话轨新建改为**小号 rail action**（非整宽主 CTA，符合 §07）
- ✅ 会话项 active 用 `#E8EEF7`、标题占满宽、操作 hover 显形（§07）
- ✅ 链路/时间/用量配色统一到 §02 tokens（思考 `#B45309`、工具 `#4F46E5`、子代理/链接 `#2563EB`、MCP 徽标 Legacy Indigo、meta `#94A3B8`、成功 `#047857`、失败 `#DC2626`、警告 `#B45309`），移除造色 `#B0B3BE`/`#0E7490`
- ⚠️ 待规范补充：①左侧栏「可收起为 72px 图标态」（§03 现写「固定 236px」）；②消息级「执行链路 / 时间 / 用量」展示模式（§07 未收录，但已全部使用 §02 tokens）。按视觉规范 §10「发现需要新页面模式，先补视觉规范，再写代码」，建议后续把这两项补入 `视觉规范.dc.html`。

状态图例：✅已确认 · 🔸MVP · ⬜后续 · ❓待确认
