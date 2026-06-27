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
