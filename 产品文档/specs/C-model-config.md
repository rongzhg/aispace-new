---
name: 模型配置
last amended: 2026-06-26
version: 3
description: 所有框架按供应商分组选择模型、可选模型参数配置、OpenClaw 每 Agent 模型选择
---

# 模型配置 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## 供应商与模型（关键约定）

所有框架（Claude Code、OpenClaw 及未来开放的框架）均需选择模型。模型清单**全平台统一、无权限控制**，所有用户看到相同列表。下表为示例清单（截至 2026-06，最终以接口返回为准）：

| 供应商 | 示例可选模型 |
|---|---|
| Anthropic | claude-opus-4-8、claude-sonnet-4-6、claude-haiku-4-5 |
| OpenAI | gpt-5.5、gpt-5.5-pro、gpt-5.4-mini、gpt-5.4-nano |
| DashScope（阿里云百炼） | qwen3.6-max-preview、qwen3.6-plus、qwen3.6-flash、qwen3.6-27b、qwen3.6-35b-a3b（百炼真实 3.6 系列） |
| AISpace-伏渊（自研） | yufeng-vl、yufeng-plus（清单待补全） |

> 模型清单由接口下发，无需在本平台做权限过滤。具体型号会迭代，以接口为准。

## MODIFIED Requirements

### Requirement: 模型选择 ✅已确认
**User Story:** 作为项目成员，我希望从按供应商分组的列表中为任意框架的 Agent 选择模型，以便指定其推理能力。

#### Acceptance Criteria
1. WHERE 任意框架的创建/编辑页 系统 SHALL 均展示模型选择区
2. WHEN 用户点击模型选择 THEN 系统 SHALL 打开下拉，按供应商分组展示可选模型，供应商至少包含 Anthropic、OpenAI、DashScope、AISpace-伏渊
3. WHEN 用户选择某个模型 THEN 系统 SHALL 在主区域显示已选模型名称及其所属供应商
4. WHERE 模型为必填 系统 SHALL 在未选择时阻止保存并提示
5. WHEN 模型列表加载中/失败 THEN 系统 SHALL 分别展示加载态与错误态

#### 引用 / 影响
- 术语：Agent, Framework
- 组件：Select(按供应商分组)
- 现有功能：与创建/编辑(A)、所有框架(B)联动
- 设计决策：所有框架都含模型选择；模型必填；四个供应商；清单由接口下发、全平台统一、无权限控制

#### 待确认 / 假设
- 已定：模型必填；清单来自接口、无权限控制
- ❓AISpace-伏渊 自研模型完整清单（已知 yufeng-vl，其余待补）

---

### Requirement: 模型参数配置 ✅已确认（demo 需要）
**User Story:** 作为项目成员，我希望调节所选模型的参数，以便控制 Agent 的输出风格。

#### Acceptance Criteria
1. WHEN 用户选定某个模型 THEN 系统 SHALL 从既有参数接口拉取该模型支持的参数及其元信息（名称、类型、取值范围、默认值）
2. WHERE 模型支持参数 系统 SHALL 据接口元信息动态渲染参数输入控件（如 temperature、max tokens 等）
3. WHEN 用户未设置某参数 THEN 系统 SHALL 使用接口给出的默认值
4. IF 参数超出接口定义的合法范围 THEN 系统 SHALL 阻止保存并提示有效区间
5. WHEN 用户切换模型 THEN 系统 SHALL 据新模型的参数定义重新渲染参数区

#### 引用 / 影响
- 术语：Agent
- 组件：Form 动态表单（据参数元信息渲染）、InputNumber/Slider/Select
- 现有功能：参数定义由既有接口提供

#### 设计决策
- 参数集合**不在本平台维护**：由其他系统通过既有接口提供（含取值范围与默认值），本平台仅按元信息动态渲染并回填用户取值。
- 因此参数区是"数据驱动的动态表单"，新增模型/参数无需改本平台代码。

---

### Requirement: OpenClaw 每 Agent 模型选择（同框架多 Agent 各用各的模型） 🔸MVP
> 决策：同时运行的多个 OpenClaw Agent 可各自使用不同模型；未单独指定的 Agent 由一个全局默认模型兜底。

**User Story:** 作为项目成员，我希望同时运行的不同 OpenClaw Agent 各自使用不同模型，以便按 Agent 的重要性 / 成本选择合适的模型。

#### Acceptance Criteria
1. WHERE OpenClaw 运行时 系统 SHALL 提供一个**全局默认模型**作兜底，未指定模型的 Agent 用它
2. WHERE 某 OpenClaw Agent 指定了模型 系统 SHALL 让该 Agent 使用其指定模型，覆盖全局默认
3. WHERE 同时运行多个 OpenClaw Agent 系统 SHALL 允许它们各用不同模型且互不影响
4. IF 指定的模型在目标运行环境不可用 THEN 系统 SHALL 回退到默认模型，保证 Agent 仍可用（不因模型不可用而部署失败）
5. WHEN 对话返回 THEN 系统 SHALL 带回**实际命中的模型**
6. WHERE 需启用目标环境默认未放行的模型 系统 SHALL 通过运行环境侧的模型配置实现，**无需改平台功能**

#### 引用 / 影响
- 术语：Agent, Framework, Model
- 现有功能：与「模型选择」（本 Spec 上文）、「OpenClaw 多 Agent 部署」（Spec I）联动
- 设计决策：平台模型 → 具体引擎模型的映射、白名单与回退等实现细节见 ../../技术文档/

#### 待确认 / 假设
- ⬜后续：平台模型清单与各引擎模型目录的对齐；模型变更的重发布生效策略
