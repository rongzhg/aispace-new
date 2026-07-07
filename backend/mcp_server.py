"""
AISpace 平台工具（MCP 服务）— 通用 Agent 的"手"。
让 Claude Code（订阅登录，无需 API key）通过这些工具真正操作平台。

**纯标准库实现**（不依赖 mcp / httpx）：手写 MCP stdio 协议（行分隔 JSON-RPC 2.0），
用 urllib 调后端 HTTP API。因此在任意 python3（含 3.8/3.9）上都能跑——避开 mcp 包要 Python>=3.10 的限制。

运行：一般由 Claude Code 通过 .mcp.json 自动拉起（`python3 mcp_server.py`）。
环境变量：
  AISPACE_API          后端地址（默认 http://localhost:8000）
  AISPACE_REQ_WEBHOOK  设了则 submit_requirement 走 HttpSink 发外部系统；否则写文件(FileSink)
  AISPACE_REQ_INBOX    需求收件箱目录（FileSink）
注意：stdout 只输出 JSON-RPC 消息；一切日志走 stderr。
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("AISPACE_API", "http://localhost:8000").rstrip("/")
_REPO = os.path.dirname(os.path.dirname(__file__))
REQ_INBOX = os.environ.get("AISPACE_REQ_INBOX") or os.path.join(_REPO, "产品文档", "需求收件箱")
REQ_WEBHOOK = os.environ.get("AISPACE_REQ_WEBHOOK", "")
PROTOCOL_VERSION = "2024-11-05"


def _log(*a):
    print("[aispace-mcp]", *a, file=sys.stderr, flush=True)


# ---------------- 后端 HTTP（纯 urllib）----------------
def _http(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            t = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        raise RuntimeError(f"后端 {method} {path} 失败：{e.code} {detail[:300]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"连不上后端 {BASE}（{e.reason}）。请确认后端已在该地址运行。")
    return json.loads(t) if t else None


def _get(path):
    return _http("GET", path)


def _post(path, body=None):
    return _http("POST", path, body or {})


def _patch(path, body=None):
    return _http("PATCH", path, body or {})


def _delete(path):
    return _http("DELETE", path)


# ---------------- 工具实现（纯函数，返回 Python 对象）----------------
def t_list_workspaces():
    return [{"id": w["id"], "name": w["name"]} for w in _get("/api/workspaces")]


def t_list_agents(workspace_id):
    return [{"id": a["id"], "name": a["name"], "version": a["version"],
             "published": a.get("published"), "model": a["model"]}
            for a in _get(f"/api/agents?ws={workspace_id}")]


def t_create_agent(workspace_id, name, role, model="claude-opus-4-8"):
    body = {"ws_id": workspace_id, "name": name, "framework": "CLAUDE_CODE",
            "model": model, "desc": role,
            "params": {"temperature": 0.7, "max_tokens": 4096},
            "files": {"claude.md": f"# {name}\n\n## 角色\n{role}\n"},
            "tools": [], "skills": []}
    a = _post("/api/agents", body)
    return {"id": a["id"], "name": a["name"], "version": a["version"]}


def t_publish_agent(agent_id):
    r = _post(f"/api/agents/{agent_id}/publish")
    return {"path": r.get("path"), "version": r.get("version"),
            "skills": r.get("skills"), "mcp": r.get("mcp")}


def t_list_published():
    return [{"id": p["id"], "name": p["name"], "version": p["version"]} for p in _get("/api/published")]


def t_create_workspace(name):
    return _post("/api/workspaces", {"name": name})


def t_list_skills(workspace_id):
    """列出某空间可用技能（含平台全局 + 本空间私有），带 scope。"""
    return [{"id": s["id"], "name": s["name"], "description": s.get("description") or s.get("summary"),
             "scope": s.get("scope"), "disabled": s.get("disabled")}
            for s in _get(f"/api/skills?ws={workspace_id}")]


def t_list_tools(workspace_id):
    """列出某空间可用 MCP 工具（含平台全局 + 本空间私有），带 scope。"""
    return [{"id": m["id"], "name": m["name"], "summary": m.get("summary"),
             "scope": m.get("scope"), "disabled": m.get("disabled")}
            for m in _get(f"/api/tools?ws={workspace_id}")]


def t_submit_requirement(title, body_markdown, workspace_id=""):
    """澄清完成的 EARS 需求落地：默认写文件(FileSink)；设 AISPACE_REQ_WEBHOOK 则发外部系统(HttpSink)。"""
    ts = time.strftime("%Y%m%d-%H%M%S")
    doc = (f"---\ntitle: {title}\nworkspace: {workspace_id}\n"
           f"created: {time.strftime('%Y-%m-%d %H:%M')}\nstatus: submitted\n---\n\n# {title}\n\n{body_markdown}\n")
    if REQ_WEBHOOK:
        data = json.dumps({"title": title, "body": body_markdown,
                           "workspace_id": workspace_id, "format": "ears"}).encode("utf-8")
        req = urllib.request.Request(REQ_WEBHOOK, data=data, method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            ref = r.read().decode("utf-8", "ignore")
        return {"ok": True, "sink": "http", "target": REQ_WEBHOOK, "externalRef": ref[:300]}
    os.makedirs(REQ_INBOX, exist_ok=True)
    safe = re.sub(r"[^\w一-龥-]+", "-", title).strip("-")[:40] or "需求"
    path = os.path.join(REQ_INBOX, f"{ts}-{safe}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(doc)
    return {"ok": True, "sink": "file", "path": path}


# ---------------- 定时任务（Deployment）----------------
def t_list_deployments(workspace_id=""):
    """列出定时任务：名称、Agent、调度、下次运行、上次运行结果、启用态。"""
    d = _get(f"/api/deployments?ws={workspace_id}" if workspace_id else "/api/deployments")
    out = []
    for x in (d.get("items") or []):
        lr = x.get("lastRun") or {}
        out.append({"id": x["id"], "name": x["name"], "agentId": x["agentId"], "agentName": x.get("agentName"),
                    "schedule": _sched_text(x), "isolation": x.get("isolation"),
                    "enabled": x.get("enabled"), "nextRunAt": x.get("nextRunAt"),
                    "lastRun": {"status": lr.get("status"), "at": lr.get("startedAt")} if lr else None})
    return out


def _sched_text(x):
    st = x.get("scheduleType")
    if st == "cron":
        return f"cron {x.get('cronExpr')}"
    if st == "once":
        return f"一次性 {x.get('runAt')}"
    return "仅手动"


def t_list_runs(deployment_id):
    """列出某定时任务的历次运行：状态、触发方式、解析版本、起止、结果/错误摘要、会话 id。"""
    rs = _get(f"/api/deployments/{deployment_id}/runs")
    return [{"status": r["status"], "trigger": r.get("trigger"), "version": r.get("version"),
             "startedAt": r.get("startedAt"), "finishedAt": r.get("finishedAt"),
             "sessionId": r.get("sessionId"), "summary": r.get("summary"), "error": r.get("error")}
            for r in (rs or [])]


def t_create_deployment(agent_id, name, prompt, schedule_type="cron", cron_expr="", run_at=""):
    """新建定时任务。运行环境复用该 Agent 的发布设置、版本默认跟随最新——都不用传。
    schedule_type: cron(需 cron_expr) / once(需 run_at) / manual。"""
    body = {"agentId": agent_id, "name": name, "prompt": prompt, "versionPolicy": "latest",
            "scheduleType": schedule_type}
    if schedule_type == "cron":
        body["cronExpr"] = cron_expr
    elif schedule_type == "once":
        body["runAt"] = run_at
    d = _post("/api/deployments", body)
    return {"id": d["id"], "name": d["name"], "agentName": d.get("agentName"),
            "schedule": _sched_text(d), "nextRunAt": d.get("nextRunAt"),
            "isolation": d.get("isolation"), "isolationPublished": d.get("isolationPublished")}


def t_run_deployment(deployment_id):
    """立即手动运行一次某定时任务（异步执行）。稍后用 list_runs 看结果。"""
    _post(f"/api/deployments/{deployment_id}/run")
    return {"ok": True, "note": "已触发，正在运行；用 list_runs 查看结果"}


def t_set_deployment_enabled(deployment_id, enabled):
    """启用或停用某定时任务的自动调度。"""
    d = _patch(f"/api/deployments/{deployment_id}", {"enabled": bool(enabled)})
    return {"id": d["id"], "name": d["name"], "enabled": d.get("enabled"), "nextRunAt": d.get("nextRunAt")}


def t_delete_deployment(deployment_id):
    """删除某定时任务模板（破坏性；历史运行台账与会话保留）。删除前请与用户确认。"""
    _delete(f"/api/deployments/{deployment_id}")
    return {"ok": True}


# ---------------- 工具注册表（name → schema + handler）----------------
_OBJ = lambda props, required: {"type": "object", "properties": props, "required": required}
_STR = {"type": "string"}
TOOLS = [
    {"name": "list_workspaces", "description": "列出全部项目空间（id, name）。",
     "inputSchema": _OBJ({}, []), "fn": lambda a: t_list_workspaces()},
    {"name": "list_agents", "description": "列出某项目空间内的 Agent（含版本、是否已发布）。",
     "inputSchema": _OBJ({"workspace_id": _STR}, ["workspace_id"]), "fn": lambda a: t_list_agents(a["workspace_id"])},
    {"name": "create_agent", "description": "在指定空间创建一个 Claude Code 类型 Agent。role 写入 claude.md 的角色段。",
     "inputSchema": _OBJ({"workspace_id": _STR, "name": _STR, "role": _STR,
                          "model": {**_STR, "default": "claude-opus-4-8"}}, ["workspace_id", "name", "role"]),
     "fn": lambda a: t_create_agent(a["workspace_id"], a["name"], a["role"], a.get("model", "claude-opus-4-8"))},
    {"name": "publish_agent", "description": "发布某 Agent 到本机工作目录并起服务，返回目录/版本/已挂载的 skill 与 MCP。",
     "inputSchema": _OBJ({"agent_id": _STR}, ["agent_id"]), "fn": lambda a: t_publish_agent(a["agent_id"])},
    {"name": "list_published", "description": "列出全部已发布的 Agent。",
     "inputSchema": _OBJ({}, []), "fn": lambda a: t_list_published()},
    {"name": "create_workspace", "description": "创建项目空间（仅平台管理员；非管理员会失败）。",
     "inputSchema": _OBJ({"name": _STR}, ["name"]), "fn": lambda a: t_create_workspace(a["name"])},
    {"name": "list_skills", "description": "列出某空间可用技能（平台全局 + 本空间私有），含 scope。",
     "inputSchema": _OBJ({"workspace_id": _STR}, ["workspace_id"]), "fn": lambda a: t_list_skills(a["workspace_id"])},
    {"name": "list_tools", "description": "列出某空间可用 MCP 工具（平台全局 + 本空间私有），含 scope。",
     "inputSchema": _OBJ({"workspace_id": _STR}, ["workspace_id"]), "fn": lambda a: t_list_tools(a["workspace_id"])},
    {"name": "submit_requirement", "description": "提交一份澄清完成的需求（EARS 正文）。demo 写收件箱文件，配置 webhook 后发外部系统。",
     "inputSchema": _OBJ({"title": _STR, "body_markdown": _STR, "workspace_id": _STR}, ["title", "body_markdown"]),
     "fn": lambda a: t_submit_requirement(a["title"], a["body_markdown"], a.get("workspace_id", ""))},
    # ---- 定时任务（Deployment）----
    {"name": "list_deployments", "description": "列出定时任务（含 Agent、调度、下次运行、上次运行结果、启用态）。不传 workspace_id 则列全部。",
     "inputSchema": _OBJ({"workspace_id": _STR}, []),
     "fn": lambda a: t_list_deployments(a.get("workspace_id", ""))},
    {"name": "list_deployment_runs", "description": "列出某定时任务的历次运行（状态/触发/版本/耗时/结果或错误/会话 id），用于排查跑得怎么样、为什么失败。",
     "inputSchema": _OBJ({"deployment_id": _STR}, ["deployment_id"]),
     "fn": lambda a: t_list_runs(a["deployment_id"])},
    {"name": "create_deployment",
     "description": ("为一个**已发布**的 Agent 创建定时任务。未发布会失败——先让用户去发布该 Agent。"
                    "运行环境复用该 Agent 发布设置、版本默认跟随最新，都不用传。"
                    "schedule_type: cron(周期,需 cron_expr) / once(一次性,需 run_at 形如 2026-07-10 09:00) / manual(仅手动)。"
                    "cron_expr 是 5 字段(分 时 日 月 周)，由你把用户的自然语言频率翻译过来，例："
                    "每天9点=`0 9 * * *`；每小时=`0 * * * *`；每周一9点=`0 9 * * 1`；每月1号9点=`0 9 1 * *`；工作日8:30=`30 8 * * 1-5`。"),
     "inputSchema": _OBJ({"agent_id": _STR, "name": _STR, "prompt": _STR,
                          "schedule_type": {**_STR, "default": "cron"}, "cron_expr": _STR, "run_at": _STR},
                         ["agent_id", "name", "prompt"]),
     "fn": lambda a: t_create_deployment(a["agent_id"], a["name"], a["prompt"],
                                         a.get("schedule_type", "cron"), a.get("cron_expr", ""), a.get("run_at", ""))},
    {"name": "run_deployment", "description": "立即手动触发某定时任务运行一次（异步）。稍后用 list_deployment_runs 看结果。",
     "inputSchema": _OBJ({"deployment_id": _STR}, ["deployment_id"]),
     "fn": lambda a: t_run_deployment(a["deployment_id"])},
    {"name": "set_deployment_enabled", "description": "启用或停用某定时任务的自动调度。",
     "inputSchema": _OBJ({"deployment_id": _STR, "enabled": {"type": "boolean"}}, ["deployment_id", "enabled"]),
     "fn": lambda a: t_set_deployment_enabled(a["deployment_id"], a["enabled"])},
    {"name": "delete_deployment", "description": "删除某定时任务（破坏性；历史运行台账与会话保留）。执行前先与用户确认。",
     "inputSchema": _OBJ({"deployment_id": _STR}, ["deployment_id"]),
     "fn": lambda a: t_delete_deployment(a["deployment_id"])},
]
_BY_NAME = {t["name"]: t for t in TOOLS}


# ---------------- MCP stdio JSON-RPC 2.0 ----------------
def _send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _result(req_id, result):
    _send({"jsonrpc": "2.0", "id": req_id, "result": result})


def _error(req_id, code, message):
    _send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def _handle(msg):
    method = msg.get("method")
    req_id = msg.get("id")
    is_notification = req_id is None
    if method == "initialize":
        client_ver = (msg.get("params") or {}).get("protocolVersion") or PROTOCOL_VERSION
        _result(req_id, {"protocolVersion": client_ver,
                         "capabilities": {"tools": {}},
                         "serverInfo": {"name": "aispace", "version": "1.0.0"}})
    elif method in ("notifications/initialized", "initialized"):
        pass  # 通知，无需回应
    elif method == "ping":
        _result(req_id, {})
    elif method == "tools/list":
        _result(req_id, {"tools": [{"name": t["name"], "description": t["description"],
                                    "inputSchema": t["inputSchema"]} for t in TOOLS]})
    elif method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _BY_NAME.get(name)
        if not tool:
            _error(req_id, -32602, f"未知工具：{name}")
            return
        try:
            out = tool["fn"](args)
            text = json.dumps(out, ensure_ascii=False, indent=2)
            _result(req_id, {"content": [{"type": "text", "text": text}], "isError": False})
        except Exception as e:
            # 工具执行错误以 isError 返回，让模型看到（而非协议级错误）
            _result(req_id, {"content": [{"type": "text", "text": f"工具出错：{e}"}], "isError": True})
    elif is_notification:
        pass  # 其它通知忽略
    else:
        _error(req_id, -32601, f"未实现的方法：{method}")


def main():
    _log(f"started, backend={BASE}")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        try:
            _handle(msg)
        except Exception as e:
            _log("handler error:", e)


if __name__ == "__main__":
    main()
