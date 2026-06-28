# 产品文档

> **给开发的说明：vibe coding 时主要读这个目录就够了。** 这里描述"做什么"——需求、验收标准、术语、视觉、配置模板。"怎么做"（工程规范、DoD、架构）在 `../技术文档/`。

## 怎么用

1. 先看 `specs/README.md` 找到要做的模块（A–N）。
2. 每个 spec 用 EARS 句式写验收标准（WHEN/THEN/SHALL）——**每条 SHALL 就是一条要满足的验收点**，照着实现即可。
3. 术语统一查 `glossary.md`（代码命名也照它）。
4. 视觉照 `视觉规范.dc.html`；可运行参考优先看 `../frontend/`，`../demo/index.html` 仅作早期原型留档。
5. 配置文件内容用 `templates/` 里的模板。

## 目录

| 文件/目录 | 内容 |
|---|---|
| [specs/](./specs/) | 功能需求 + 验收标准（A–N，含 README 索引与状态） |
| [glossary.md](./glossary.md) | 统一术语表 |
| [spec-template.md](./spec-template.md) | spec 写作规范（如何写需求） |
| [视觉规范.dc.html](./视觉规范.dc.html) | 权威视觉规范（色板/排版/组件） |
| [templates/](./templates/) | 框架配置文件模板 |
| 设计参考-index-demo.html | 早期视觉参考稿（非当前功能源） |
| [项目总结.md](./项目总结.md) | 项目全貌与关键决策 |
| [待做功能.md](./待做功能.md) | **待做功能清单 / Roadmap**（未实现的功能 + 设计草案，如 L1 灰度发布） |

> 当前为产品/demo 阶段；前端 demo 说不清的逻辑才考虑做后端（见技术文档/架构设计）。
