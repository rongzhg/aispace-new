# 技术文档

> "怎么做"——工程规范、完成标准、技术架构。产品"做什么"在 `../产品文档/`。

## 目录

| 文件 | 内容 |
|---|---|
| [前端工程规范.md](./前端工程规范.md) | React+TS+AntD 组件约定、设计 token、目录结构 |
| [完成定义-DoD.md](./完成定义-DoD.md) | Definition of Done：接口契约(OpenAPI)、分层测试、CI 关卡 |
| [接口契约.md](./接口契约.md) | 后端 API 速览（FastAPI，已实现，对前后端 vibe coding 对齐） |
| [架构设计.md](./架构设计.md) | 后端与运行模式架构（短任务 / 长会话；控制面+数据面；云端 sandbox 方向） |
| [单sandbox多agent验证.md](./单sandbox多agent验证.md) | 一个 sandbox 跑多 agent：依赖隔离/并发/故障隔离的测试用例与期望结果（已验证） |

## 与产品文档的关系

- 视觉/交互基准：`../产品文档/视觉规范.dc.html` + `../demo/`
- 需求与验收：`../产品文档/specs/`
- 实现按 DoD：每条 spec 的 SHALL → 一条测试，全绿才算完成。
