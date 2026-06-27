# AISpace · Agent 平台

集团内复制的「Claude Managed Agent」平台：在平台上创建、配置、调试、版本化管理 AI Agent。

当前处于**产品设计 + 前端 demo** 阶段，采用 spec-driven + vibe coding 协作。

## 从哪开始

| 你是… | 看这里 |
|---|---|
| 想了解全貌 | [产品文档/项目总结.md](./产品文档/项目总结.md) |
| 产品/需求 | [产品文档/](./产品文档/)（specs、术语、视觉、模板） |
| 开发（vibe coding） | **先读 [产品文档/](./产品文档/)** 知道做什么；工程规范/架构/云部署看 [技术文档/](./技术文档/) |
| 还有什么没做 | [产品文档/待做功能.md](./产品文档/待做功能.md)（Roadmap + 设计草案） |
| 想看效果 | 正式前端 [frontend/](./frontend/)（`npm i && npm run dev`）；或纯前端原型 [demo/index.html](./demo/index.html) |

## 目录

```
产品文档/        做什么——开发 vibe coding 主要参考
  specs/         功能需求 + EARS 验收标准（A–K）
  glossary.md    统一术语表
  spec-template.md  spec 写作规范
  视觉规范.dc.html  权威视觉规范
  templates/     配置文件模板
  项目总结.md     项目全貌与关键决策
  待做功能.md     待做功能清单 / Roadmap（未实现功能 + 设计草案）

技术文档/        怎么做
  前端工程规范.md   组件约定 + 设计 token
  完成定义-DoD.md   完成标准（接口契约/测试/CI）
  架构设计.md       后端与运行模式
  接口契约.md       后端 API 速览
  openclaw对接.md   OpenClaw 引擎对接（本地）
  阿里云AgentRun部署.md  云端部署（L2 独立环境）

frontend/        正式前端工程（Vite+React+TS+AntD）
backend/         Python 后端（FastAPI；发布/服务/对话/云适配）
cloud/           云部署脚本（AgentRun/OSS/ACR）
demo/            早期纯前端原型（已被 frontend/ 取代，留作参考）
```

## 工作方式

需求用 EARS 句式写进 specs（每条 SHALL = 一条验收点）→ demo 表达交互 → 开发据 spec + demo + 工程规范 vibe coding → 按 DoD 验收。
