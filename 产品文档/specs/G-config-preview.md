---
name: 配置预览与导出
last amended: 2026-06-28
version: 2
description: Agent 工作台内的结构化配置只读预览（JSON/YAML）与导出下载
---

# 配置预览与导出 Feature Specification

> 术语见 ../glossary.md；格式见 ../spec-template.md
> 状态：✅已确认 / 🔸MVP / ⬜后续 / ❓待确认

## MODIFIED Requirements

### Requirement: 配置预览 🔸MVP
> 位置更新：预览是 Agent 工作台的**次级工具入口**，不得挤占右侧「线上发布与运行 / 试跑」主区域。可用 Drawer / Modal / Tab 承载，核心要求是随当前配置实时生成、只读、可切换 JSON/YAML。

**User Story:** 作为项目成员，我希望随时预览 Agent 所有配置项合并后的结构化配置，以便确认最终生成的内容正确。

#### Acceptance Criteria
1. WHERE Agent 工作台 系统 SHALL 提供「配置预览」入口，内含只读代码块
2. WHEN 用户修改任意配置项(基本信息/配置文件/模型/工具/技能) THEN 系统 SHALL 实时更新预览内容
3. WHERE 预览为结构化配置 系统 SHALL 以 JSON / YAML 呈现且只读，提供 JSON/YAML 切换
4. WHERE 配置预览打开/关闭 系统 SHALL 保持工作台当前编辑状态，不触发保存、不生成版本、不影响试跑
5. WHERE 工作台右侧空间有限 系统 SHALL 优先保障「线上发布与运行」和「试跑」，配置预览不得造成主流程信息拥挤

#### 引用 / 影响
- 术语：ConfigPreview, Agent, Tool, Skill, ConfigFile
- 组件：Drawer/Modal/Tab、只读代码块、Segmented(JSON/YAML)
- 现有功能：聚合 A/B/C/D/E 的配置
- 设计决策：预览降级为次级工具，不再作为工作台右栏常驻主面板

#### 待确认 / 假设
- 已定：提供 JSON/YAML 切换
- ❓预览的结构化 schema 由谁定义（影响后端契约）

---

### Requirement: 配置导出 🔸MVP
**User Story:** 作为项目成员，我希望导出 Agent 的配置文件，以便在其他环境使用或归档。

#### Acceptance Criteria
1. WHEN 用户点击"导出" THEN 系统 SHALL 下载当前配置的结构化文件(JSON/YAML)
2. WHERE 框架含多个配置文件(如 OpenClaw 的 user/agent/role) 系统 SHALL 一并导出
3. IF 配置不完整 THEN 系统 SHALL ❓（待确认：是否允许导出草稿）

#### 引用 / 影响
- 术语：ConfigPreview, ConfigFile
- 组件：Button

#### 待确认 / 假设
- ❓导出格式与文件命名规则
- ❓是否需要"复制到剪贴板"作为轻量替代
