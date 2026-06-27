"""
单个 Agent 的服务运行器：把已发布 Agent 跑成常驻 HTTP 服务，暴露 /chat、/chat/stream。
框架可插拔：按 AGENT_FRAMEWORK 分派适配器（CLAUDE_CODE / OPENCLAW）。
环境变量：AGENT_DIR AGENT_MODEL AGENT_NAME AGENT_FRAMEWORK PORT [CLAUDE_BIN] [OPENCLAW_BIN]
"""
import json
import os
import shutil
import subprocess
import time
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

DIR = os.environ.get("AGENT_DIR", ".")
MODEL = os.environ.get("AGENT_MODEL", "")
NAME = os.environ.get("AGENT_NAME", "Agent")
FRAMEWORK = os.environ.get("AGENT_FRAMEWORK", "CLAUDE_CODE")  # 框架可插拔


def claude_bin():
    return os.environ.get("CLAUDE_BIN") or shutil.which("claude")


def openclaw_bin():
    return os.environ.get("OPENCLAW_BIN") or shutil.which("openclaw")


def _mcp_args():
    """若工作目录有 .mcp.json（= 该 agent 绑定了 MCP，或它是 copilot），
    用 --mcp-config 显式加载，并跳过工具确认（headless 非交互，本机受信沙箱内）。
    没有 .mcp.json 的普通 agent 不受影响。技能(.claude/skills/)由 Claude Code 自动发现，无需传参。"""
    cfg = os.path.join(DIR, ".mcp.json")
    if FRAMEWORK == "CLAUDE_CODE" and os.path.exists(cfg):
        return ["--mcp-config", cfg, "--dangerously-skip-permissions"]
    return []


app = FastAPI(title=f"Agent · {NAME}")


class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None


def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


_LOGIN_HINT = ("⚠️ 运行环境的 Claude Code 未登录。请在**启动后端的终端**执行 `claude` 并 `/login`"
               "（或设置 ANTHROPIC_API_KEY），然后重启后端 / 重新发布该 Agent。")


def _auth_hint(text):
    """识别 Claude Code「未登录」错误，返回友好提示；否则 None。"""
    if text and ("Not logged in" in text or "Please run /login" in text or "Invalid API key" in text):
        return _LOGIN_HINT
    return None


# ============ 适配器：Claude Code（每 agent 一进程，claude -p）============
def cc_run(message, session_id):
    cb = claude_bin()
    if not cb:
        return {"engine": "mock", "reply": f"（mock · 本机无 claude）{NAME} 收到：{message}"}
    cmd = [cb, "-p", message, "--output-format", "json"] + _mcp_args()
    if session_id:
        cmd += ["--resume", session_id]
    if str(MODEL).startswith("claude"):
        cmd += ["--model", MODEL]
    env = os.environ.copy()
    env["PATH"] = os.path.dirname(cb) + os.pathsep + env.get("PATH", "")
    try:
        # cwd=DIR：Claude Code 自动读取该目录的 CLAUDE.md 作为本 Agent 指令
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, cwd=DIR, env=env, stdin=subprocess.DEVNULL)
    except Exception as e:
        return {"engine": "error", "reply": str(e)}
    raw = (res.stdout or "") + (res.stderr or "")
    if (hint := _auth_hint(raw)):
        return {"engine": "error", "reply": hint}
    if res.returncode != 0:
        return {"engine": "error", "reply": (res.stderr or res.stdout or "运行失败").strip()[:1000]}
    out = (res.stdout or "").strip()
    try:
        d = json.loads(out)
        if d.get("is_error") and (hint := _auth_hint(d.get("result", ""))):
            return {"engine": "error", "reply": hint}
        return {"engine": "claude-code", "reply": d.get("result", ""), "session_id": d.get("session_id")}
    except Exception:
        return {"engine": "claude-code", "reply": out}


def cc_stream(message, session_id):
    cb = claude_bin()
    if not cb:
        full = f"（mock 流式 · {NAME}）收到：{message}"
        for ch in full:
            yield _sse("delta", {"text": ch})
            time.sleep(0.015)
        yield _sse("done", {"reply": full, "session_id": None, "engine": "mock"})
        return
    cmd = [cb, "-p", message, "--output-format", "stream-json", "--verbose", "--include-partial-messages"] + _mcp_args()
    if session_id:
        cmd += ["--resume", session_id]
    if str(MODEL).startswith("claude"):
        cmd += ["--model", MODEL]
    env = os.environ.copy()
    env["PATH"] = os.path.dirname(cb) + os.pathsep + env.get("PATH", "")
    proc = subprocess.Popen(cmd, cwd=DIR, env=env, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    got_partial = False
    err_emitted = False   # 已发过 error（如未登录）：不再重复抛 finally 的「运行失败」
    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except Exception:
                continue
            t = ev.get("type")
            if t == "stream_event":
                inner = ev.get("event", {})
                if inner.get("type") == "content_block_delta":
                    delta = inner.get("delta", {})
                    if delta.get("type") == "text_delta" and delta.get("text"):
                        if _auth_hint(delta["text"]):   # 未登录文本不外泄为正文
                            continue
                        got_partial = True
                        yield _sse("delta", {"text": delta["text"]})
            elif t == "assistant":
                for blk in ev.get("message", {}).get("content", []):
                    if blk.get("type") == "text" and blk.get("text") and not got_partial:
                        if _auth_hint(blk["text"]):
                            continue
                        yield _sse("delta", {"text": blk["text"]})
                    elif blk.get("type") == "tool_use":
                        yield _sse("tool", {"name": blk.get("name")})
            elif t == "result":
                got_partial = False
                if ev.get("is_error") and (hint := _auth_hint(ev.get("result", ""))):
                    err_emitted = True
                    yield _sse("error", {"reply": hint})
                else:
                    yield _sse("done", {"reply": ev.get("result", ""),
                                        "session_id": ev.get("session_id"), "engine": "claude-code"})
    finally:
        proc.wait()
        if proc.returncode not in (0, None) and not err_emitted:
            err = (proc.stderr.read() if proc.stderr else "") or "运行失败"
            hint = _auth_hint(err)
            yield _sse("error", {"reply": hint or err.strip()[:500]})


# ============ 适配器：OpenClaw（骨架）============
# 正式实现：沙箱里跑一个 OpenClaw Gateway（一个 Gateway 托多个 agent），
# 经其 RPC / `openclaw message send` 按 agentId 路由（见 架构设计「隔离级别 × 框架」）。
# OpenClaw 工作目录用 SOUL.md / AGENTS.md / USER.md 等（非 CLAUDE.md）。
# 此处为 demo 骨架：未对接真实 Gateway，清晰标注。
def oc_run(message, session_id):
    b = openclaw_bin()
    note = f"已检测到 openclaw @ {b}" if b else "未检测到 openclaw"
    return {"engine": "openclaw-skeleton",
            "reply": f"（OpenClaw 适配器·骨架，{note}）{NAME} 收到：{message}\n"
                     f"正式实现：沙箱内一个 Gateway 托多 agent，按 agentId 路由（message send / RPC）。"}


def oc_stream(message, session_id):
    r = oc_run(message, session_id)
    yield _sse("delta", {"text": r.get("reply", "")})
    yield _sse("done", {"reply": r.get("reply", ""), "session_id": r.get("session_id"), "engine": r.get("engine")})


ADAPTERS = {
    "CLAUDE_CODE": (cc_run, cc_stream),
    "OPENCLAW": (oc_run, oc_stream),
}


def _adapter():
    return ADAPTERS.get(FRAMEWORK, ADAPTERS["CLAUDE_CODE"])


@app.get("/health")
def health():
    return {"ok": True, "name": NAME, "framework": FRAMEWORK,
            "claude": bool(claude_bin()), "openclaw": bool(openclaw_bin())}


@app.post("/chat")
def chat(b: ChatIn):
    run, _ = _adapter()
    return run(b.message, b.session_id)


@app.post("/chat/stream")
def chat_stream(b: ChatIn):
    _, stream = _adapter()
    return StreamingResponse(stream(b.message, b.session_id), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "9100")), log_level="warning")
