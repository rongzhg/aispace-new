# 单 Sandbox 跑多个 Agent — 验证文档

## 目标

验证"一个 sandbox（正式环境=每用户一个云端容器；本机=用户机器）内运行多个 agent"的可行性，重点回答：

1. 一个 sandbox 能否同时跑多个 agent？
2. agent 依赖不同的包/工具（含**版本冲突**），能否环境隔离？
3. 一个 agent 崩溃是否会拖垮其他 agent？

## 方案

- **隔离原语**：每个 agent = 一个工作目录 + 一个独立 `.venv`（Python；Node 用各自 `node_modules` 同理）。
- 同一 sandbox 内多个 agent = 多个进程，各自用自己的 venv，互不共享依赖。

## 测试用例与期望结果

> 已在环境实跑通过。复现：`bash tools-isolation/multi_agent_test.sh [根目录]`（默认 `~/aispace-agents-iso`）。

### 三个 Agent（工具依赖各不相同，前两个故意冲突）

| Agent | 依赖 |
|---|---|
| excel-报表 | `jinja2==3.0.3` + `markdown` |
| web-摘要 | `jinja2==3.1.4`（与上**冲突**）+ `requests` |
| ascii-banner | `pyfiglet==1.0.2` |

### TC1 依赖隔离
**步骤**：为每个 agent 建独立 venv 并装其依赖，分别打印各 venv 内的实际版本。
**期望结果**：
```
excel-报表    jinja2=3.0.3  markdown=3.10.2
web-摘要      jinja2=3.1.4  requests=2.34.2
ascii-banner  pyfiglet=1.0.2
```
**判定**：excel-报表 与 web-摘要 同装 jinja2 但版本不同（3.0.3 vs 3.1.4）、互不影响。单一全局环境装不下，per-agent venv 可以 → **隔离成立**。
（markdown 版本随安装时最新，不固定，无需关注具体小版本。）

### TC2 并发运行
**步骤**：3 个 agent **同时**各跑一个用到自身依赖的任务（渲染模板 / 加载 requests / 生成 banner）。
**期望结果**：三个任务全部成功，各自输出本 agent 的结果：
```
[excel-报表] 渲染: Hi Excel
[web-摘要] requests 2.34.2 就绪
[ascii-banner] banner: ' _   _ _ '
并发完成，成功 3/3
```
**判定**：同一 sandbox 内多 agent 并发运行、互不干扰 → **多 agent 并发成立**。

### TC3 故障隔离
**步骤**：让 web-摘要 的任务主动抛错，随后运行其余两个 agent 的任务。
**期望结果**：
```
web-摘要 退出码: 1 (非0=已崩)
excel-报表 仍正常: OK
excel-报表 退出码: 0
ascii-banner 仍正常: OK
ascii-banner 退出码: 0
```
**判定**：一个 agent 崩溃（独立进程，非0 退出）不影响其他 agent 继续运行 → **故障隔离成立**。

## 结论

单 sandbox 内"多 agent + 依赖隔离 + 并发 + 故障隔离"在本机方案下**全部验证通过**。per-agent venv 足以隔离绝大多数包/版本冲突。

## 与正式环境的映射

- **用户之间**：每用户一个 sandbox（云端容器/microVM）作为隔离边界。
- **agent 之间（同一 sandbox 内）**：默认 per-agent venv（本文件验证）；若出现**系统级/native 库冲突**或需要更强安全/资源隔离，再升级为 **per-agent 容器**。
- 即：用户间 = sandbox 边界；agent 间 = venv（必要时容器）。

## 局限 / 后续

- venv 只隔离 Python 包版本，不隔离系统库（apt/brew 级）；这类冲突需 per-agent 容器。
- 资源配额（CPU/内存）与崩溃自动重启，属正式环境的 sandbox/编排层职责，本验证未覆盖。
- 脚本：`tools-isolation/multi_agent_test.sh`（本验证）、`tools-isolation/run.sh`（仅依赖隔离）。
