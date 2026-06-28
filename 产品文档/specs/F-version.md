---
name: 版本管理
last amended: 2026-06-28
version: 2
description: 版本快照、Head/Live 关系、版本历史、版本对比、版本回滚
---

# 版本管理 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: 版本快照 ✅已确认（源自原始 spec）
**User Story:** 作为项目成员，我希望每次保存配置都生成版本快照，以便追溯 Agent 配置的演变。

#### Acceptance Criteria
1. WHEN 用户创建 Agent THEN 系统 SHALL 生成初始版本 v1
2. WHEN 用户在编辑页保存修改 THEN 系统 SHALL 生成新版本(版本号 +1)
3. WHILE 工作副本存在未保存改动 系统 SHALL 禁止发布，并提示先保存为新版本；发布只作用于已保存版本（见 Spec I）
4. WHERE 版本已生成 系统 SHALL 记录该版本的完整配置快照与生成时间
5. WHILE 历史版本存在 系统 SHALL 不允许修改历史版本（只读）
6. WHERE 当前最新已保存版本 系统 SHALL 称为 Head；Head 可能尚未发布为 Live

#### 引用 / 影响
- 术语：Version, Agent, ConfigFile
- 组件：—（数据为主）
- 现有功能：与创建/编辑(A)、发布(I)联动（保存生成 Head；发布选择已保存版本成为 Live）

#### 待确认 / 假设
- ❓版本是否记录操作人

---

### Requirement: 版本历史 🔸MVP
**User Story:** 作为项目成员，我希望查看一个 Agent 的所有历史版本，以便了解它改过什么。

#### Acceptance Criteria
1. WHEN 用户进入「版本与回滚」 THEN 系统 SHALL 按时间倒序列出所有版本：版本号、生成时间、(可选)操作人
2. WHEN 用户点击某版本 THEN 系统 SHALL 展示该版本的只读配置详情
3. WHERE 当前 Head 版本 系统 SHALL 在列表中明确标识「最新」
4. WHERE 当前 Live 版本 系统 SHALL 在列表中明确标识「已发布」
5. WHERE 版本历史入口 系统 SHALL 出现在 Agent 工作台顶部与线上发布与运行面板中，文案为「版本与回滚」或「回滚 / 历史」

#### 引用 / 影响
- 术语：Version
- 组件：Timeline/List、Tag、Monaco(只读)

#### 待确认 / 假设
- 已定：入口在 Agent 工作台内，以抽屉承载版本明细、回滚与对比

---

### Requirement: 版本对比 🔸MVP（已在 demo 实现）
**User Story:** 作为项目成员，我希望对比任意两个版本的差异，以便看清具体改动。

#### Acceptance Criteria
1. WHERE Agent 版本数 ≥ 2 系统 SHALL 在 Agent 工作台 / 版本与回滚抽屉提供「版本对比」入口
2. WHEN 用户进入对比页或抽屉的对比 Tab THEN 系统 SHALL 提供左右两个版本选择器，默认对比「次新版本 vs 最新版本」
3. WHEN 用户选择任意两个版本 THEN 系统 SHALL 同时给出：字段级变化（框架、模型、描述、参数、工具增删、技能增删）与配置文件逐行 diff
4. WHERE 配置文件文本存在差异 系统 SHALL 逐行标出新增（绿）、删除（红）、未变（常态）
5. IF 左右选择了同一版本 THEN 系统 SHALL 提示选择两个不同版本

#### 引用 / 影响
- 术语：Version, ConfigFile
- 组件：Select(版本选择)、行级 diff 渲染
- 现有功能：依赖每个版本存「完整配置快照」（已落定，见版本快照需求）
- 设计决策：diff 同时覆盖结构化字段与配置文件文本两个层次

#### 待确认 / 假设
- 已定：diff 粒度 = 字段级 + 配置文件逐行；入口在 Agent 工作台与版本与回滚抽屉
- 前提：版本快照需存全量配置（demo 已按此实现）

---

### Requirement: 版本回滚 🔸MVP
**User Story:** 作为项目成员，我希望把 Agent 回滚到某个历史版本，或直接让线上 Live 指向某个历史版本，以便快速撤销有问题的改动。

#### Acceptance Criteria
1. WHERE 版本与回滚抽屉 系统 SHALL 对非当前编辑态的历史版本提供「回滚为新版本」
2. WHEN 用户选择「回滚为新版本」 THEN 系统 SHALL 将该历史版本配置载入 Agent 工作台作为工作副本；用户保存后生成新的 Head 版本(版本号 +1)，不覆盖任何历史版本
3. WHERE 版本与回滚抽屉 系统 SHALL 对非当前 Live 的历史版本提供「直接发布 vN」
4. WHEN 用户选择「直接发布 vN」 THEN 系统 SHALL 不生成新版本，而是把 Live 指向该历史版本，并按 Spec I 的发布流程替换运行服务
5. WHERE 所选版本已是 Live 系统 SHALL 禁用「直接发布」并显示「当前已发布」
6. WHERE 回滚相关操作 系统 SHALL 在文案上明确两种模式差异：直接发布 = 改 Live 指向；回滚为新版本 = 生成新的 Head

#### 待确认 / 假设
- ❓生产环境是否需要发布审批或二次确认；MVP 先沿用发布权限
