# Spec 模板与写作规范

> 共享契约的一部分。这是**需求 agent 的输出格式**，也是**开发的输入格式**。
> 一份 spec 同时被人 review、被 AI 拿去 vibe coding、被转成验收测试，所以必须结构固定、可机读、可验证。

---

## 1. 文件头（每份 spec 必含）

```
---
name: <功能名>
last amended: <YYYY-MM-DD>
version: <递增整数>
description: <一句话说明这块功能干什么>
---
```

## 2. 结构

每份 spec 由若干 **Requirement** 组成，每个 Requirement 固定四段：

```
### Requirement: <需求名>
**User Story:** 作为<角色>，我希望<动作>，以便<价值>。

#### Acceptance Criteria
1. <EARS 句式的验收条件>
2. ...

#### 引用 / 影响
- 术语：<本需求用到的 glossary 术语>
- 组件：<复用的组件库组件，见 component-library.md>
- 现有功能：<是否与已有功能重叠/冲突>

#### 待确认 / 假设
- <agent 不确定、或做了假设的点，显式列出，供人 review>
```

## 3. Acceptance Criteria 用 EARS 句式（强制）

每条验收条件必须能对应一个测试。用下面四种句式之一：

| 类型 | 句式 | 例 |
|---|---|---|
| 事件驱动 | **WHEN** <触发> **THEN** 系统 **SHALL** <行为> | WHEN 用户点击"创建 Agent"按钮 THEN 系统 SHALL 导航至 Agent 创建页面 |
| 状态驱动 | **WHILE** <状态> 系统 **SHALL** <行为> | WHILE Agent 名称已创建 系统 SHALL 禁止修改该 Agent 的名称 |
| 条件可选 | **WHERE** <条件成立> 系统 **SHALL** <行为> | WHERE 框架为 OpenClaw 系统 SHALL 展示 user.md 与 agent.md 两个编辑器 |
| 异常处理 | **IF** <异常> **THEN** 系统 **SHALL** <处理> | IF 名称已存在 THEN 系统 SHALL 提示并阻止保存 |

写作要求：
- 一条只描述一个可验证行为，不要把多个 SHALL 塞进一句。
- 带上具体边界：字数范围、空状态、分页阈值、必填/选填、禁用条件。
- 不写实现方式（不说"用 useState 存"），只写可观察的行为与结果。

## 4. 一条 SHALL → 一个测试（与 DoD 联动）

每条 Acceptance Criteria 应能直接映射成一个测试用例。示例：

```
SHALL: WHEN 用户填写完所有必填项并点击保存 THEN 系统 SHALL 创建 Agent 及其初始版本(v1)，并导航回 Agent 列表
↓
test('保存后创建 Agent 并生成 v1，跳转列表', ...)
  - 填必填项 → 点保存
  - 断言：列表出现该 Agent、版本=v1、当前路由=列表页
```

开发/AI 自动迭代的收敛信号就来自这些测试全绿。详见 `dod.md`。

## 5. 完整最小示例

```
### Requirement: 创建 Agent
**User Story:** 作为项目成员，我希望通过分步表单创建新的 Agent，并根据框架类型配置差异化的配置文件，以便定义 Agent 的行为和能力。

#### Acceptance Criteria
1. WHEN 用户点击"创建 Agent"按钮 THEN 系统 SHALL 导航至 Agent 创建页面
2. WHEN 用户进入创建页面 THEN 系统 SHALL 展示四个框架卡片：Claude Code(可选)、OpenClaw(可选)、Custom(禁用,标注"coming soon")、Hermes(禁用)
3. WHERE 框架为 Claude Code 系统 SHALL 展示：基本信息(名称必填,2-50字符;描述选填)、配置编辑器、工具选择、技能选择、配置预览
4. WHEN 用户填完必填项并点击保存 THEN 系统 SHALL 创建 Agent 及初始版本(v1)并导航回列表
5. WHILE Agent 名称已创建 系统 SHALL 禁止修改该名称

#### 引用 / 影响
- 术语：Agent, Framework, ConfigFile, Version, Tool, Skill, ConfigPreview
- 组件：StepForm、FrameworkCard、MonacoEditor、Drawer、Collapse
- 现有功能：新增，无冲突

#### 待确认 / 假设
- 名称重复时的提示文案待定（假设：阻止保存并行内提示）
```
