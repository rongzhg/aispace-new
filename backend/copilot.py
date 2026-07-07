"""
通用 Agent（Copilot）的编写与启动。

定位（见 技术文档/架构设计.md §10）：
  copilot = 平台自带、常驻在「每用户 L0 沙箱」里的一个编排者 agent。
  租户边界由 L0 沙箱 + API 层鉴权兜底，自身不跑不可信代码，故不需要 L2/L3。
  编排两个扩展点：
    · 加 skill → 能力/提示词（slash 唤起），物化到 .claude/skills/，Claude Code 自动发现
    · 加 MCP  → 工具，物化到 .mcp.json，--mcp-config 加载
  出厂内置集（本文件）+ 用户从市场安装集，在「构建工作目录」时合并。

本 demo 用 Claude Code（claude -p）当编排运行时跑通链路；正式版可换成
Agent SDK 内嵌后端（运行时外壳变，skill/MCP 定义不变）。
"""
import os

# copilot 在服务注册表里的实例键——**按用户派生**：一个用户一个 copilot（住其 L0 沙箱），
# 跨该用户所有项目空间复用；「当前操作哪个空间(ws)」作为每条消息的上下文传入，不进实例键。
COPILOT_PREFIX = "copilot"


def copilot_id(user_id):
    return f"{COPILOT_PREFIX}-{user_id}"


# ---------------- 编排者系统提示（CLAUDE.md）----------------
# 不再硬编码 ws：copilot 服务一个用户的所有空间，当前空间随每条消息给定。
def system_md():
    return """# 通用助手 · Copilot

你是 AISpace 平台的**通用助手（编排者）**，常驻在当前用户的环境里，服务他的所有项目空间。
平台界面能做的事，用户都能直接对你说，你用工具真正完成。

## 当前工作空间（重要）
用户的消息可能以 `[当前工作空间: <id>]` 开头，表示**此刻操作的项目空间**。
- 调用需要 `workspace_id` 的工具时，**用这个 id**。
- 用户切换空间，这个标记会随之改变；若某条消息没有该标记，沿用最近一次给定的空间，没有则先问用户。

## 你的能力来源
- **平台操作工具（MCP `aispace`）**：列出/创建 Agent、发布、列出已发布、列出/创建空间、列技能；
  以及**定时任务**：列出(list_deployments)、看运行历史(list_deployment_runs)、新建(create_deployment)、
  立即运行(run_deployment)、启停(set_deployment_enabled)、删除(delete_deployment)。
  能用工具核实或执行的事，**先调工具**，不要凭空回答或假设结果。
- **内置技能（skill）**：`agent-creator`（建 Agent）、`schedule-creator`（建定时任务）、
  `skill-creator`（写技能草稿）、`requirement-clarify`（需求澄清）。相关场景按技能说明执行。
- 平台全局 / 用户安装的技能 / MCP 会自动出现，与内置集一并可用。

## 工作准则
1. 需要空间的操作，用消息里 `[当前工作空间]` 给的 id，除非用户另指明。
2. **写操作**（创建/发布/删除）执行后，简要回报结果（名称、版本）。删除等破坏性操作先确认。
3. 无法用工具完成的，说明原因与替代路径，不要编造。
4. 回答简洁、用中文、可执行。

## 需求澄清 → 派发
当用户是在「提平台改进/反馈」而非「让你执行一个现成操作」时，进入 `requirement-clarify`
技能：多轮追问收敛成 EARS 需求，确认后调 `submit_requirement` 落地（demo 写文件，
正式版经同一工具切到 HttpSink 发往外部系统）。
"""


# ---------------- 内置技能（物化为 .claude/skills/<name>/SKILL.md）----------------
# 每项：name 须为小写连字符；description 决定 Claude 何时自动调用；instructions 是正文步骤。
BUILTIN_SKILLS = [
    {
        "name": "agent-creator",
        "description": "当用户想创建一个新的 Agent（智能体/助手/机器人）时使用：从对话中澄清名称、职责、框架、模型，然后真正创建。",
        "instructions": """# Agent Creator

帮用户把一句话需求变成一个建好的 Agent。

## 步骤
1. **澄清要素**（缺哪问哪，最多两轮，别盘问）：
   - 名称
   - 职责/角色（一句话即可）
   - 框架（默认 Claude Code）、模型（默认 claude-opus-4-8）—— 用户没要求就用默认，不必追问
2. 调 `create_agent(workspace_id, name, role, model)` 真正创建，role 会写进该 Agent 的 claude.md。
3. 回报：Agent 名称 + 版本，并提示「可去 Agents 继续完善，或发布」。
4. 若用户要求顺带发布，再调 `publish_agent(agent_id)`。

## 注意
- workspace_id 用当前空间，除非用户指定别的空间。
- 不要在没有名称时就创建；名称缺失就先问。
""",
    },
    {
        "name": "schedule-creator",
        "description": "当用户想让某个 Agent 按计划自动运行（定时任务 / 每天/每周跑一次 / 定时执行）时使用：澄清哪个 Agent、干什么、什么频率，然后真正创建定时任务。",
        "instructions": """# Schedule Creator · 建定时任务

把用户「让某 Agent 按计划自动干某事」的诉求，变成一个建好的定时任务。

## 前提：Agent 必须已发布
定时任务只能建在**已发布**的 Agent 上（运行环境/版本都来自发布）。
- 先用 `list_deployments` 或 `list_agents` 确认目标 Agent 是否已发布。
- 若未发布：**不要**尝试创建，直接提示用户「先去发布该 Agent，再回来建定时任务」（可顺带问要不要现在帮他发布——调 `publish_agent`）。

## 步骤
1. **澄清三要素**（缺哪问哪，最多两轮）：
   - 哪个 Agent（用 list_agents/list_deployments 核对名字→id；确认已发布）
   - 任务名 + 干什么（这句话会作为每次运行发给 Agent 的开场指令 prompt；可用 {{date}}/{{time}}/{{task}} 变量）
   - 什么频率：周期(cron) / 某个具体时刻一次(once) / 只手动(manual)
2. **把自然语言频率翻成 cron 表达式**（5 字段：分 时 日 月 周）：
   每天9点=`0 9 * * *`；每小时整点=`0 * * * *`；每周一9点=`0 9 * * 1`；每月1号9点=`0 9 1 * *`；工作日8:30=`30 8 * * 1-5`。
   拿不准就把你理解的时间复述给用户确认。
3. 调 `create_deployment(agent_id, name, prompt, schedule_type, cron_expr/run_at)` 创建。
   运行环境、版本策略都不用传（默认复用发布环境 + 跟随最新）。
4. 回报：任务名 + 调度摘要 + 下次运行时间，并提示「可在『定时任务』里管理，或让我立即跑一次(run_deployment)」。

## 注意
- 创建失败提示「未发布」时，转到「前提」那步引导发布，别硬试。
- 一次只建一个任务；用户要多个就逐个确认。
""",
    },
    {
        "name": "skill-creator",
        "description": "当用户想创建/定义一个新技能（skill）时使用：把用户描述整理成 SKILL.md 规格的草稿（名称/描述/触发/步骤）。",
        "instructions": """# Skill Creator

把用户对一个技能的描述，整理成符合 Claude Agent Skill（SKILL.md）规格的草稿。

## 步骤
1. 澄清：技能名（小写连字符）、一句话描述（决定何时触发）、关键步骤。
2. 产出草稿，结构：
   - frontmatter：name、description
   - 正文：## 触发场景 / ## 步骤 / ## 注意
3. 展示草稿给用户确认。
4. 落库需要「技能注册」接口（市场 register，⬜后续接通）；本期先产出草稿，不持久化。
""",
    },
    {
        "name": "requirement-clarify",
        "description": "当用户是在提平台改进诉求、反馈问题、或描述一个尚不清晰的需求（而非执行一个现成操作）时使用：多轮追问，收敛成结构化 EARS 需求并落地。",
        "instructions": """# Requirement Clarify · 需求澄清

把用户模糊的诉求，通过多轮追问收敛成一份结构化（EARS）需求文档，再落地派发。

## 步骤
1. **多轮追问**（一次问 1–2 个，别一口气抛一堆）：
   - 背景 & 现在的问题是什么
   - 目标：希望达到什么效果
   - 范围：涉及哪些功能/角色，不包含什么
   - 验收：怎样算做好了（尽量可度量）
2. 收敛成 EARS 草稿并展示，让用户确认或修正：
   ```
   ## 背景
   ## 目标
   ## 范围
   ## 验收标准（EARS）
   - WHEN <触发> THEN 系统 SHALL <行为>
   - WHERE <前置> 系统 SHALL <约束>
   ```
3. 用户确认后，调 `submit_requirement(title, body_markdown, workspace_id)` 落地。
   - demo：写入需求收件箱文件；正式版：同一工具切到 HttpSink 发往外部系统。
4. 回报落地结果（标题 + 去向），告知后续由外部系统接手。

## 注意
- 不要替用户拍板验收标准，先给草稿再确认。
- 一份需求一个主题；多个诉求拆成多份。
""",
    },
]


# ---------------- platform-ops MCP（注入到 .mcp.json）----------------
def platform_ops_server(api_base):
    """copilot 的「手」：把 mcp_server.py 作为 stdio MCP 拉起，操作本平台 API。
    mcp_server.py 是纯标准库实现，任意 python3 均可（用 AISPACE_MCP_PYTHON 可指定，默认 python3）。"""
    return {
        "aispace": {
            "command": os.environ.get("AISPACE_MCP_PYTHON", "python3"),
            "args": [os.path.join(os.path.dirname(__file__), "mcp_server.py")],
            "env": {"AISPACE_API": api_base},
        }
    }


def build_workdir(base_dir, user_id, api_base, extra_skill_ids=None, extra_mcp_ids=None,
                  materialize_skills=None, materialize_mcp=None, resolve_ws=None):
    """构建/刷新某用户 copilot 的工作目录：CLAUDE.md + 内置 skills + .mcp.json(platform-ops)。
    按 **user** 派生目录（copilot-<user>），跨该用户所有空间复用。
    extra_*：要挂到 copilot 的技能/MCP id（一般是平台全局 default_on 项，与内置集合并）。
    resolve_ws：物化 extra_* 时用于解析的空间（这些项多为 platform 作用域，传系统空间即可）。
    materialize_*：复用 main.py 的物化函数（写 .claude/skills / .mcp.json）。返回工作目录路径。"""
    import shutil
    d = os.path.join(base_dir, copilot_id(user_id))
    os.makedirs(d, exist_ok=True)
    # 系统提示（不含 ws；当前空间随每条消息给定）
    with open(os.path.join(d, "CLAUDE.md"), "w", encoding="utf-8") as f:
        f.write(system_md())
    # 内置技能 → .claude/skills/<name>/SKILL.md（每次重建，保证与本文件同步）
    sk_root = os.path.join(d, ".claude", "skills")
    for s in BUILTIN_SKILLS:
        sk_dir = os.path.join(sk_root, s["name"])
        os.makedirs(sk_dir, exist_ok=True)
        fm = ["---", f"name: {s['name']}", f"description: {s['description']}", "---", ""]
        with open(os.path.join(sk_dir, "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(fm) + s["instructions"])
    # 平台全局 / 用户安装、挂到 copilot 的技能（叠加在内置之上）
    if extra_skill_ids and materialize_skills:
        materialize_skills(d, resolve_ws, extra_skill_ids)
    # MCP：内置 platform-ops + 叠加项（合并写入一个 .mcp.json）
    extra = platform_ops_server(api_base)
    if materialize_mcp:
        materialize_mcp(d, resolve_ws, extra_mcp_ids or [], extra=extra)
    else:  # 兜底：仅内置
        import json
        with open(os.path.join(d, ".mcp.json"), "w", encoding="utf-8") as f:
            json.dump({"mcpServers": extra}, f, ensure_ascii=False, indent=2)
    return d
