# Specs 索引

Claude Managed Agent 平台的功能 spec，按模块拆分。每份遵循 [../spec-template.md](../spec-template.md)，术语统一引用 [../glossary.md](../glossary.md)。

逐个细化的用法：打开某个模块 → 先处理里面的 `❓待确认` 项 → 把 `⬜后续` 中本期要做的提到 `🔸MVP` → 每条 Acceptance Criteria 确认可被测试覆盖。

## 模块清单

| 模块 | 文件 | 范围 | 主要状态 |
|---|---|---|---|
| A | [A-agent-lifecycle.md](./A-agent-lifecycle.md) | Agent Operations 列表/工作台/创建/编辑/删除 | ✅Operations 列表 + ✅工作台创建编辑 |
| B | [B-framework-config.md](./B-framework-config.md) | 多框架、差异化配置文件、模板 | ✅核心 + 🔸模板 |
| C | [C-model-config.md](./C-model-config.md) | 模型选择、参数、OpenClaw 每 Agent 模型 | ✅选择 + 🔸每 Agent 模型 + ⬜参数 |
| D | [D-mcp-tools.md](./D-mcp-tools.md) | 工具选择、当前空间 MCP 页面、锁定、接入、版本 | ✅选择 + 🔸MCP 页面 + ⬜连通/版本 |
| E | [E-skills.md](./E-skills.md) | 技能选择、当前空间 Skill 页面、分类、运行安装 | ✅选择 + 🔸Skill 页面 + ⬜运行安装/治理 |
| F | [F-version.md](./F-version.md) | Head/Live 关系、快照、历史、对比、回滚 | ✅快照 + 🔸历史/对比/回滚 |
| G | [G-config-preview.md](./G-config-preview.md) | 工作台次级预览、导出 | 🔸预览 + ⬜导出 |
| H | [H-permission.md](./H-permission.md) | 资产权限、锁定、分配后台 | ✅消费 + 🔸数据源 + ⬜后台 |
| I | [I-runtime-publish.md](./I-runtime-publish.md) | 试跑、Head/Live/Runtime 发布模型、部署方式、Playground、部署控制台、运行服务运维、日志 | ✅试跑/Live 发布/Playground + 🔸部署控制台/多框架 + ⬜灰度/日志 |
| J | [J-infrastructure.md](./J-infrastructure.md) | 登录/SSO、默认空间、RBAC、审计 | 🔸登录/空间 + ✅角色模型 + ⬜审计 |
| K | [K-project-workspace.md](./K-project-workspace.md) | 项目空间增查、成员（多 Owner）、切换 | ✅模型 + 🔸切换器；创建限管理员 |
| L | [L-assistant.md](./L-assistant.md) | Chat 统一入口：会话轨 + 默认通用 agent + slash 选内置 skill（/agent-creator、/skill-creator）| 🔸会话轨/阶段一已实现 + ⬜需求闭环/完整工具调用 |
| M | [M-agent-api.md](./M-agent-api.md) | **Agent 调用契约与会话（Managed Agent 标准：Agent+Environment+Session）**——统一会话(服务端有状态)、事件驱动、稳定寻址 | 🔸Phase 1 已落地 + ⬜Phase 2–4 |
| N | [N-session-console.md](./N-session-console.md) | **会话 Tab（会话控制台）**——按「创建人」聚合我创建的 Agent（L1/L2/L3）的全部会话、明细回看、检索过滤、全量归集 | 🔸MVP 列表/明细 + ⬜外部直连归集/全文检索 |

状态图例：✅已确认（多源自原始 spec）· 🔸MVP（demo 建议做）· ⬜后续 · ❓待确认（spec 内逐条标注）

> ⚠️ **M 是有意的例外**：其余 spec 只写 WHAT、接口契约归 技术文档/；调用契约是平台根基约定，**重要到需在 spec 内固化规范性端点面**（完整 schema 仍见 技术文档/接口契约.md）。

## 当前已实现闭环（前端 + Python 后端）

> A Agent Operations（Owner / Live / Draft / Runtime）→ A 工作台创建（B 框架差异化配置 + C 模型 + D 工具 + E 技能）→ F 生成 v1 Head → I 试跑当前配置 → I 发布某个已保存版本为 Live（选择部署方式，启动/替换 Runtime）→ Playground 与 Live 对话（统一 Session）→ F 版本与回滚（直接发布历史版本 / 回滚为新版本）。
> **框架可插拔（I）**：同一发布/服务/对话流程支撑多框架（Claude Code、OpenClaw…）；支持同时部署多个 OpenClaw Agent 各成服务、按 Agent 路由互不影响、每 Agent 可不同模型（C）；运行引擎不可用时回退占位。
> D/E/H 的资产与权限仍以 mock/轻量实现为主；J 的 RBAC 后台/审计、灰度发布/运行日志 本期不做。
> **实现/架构/接口契约不在 spec 内**，统一见 ../../技术文档/（架构设计、接口契约、openclaw对接、阿里云AgentRun部署 等）。**唯一例外：M（调用契约与会话）** 在 spec 内固化规范性端点面——因为它是平台根基约定。

## 待补素材（细化时需要你提供或一起定）

- 各框架配置文件的默认模板内容（B）
- 模型清单与是否受权限控制（C）
- 配置预览的结构化 schema（G，影响后端契约）
- 权限粒度：按用户/项目/角色（H、J）
- demo 是否需要真实登录/SSO（J）

---
last amended: 2026-06-28 · version 3
