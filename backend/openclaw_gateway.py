"""
OpenClaw Gateway 运行器：**一个 Gateway 进程托管多个 OpenClaw agent**，按 agent_id 路由。

这是 OpenClaw 框架的正确本地部署形态——区别于 Claude Code 的「每 agent 一进程」
（见 ../技术文档/架构设计.md「隔离级别 × 框架」）。平台为一个隔离域只起一个 Gateway，
所有 OpenClaw agent 绑进它的 agents.list，对话时带 agent_id 路由（经 `openclaw message send` / RPC）。

热绑定：发布一个 agent = 往运行中的 Gateway POST 一条 binding（无需重启）；停服 = DELETE 解绑。

环境变量：
  GATEWAY_DIR    各 agent 工作目录的父目录（用于落 binding.json，重启可恢复）
  PORT           监听端口（默认 9180）
  OPENCLAW_BIN   openclaw 可执行文件全路径（PATH 找不到时用）

真实运行：本机装了 openclaw 时经其 CLI 路由；未安装则回退 mock（按各 agent 人设回应，
证明「一个 Gateway 多 agent、按 agentId 路由」确实生效）。与 Claude Code 适配器的 mock 回退同构。
"""
import json
import os
import re
import shutil
import subprocess
import time
import uuid
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

GATEWAY_DIR = os.environ.get("GATEWAY_DIR") or os.path.expanduser("~/aispace-agents")


def openclaw_bin():
    """解析本机 openclaw 可执行文件：优先 OPENCLAW_BIN，其次 PATH，再兜底常见安装位。"""
    p = os.environ.get("OPENCLAW_BIN")
    if p and os.path.exists(p):
        return p
    w = shutil.which("openclaw")
    if w:
        return w
    cands = [
        os.path.expanduser("~/.openclaw/bin/openclaw"),
        "/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw",
        os.path.expanduser("~/.local/bin/openclaw"),
    ]
    for c in cands:
        if os.path.exists(c):
            return c
    return None


# agent_id -> {"agent_id","name","dir","model","version"}：本 Gateway 当前托管的 agent（agents.list）
AGENTS: dict = {}
# (agent_id, session_id) -> 轮次计数：mock 下维持简单的多轮上下文感
_TURNS: dict = {}

app = FastAPI(title="OpenClaw Gateway")


class Binding(BaseModel):
    agent_id: str
    name: str = "Agent"
    dir: str
    model: str = ""
    version: Optional[int] = None


class ChatIn(BaseModel):
    agent_id: str
    message: str
    session_id: Optional[str] = None


def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _binding_path(d):
    return os.path.join(d, ".gateway-binding.json")


def _persist(b: dict):
    try:
        os.makedirs(b["dir"], exist_ok=True)
        with open(_binding_path(b["dir"]), "w", encoding="utf-8") as f:
            json.dump(b, f, ensure_ascii=False)
    except Exception:
        pass


def _restore():
    """启动时扫描 GATEWAY_DIR，把上次的 binding 恢复进 agents.list（Gateway 重启可续）。"""
    if not os.path.isdir(GATEWAY_DIR):
        return
    for name in os.listdir(GATEWAY_DIR):
        p = _binding_path(os.path.join(GATEWAY_DIR, name))
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8") as f:
                    b = json.load(f)
                if b.get("agent_id") and os.path.isdir(b.get("dir", "")):
                    AGENTS[b["agent_id"]] = b
            except Exception:
                continue


def _persona(agent_dir: str) -> str:
    """读取 agent 的人设（role.md > SOUL.md），用于 mock 回应，证明按 agent 路由。"""
    for fn in ("role.md", "SOUL.md", "agent.md", "AGENTS.md"):
        p = os.path.join(agent_dir, fn)
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8") as f:
                    txt = f.read()
                # 去掉注释块与空行，取首段非空文本
                lines = [ln.strip() for ln in txt.splitlines()
                         if ln.strip() and not ln.strip().startswith(("<!--", "-->", "#"))]
                if lines:
                    return lines[0][:120]
            except Exception:
                pass
    return ""


# ============ 真实 OpenClaw 对接 ============
# 实测 OpenClaw 2026.6.x 的真实接口（见 ../技术文档/openclaw对接.md）：
#   注册：openclaw agents add <ocid> --workspace <dir> --non-interactive --json
#   人设：workspace 内 SOUL.md(人设) / AGENTS.md(行为，openclaw 默认运维段勿删) / USER.md(用户上下文)
#         平台 role.md+agent.md → SOUL.md；user.md → USER.md（每次发布覆盖，幂等）
#   对话：openclaw agent --agent <ocid> -m <msg> --json [--session-id <sid>]
#         回复 = payloads[0].text（兜底 meta.finalAssistantVisibleText）；会话 = meta.agentMeta.sessionId
def _oc_id(agent_id: str) -> str:
    """平台 agent_id → openclaw agent id（合法字符；绝不会撞上保留的 main）。"""
    s = re.sub(r"[^a-zA-Z0-9_-]", "-", str(agent_id)).strip("-") or "agent"
    return f"as-{s}"


def _oc_env(b):
    env = os.environ.copy()
    env["PATH"] = os.path.dirname(b) + os.pathsep + env.get("PATH", "")
    return env


def _extract_json(out: str):
    """openclaw 输出可能夹杂前置日志行；稳健地取最后一个完整 JSON 对象。"""
    out = (out or "").strip()
    try:
        return json.loads(out)
    except Exception:
        pass
    i, j = out.find("{"), out.rfind("}")
    if 0 <= i < j:
        try:
            return json.loads(out[i:j + 1])
        except Exception:
            return None
    return None


def _read(workdir, fn):
    p = os.path.join(workdir, fn)
    if os.path.exists(p):
        try:
            with open(p, encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None
    return None


def _write(workdir, fn, content):
    try:
        os.makedirs(workdir, exist_ok=True)
        with open(os.path.join(workdir, fn), "w", encoding="utf-8") as f:
            f.write(content or "")
    except Exception:
        pass


def _sync_persona(workdir):
    """平台配置文件 → openclaw workspace 人设文件（role+agent→SOUL.md；user→USER.md）。"""
    role, agent_md, user = _read(workdir, "role.md"), _read(workdir, "agent.md"), _read(workdir, "user.md")
    soul = "\n\n".join(p.strip() for p in (role, agent_md) if p and p.strip())
    if soul:
        _write(workdir, "SOUL.md", soul + "\n")
    if user is not None:
        _write(workdir, "USER.md", user)


def _map_model(model: str):
    """平台模型 id → OpenClaw 模型 id（每 agent 可不同）。
    claude-* → anthropic/claude-*；已带 provider/ 前缀的原样；非 claude（如 qwen）→ None（用 OpenClaw 默认）。
    注意：目标模型须在 OpenClaw 的 `defaults.models` 白名单内，否则注册回退到默认模型。"""
    m = (model or "").strip()
    if not m:
        return None
    if "/" in m:
        return m
    if m.lower().startswith("claude"):
        return "anthropic/" + m
    return None


def register_openclaw_agent(agent: dict):
    """把 agent 注册进真实 OpenClaw（一个 Gateway 托多 agent），按平台 model 给该 agent 选模型。
    openclaw 未装则 no-op（mock 模式）。"""
    b = openclaw_bin()
    if not b:
        return
    ocid = _oc_id(agent["agent_id"])
    workdir = agent["dir"]
    ocmodel = _map_model(agent.get("model"))
    base = [b, "agents", "add", ocid, "--workspace", workdir, "--non-interactive", "--json"]
    cmd = base + (["--model", ocmodel] if ocmodel else [])
    # agents add：已存在会报错（幂等，忽略）；带 --model 若因白名单不允许而失败，退回不带 model 注册，保证 agent 可用
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=90, env=_oc_env(b), stdin=subprocess.DEVNULL)
        if res.returncode != 0 and ocmodel and ("not allowed" in (res.stderr + res.stdout).lower()
                                                or "model" in (res.stderr + res.stdout).lower()):
            subprocess.run(base, capture_output=True, text=True, timeout=90, env=_oc_env(b), stdin=subprocess.DEVNULL)
    except Exception:
        pass
    _sync_persona(workdir)


def deregister_openclaw_agent(agent_id: str):
    """从真实 OpenClaw 删除该 agent（停服调用）。openclaw 未装则 no-op。"""
    b = openclaw_bin()
    if not b:
        return
    try:
        subprocess.run([b, "agents", "delete", _oc_id(agent_id), "--force", "--json"],
                       capture_output=True, text=True, timeout=60, env=_oc_env(b), stdin=subprocess.DEVNULL)
    except Exception:
        pass


def parse_agent_output(stdout: str, returncode: int, stderr: str, session_id):
    """解析 `openclaw agent --json` 输出 → {engine, reply, session_id[, model]}。纯函数，便于单测。
    兼容两种形态：直接 {payloads,meta}，或包一层 {runId,status,result:{payloads,meta}}。"""
    d = _extract_json(stdout)
    if d is None:
        if returncode != 0:
            return {"engine": "error",
                    "reply": (stderr or stdout or "openclaw 运行失败").strip()[:1000],
                    "session_id": session_id}
        return {"engine": "openclaw", "reply": (stdout or "").strip(), "session_id": session_id}
    if "payloads" not in d and isinstance(d.get("result"), dict):
        d = d["result"]
    payloads = d.get("payloads") or []
    meta = d.get("meta") or {}
    reply = ""
    if payloads and isinstance(payloads[0], dict):
        reply = payloads[0].get("text") or ""
    reply = reply or meta.get("finalAssistantVisibleText") or ""
    sid = (meta.get("agentMeta") or {}).get("sessionId") or session_id
    model = (meta.get("executionTrace") or {}).get("winnerModel")
    out = {"engine": "openclaw", "reply": reply, "session_id": sid}
    if model:
        out["model"] = model
    return out


# ============ OpenClaw 调用：真实 CLI 优先，未安装回退 mock ============
def oc_invoke(agent: dict, message: str, session_id: Optional[str]):
    """按 agent_id 路由到该 agent。返回 {engine, reply, session_id}。"""
    b = openclaw_bin()
    agent_id = agent["agent_id"]
    workdir = agent["dir"]
    if b:
        # 真实路径：openclaw agent 一次回合，--agent 按 id 路由，--session-id 续多轮
        ocid = _oc_id(agent_id)
        cmd = [b, "agent", "--agent", ocid, "-m", message, "--json"]
        # 未配对/无 gateway 凭据的环境（如云端 ECS）用嵌入式本地模式跑，绕开 gateway websocket 鉴权；
        # 本机 Mac 不设该变量，仍走已配对的 gateway 模式。输出形态一致（{payloads,meta}）。
        if os.environ.get("OPENCLAW_LOCAL"):
            cmd += ["--local"]
        if session_id:
            cmd += ["--session-id", session_id]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=300,
                                 cwd=workdir, env=_oc_env(b), stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            return {"engine": "error", "reply": "openclaw 运行超时（>300s）", "session_id": session_id}
        except Exception as e:
            return {"engine": "error", "reply": str(e), "session_id": session_id}
        return parse_agent_output(res.stdout, res.returncode, res.stderr, session_id)
    # ---- mock 回退：按该 agent 的人设回应，证明 Gateway 已正确路由到对应 agent ----
    sid = session_id or f"oc-{agent_id}-{uuid.uuid4().hex[:8]}"
    key = (agent_id, sid)
    turn = _TURNS.get(key, 0) + 1
    _TURNS[key] = turn
    persona = _persona(workdir)
    who = agent.get("name") or agent_id
    persona_line = f"（人设：{persona}）" if persona else ""
    reply = (f"[OpenClaw Gateway · mock] 「{who}」{persona_line}收到（第 {turn} 轮）：{message}\n"
             f"本机未安装 openclaw，已按 agent_id={agent_id} 路由到该 agent 工作目录回应——"
             f"证明「一个 Gateway 托多 agent、按 agentId 路由」生效。装上 openclaw 后此处走真实 CLI。")
    return {"engine": "openclaw-mock", "reply": reply, "session_id": sid}


def _get_agent(agent_id: str) -> dict:
    a = AGENTS.get(agent_id)
    if not a:
        raise HTTPException(404, f"Gateway 未托管 agent_id={agent_id}（先发布该 OpenClaw agent 以绑定）")
    return a


# ============ 路由 ============
@app.get("/health")
def health():
    return {"ok": True, "framework": "OPENCLAW", "openclaw": bool(openclaw_bin()),
            "agents": [{"agent_id": a["agent_id"], "name": a.get("name"),
                        "version": a.get("version")} for a in AGENTS.values()]}


@app.get("/agents")
def list_agents():
    """agents.list：本 Gateway 当前托管的所有 agent。"""
    return list(AGENTS.values())


@app.post("/agents")
def bind_agent(b: Binding):
    """热绑定/更新一个 agent 到本 Gateway（发布即调用，无需重启 Gateway）。
    真实模式下同时把 agent 注册进 OpenClaw（agents add + 人设同步）。"""
    rec = b.model_dump()
    AGENTS[b.agent_id] = rec
    _persist(rec)
    register_openclaw_agent(rec)   # openclaw 未装则 no-op（mock）
    return {"ok": True, "bound": b.agent_id, "count": len(AGENTS), "openclaw": bool(openclaw_bin())}


@app.delete("/agents/{agent_id}")
def unbind_agent(agent_id: str):
    """解绑一个 agent（停服调用）。真实模式下同时从 OpenClaw 删除该 agent。"""
    a = AGENTS.pop(agent_id, None)
    if a:
        try:
            os.remove(_binding_path(a["dir"]))
        except Exception:
            pass
    deregister_openclaw_agent(agent_id)   # openclaw 未装则 no-op
    # 清掉该 agent 的会话轮次
    for k in [k for k in _TURNS if k[0] == agent_id]:
        _TURNS.pop(k, None)
    return {"ok": True, "unbound": agent_id, "count": len(AGENTS)}


@app.post("/chat")
def chat(b: ChatIn):
    agent = _get_agent(b.agent_id)
    return oc_invoke(agent, b.message, b.session_id)


@app.post("/chat/stream")
def chat_stream(b: ChatIn):
    agent = _get_agent(b.agent_id)

    def gen():
        r = oc_invoke(agent, b.message, b.session_id)
        reply = r.get("reply", "")
        # mock/一次性结果按字推送，体验与 Claude Code 适配器一致
        for ch in reply:
            yield _sse("delta", {"text": ch})
            time.sleep(0.005)
        yield _sse("done", {"reply": reply, "session_id": r.get("session_id"), "engine": r.get("engine")})

    return StreamingResponse(gen(), media_type="text/event-stream")


_restore()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "9180")), log_level="warning")
