# Agent 依赖隔离验证（本机方案）

验证："每个 agent 一个独立 venv"能否隔离不同 agent 的工具/包依赖（含版本冲突）。

## 跑一下
```bash
bash run.sh            # 默认装到 ~/aispace-agents-iso/<agent>/.venv
bash run.sh /某/目录    # 自定义根目录
```

## 三个 case
| Agent | 工具依赖 |
|---|---|
| excel-报表 | jinja2==3.0.3 + markdown |
| web-摘要 | jinja2==3.1.4（与上冲突）+ requests |
| ascii-banner | pyfiglet==1.0.2 |

## 预期结果（已在环境验证）
```
excel-报表    jinja2=3.0.3 ...
web-摘要      jinja2=3.1.4 ...
ascii-banner  pyfiglet=1.0.2
```
两个 agent 同装 jinja2 但版本不同、互不影响 → **隔离成立**。

## 与整体方案的关系
- **隔离原语**：每个 agent = 一个工作目录 + 一个独立 `.venv`（Python；Node 用 per-agent `node_modules` 同理）。这覆盖绝大多数"包版本冲突"。
- **本机**：所有 agent 的 venv 在用户机器上各自独立（就是本脚本演示的）。
- **云端正式环境**：把"本机"换成**每用户一个 sandbox（容器/microVM）**，sandbox 内同样用 per-agent venv 隔离依赖；若有系统级/native 库冲突或更强安全需求，再升级到 per-agent 容器。
- 结论：本机 venv 方案够用且已验证；规模化时按"用户间=sandbox 边界、agent 间=venv（必要时容器）"分层即可。
