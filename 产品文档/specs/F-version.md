---
name: 版本管理
last amended: 2026-06-24
version: 1
description: 版本快照、版本历史、版本对比、版本回滚
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
3. WHEN 用户在编辑页「发布」且配置相对最新版有改动 THEN 系统 SHALL 先生成新版本再发布（无改动则不新增版本，见 Spec I）
4. WHERE 版本已生成 系统 SHALL 记录该版本的完整配置快照与生成时间
5. WHILE 历史版本存在 系统 SHALL 不允许修改历史版本（只读）

#### 引用 / 影响
- 术语：Version, Agent, ConfigFile
- 组件：—（数据为主）
- 现有功能：与创建/编辑(A)、发布(I)联动（编辑生成新版本、发布按规则升版本）

#### 待确认 / 假设
- ❓版本是否记录操作人

---

### Requirement: 版本历史 🔸MVP
**User Story:** 作为项目成员，我希望查看一个 Agent 的所有历史版本，以便了解它改过什么。

#### Acceptance Criteria
1. WHEN 用户进入版本历史 THEN 系统 SHALL 按时间倒序列出所有版本：版本号、生成时间、(可选)操作人
2. WHEN 用户点击某版本 THEN 系统 SHALL 展示该版本的只读配置详情
3. WHERE 当前最新版本 系统 SHALL 在列表中明确标识

#### 引用 / 影响
- 术语：Version
- 组件：Timeline/List、Tag、Monaco(只读)

#### 待确认 / 假设
- ❓历史版本入口在详情页还是独立页

---

### Requirement: 版本对比 🔸MVP（已在 demo 实现）
**User Story:** 作为项目成员，我希望对比任意两个版本的差异，以便看清具体改动。

#### Acceptance Criteria
1. WHERE Agent 版本数 ≥ 2 系统 SHALL 在详情页提供「对比版本」入口
2. WHEN 用户进入对比页 THEN 系统 SHALL 提供左右两个版本选择器，默认对比「次新版本 vs 最新版本」
3. WHEN 用户选择任意两个版本 THEN 系统 SHALL 同时给出：字段级变化（框架、模型、描述、参数、工具增删、技能增删）与配置文件逐行 diff
4. WHERE 配置文件文本存在差异 系统 SHALL 逐行标出新增（绿）、删除（红）、未变（常态）
5. IF 左右选择了同一版本 THEN 系统 SHALL 提示选择两个不同版本

#### 引用 / 影响
- 术语：Version, ConfigFile
- 组件：Select(版本选择)、行级 diff 渲染
- 现有功能：依赖每个版本存「完整配置快照」（已落定，见版本快照需求）
- 设计决策：diff 同时覆盖结构化字段与配置文件文本两个层次

#### 待确认 / 假设
- 已定：diff 粒度 = 字段级 + 配置文件逐行；入口在详情页
- 前提：版本快照需存全量配置（demo 已按此实现）

---

### Requirement: 版本回滚 ⬜后续
**User Story:** 作为项目成员，我希望把 Agent 回滚到某个历史版本，以便快速撤销有问题的改动。

#### Acceptance Criteria
1. WHEN 用户选择某历史版本回滚 THEN 系统 SHALL 以该版本配置生成一个新版本(版本号 +1)，而非覆盖历史
2. WHEN 回滚完成 THEN 系统 SHALL 将新版本设为当前版本

#### 待确认 / 假设
- ❓回滚是否需要二次确认与权限校验
