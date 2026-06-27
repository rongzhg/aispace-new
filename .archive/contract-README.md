# 共享契约 (Shared Contract)

这是团队 AI native + vibe coding 的**地基**。一句话：把规范从"人要记住的文档"变成"AI 默认读到的上下文 + 机器自动卡住的关卡"。

需求 agent 按这份契约**生产** spec，全栈开发（的 AI）按这份契约**消费** spec。两端共享同一份资产，交接才不会崩。

## 四份契约

| 文件 | 作用 | 谁用 |
|---|---|---|
| [glossary.md](./glossary.md) | 统一术语表 | agent 写 spec、开发命名代码 |
| [spec-template.md](./spec-template.md) | EARS 格式 spec 模板 + 写作规范 | agent 的输出格式 = 开发的输入格式 |
| [component-library.md](./component-library.md) | React+TS+AntD 组件库与 design tokens | demo、spec、代码的视觉一致性 |
| [dod.md](./dod.md) | Definition of Done | vibe coding 的"对错信号"、合并/发布关卡 |

## 怎么用

1. **进仓库、被 AI 自动读取**：把这些内容（或其引用）放进项目的 `CLAUDE.md`/规则文件，每个人的 AI 一打开项目就读到，自动对齐。
2. **在真实项目里打磨**：先用本项目（Agent 管理）跑几个需求，发现契约里说不清/对不齐的地方就改这里。契约成熟后再套需求 agent。
3. **闭环**：spec 的每条 SHALL → 一个测试 → 测试全绿才算 done → 才可合并发布。

## 推进顺序（已确认）

1. ✅ 起草契约（本目录）
2. ⏳ 用 Agent 管理项目跑通几个需求，打磨契约 + 沉淀一个"黄金样板"模块
3. ⏳ 契约稳定后，构建需求 agent（按 spec-template 产出、以本契约为知识库）

## 待补充（项目里逐步填）

- 组件库的真实 token 值（按视觉稿）
- 黄金样板模块的路径
- 现有功能清单（供 agent 去重用）
- 技术栈最终确认（前端 UI 库、后端框架细节）

---
last amended: 2026-06-24 · version 1
