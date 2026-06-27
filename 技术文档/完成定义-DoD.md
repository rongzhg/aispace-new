# Definition of Done (DoD)

> 共享契约的一部分。一条需求满足下面**全部**条件才算"完成"，才可合并/发布。
> DoD 是 vibe coding 的"对错信号"：人和 AI 都照它判断东西做没做完。
>
> 技术栈：前端 React + TS + Ant Design；后端 **Python / FastAPI**（demo 用 SQLite，本地优先；上云换 Tablestore）。Agent 运行用 Claude Code。

---

## 1. 接口契约优先

- FastAPI 用 pydantic 模型定义入参/出参，**自动生成 OpenAPI**（`/docs`）；前后端基于同一份契约并行开发。
- 接口路径与字段命名用 `glossary.md` 的英文命名，不自创。
- 前端类型与 OpenAPI 严格对齐（可由 `/openapi.json` 生成），不手抄。
- 错误用 HTTP 状态码 + `{detail}`（FastAPI 默认）；错误信息清晰可读。

## 2. 一条 SHALL = 至少一个测试（核心）

- spec 里每条 Acceptance Criteria 必须有对应的自动化测试，命名能追溯到该条。
- 测试不全绿 → 不算完成、不允许合并。这是自动迭代的收敛条件。

## 3. 分层测试要求

| 层 | 范围 | 工具（建议） | 要求 |
|---|---|---|---|
| 后端单元 | 业务逻辑 / 工具函数 | pytest | 核心逻辑与边界、异常分支覆盖 |
| 后端接口 | API 端点 | pytest + FastAPI TestClient | 每个接口的正常 + 关键错误码 |
| 前端组件 | 组件行为 | Vitest + React Testing Library | 交互、空/加载/错误态 |
| 端到端 | 用户流程 | Playwright | 覆盖 spec 里的关键 SHALL 流程 |

> 起步阶段可先保证「后端接口测试（TestClient）+ e2e 覆盖关键 SHALL」，再逐步补单元和组件测试。
> 参考：`backend/` 已用 TestClient 跑通建库/CRUD/版本/软删/重名等冒烟用例。

## 4. 代码质量关卡（CI 自动卡，不靠人自觉）

合并前必须全绿：
- Lint：ESLint（前端）+ ruff（后端 Python），不允许 warning 堆积
- 格式化：Prettier（前端）+ black/ruff format（后端），提交前自动跑
- 类型：TS `strict` 通过，禁用 `any`；后端 pydantic 校验 + 可选 mypy
- 构建/启动：前端能构建；后端 `uvicorn main:app` 能正常起
- 测试：上面的测试套件全绿

## 5. 契约一致性

- 用到的术语都在 `glossary.md` 中（新词先登记）。
- UI 只用 `前端工程规范.md` 约定的组件和 token，无魔法值。
- 新功能不与现有功能重复/冲突（spec 的"引用/影响"已声明）。

## 6. Review

- 每个 PR 至少一名人 review + 一轮 AI review。
- Review 对照 spec 的 Acceptance Criteria 逐条核对，而非只看代码风格。

## 7. 可发布性

- 改动可灰度、可一键回滚。
- 空状态、加载态、错误态、权限/锁定态均已处理。
- 关键操作有日志/埋点（便于线上排查）。

---

## DoD 速查清单（贴在 PR 模板里）

```
- [ ] 接口有 OpenAPI 契约，前端类型与之对齐
- [ ] 每条 Acceptance Criteria 都有对应测试，且全绿
- [ ] Lint / 格式化 / 类型检查 / 构建 全过
- [ ] 术语、组件、token 符合契约，无魔法值
- [ ] 与现有功能无重复/冲突
- [ ] 人 review + AI review 完成，对照 SHALL 逐条核对
- [ ] 空/加载/错误/锁定态已处理，可灰度可回滚
```
