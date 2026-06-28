"""
AISpace · Agent 平台后端（demo）
FastAPI + SQLite，本地优先。Agent 试跑通过 Claude Code 无头模式；
Claude Code 不可用时自动回退 mock，保证未配好环境也能跑通链路。

运行：
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
文档：http://localhost:8000/docs
"""
import json
import os
import re
import shutil
import signal
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Optional

import httpx
from fastapi import Body, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import market
import copilot

_proxy = httpx.Client(timeout=180, trust_env=False)  # 调本机 agent 服务，忽略系统代理
# copilot MCP 工具回连本后端的地址（mcp_server.py 用它操作平台 API）
SELF_API = os.environ.get("AISPACE_API", "http://localhost:8000")
# copilot 工作目录根：demo 用 AGENTS_DIR 下派生；正式版 = 每用户 L0 沙箱内常驻
COPILOT_BASE = os.environ.get("AISPACE_COPILOT_DIR") or os.path.expanduser("~/aispace-agents")
# 保留系统空间：承载「平台全局」skill/MCP/agent（scope='platform'）。它是平台系统目录，不是租户——
# 对用户隐藏（不在空间列表里），全员可读其内容，仅平台管理员可改（见 架构设计 §10.5）。
SYS_WS = "__system__"


def _load_dotenv():
    """启动时把 backend/.env 加载进环境变量（如 DASHSCOPE_API_KEY），重启自动生效。
    已有的同名环境变量优先（不覆盖），便于临时 override。"""
    p = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

# 云端运行适配器（可插拔）：发布到独立环境(L2)/即用即弃(L3) 时把 Agent 部署成云端独立沙箱。懒加载。
_CLOUD = None


def _cloud():
    global _CLOUD
    if _CLOUD is None:
        from cloud_adapter import AgentRunCloudAdapter
        _CLOUD = AgentRunCloudAdapter()
    return _CLOUD

DB_PATH = os.environ.get("AISPACE_DB") or os.path.join(os.path.dirname(__file__), "aispace.db")
# 发布目标根目录：每个 agent 一个本地工作目录（Claude Code 读 CLAUDE.md；OpenClaw 读 role/agent/user.md）
AGENTS_DIR = os.environ.get("AISPACE_AGENTS_DIR") or os.path.expanduser("~/aispace-agents")
# 技能市场上传的技能包（tar/zip）存档目录
SKILL_PKG_DIR = os.environ.get("AISPACE_SKILL_PKG_DIR") or os.path.join(os.path.dirname(__file__), "skill_pkgs")


# 已发布为服务的 agent 运行时注册表：agent_id -> {port,pid,url,name,version,framework,...}
# 本地 agent = 单实例（同一时刻只活一个版本）。FC agent 走"版本随请求"，不在此注册（后续）。
# 框架差异（见架构设计「隔离级别 × 框架」）：
#   CLAUDE_CODE = 每 agent 一进程（_PROCS 各一条）。
#   OPENCLAW    = 一个共享 Gateway 托多个 agent，按 agentId 路由——SERVICES 每 agent 仍一条，
#                 但 url/port 同指向共享 Gateway，且带 gateway=True。
SERVICES = {}
_PROCS = {}  # agent_id -> Popen（Claude Code 每 agent 进程；用于停服）

# OpenClaw 共享 Gateway（一个隔离域只起一个）：{port,pid,url} 或空
GATEWAY = {}
_GW_PROC = None  # openclaw_gateway.py 的 Popen


# ---------------- 稳定寻址（对外契约）----------------
def _stable_url(agent_id, stream=False):
    """对外**稳定调用地址**：按 agent id 经后端网关路由（端口/internal_url 是内部细节，会变，勿直连）。"""
    return f"{SELF_API}/api/agents/{agent_id}/service-chat" + ("/stream" if stream else "")


# ---------------- 服务注册表落库 + 启动对账 ----------------
# SERVICES 是内存态；落库后后端重启可「对账」复活仍在跑的进程，无需等懒自愈即可稳定路由。
def _persist_service(agent_id, info):
    try:
        with db() as c:
            c.execute(
                "INSERT OR REPLACE INTO services "
                "(agent_id,port,pid,url,name,version,framework,isolation,location,gateway,status,updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (agent_id, info.get("port"), info.get("pid"), info.get("url"), info.get("name"),
                 info.get("version"), info.get("framework"), info.get("isolation"),
                 info.get("location", "local"), int(bool(info.get("gateway"))), info.get("status"), now()))
    except Exception:
        pass


def _unpersist_service(agent_id):
    try:
        with db() as c:
            c.execute("DELETE FROM services WHERE agent_id=?", (agent_id,))
    except Exception:
        pass


def _reconcile_services():
    """启动对账：把上次落库的服务逐个 health-ping，仍在跑的复活进 SERVICES（路由立即可用），已死的清掉。
    后端重启时它的子进程（agent_runner / Gateway）通常仍在监听，故能直接复用，端口不变。"""
    try:
        with db() as c:
            rows = [dict(r) for r in c.execute("SELECT * FROM services").fetchall()]
    except Exception:
        return 0, 0
    restored = pruned = 0
    for r in rows:
        info = {"port": r["port"], "pid": r["pid"], "url": r["url"], "name": r["name"],
                "version": r["version"], "framework": r["framework"],
                "isolation": r["isolation"], "location": r["location"] or "local"}
        if r["gateway"]:
            info["gateway"] = True
        if r["status"]:
            info["status"] = r["status"]
        # 云端点确定性，best-effort 复活；本地/Gateway 实测 /health 可达性
        alive = True if info["location"] == "cloud" else (bool(info.get("url")) and _svc_alive(info))
        if alive:
            SERVICES[r["agent_id"]] = info
            if r["gateway"] and info.get("url"):
                GATEWAY.update({"url": info["url"], "port": info.get("port"), "pid": info.get("pid")})
            restored += 1
        else:
            _unpersist_service(r["agent_id"])
            pruned += 1
    if restored or pruned:
        print(f"[reconcile] 复活服务 {restored} 个，清理失效 {pruned} 个", file=sys.stderr)
    return restored, pruned


def _free_port(start=9100, end=9300):
    # 跳过已分配给在跑服务/Gateway 的端口：子进程刚 Popen 还没 bind 时，
    # 仅靠 OS bind 探测会把同一端口重复发给下个发布（连发多个 agent 会撞端口）。
    used = {s.get("port") for s in SERVICES.values()}
    used.add(GATEWAY.get("port"))
    for p in range(start, end):
        if p in used:
            continue
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError("无可用端口")


def openclaw_bin():
    """解析本机 openclaw 可执行文件：优先 OPENCLAW_BIN，其次 PATH，再兜底常见安装位。"""
    p = os.environ.get("OPENCLAW_BIN")
    if p and os.path.exists(p):
        return p
    w = shutil.which("openclaw")
    if w:
        return w
    for c in (os.path.expanduser("~/.openclaw/bin/openclaw"),
              "/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw",
              os.path.expanduser("~/.local/bin/openclaw")):
        if os.path.exists(c):
            return c
    return None


# ---------------- OpenClaw 共享 Gateway 生命周期 ----------------
def _ensure_gateway():
    """确保 OpenClaw 共享 Gateway 在运行（懒启动），返回 {port,pid,url}。一个隔离域只起一个 Gateway。"""
    global _GW_PROC
    if GATEWAY.get("url") and _GW_PROC and _GW_PROC.poll() is None:
        return GATEWAY
    port = _free_port()
    env = os.environ.copy()
    env.update({"GATEWAY_DIR": AGENTS_DIR, "PORT": str(port)})
    ob = openclaw_bin()
    if ob:
        env["OPENCLAW_BIN"] = ob
    runner = os.path.join(os.path.dirname(__file__), "openclaw_gateway.py")
    proc = subprocess.Popen([sys.executable, runner], env=env, cwd=os.path.dirname(__file__))
    _GW_PROC = proc
    info = {"port": port, "pid": proc.pid, "url": f"http://127.0.0.1:{port}"}
    GATEWAY.clear()
    GATEWAY.update(info)
    # 等 Gateway 就绪（/health 可达）
    for _ in range(60):
        try:
            _proxy.get(info["url"] + "/health", timeout=0.5)
            break
        except Exception:
            time.sleep(0.1)
    return info


def _stop_gateway():
    global _GW_PROC
    if _GW_PROC:
        try:
            _GW_PROC.terminate()
        except Exception:
            pass
    _GW_PROC = None
    GATEWAY.clear()


def _stop_service(agent_id):
    """停某 agent 的服务。位置/框架感知：云端=删 runtime；OpenClaw 本地=从共享 Gateway 解绑；Claude Code=杀进程。"""
    svc = SERVICES.get(agent_id)
    _unpersist_service(agent_id)   # 落库行先删，避免重启对账复活已停服务
    if svc and svc.get("location") == "cloud":
        try:
            _cloud().stop(agent_id)
        except Exception:
            pass
        SERVICES.pop(agent_id, None)
        return
    if svc and svc.get("gateway"):
        if GATEWAY.get("url"):
            try:
                _proxy.delete(GATEWAY["url"] + f"/agents/{agent_id}", timeout=5)
            except Exception:
                pass
        SERVICES.pop(agent_id, None)
        # 没有 OpenClaw agent 还托管在 Gateway 上了，就把 Gateway 也停掉
        if not any(s.get("gateway") for s in SERVICES.values()):
            _stop_gateway()
        return
    p = _PROCS.pop(agent_id, None)
    if p:
        try:
            p.terminate()
        except Exception:
            pass
    elif svc and svc.get("pid"):
        # 对账复活的进程没有 Popen 句柄，按 pid 兜底终止
        try:
            os.kill(svc["pid"], signal.SIGTERM)
        except Exception:
            pass
    SERVICES.pop(agent_id, None)


def _bind_openclaw_agent(agent_id, name, workdir, model, version, isolation):
    """OpenClaw：把 agent 绑进共享 Gateway（一个 Gateway 托多 agent，按 agentId 路由）。热绑定不重启。"""
    gw = _ensure_gateway()
    try:
        _proxy.post(gw["url"] + "/agents", timeout=10, json={
            "agent_id": agent_id, "name": name, "dir": workdir,
            "model": model or "", "version": version})
    except Exception as e:
        raise HTTPException(502, f"OpenClaw Gateway 不可达，无法绑定 agent：{e}")
    info = {"port": gw["port"], "pid": gw["pid"], "url": gw["url"], "name": name,
            "version": version, "framework": "OPENCLAW", "isolation": isolation or "L1",
            "gateway": True}
    SERVICES[agent_id] = info
    _persist_service(agent_id, info)
    return info


def _start_cloud_service(agent_id, name, model, files, version, framework, isolation, skills=None):
    """L2/L3：把 agent 部署成云端独立沙箱（异步）。R1 单主实例：先停旧（本地/旧云）再起。
    端点 URL 即时可知（确定性），状态 deploying→running，前端轮询 /api/services。
    skills: {slug:{relpath:content}}，随部署经 SKILLS_JSON 下发到沙箱。"""
    cloud = _cloud()
    if not cloud.available:
        raise HTTPException(503, f"云端运行不可用：{cloud._err}")
    if SERVICES.get(agent_id):
        _stop_service(agent_id)     # 迁移/替换：先停旧
    info = {"url": cloud.endpoint_url(agent_id), "name": name, "version": version,
            "framework": framework, "isolation": isolation, "location": "cloud",
            "status": "deploying", "model": model}
    SERVICES[agent_id] = info
    _persist_service(agent_id, info)

    def _bg():
        try:
            r = cloud.deploy(agent_id, name, framework, model, files or {}, isolation, skills=skills)
            if SERVICES.get(agent_id) is info:
                info.update(status="running", url=r["url"], runtime_id=r["runtime_id"],
                            version=r["version"], model=r["model"])
                _persist_service(agent_id, info)
        except Exception as e:
            if SERVICES.get(agent_id) is info:
                info.update(status="failed", error=str(e)[:300])
                _persist_service(agent_id, info)

    threading.Thread(target=_bg, daemon=True).start()
    return info


def _start_service(agent_id, name, workdir, model, version, framework="CLAUDE_CODE", isolation="L1", files=None, skills=None):
    """为某 agent 启动（或复用）常驻服务。R1 单主实例：换版本/环境=停旧起新（OpenClaw 本地为热重绑）。
    位置分派：L1=本地（CLAUDE_CODE 每 agent 一进程 / OPENCLAW 共享 Gateway）；L2/L3=云端独立沙箱。"""
    framework = framework or "CLAUDE_CODE"
    isolation = isolation or "L1"
    location = "cloud" if isolation in ("L2", "L3") else "local"
    cur = SERVICES.get(agent_id)
    # 完全一致且健康则复用
    if (cur and cur.get("version") == version and cur.get("framework") == framework
            and cur.get("location", "local") == location and cur.get("isolation") == isolation
            and cur.get("status") != "failed"):
        return cur
    if location == "cloud":
        return _start_cloud_service(agent_id, name, model, files, version, framework, isolation, skills=skills)
    # ---- 本地 ----
    if framework == "OPENCLAW":
        # 共享 Gateway：换版本 = 重新绑定（覆盖），不停其他 agent；若上一版是别的框架则先清掉其进程
        if cur and not cur.get("gateway"):
            _stop_service(agent_id)
        return _bind_openclaw_agent(agent_id, name, workdir, model, version, isolation)
    # ---- CLAUDE_CODE：每 agent 一进程 ----
    if cur:
        _stop_service(agent_id)     # 单实例：换版本/换框架则替换
    port = _free_port()
    env = os.environ.copy()
    env.update({"AGENT_DIR": workdir, "AGENT_MODEL": model or "", "AGENT_NAME": name,
                "AGENT_FRAMEWORK": framework, "PORT": str(port),
                # 供绑定了 platform-ops MCP 的 agent 的 .mcp.json 里 ${AISPACE_API} 展开
                "AISPACE_API": os.environ.get("AISPACE_API", "http://localhost:8000")})
    b = claude_bin()
    if b:
        env["CLAUDE_BIN"] = b
    runner = os.path.join(os.path.dirname(__file__), "agent_runner.py")
    proc = subprocess.Popen([sys.executable, runner], env=env, cwd=os.path.dirname(__file__))
    _PROCS[agent_id] = proc
    info = {"port": port, "pid": proc.pid, "url": f"http://127.0.0.1:{port}", "name": name,
            "version": version, "framework": framework, "isolation": isolation or "L1"}
    SERVICES[agent_id] = info
    _persist_service(agent_id, info)
    return info


def claude_bin():
    """解析本机 claude 可执行文件：优先 CLAUDE_BIN，其次 PATH，再兜底常见安装位置（含 nvm）。"""
    p = os.environ.get("CLAUDE_BIN")
    if p and os.path.exists(p):
        return p
    w = shutil.which("claude")
    if w:
        return w
    cands = [
        os.path.expanduser("~/.claude/local/claude"),   # Claude Code 原生安装
        os.path.expanduser("~/.npm-global/bin/claude"),
        "/opt/homebrew/bin/claude", "/usr/local/bin/claude",
        os.path.expanduser("~/.local/bin/claude"),
    ]
    import glob as _glob
    cands += _glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/claude"))
    cands += _glob.glob(os.path.expanduser("~/.local/share/*/node/*/bin/claude"))
    for c in cands:
        if os.path.exists(c):
            return c
    return None

# ---------------- DB ----------------
@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT);
            CREATE TABLE IF NOT EXISTS members (
                ws_id TEXT, user_id TEXT, name TEXT, role TEXT,
                PRIMARY KEY (ws_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY, ws_id TEXT, name TEXT, framework TEXT, model TEXT,
                desc TEXT, params TEXT, files TEXT, tools TEXT, skills TEXT,
                version INTEGER, updated_at TEXT, deleted INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS versions (
                agent_id TEXT, version INTEGER, created_at TEXT, config TEXT,
                PRIMARY KEY (agent_id, version)
            );
            CREATE TABLE IF NOT EXISTS published (
                agent_id TEXT PRIMARY KEY, version INTEGER, path TEXT, published_at TEXT,
                isolation TEXT DEFAULT 'L1'
            );
            CREATE TABLE IF NOT EXISTS services (
                agent_id TEXT PRIMARY KEY, port INTEGER, pid INTEGER, url TEXT, name TEXT,
                version INTEGER, framework TEXT, isolation TEXT, location TEXT DEFAULT 'local',
                gateway INTEGER DEFAULT 0, status TEXT, updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS copilot_sessions (
                id TEXT PRIMARY KEY, user TEXT, title TEXT, claude_sid TEXT,
                messages TEXT DEFAULT '[]', created_at TEXT, updated_at TEXT
            );
            -- 统一会话表（Phase 1）：agent_ref='copilot' 或某 agent id；claude_sid=续接 token(内部)
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, user TEXT, agent_ref TEXT DEFAULT 'copilot', environment_ref TEXT,
                title TEXT, claude_sid TEXT, messages TEXT DEFAULT '[]', status TEXT DEFAULT 'active',
                created_at TEXT, updated_at TEXT
            );
            -- Environment 一等资源（Phase 2）：运行环境/沙箱（隔离级别等），Session/发布绑定
            CREATE TABLE IF NOT EXISTS environments (
                id TEXT PRIMARY KEY, name TEXT, isolation TEXT, description TEXT, builtin INTEGER DEFAULT 0,
                created_at TEXT
            );
            """
        )
        # 隔离是嵌套的：L0 每用户沙箱=租户边界（每用户一个、跨用户绝不共享、始终生效，不是可选项，不入目录）。
        # 可选的「部署方式」= 在你自己的沙箱里面怎么放 agent：L1 共享 / L2 独立 / L3 即用即弃。
        for _e in (("env-shared", "共享", "L1", "你名下多个 Agent 共用一个沙箱，最省（各自库依赖仍隔离）"),
                   ("env-isolated", "独立", "L2", "你名下每个 Agent 独占一个沙箱：崩溃 / 资源 / 被攻破都不波及别人；需系统级依赖时也用它"),
                   ("env-ephemeral", "即用即弃", "L3", "每次会话开一个临时沙箱、跑完即焚，隔离最强；跑不可信代码用它（记忆需外置）")):
            c.execute("INSERT OR IGNORE INTO environments (id,name,isolation,description,builtin,created_at) "
                      "VALUES (?,?,?,?,1,?)", (*_e, now()))
        c.execute("DELETE FROM environments WHERE id='env-personal'")   # 旧库：L0 是边界、不作可选环境
        # 迁移：把旧 copilot_sessions 的历史搬进统一 sessions（agent_ref='copilot'），幂等
        try:
            c.execute("INSERT OR IGNORE INTO sessions (id,user,agent_ref,title,claude_sid,messages,status,created_at,updated_at) "
                      "SELECT id,user,'copilot',title,claude_sid,messages,'active',created_at,updated_at FROM copilot_sessions")
        except Exception:
            pass
        # 市场表（技能/MCP）按「空间」归属 + 技能对齐 SKILL.md 规格：缺关键列则重建（辅助表，重建无碍）
        def _cols(t):
            return [r["name"] for r in c.execute(f"PRAGMA table_info({t})").fetchall()]
        if (mc := _cols("installed_mcp")) and "ws_id" not in mc:
            c.execute("DROP TABLE installed_mcp")
        if (sc := _cols("installed_skills")) and ("instructions" not in sc or "tree" not in sc):
            c.execute("DROP TABLE installed_skills")        # 升级到 SKILL.md + 上传包(树/存档) 结构
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS installed_skills (
                ws_id TEXT, id TEXT, name TEXT, description TEXT, instructions TEXT,
                allowed_tools TEXT, source TEXT DEFAULT 'custom', added_at TEXT,
                archive_path TEXT, tree TEXT, deleted INTEGER DEFAULT 0, creator TEXT,
                PRIMARY KEY (ws_id, id)
            );
            CREATE TABLE IF NOT EXISTS installed_mcp (
                ws_id TEXT, id TEXT, name TEXT, summary TEXT, category TEXT,
                command TEXT, args TEXT, env TEXT, homepage TEXT,
                source TEXT DEFAULT 'catalog', added_at TEXT,
                PRIMARY KEY (ws_id, id)
            );
            """
        )
        # 作用域维度（scope）：platform=平台全局(所有空间可见可绑) / workspace=空间私有。
        # default_on：平台项是否「copilot 默认挂载」（经 extras 机制；内置三件套/platform-ops 由 copilot 固有携带，不走此机制）。
        # 每 ws 禁用某全局项：ws_disabled。老库平滑加列/建表。
        for _ddl in ("ALTER TABLE published ADD COLUMN isolation TEXT DEFAULT 'L1'",
                     "ALTER TABLE sessions ADD COLUMN agent_version INTEGER",
                     "ALTER TABLE installed_skills ADD COLUMN deleted INTEGER DEFAULT 0",
                     "ALTER TABLE installed_skills ADD COLUMN creator TEXT",
                     "ALTER TABLE installed_skills ADD COLUMN scope TEXT DEFAULT 'workspace'",
                     "ALTER TABLE installed_skills ADD COLUMN default_on INTEGER DEFAULT 0",
                     "ALTER TABLE installed_mcp ADD COLUMN scope TEXT DEFAULT 'workspace'",
                     "ALTER TABLE installed_mcp ADD COLUMN default_on INTEGER DEFAULT 0",
                     "ALTER TABLE agents ADD COLUMN scope TEXT DEFAULT 'workspace'",
                     # 会话 Tab（spec N）：Agent 记创建人；会话冗余运行元数据，便于按创建人聚合 + 明细展示
                     "ALTER TABLE agents ADD COLUMN creator TEXT",
                     "ALTER TABLE sessions ADD COLUMN isolation TEXT",
                     "ALTER TABLE sessions ADD COLUMN location TEXT DEFAULT 'local'",
                     "ALTER TABLE sessions ADD COLUMN initiator TEXT",
                     "ALTER TABLE sessions ADD COLUMN source TEXT DEFAULT 'platform'"):
            try:
                c.execute(_ddl)
            except Exception:
                pass
        # 老库回填：creator 缺失的 Agent 归到所属空间的首个 owner（demo 即 u0=我），保证既有 Agent 进会话 Tab
        c.execute("UPDATE agents SET creator=("
                  "SELECT m.user_id FROM members m WHERE m.ws_id=agents.ws_id AND m.role='owner' "
                  "ORDER BY m.user_id LIMIT 1) WHERE creator IS NULL OR creator=''")
        c.execute(f"UPDATE agents SET creator='{DEMO_USER}' WHERE creator IS NULL OR creator=''")
        c.execute("UPDATE sessions SET initiator=user WHERE initiator IS NULL OR initiator=''")
        c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_ref)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents(creator)")
        c.execute("""CREATE TABLE IF NOT EXISTS ws_disabled (
                     ws_id TEXT, kind TEXT, id TEXT, PRIMARY KEY (ws_id, kind, id))""")
        # 启动清理：保留「用户注册」与「平台全局」，仅清掉公共注册表(clawhub)/内置目录拉入的非 custom 项
        c.execute("DELETE FROM installed_skills WHERE source='clawhub' AND scope!='platform'")
        c.execute("DELETE FROM installed_mcp WHERE source!='custom' AND scope!='platform'")
        # 保留系统空间（承载平台全局项；对用户隐藏）
        c.execute("INSERT OR IGNORE INTO workspaces VALUES (?,?)", (SYS_WS, "平台系统目录"))
        empty = c.execute("SELECT COUNT(*) AS n FROM workspaces WHERE id!=?", (SYS_WS,)).fetchone()["n"] == 0
    if empty:
        seed()
    _seed_platform()
    _seed_sessions()


def now():
    return time.strftime("%Y-%m-%d %H:%M")


def seed():
    """初始 mock 数据，与前端 demo 对齐。"""
    with db() as c:
        c.executemany("INSERT INTO workspaces VALUES (?,?)", [
            ("w1", "我的工作空间"), ("w2", "智能客服项目"),
        ])
        c.executemany("INSERT INTO members VALUES (?,?,?,?)", [
            ("w1", "u0", "Helena（我）", "owner"), ("w1", "u1", "张工", "member"),
            ("w2", "u0", "Helena（我）", "member"), ("w2", "u2", "李产品", "owner"),
            ("w2", "u3", "王全栈", "owner"),
        ])
        agents = [
            dict(id="a1", ws_id="w1", name="需求分析助手", framework="CLAUDE_CODE",
                 model="claude-sonnet-4-6", desc="把用户对话整理成结构化需求",
                 params={"temperature": 0.5, "max_tokens": 4096}, tools=["t1", "t3"], skills=["s1"],
                 files={"claude.md": "# 需求分析助手\n\n## 角色\n你是资深需求分析助手。\n"}),
            dict(id="a2", ws_id="w1", name="数据洞察 Bot", framework="OPENCLAW",
                 model="qwen3.6-plus", desc="业务数据分析与可视化",
                 params={"temperature": 0.7, "max_tokens": 8192}, tools=["t2"], skills=["s2", "s4"],
                 files={"role.md": "# 角色\n你是数据分析师。\n", "agent.md": "# 行为\n", "user.md": "# 用户上下文\n"}),
        ]
        for a in agents:
            c.execute(
                "INSERT INTO agents (id,ws_id,name,framework,model,desc,params,files,tools,skills,version,updated_at,deleted,creator) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)",
                (a["id"], a["ws_id"], a["name"], a["framework"], a["model"], a["desc"],
                 json.dumps(a["params"]), json.dumps(a["files"]), json.dumps(a["tools"]),
                 json.dumps(a["skills"]), 1, now(), DEMO_USER),
            )
            c.execute("INSERT INTO versions VALUES (?,?,?,?)",
                      (a["id"], 1, now(), json.dumps(a)))


def _seed_sessions():
    """幂等补充会话 Tab（spec N）演示数据：跨 a1/a2/copilot、多环境/发起人/状态/出错轮，
    足量以演示分页（>20）与概览统计；另插一条「他人(u9)创建的 Agent」会话，验证创建人隔离不可见。
    全部按固定 id INSERT OR IGNORE，幂等、不覆盖真实会话。"""
    # (agent_ref, title, isolation, location, initiator, status, source, version, rounds, err_last)
    specs = [
        ("a1", "把访谈记录整理成 PRD 需求项", "L1", "cloud", "u0", "active", "platform", 2, 4, False),
        ("a1", "电商下单流程的边界场景梳理", "L1", "cloud", "u7", "active", "gateway", 2, 3, False),
        ("a1", "帮我拆解「智能客服」史诗为用户故事", "L2", "cloud", "u8", "active", "gateway", 2, 5, False),
        ("a1", "需求优先级排序（MoSCoW）", "L1", "local", "u0", "archived", "platform", 1, 2, False),
        ("a1", "把这段语音转写整理成需求", "L1", "cloud", "u11", "active", "gateway", 1, 3, False),
        ("a1", "竞品功能对照表生成", "L2", "cloud", "u7", "failed", "gateway", 2, 2, True),
        ("a1", "验收标准 EARS 句式改写", "L1", "cloud", "u0", "active", "platform", 2, 4, False),
        ("a1", "用户旅程地图要点提炼", "L1", "cloud", "u12", "active", "gateway", 1, 3, False),
        ("a2", "上月 GMV 环比下滑归因分析", "L2", "cloud", "u0", "active", "platform", 1, 5, False),
        ("a2", "把这张表透视成区域×品类", "L3", "cloud", "u8", "active", "gateway", 1, 3, False),
        ("a2", "异常订单的离群点检测", "L3", "cloud", "u7", "active", "gateway", 1, 4, False),
        ("a2", "周活跃留存曲线解读", "L2", "cloud", "u0", "archived", "platform", 1, 2, False),
        ("a2", "渠道 ROI 对比可视化建议", "L3", "cloud", "u13", "active", "gateway", 1, 3, False),
        ("a2", "用户分层 RFM 模型测算", "L2", "cloud", "u8", "failed", "gateway", 1, 2, True),
        ("a2", "把 SQL 结果讲成一段结论", "L3", "cloud", "u0", "active", "cloud-callback", 1, 4, False),
        ("a2", "大促期间转化漏斗诊断", "L2", "cloud", "u7", "active", "gateway", 1, 5, False),
        ("copilot", "帮我起草本周项目周报", None, "local", "u0", "active", "platform", None, 3, False),
        ("copilot", "解释一下 RBAC 和 ABAC 区别", None, "local", "u0", "active", "platform", None, 2, False),
        ("copilot", "把这段英文邮件润色得正式些", None, "local", "u0", "archived", "platform", None, 2, False),
        ("copilot", "给新功能想几个命名", None, "local", "u0", "active", "platform", None, 4, False),
        ("copilot", "正则：匹配中国大陆手机号", None, "local", "u0", "active", "platform", None, 2, False),
        ("copilot", "整理今天的待办清单", None, "local", "u0", "active", "platform", None, 3, False),
        ("a1", "把会议纪要转成需求跟踪表", "L1", "cloud", "u0", "active", "platform", 2, 3, False),
        ("a2", "客单价分布的直方图建议", "L3", "cloud", "u14", "active", "gateway", 1, 4, False),
    ]

    def _ts_at(base_ts, k):
        # base_ts 形如 "2026-06-27 22:51:00"，按第 k 条消息加 k 分钟，返回分钟精度时间戳
        return time.strftime("%Y-%m-%d %H:%M", time.localtime(time.mktime(time.strptime(base_ts, "%Y-%m-%d %H:%M:%S")) + k * 60))

    def _msgs(agent_title, n, err_last, base_ts):
        out = []
        def add(m): m["ts"] = _ts_at(base_ts, len(out)); out.append(m)
        add({"role": "sys", "text": "会话开始"})
        for i in range(n):
            add({"role": "user", "text": f"第 {i+1} 轮：{agent_title}（追问 {i+1}）"})
            if err_last and i == n - 1:
                add({"role": "assistant", "text": "工具调用超时，本轮执行失败。", "err": True})
            else:
                add({"role": "assistant", "text": f"已处理「{agent_title}」第 {i+1} 步，给出阶段性结论。"})
        return out

    with db() as c:
        # 重建演示会话行（旧行可能缺 ts 等新字段，先清后插，保证幂等且 schema 最新；不动真实会话）
        c.execute("DELETE FROM sessions WHERE id LIKE 'sess_seed%'")
        # 他人(u9)创建的 Agent + 其会话——u0 不应看见（创建人隔离样本）
        c.execute("INSERT OR IGNORE INTO agents (id,ws_id,name,framework,model,desc,params,files,tools,skills,version,updated_at,deleted,creator) "
                  "VALUES ('a_other','w1','风控审查助手','CLAUDE_CODE','claude-sonnet-4-6','他人创建，用于隔离验证','{}','{}','[]','[]',1,?,0,'u9')", (now(),))
        c.execute("INSERT INTO sessions (id,user,agent_ref,title,claude_sid,messages,status,created_at,updated_at,agent_version,isolation,location,initiator,source) "
                  "VALUES ('sess_seed_other','u9','a_other','他人 Agent 的会话（u0 不可见）',NULL,?,'active',?,?,1,'L2','cloud','u9','gateway')",
                  (json.dumps(_msgs("风控审查", 3, False, "2026-06-27 12:00:00"), ensure_ascii=False), "2026-06-27 12:00:00", "2026-06-27 12:00:00"))
        for idx, (ag, title, iso, loc, initiator, status, source, ver, rounds, err) in enumerate(specs):
            sid = f"sess_seed_{idx:02d}"
            # 时间递减：idx 越小越新，落在 06-27 当天，保证默认倒序可读
            ts = f"2026-06-27 {23 - (idx // 2):02d}:{59 - (idx * 4 % 60):02d}:00"
            c.execute("INSERT INTO sessions (id,user,agent_ref,title,claude_sid,messages,status,created_at,updated_at,agent_version,isolation,location,initiator,source) "
                      "VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?)",
                      (sid, initiator, ag, title, json.dumps(_msgs(title, rounds, err, ts), ensure_ascii=False),
                       status, ts, ts, ver, iso, loc, initiator, source))


# 平台全局项（scope='platform'）的稳定 id
PLATFORM_OPS_ID = "aispace-platform-ops"
COPILOT_TEMPLATE_ID = "copilot"


def _seed_platform():
    """把 copilot 的内置三 skill + platform-ops MCP 沉淀为「平台全局」行（scope='platform'，住 __system__），
    并登记 copilot 为平台 agent 模板。让它们在所有空间可见可绑、可在平台集中管理（见 架构设计 §10.5）。
    内置项源真在 copilot.py，这里 REPLACE 保持与代码同步；管理员新增的全局项是独立 id，不被重置。"""
    ts = now()
    with db() as c:
        # 三个内置技能 → 平台全局技能行（default_on=0：copilot 由 build_workdir 固有携带，不走 extras）
        for s in copilot.BUILTIN_SKILLS:
            c.execute(
                "INSERT OR REPLACE INTO installed_skills "
                "(ws_id,id,name,description,instructions,allowed_tools,source,added_at,archive_path,tree,deleted,creator,scope,default_on) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?)",
                (SYS_WS, s["name"], s["name"], s["description"], s["instructions"],
                 "[]", "platform", ts, None, "[]", "平台", "platform", 0))
        # platform-ops MCP → 平台全局 MCP 行（env 用变量名，运行时由 ${AISPACE_API} 展开）
        c.execute(
            "INSERT OR REPLACE INTO installed_mcp "
            "(ws_id,id,name,summary,category,command,args,env,homepage,source,added_at,scope,default_on) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (SYS_WS, PLATFORM_OPS_ID, "aispace（平台操作）", "操作本平台：列出/创建/发布 Agent、创建空间、提交需求等",
             "平台", os.environ.get("AISPACE_MCP_PYTHON", "python3"),
             json.dumps([os.path.join(os.path.dirname(__file__), "mcp_server.py")]),
             json.dumps(["AISPACE_API"]), "", "platform", ts, "platform", 0))
        # copilot → 平台 agent 模板（公共；运行时**按用户**实例化，当前空间随每条消息给定）
        files = json.dumps({"claude.md": copilot.system_md()})
        c.execute(
            "INSERT OR REPLACE INTO agents "
            "(id,ws_id,name,framework,model,desc,params,files,tools,skills,version,updated_at,deleted,scope) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)",
            (COPILOT_TEMPLATE_ID, SYS_WS, "通用助手 (Copilot)", "CLAUDE_CODE", "claude-opus-4-8",
             "平台统一入口·编排者：platform-ops MCP + 三内置 skill", json.dumps({}), files,
             json.dumps([PLATFORM_OPS_ID]), json.dumps([s["name"] for s in copilot.BUILTIN_SKILLS]),
             1, ts, "platform"))


# ---------------- Models ----------------
class AgentIn(BaseModel):
    ws_id: str
    name: str
    framework: str
    model: str
    desc: str = ""
    params: dict = {}
    files: dict = {}
    tools: list = []
    skills: list = []


class AgentEdit(BaseModel):
    model: Optional[str] = None
    desc: Optional[str] = None
    params: Optional[dict] = None
    files: Optional[dict] = None
    tools: Optional[list] = None
    skills: Optional[list] = None


class ChatIn(BaseModel):
    message: str
    config: Optional[dict] = None       # 调试：用未保存配置；不传则用已保存 agent
    session_id: Optional[str] = None    # 多轮续接：上一次返回的 session_id


class PublishIn(BaseModel):
    config: Optional[dict] = None   # 编辑页发布：当前配置（有改动则存为新版本）


class CopilotSessionIn(BaseModel):
    title: Optional[str] = None
    claude_sid: Optional[str] = None     # Claude Code 续接 token（resume）
    messages: Optional[list] = None      # 可见对话消息 [{role,text}]


class SessionCreateIn(BaseModel):
    agent: str = "copilot"               # 'copilot' 或某 agent id
    version: Optional[int] = None        # 按 session 钉 agent 版本（不传=随已发布版本，对齐 Claude managed agents）
    environment_id: Optional[str] = None # 环境（决定隔离级别 L1/L3）；MVP 隔离仍以发布时为准
    title: Optional[str] = None


class EnvironmentIn(BaseModel):
    name: str
    isolation: str = "L1"                # L0 用户沙箱 / L1 共享 / L2 独立 / L3 即用即弃
    description: str = ""


class SessionEventIn(BaseModel):
    # 兼容 {message, session_id?} 与标准 {events:[{type:'user.message',content:[{type:'text',text}]}]}
    message: Optional[str] = None
    session_id: Optional[str] = None
    events: Optional[list] = None


class WorkspaceIn(BaseModel):
    name: str


class MemberIn(BaseModel):
    name: str
    role: str = "member"


# ---------------- App ----------------
app = FastAPI(title="AISpace Agent 平台 API", version="0.1")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


def row_to_agent(r):
    return {
        "id": r["id"], "wsId": r["ws_id"], "name": r["name"], "framework": r["framework"],
        "model": r["model"], "desc": r["desc"], "params": json.loads(r["params"]),
        "files": json.loads(r["files"]), "tools": json.loads(r["tools"]),
        "skills": json.loads(r["skills"]), "version": r["version"], "updatedAt": r["updated_at"],
        "creator": (r["creator"] if "creator" in r.keys() else None),
    }


# ----- workspaces / members -----
@app.get("/api/workspaces")
def list_workspaces():
    with db() as c:
        wss = c.execute("SELECT * FROM workspaces WHERE id!=?", (SYS_WS,)).fetchall()  # 隐藏平台系统目录
        out = []
        for w in wss:
            ms = c.execute("SELECT user_id,name,role FROM members WHERE ws_id=?", (w["id"],)).fetchall()
            out.append({"id": w["id"], "name": w["name"],
                        "members": [{"id": m["user_id"], "name": m["name"], "role": m["role"]} for m in ms]})
        return out


@app.post("/api/workspaces")
def create_workspace(body: WorkspaceIn):
    wid = "w" + str(int(time.time() * 1000))
    with db() as c:
        c.execute("INSERT INTO workspaces VALUES (?,?)", (wid, body.name))
        c.execute("INSERT INTO members VALUES (?,?,?,?)", (wid, "u0", "Helena（我）", "owner"))
    return {"id": wid, "name": body.name}


@app.put("/api/workspaces/{ws_id}/members/{user_id}")
def upsert_member(ws_id: str, user_id: str, body: MemberIn):
    with db() as c:
        c.execute("INSERT INTO members VALUES (?,?,?,?) ON CONFLICT(ws_id,user_id) DO UPDATE SET name=?,role=?",
                  (ws_id, user_id, body.name, body.role, body.name, body.role))
    return {"ok": True}


@app.delete("/api/workspaces/{ws_id}/members/{user_id}")
def remove_member(ws_id: str, user_id: str):
    with db() as c:
        owners = c.execute("SELECT COUNT(*) n FROM members WHERE ws_id=? AND role='owner'", (ws_id,)).fetchone()["n"]
        m = c.execute("SELECT role FROM members WHERE ws_id=? AND user_id=?", (ws_id, user_id)).fetchone()
        if m and m["role"] == "owner" and owners <= 1:
            raise HTTPException(400, "空间至少保留一名 Owner")
        c.execute("DELETE FROM members WHERE ws_id=? AND user_id=?", (ws_id, user_id))
    return {"ok": True}


# ----- agents -----
def _pub_map(c):
    return {r["agent_id"]: {"version": r["version"], "isolation": r["isolation"]}
            for r in c.execute("SELECT agent_id, version, isolation FROM published").fetchall()}


@app.get("/api/agents")
def list_agents(ws: str):
    with db() as c:
        rows = c.execute("SELECT * FROM agents WHERE ws_id=? AND deleted=0 ORDER BY updated_at DESC", (ws,)).fetchall()
        pub = _pub_map(c)
        out = []
        for r in rows:
            a = row_to_agent(r)
            p = pub.get(r["id"])
            a["publishedVersion"] = p["version"] if p else None
            a["publishedIsolation"] = p["isolation"] if p else None
            a["published"] = r["id"] in pub
            out.append(a)
        return out


@app.get("/api/agents/{aid}")
def get_agent(aid: str):
    with db() as c:
        r = c.execute("SELECT * FROM agents WHERE id=?", (aid,)).fetchone()
        if not r:
            raise HTTPException(404, "Agent 不存在")
        a = row_to_agent(r)
        vs = c.execute("SELECT version,created_at,config FROM versions WHERE agent_id=? ORDER BY version", (aid,)).fetchall()
        a["versions"] = [{"version": v["version"], "createdAt": v["created_at"], "config": json.loads(v["config"])} for v in vs]
        pub = _pub_map(c)
        p = pub.get(aid)
        a["publishedVersion"] = p["version"] if p else None
        a["publishedIsolation"] = p["isolation"] if p else None
        a["published"] = aid in pub
        return a


@app.post("/api/agents")
def create_agent(body: AgentIn, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    aid = "a" + str(int(time.time() * 1000))
    ts = now()
    cfg = body.model_dump()
    creator = _copilot_user(x_user)   # 记创建人：会话 Tab 按它聚合（spec N）
    with db() as c:
        dup = c.execute("SELECT 1 FROM agents WHERE ws_id=? AND name=? AND deleted=0", (body.ws_id, body.name)).fetchone()
        if dup:
            raise HTTPException(400, "同空间内名称已存在")
        c.execute("INSERT INTO agents (id,ws_id,name,framework,model,desc,params,files,tools,skills,version,updated_at,deleted,creator) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)",
                  (aid, body.ws_id, body.name, body.framework, body.model, body.desc,
                   json.dumps(body.params), json.dumps(body.files), json.dumps(body.tools),
                   json.dumps(body.skills), 1, ts, creator))
        c.execute("INSERT INTO versions VALUES (?,?,?,?)", (aid, 1, ts, json.dumps(cfg)))
    return get_agent(aid)


VKEYS = ["name", "desc", "framework", "model", "params", "files", "tools", "skills"]


def _commit_version(aid: str, data: dict) -> int:
    """以 data 覆盖当前配置并生成新版本，返回新版本号。"""
    with db() as c:
        r = c.execute("SELECT * FROM agents WHERE id=?", (aid,)).fetchone()
        if not r:
            raise HTTPException(404, "Agent 不存在")
        a = row_to_agent(r)
        a.update({k: v for k, v in data.items() if v is not None})
        nv = r["version"] + 1
        ts = now()
        c.execute("UPDATE agents SET model=?,desc=?,params=?,files=?,tools=?,skills=?,version=?,updated_at=? WHERE id=?",
                  (a["model"], a["desc"], json.dumps(a["params"]), json.dumps(a["files"]),
                   json.dumps(a["tools"]), json.dumps(a["skills"]), nv, ts, aid))
        snap = {k: a.get(k) for k in VKEYS}
        c.execute("INSERT INTO versions VALUES (?,?,?,?)", (aid, nv, ts, json.dumps(snap)))
    return nv


@app.put("/api/agents/{aid}")
def edit_agent(aid: str, body: AgentEdit):
    _commit_version(aid, {k: v for k, v in body.model_dump().items() if v is not None})
    return get_agent(aid)


@app.delete("/api/agents/{aid}")
def delete_agent(aid: str):
    with db() as c:
        c.execute("UPDATE agents SET deleted=1 WHERE id=?", (aid,))
    return {"ok": True}


# ----- chat / 试跑（Claude Code 无头，回退 mock）-----
def build_system_prompt(cfg: dict) -> str:
    files = cfg.get("files", {})
    parts = [f"# Agent: {cfg.get('name','')}", cfg.get("desc", "")]
    for k, v in files.items():
        parts.append(f"\n--- {k} ---\n{v}")
    return "\n".join(parts)


def run_claude_code(system_prompt: str, message: str, model: str, session_id: Optional[str]):
    """无头调用本机 Claude Code 真实运行。返回 {engine, reply, session_id?}。"""
    b = claude_bin()
    if not b:
        return {"engine": "mock", "reply": None}
    cmd = [b, "-p", message, "--output-format", "json"]
    if session_id:
        cmd += ["--resume", session_id]            # 续接多轮上下文
    elif system_prompt:
        cmd += ["--append-system-prompt", system_prompt]  # 首轮注入 agent 配置
    if str(model).startswith("claude"):
        cmd += ["--model", model]
    workdir = os.path.join(AGENTS_DIR, ".debug")
    os.makedirs(workdir, exist_ok=True)
    env = os.environ.copy()
    env["PATH"] = os.path.dirname(b) + os.pathsep + env.get("PATH", "")  # 让同目录的 node 可被找到
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, cwd=workdir, env=env)
    except subprocess.TimeoutExpired:
        return {"engine": "error", "reply": "调试超时（>180s）"}
    if res.returncode != 0:
        return {"engine": "error", "reply": (res.stderr or res.stdout or "claude 运行失败").strip()[:1000]}
    out = (res.stdout or "").strip()
    try:
        data = json.loads(out)
        return {"engine": "claude-code", "reply": data.get("result", ""), "session_id": data.get("session_id")}
    except Exception:
        return {"engine": "claude-code", "reply": out}


@app.post("/api/agents/{aid}/chat")
def chat(aid: str, body: ChatIn):
    cfg = body.config if body.config is not None else get_agent(aid)
    sys_p = build_system_prompt(cfg)
    r = run_claude_code(sys_p, body.message, cfg.get("model", ""), body.session_id)
    if r.get("engine") == "mock":
        r["reply"] = (f"（mock · 本机未检测到 claude 命令）「{cfg.get('name','Agent')}」"
                      f"收到：{body.message}")
    return r


@app.get("/api/published")
def list_published():
    with db() as c:
        rows = c.execute(
            """SELECT p.agent_id, p.version, p.path, p.published_at, p.isolation,
                      a.name, a.framework, a.model, a.ws_id, a.deleted
               FROM published p JOIN agents a ON a.id = p.agent_id
               ORDER BY p.published_at DESC"""
        ).fetchall()
        return [{"id": r["agent_id"], "version": r["version"], "path": r["path"],
                 "publishedAt": r["published_at"], "name": r["name"],
                 "framework": r["framework"], "model": r["model"], "wsId": r["ws_id"],
                 "isolation": (r["isolation"] if "isolation" in r.keys() else "L1") or "L1"}
                for r in rows if not r["deleted"]]


# ---------------- 作用域有效集解析（platform ∪ workspace − disabled，ws 私有覆盖同 id 平台项）----------------
def _disabled_ids(c, ws, kind):
    return {r["id"] for r in c.execute(
        "SELECT id FROM ws_disabled WHERE ws_id=? AND kind=?", (ws, kind)).fetchall()}


def _effective_rows(c, table, kind, ws, ids=None, extra_where="", drop_disabled=True):
    """某空间的 skill/MCP 有效集：全局(platform) ∪ 本空间(workspace)，同 id 时 workspace 覆盖 platform。
    每行打 scope 与 disabled（platform 项是否在本空间被禁用）。
    drop_disabled=True（物化/解析用）：剔除被禁用的全局项；False（列表展示用）：保留但标 disabled。
    ids=None 取全部，否则只取指定 id。"""
    if ids is not None and not ids:
        return []
    dis = _disabled_ids(c, ws, kind)
    q = f"SELECT * FROM {table} WHERE (ws_id=? OR scope='platform'){extra_where}"
    args = [ws]
    if ids is not None:
        q += f" AND id IN ({','.join('?' * len(ids))})"
        args += list(ids)
    by_id = {}
    for r in c.execute(q, args).fetchall():
        d = dict(r)
        d["scope"] = d.get("scope") or "workspace"
        d["disabled"] = bool(d["scope"] == "platform" and d["id"] in dis)
        if drop_disabled and d["disabled"]:
            continue
        if d["id"] in by_id and by_id[d["id"]].get("scope") == "workspace":
            continue   # ws 私有已占，platform 不覆盖
        by_id[d["id"]] = d
    return list(by_id.values())


def _materialize_skills(workdir, ws_id, skill_ids):
    """把 agent 绑定的技能物化成 Claude Code 能自动发现的目录结构：
    每个技能 → <workdir>/.claude/skills/<name>/SKILL.md（+ 上传包的文件树，如有）。
    解析按有效集：本空间私有 + 平台全局（所有空间可访问），Claude Code 启动时扫描 .claude/skills/ 懒加载。"""
    if not skill_ids:
        return []
    mounted = []
    with db() as c:
        rows = _effective_rows(c, "installed_skills", "skill", ws_id, skill_ids, extra_where=" AND deleted=0")
    for r in rows:
        d = dict(r)
        safe = re.sub(r"[^a-z0-9-]+", "-", (d["name"] or d["id"]).lower()).strip("-") or d["id"]
        sk_dir = os.path.join(workdir, ".claude", "skills", safe)
        os.makedirs(sk_dir, exist_ok=True)
        # 上传包（tar/zip）：解包整棵树，SKILL.md 随包内文件一起落地
        arch = d.get("archive_path")
        if arch and os.path.exists(arch):
            try:
                shutil.unpack_archive(arch, sk_dir)
            except Exception:
                pass
        if not os.path.exists(os.path.join(sk_dir, "SKILL.md")):
            md = _render_skill_md(d["name"], d["description"], d.get("instructions") or "",
                                  json.loads(d.get("allowed_tools") or "[]"))
            with open(os.path.join(sk_dir, "SKILL.md"), "w", encoding="utf-8") as f:
                f.write(md)
        mounted.append(safe)
    return mounted


def _skills_payload(ws_id, skill_ids):
    """收集 agent 绑定技能为 {slug: {relpath: content}}，供云端 OpenClaw 沙箱经 SKILLS_JSON 物化到 <ws>/skills/<slug>/。
    复用 _materialize_skills 的有效集解析（本空间私有 + 平台全局）；文本文件入字典，二进制资产暂跳过（后续走 OSS）。"""
    if not skill_ids:
        return {}
    import tempfile
    tmp = tempfile.mkdtemp(prefix="aispace-sk-")
    try:
        names = _materialize_skills(tmp, ws_id, skill_ids)
        base = os.path.join(tmp, ".claude", "skills")
        out = {}
        for slug in names:
            sd = os.path.join(base, slug)
            files = {}
            for root, _dirs, fns in os.walk(sd):
                for fn in fns:
                    fp = os.path.join(root, fn)
                    try:
                        with open(fp, "r", encoding="utf-8") as f:
                            files[os.path.relpath(fp, sd)] = f.read()
                    except (UnicodeDecodeError, OSError):
                        pass   # 二进制/不可读：跳过（文本 skill 足够跑通）
            if files:
                out[slug] = files
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _materialize_mcp(workdir, ws_id, mcp_ids, extra=None):
    """把 agent 绑定的 MCP（tools 字段）物化成 <workdir>/.mcp.json。
    Claude Code 以 --mcp-config 加载该文件，把每个 server 的工具挂进编排。
    extra：额外注入的 server（如 copilot 的 platform-ops），形如 {name: {command,args,env}}。"""
    servers = dict(extra or {})
    if mcp_ids:
        with db() as c:
            rows = _effective_rows(c, "installed_mcp", "mcp", ws_id, mcp_ids)
        for r in rows:
            d = dict(r)
            key = re.sub(r"[^a-zA-Z0-9_-]+", "-", d["name"] or d["id"]).strip("-") or d["id"]
            # env 存的是「所需变量名」列表；用 ${VAR} 让 Claude Code 从运行环境展开（凭证不入库）
            env = {k: f"${{{k}}}" for k in json.loads(d.get("env") or "[]")}
            servers[key] = {"command": d["command"], "args": json.loads(d.get("args") or "[]"), "env": env}
    if not servers:
        return []
    with open(os.path.join(workdir, ".mcp.json"), "w", encoding="utf-8") as f:
        json.dump({"mcpServers": servers}, f, ensure_ascii=False, indent=2)
    return list(servers.keys())


@app.post("/api/agents/{aid}/publish")
def publish(aid: str, version: Optional[int] = None, isolation: str = "L1", body: Optional[PublishIn] = Body(default=None)):
    """把 Agent 物化成本机 Claude Code 工作目录，返回运行命令。
    若带 config（编辑页发布）：有改动则先存为新版本再发布（版本自动 +1）。"""
    a = get_agent(aid)
    if body and body.config:
        latest = a["versions"][-1]["config"] if a["versions"] else {}
        changed = any(body.config.get(k) != latest.get(k) for k in VKEYS)
        if changed:
            version = _commit_version(aid, body.config)
            a = get_agent(aid)
    cfg = a
    if version:
        v = next((x for x in a["versions"] if x["version"] == version), None)
        if v:
            cfg = {**a, **v["config"]}
    ver = version or a["version"]
    safe = re.sub(r"[^\w\-]+", "_", cfg.get("name") or aid).strip("_") or aid
    d = os.path.join(AGENTS_DIR, safe)
    os.makedirs(d, exist_ok=True)
    written = []
    for fn, content in (cfg.get("files") or {}).items():
        # Claude Code 读取 CLAUDE.md 作为项目指令；claude.md → CLAUDE.md
        target = "CLAUDE.md" if fn.lower() == "claude.md" else fn
        with open(os.path.join(d, target), "w", encoding="utf-8") as f:
            f.write(content or "")
        written.append(target)
    model = cfg.get("model", "")
    fw = cfg.get("framework", "CLAUDE_CODE")
    mounted_skills, mounted_mcp = [], []
    if fw != "OPENCLAW":
        # 单 agent 编排：把绑定的技能/MCP 物化进工作目录，Claude Code 启动即挂载
        mounted_skills = _materialize_skills(d, cfg.get("wsId") or a.get("wsId"), cfg.get("skills") or [])
        mounted_mcp = _materialize_mcp(d, cfg.get("wsId") or a.get("wsId"), cfg.get("tools") or [])
    if fw == "OPENCLAW":
        # OpenClaw 不是「每 agent 一进程」，而是由平台共享 Gateway 托管（一个 Gateway 托多 agent，按 agentId 路由）
        cmd = f'# OpenClaw：本 agent 由平台共享 Gateway 托管，按 agentId 路由（无需在本目录单独起进程）'
        run_note = ("本 Agent 为 **OpenClaw** 框架：由平台**共享 Gateway** 托管"
                    "（一个 Gateway 托多个 agent，按 agentId 路由），发布即绑定，"
                    "经 `POST /api/agents/{id}/service-chat` 对话。配置文件为 role/agent/user.md。")
    else:
        cmd = f'cd "{d}" && claude' + (f" --model {model}" if str(model).startswith("claude") else "")
        run_note = "在此目录运行 `claude` 即以本 Agent 的设定开始多轮会话；记忆/状态留在本目录。"
    with open(os.path.join(d, "运行说明.md"), "w", encoding="utf-8") as f:
        f.write(f"# {cfg.get('name','')}（v{ver}）\n\n本机运行：\n\n    {cmd}\n\n"
                f"模型：{model}\n框架：{fw}\n\n{run_note}\n")
    iso = isolation or "L1"
    # OpenClaw 上云：把该 agent 绑定的技能收集为下发载荷，云端沙箱经 SKILLS_JSON 物化到 <ws>/skills/
    cloud_skills = _skills_payload(cfg.get("wsId") or a.get("wsId"), cfg.get("skills") or []) if fw == "OPENCLAW" else None
    with db() as c:
        c.execute("INSERT OR REPLACE INTO published (agent_id, version, path, published_at, isolation) VALUES (?,?,?,?,?)",
                  (aid, ver, d, now(), iso))
    # 发布即起服务（R1 单主实例，换版本/环境=替换）：L1=本地常驻；L2/L3=云端独立沙箱（异步部署）
    svc = _start_service(aid, cfg.get("name") or aid, d, cfg.get("model", ""), ver,
                         cfg.get("framework", "CLAUDE_CODE"), iso, files=cfg.get("files") or {}, skills=cloud_skills)
    return {"path": d, "command": cmd, "files": written,
            "skills": mounted_skills, "mcp": mounted_mcp,
            "framework": cfg.get("framework", ""), "version": ver, "isolation": iso,
            "claude_code": bool(claude_bin()),
            # 对外稳定地址（按 id 经网关路由）——上游请绑这个：
            "stable_url": _stable_url(aid),
            # 内部细节（裸端口，重启/换版本会变，仅本机调试用，勿直连）：
            "internal_url": svc.get("url"), "service_port": svc.get("port"),
            "service_url": svc.get("url"),  # 兼容旧字段（= internal_url，已不建议对外使用）
            "location": svc.get("location", "local"), "status": svc.get("status", "running")}


@app.get("/api/services")
def list_services():
    """运行中服务。stable_url=对外稳定地址（按 id 经网关）；internal_url/url=内部裸端口（会变，勿直连）。"""
    out = []
    for k, v in SERVICES.items():
        out.append({"agentId": k, **v,
                    "stable_url": _stable_url(k),
                    "internal_url": v.get("url")})
    return out


@app.post("/api/agents/{aid}/service/stop")
def stop_service(aid: str):
    if aid not in SERVICES:
        raise HTTPException(400, "该 Agent 服务未在运行")
    _stop_service(aid)
    return {"ok": True}


@app.post("/api/services/stop-all")
def stop_all_services():
    """停止所有 agent 服务：先停已登记的，再 pkill 兜底（清掉后端重启遗留的孤儿进程）。"""
    n = len(SERVICES)
    for aid in list(_PROCS.keys()):
        _stop_service(aid)
    _stop_gateway()
    try:
        subprocess.run(["pkill", "-f", "agent_runner.py"], timeout=5)
        subprocess.run(["pkill", "-f", "openclaw_gateway.py"], timeout=5)  # 兜底清理孤儿 Gateway
    except Exception:
        pass
    SERVICES.clear()
    _PROCS.clear()
    return {"ok": True, "stopped": n}


def _svc_payload(aid, svc, body):
    """构造下游 /chat 请求体。OpenClaw 走共享 Gateway，需带 agent_id 路由。"""
    p = {"message": body.message, "session_id": body.session_id}
    if svc.get("gateway"):
        p["agent_id"] = aid
    return p


def _cloud_guard(svc):
    if svc.get("status") == "deploying":
        raise HTTPException(409, "云端独立环境部署中，请稍候再试")
    if svc.get("status") == "failed":
        raise HTTPException(502, f"云端部署失败：{svc.get('error', '')}")


@app.post("/api/agents/{aid}/service-chat")
def service_chat(aid: str, body: ChatIn):
    svc = SERVICES.get(aid)
    if not svc:
        raise HTTPException(400, "该 Agent 未发布为服务")
    if svc.get("location") == "cloud":                      # 云端独立沙箱：经云适配器调用
        _cloud_guard(svc)
        try:
            return _cloud().chat(aid, body.message, body.session_id)
        except Exception as e:
            raise HTTPException(502, f"云端 agent 不可达：{e}")
    try:
        r = _proxy.post(svc["url"] + "/chat", json=_svc_payload(aid, svc, body))
        return r.json()
    except Exception as e:
        raise HTTPException(502, f"agent 服务不可达：{e}")


@app.post("/api/agents/{aid}/service-chat/stream")
def service_chat_stream(aid: str, body: ChatIn):
    """协议2：SSE 流式，后端代理到该 Agent 服务的 /chat/stream（OpenClaw 本地经共享 Gateway 路由）。
    云端独立沙箱暂以一次性结果包成单个 SSE done（云 bundle 未开流式）。"""
    svc = SERVICES.get(aid)
    if not svc:
        raise HTTPException(400, "该 Agent 未发布为服务")
    if svc.get("location") == "cloud":
        _cloud_guard(svc)

        def gen_cloud():
            try:
                r = _cloud().chat(aid, body.message, body.session_id)
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'reply': str(e)}, ensure_ascii=False)}\n\n"
                return
            yield from _sse_text_deltas(r.get("reply", ""))   # 逐字推送，与本地一致的流式观感
            yield f"event: done\ndata: {json.dumps(r, ensure_ascii=False)}\n\n"
        return StreamingResponse(gen_cloud(), media_type="text/event-stream")
    payload = _svc_payload(aid, svc, body)

    def gen():
        try:
            with _proxy.stream("POST", svc["url"] + "/chat/stream", json=payload) as r:
                for chunk in r.iter_raw():
                    yield chunk
        except Exception as e:   # 下游不可达：转成干净 SSE error，避免 ASGI 未处理异常
            yield f"event: error\ndata: {json.dumps({'reply': f'agent 服务不可达：{e}'}, ensure_ascii=False)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------------- 通用 Agent（Copilot）：编写 + 启动 + 对话 ----------------
# copilot = 平台自带、常驻在每用户 L0 沙箱里的编排者；编排支持挂 skill(.claude/skills) + MCP(.mcp.json)。
# 复用 _start_service/agent_runner 当运行时（claude -p）；正式版可换 Agent SDK 内嵌。
# ---------------- copilot 按「用户」路由（一个用户一个 copilot，ws 作上下文）----------------
# demo 没有真实鉴权：用户取 X-User-Id 头，缺省 DEMO_USER。生产从会话/鉴权拿真实用户。
DEMO_USER = "u0"


def _copilot_user(x_user):
    return (x_user or DEMO_USER).strip() or DEMO_USER


def _ctx_message(ws, message):
    """把「当前操作的空间」作为上下文前缀注入消息——copilot 据此给工具传 workspace_id。
    ws 是每请求上下文，不进实例键；前端展示的仍是用户原文。"""
    return f"[当前工作空间: {ws}]\n{message}" if ws else message


def _platform_default_ids():
    """copilot 默认挂载的平台全局项 id（default_on=1）。内置三 skill / platform-ops 由 copilot 固有携带，
    default_on=0，不在此列；这里捞的是管理员后加、标了「copilot 默认带」的全局项。"""
    with db() as c:
        sk = [r["id"] for r in c.execute(
            "SELECT id FROM installed_skills WHERE scope='platform' AND default_on=1 AND deleted=0").fetchall()]
        mc = [r["id"] for r in c.execute(
            "SELECT id FROM installed_mcp WHERE scope='platform' AND default_on=1").fetchall()]
    return sk, mc


def _start_copilot(user, extras=None):
    """启动（或刷新重启）某用户的通用助手。extras 可带 {skills:[...], mcp:[...]}；自动叠加 default_on 平台全局项。"""
    extras = extras or {}
    cid = copilot.copilot_id(user)
    dsk, dmc = _platform_default_ids()
    skills = list(dict.fromkeys((extras.get("skills") or []) + dsk))   # 去重合并
    mcp = list(dict.fromkeys((extras.get("mcp") or []) + dmc))
    # extras 多为 platform 作用域，解析用系统空间即可
    workdir = copilot.build_workdir(
        COPILOT_BASE, user, SELF_API, extra_skill_ids=skills, extra_mcp_ids=mcp,
        materialize_skills=_materialize_skills, materialize_mcp=_materialize_mcp, resolve_ws=SYS_WS)
    if cid in SERVICES:
        _stop_service(cid)          # 单实例：停旧起新，加载最新 skill/MCP
    svc = _start_service(cid, "通用助手", workdir, "claude-opus-4-8", 1, "CLAUDE_CODE", "L1")
    ready = _wait_svc_alive(svc)
    return svc, ready, skills, mcp, workdir


def _svc_alive(svc, timeout=0.8):
    """ping 服务 /health。注册表里的端口可能指向已死进程（重启遗留），需实测可达性。"""
    try:
        return _proxy.get(svc["url"] + "/health", timeout=timeout).status_code == 200
    except Exception:
        return False


def _wait_svc_alive(svc, secs=12):
    """等待刚拉起的服务进程就绪（uvicorn 启动 + 监听约需 1–2s，避免首条请求撞到未监听端口）。"""
    for _ in range(int(secs / 0.25)):
        if _svc_alive(svc, timeout=0.5):
            return True
        time.sleep(0.25)
    return False


def _resolve_copilot_endpoint(user):
    """**身份 → 端点**解析（与隔离级别正交，对外路由不变）。
    local（demo）：返回该用户 copilot 的本地服务（懒启动 + 自愈）。
    sandbox（生产，预留）：返回该用户 L0 沙箱内 copilot 的端点（由沙箱编排器登记）。"""
    cid = copilot.copilot_id(user)
    svc = SERVICES.get(cid)
    if svc and _svc_alive(svc):
        return svc
    if svc:                      # 登记了但 ping 不通：清陈旧条目，重起到新端口
        _stop_service(cid)
    _start_copilot(user)         # 内部已等待就绪
    svc = SERVICES.get(cid)
    if not svc:
        raise HTTPException(500, "通用助手启动失败")
    return svc


@app.post("/api/copilot/start")
def copilot_start(body: Optional[dict] = Body(default=None), x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """启动（或刷新重启）当前用户的通用助手（一个用户一个，跨其所有空间复用）。"""
    user = _copilot_user(x_user)
    svc, ready, skills, mcp, workdir = _start_copilot(user, body or {})
    return {"ok": True, "user": user, "workdir": workdir, "ready": ready,
            "skills": [s["name"] for s in copilot.BUILTIN_SKILLS] + skills,
            "mcp": ["aispace"] + mcp,
            # 对外稳定地址（按用户身份经网关路由，端口是内部细节）
            "stable_url": f"{SELF_API}/api/copilot/chat",
            "internal_url": svc.get("url"), "service_url": svc.get("url"),
            "claude_code": bool(claude_bin())}


@app.get("/api/copilot/status")
def copilot_status(ws: Optional[str] = None, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """当前用户通用助手运行态（与空间无关——一个用户一个，跨空间复用）。ws 仅作回显上下文。"""
    user = _copilot_user(x_user)
    svc = SERVICES.get(copilot.copilot_id(user))
    running = bool(svc) and _svc_alive(svc)   # 实测可达，避免登记了已死端口仍报「已连接」
    return {"running": running, "user": user, "ws": ws,
            "stable_url": f"{SELF_API}/api/copilot/chat",
            "internal_url": (svc or {}).get("url"), "service_url": (svc or {}).get("url"),
            "builtin_skills": [s["name"] for s in copilot.BUILTIN_SKILLS],
            "claude_code": bool(claude_bin())}


@app.post("/api/copilot/stop")
def copilot_stop(x_user: Optional[str] = Header(None, alias="X-User-Id")):
    cid = copilot.copilot_id(_copilot_user(x_user))
    if cid in SERVICES:
        _stop_service(cid)
    return {"ok": True}


# ---------------- 会话持久化（服务端拥有，按轮原子写）----------------
# 关键：消息历史由**后端**在每轮对话时落库，前端只发 {session_id, message} 并渲染——
# 不再由前端事后回写整段（消除切换/卸载/PUT 失败导致的内容丢失）。
# ================= 统一会话层（Phase 1：对齐 Claude/Qoder Managed Agents）=================
# 一个 Session = (Agent + Environment) 的有状态实例，**服务端持有历史**，按 id 寻址。
#   agent_ref: 'copilot' 或某 agent id（统一，普通 agent 也有 session 与历史）。
#   claude_sid: 续接 token，纯**内部细节**（前端只认我方 session id —— 单一语义）。
# 旧 /api/copilot/* 与 /api/agents/{id}/service-chat 保留为薄适配器（不破坏上游）。
def _agent_runtime_meta(agent_ref):
    """会话创建时快照 Agent 当时的运行形态：(isolation, location)。copilot/未发布兜底为 (None,'local')。"""
    if not agent_ref or agent_ref == "copilot":
        return None, "local"
    iso = None
    with db() as c:
        p = c.execute("SELECT isolation FROM published WHERE agent_id=?", (agent_ref,)).fetchone()
        if p:
            iso = p["isolation"]
    loc = (SERVICES.get(agent_ref) or {}).get("location", "local")
    return iso, loc


def _sess_resolve(user, sid, agent_ref="copilot"):
    """返回 (会话id, 续接token, agent_ref)。sid 不存在则按 agent_ref 新建一条（容错，对话不丢）。"""
    with db() as c:
        r = c.execute("SELECT id,claude_sid,agent_ref FROM sessions WHERE id=? AND user=?", (sid or "", user)).fetchone()
        if r:
            return r["id"], r["claude_sid"], r["agent_ref"]
        nsid = sid or ("s" + uuid.uuid4().hex[:12])
        ts = now()
        iso, loc = _agent_runtime_meta(agent_ref)
        c.execute("INSERT OR IGNORE INTO sessions (id,user,agent_ref,title,claude_sid,messages,status,created_at,updated_at,isolation,location,initiator,source) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", (nsid, user, agent_ref, "新对话", None, "[]", "active", ts, ts, iso, loc, user, "platform"))
    return nsid, None, agent_ref


def _sess_append(user, sid, msg):
    """往会话追加一条消息（事件日志的雏形）；首条用户消息自动当标题。"""
    with db() as c:
        r = c.execute("SELECT messages,title FROM sessions WHERE id=? AND user=?", (sid, user)).fetchone()
        if not r:
            return
        msgs = json.loads(r["messages"] or "[]")
        if "ts" not in msg:
            msg = {**msg, "ts": now()}    # 每条消息打时间戳（会话明细 QA 展示用）
        msgs.append(msg)
        title = r["title"]
        if (not title or title == "新对话") and msg.get("role") == "user" and (msg.get("text") or "").strip():
            title = msg["text"].strip()[:24]
        c.execute("UPDATE sessions SET messages=?, title=?, updated_at=? WHERE id=? AND user=?",
                  (json.dumps(msgs, ensure_ascii=False), title, now(), sid, user))


def _sess_set_token(user, sid, token):
    if not token:
        return
    with db() as c:
        c.execute("UPDATE sessions SET claude_sid=? WHERE id=? AND user=?", (token, sid, user))


def _session_downstream(user, agent_ref, ws, message, resume_token):
    """把「copilot vs 普通 agent」的下游差异收敛在一处：返回 (svc, 下游 payload)。"""
    if agent_ref == "copilot":
        svc = _resolve_copilot_endpoint(user)           # 按用户解析 + 懒启动/自愈
        return svc, {"message": _ctx_message(ws, message), "session_id": resume_token}
    svc = SERVICES.get(agent_ref)
    if not svc:
        raise HTTPException(400, "该 Agent 未发布为服务")
    if svc.get("location") != "cloud" and not _svc_alive(svc):
        _wait_svc_alive(svc)                            # 刚发布/重启的服务可能还没监听，等就绪
    payload = {"message": message, "session_id": resume_token}
    if svc.get("gateway"):                              # OpenClaw 共享 Gateway：带 agent_id 路由
        payload["agent_id"] = agent_ref
    return svc, payload


def _sse_text_deltas(text, size=2, delay=0.012):
    """把一次性文本切成小块按 SSE delta 推送，给云端/一次性结果一个与本地一致的「逐字流式」观感。
    云端 bundle 当前是一次性 /chat（CLI 缓冲全量输出），没有 token 流；本地 OpenClaw Gateway 同样按字切。"""
    for i in range(0, len(text), size):
        yield f"event: delta\ndata: {json.dumps({'text': text[i:i + size]}, ensure_ascii=False)}\n\n"
        if delay:
            time.sleep(delay)


def _session_stream_gen(user, sid, agent_ref, svc, payload, message):
    """统一流式：转发下游 SSE 给前端，并行解析 delta/done/error，流结束把 bot 这一轮与新续接 token 落库。
    （user 消息已在外层先 append。）云端 agent 以一次性结果包成单个 delta+done。"""
    def gen():
        acc = ""
        new_tok = payload.get("session_id")
        err_text = None
        if svc.get("location") == "cloud":              # L2/L3 云端独立沙箱
            try:
                # 用我方稳定 sid 作 AgentRun 会话亲和键 + openclaw 会话键：同一会话粘同一沙箱（历史留沙箱），跨会话隔离
                r = _cloud().chat(agent_ref, message, sid)
                acc = r.get("reply", ""); new_tok = r.get("session_id") or new_tok
                yield from _sse_text_deltas(acc)          # 逐字推送，与本地一致的流式观感
                yield f"event: done\ndata: {json.dumps(r, ensure_ascii=False)}\n\n"
            except Exception as e:
                err_text = f"云端 agent 不可达：{e}"
                yield f"event: error\ndata: {json.dumps({'reply': err_text}, ensure_ascii=False)}\n\n"
        else:
            byte_buf = b""
            try:
                with _proxy.stream("POST", svc["url"] + "/chat/stream", json=payload) as r:
                    for chunk in r.iter_raw():
                        yield chunk
                        byte_buf += chunk
                        while b"\n\n" in byte_buf:
                            raw, byte_buf = byte_buf.split(b"\n\n", 1)
                            ev, data = "message", ""
                            for line in raw.decode("utf-8", "ignore").split("\n"):
                                if line.startswith("event:"):
                                    ev = line[6:].strip()
                                elif line.startswith("data:"):
                                    data += line[5:].strip()
                            if not data:
                                continue
                            try:
                                d = json.loads(data)
                            except Exception:
                                continue
                            if ev == "delta":
                                acc += d.get("text", "")
                            elif ev == "done":
                                acc = d.get("reply") or acc; new_tok = d.get("session_id") or new_tok
                            elif ev == "error":
                                err_text = d.get("reply") or "出错"
            except Exception as e:
                err_text = f"agent 服务不可达：{e}"
                yield f"event: error\ndata: {json.dumps({'reply': err_text}, ensure_ascii=False)}\n\n"
        final = err_text or acc.strip() or "（无回复）"
        _sess_append(user, sid, {"role": "bot", "text": final, **({"err": True} if err_text else {})})
        _sess_set_token(user, sid, new_tok)
    return gen


def _user_msg_text(body):
    """从请求体取用户文本：兼容 {message} 与标准 {events:[{type:'user.message',content:[{type:'text',text}]}]}。"""
    if getattr(body, "message", None):
        return body.message
    for ev in (getattr(body, "events", None) or []):
        if ev.get("type") == "user.message":
            return "".join(b.get("text", "") for b in (ev.get("content") or []) if b.get("type") == "text")
    return ""


# ================= 统一 Session API（标准契约：Agent + Environment + Session）=================
def _session_event(user, sid, agent_ref, ws, message, stream):
    """一轮对话：解析会话(取续接 token) → 落 user 消息 → 驱动下游(copilot/agent) → 落 bot。
    sid=我方会话 id（缺则新建）；对外只认它（单一语义），续接 token 内部持有。"""
    sid, resume, agent_ref = _sess_resolve(user, sid, agent_ref)
    # 先把用户消息落库（含自动标题），无论下游能否连通——否则下游解析失败会让会话停留在空 "新对话"（历史"丢失"+不改名）
    _sess_append(user, sid, {"role": "user", "text": message})
    try:
        svc, payload = _session_downstream(user, agent_ref, ws, message, resume)
    except HTTPException as e:
        _sess_append(user, sid, {"role": "bot", "text": f"（无法连接 Agent：{getattr(e, 'detail', e)}）", "err": True})
        raise
    if stream:
        return StreamingResponse(_session_stream_gen(user, sid, agent_ref, svc, payload, message)(),
                                 media_type="text/event-stream")
    # 一次性
    try:
        if svc.get("location") == "cloud":
            d = _cloud().chat(agent_ref, message, sid)   # 我方 sid 作会话亲和键（每会话一沙箱、历史留沙箱）
        else:
            d = _proxy.post(svc["url"] + "/chat", json=payload).json()
    except Exception as e:
        _sess_append(user, sid, {"role": "bot", "text": f"agent 不可达：{e}", "err": True})
        raise HTTPException(502, f"agent 不可达：{e}")
    _sess_append(user, sid, {"role": "bot", "text": d.get("reply") or "（无回复）",
                             **({"err": True} if d.get("engine") == "error" else {})})
    _sess_set_token(user, sid, d.get("session_id"))
    return {**d, "session_id": sid}   # 回我方会话 id（单一语义）


def _ensure_agent_service(agent_id):
    """create-session 为普通 agent 确保其服务就绪（L2/L3=云端独立沙箱 runtime）。
    已在 SERVICES 且非 failed → 直接用；否则按其发布版本 deploy-on-demand。未发布则不处理（events 会报未发布）。"""
    if not agent_id or agent_id == "copilot":
        return None
    cur = SERVICES.get(agent_id)
    if cur and cur.get("status") != "failed":
        return cur
    with db() as c:
        r = c.execute("SELECT version, isolation FROM published WHERE agent_id=?", (agent_id,)).fetchone()
    if not r:
        return None
    return publish(agent_id, version=r["version"], isolation=(r["isolation"] or "L1"))


@app.post("/api/sessions")
def session_create(body: SessionCreateIn, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """创建一条会话（绑定 agent + 版本 + 环境，对齐 Claude managed agents）。
    普通 agent：确保其云端/本地服务就绪（L2/L3 即在云端备好独立沙箱 runtime）；首条消息按本会话 sid 冷启专属沙箱。"""
    user = _copilot_user(x_user)
    agent = body.agent or "copilot"
    if agent != "copilot":
        _ensure_agent_service(agent)
    sid = "s" + uuid.uuid4().hex[:12]
    ts = now()
    iso, loc = _agent_runtime_meta(agent)
    with db() as c:
        c.execute("INSERT INTO sessions (id,user,agent_ref,agent_version,environment_ref,title,claude_sid,messages,status,created_at,updated_at,isolation,location,initiator,source) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (sid, user, agent, body.version, body.environment_id, (body.title or "新对话"),
                   None, "[]", "active", ts, ts, iso, loc, user, "platform"))
    return {"id": sid, "agent": agent, "version": body.version, "title": body.title or "新对话",
            "messages": [], "status": "active", "updatedAt": ts}


@app.post("/api/sessions/{sid}/events")
def session_events(sid: str, body: SessionEventIn, ws: Optional[str] = None, stream: bool = False,
                   x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """向会话发送事件（user.message）驱动 agent。?stream=true 走 SSE。会话已存在则用其绑定的 agent。"""
    user = _copilot_user(x_user)
    if ws:
        _ws_guard(ws)
    return _session_event(user, sid, "copilot", ws, _user_msg_text(body), stream)


@app.post("/api/sessions/{sid}/events/stream")
def session_events_stream(sid: str, body: SessionEventIn, ws: Optional[str] = None,
                          x_user: Optional[str] = Header(None, alias="X-User-Id")):
    user = _copilot_user(x_user)
    if ws:
        _ws_guard(ws)
    return _session_event(user, sid, "copilot", ws, _user_msg_text(body), True)


@app.get("/api/sessions")
def session_list(agent: Optional[str] = None, scope: str = "mine",
                 isolation: Optional[str] = None, q: Optional[str] = None,
                 page: int = 0, size: int = 20,
                 x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """列出会话。
    - scope=mine（缺省）：按「对话发起人=我」列出（沿用旧语义，兼容 Chat/Playground）。
    - scope=created（会话 Tab，spec N）：按「我是所属 Agent 的创建人」聚合 + copilot 本人会话；
      仅含至少 1 轮的会话；支持 agent/isolation/关键词过滤与分页。"""
    user = _copilot_user(x_user)
    if scope == "created":
        # LEFT JOIN 纳入无 agents 行的 copilot；可见 = 我创建的 Agent 的会话 OR copilot 本人会话。
        # 先取「我可见全集」（仅受可见性 + 至少 1 轮约束），据此算 facets（统计/过滤候选），
        # 再按 agent/isolation/关键词过滤 + 分页——保证概览与下拉候选不随当前过滤/翻页而变。
        base_sql = ("SELECT s.id,s.agent_ref,s.title,s.updated_at,s.messages,s.status,s.isolation,s.location,s.initiator,"
                    "COALESCE(a.name,'通用助手') AS agent_name "
                    "FROM sessions s LEFT JOIN agents a ON a.id=s.agent_ref "
                    "WHERE ((a.creator=? AND a.deleted=0) OR (s.agent_ref='copilot' AND s.user=?)) "
                    "AND json_array_length(s.messages)>=1 ORDER BY s.updated_at DESC")
        with db() as c:
            base = c.execute(base_sql, [user, user]).fetchall()

        def _rounds(msgs):
            return sum(1 for m in msgs if m.get("role") == "user")

        # 预解析 messages，避免重复 json.loads
        parsed = [(r, json.loads(r["messages"] or "[]")) for r in base]

        # facets：基于「全集」（未过滤）——概览统计 + Agent 候选 + 环境分布 + 状态分布
        agent_facet, env_facet, status_facet = {}, {"L1": 0, "L2": 0, "L3": 0, "general": 0}, {}
        for r, _ in parsed:
            ag = r["agent_ref"]
            if ag not in agent_facet:
                agent_facet[ag] = {"value": ag, "label": r["agent_name"], "count": 0}
            agent_facet[ag]["count"] += 1
            env_facet[r["isolation"] if r["isolation"] in ("L1", "L2", "L3") else "general"] += 1
            st = r["status"] or "—"
            status_facet[st] = status_facet.get(st, 0) + 1
        facets = {
            "totalSessions": len(parsed),
            "agents": sorted(agent_facet.values(), key=lambda x: (-x["count"], x["label"])),
            "env": env_facet,
            "status": status_facet,
            "activeSessions": status_facet.get("active", 0),
        }

        # 过滤（agent + isolation + 标题关键词，取交集）
        ql = (q or "").lower()
        rows = [(r, msgs) for r, msgs in parsed
                if (not agent or r["agent_ref"] == agent)
                and (not isolation or r["isolation"] == isolation)
                and (not ql or ql in (r["title"] or "").lower())]
        items = [{"id": r["id"], "agent": r["agent_ref"], "agentName": r["agent_name"],
                  "title": r["title"] or "新对话", "isolation": r["isolation"], "location": r["location"],
                  "initiator": r["initiator"], "status": r["status"], "updatedAt": r["updated_at"],
                  "count": len(msgs), "rounds": _rounds(msgs)} for r, msgs in rows]
        total = len(items)
        start = max(0, page) * max(1, size)
        return {"total": total, "page": page, "size": size,
                "items": items[start:start + size], "facets": facets}
    # 旧语义
    sql = "SELECT id,agent_ref,title,updated_at,messages FROM sessions WHERE user=?"
    args = [user]
    if agent:
        sql += " AND agent_ref=?"; args.append(agent)
    sql += " ORDER BY updated_at DESC"
    with db() as c:
        rows = c.execute(sql, args).fetchall()
    return [{"id": r["id"], "agent": r["agent_ref"], "title": r["title"] or "新对话",
             "updatedAt": r["updated_at"], "count": len(json.loads(r["messages"] or "[]"))} for r in rows]


def _session_visible(c, r, user):
    """会话可见性（spec N 规范性判据）：我是所属 Agent 创建人 / copilot 本人 / PlatformAdmin（本期 False）。"""
    if r["agent_ref"] == "copilot":
        return r["user"] == user
    a = c.execute("SELECT creator FROM agents WHERE id=?", (r["agent_ref"],)).fetchone()
    if a and a["creator"] == user:
        return True
    return r["user"] == user      # 发起人本人也可见自己的（兼容旧语义）


@app.get("/api/sessions/{sid}")
def session_get(sid: str, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    user = _copilot_user(x_user)
    with db() as c:
        r = c.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
        if not r or not _session_visible(c, r, user):
            raise HTTPException(404, "会话不存在")   # 不泄露存在性
        agent_name, creator = None, None
        if r["agent_ref"] != "copilot":
            a = c.execute("SELECT name,creator FROM agents WHERE id=?", (r["agent_ref"],)).fetchone()
            if a:
                agent_name, creator = a["name"], a["creator"]
    cols = r.keys()
    return {"id": r["id"], "agent": r["agent_ref"], "agentName": agent_name or "通用助手",
            "agentVersion": (r["agent_version"] if "agent_version" in cols else None),
            "isolation": (r["isolation"] if "isolation" in cols else None),
            "location": (r["location"] if "location" in cols else "local"),
            "initiator": (r["initiator"] if "initiator" in cols else r["user"]),
            "creator": creator, "source": (r["source"] if "source" in cols else "platform"),
            "title": r["title"] or "新对话", "status": r["status"],
            "messages": json.loads(r["messages"] or "[]"),
            "createdAt": r["created_at"], "updatedAt": r["updated_at"]}


@app.put("/api/sessions/{sid}")
def session_update(sid: str, body: CopilotSessionIn, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    """更新会话（重命名 title；轻量模式可回写 messages）。"""
    user = _copilot_user(x_user)
    with db() as c:
        if not c.execute("SELECT 1 FROM sessions WHERE id=? AND user=?", (sid, user)).fetchone():
            raise HTTPException(404, "会话不存在")
        sets, args = [], []
        if body.title is not None:
            sets.append("title=?"); args.append((body.title or "").strip()[:60] or "新对话")
        if body.messages is not None:
            sets.append("messages=?"); args.append(json.dumps(body.messages, ensure_ascii=False))
        sets.append("updated_at=?"); args.append(now())
        c.execute(f"UPDATE sessions SET {','.join(sets)} WHERE id=? AND user=?", (*args, sid, user))
    return {"ok": True}


@app.delete("/api/sessions/{sid}")
def session_delete(sid: str, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    user = _copilot_user(x_user)
    with db() as c:
        c.execute("DELETE FROM sessions WHERE id=? AND user=?", (sid, user))
    return {"ok": True}


# --------- 平台外「直连」会话旁路归集（spec N Phase 3 平台侧）---------
# 外部系统经稳定地址/网关直连已发布 Agent（不经 /api/sessions）的会话，由网关/云端运行时
# 每轮异步回传到此端点，平台 upsert 进 sessions 并对该 Agent 创建人可见。幂等键=(agent_id,session_key,turn)。
class SessionIngestIn(BaseModel):
    agent_id: str                       # 被直连的已发布 Agent id
    session_key: str                    # 外部侧会话键（网关/AgentRun 的会话亲和键）
    initiator: Optional[str] = None     # 外部发起人标识（可空）
    turn: Optional[int] = None          # 轮序，用于幂等去重；缺省按当前消息数推断
    messages: list = []                 # 本次回传的消息 [{role,text}]（增量或全量）
    isolation: Optional[str] = None
    title: Optional[str] = None


@app.post("/internal/sessions/ingest")
def session_ingest(body: SessionIngestIn):
    """网关/云端回传一轮（或多轮）会话。以 'ext:{agent_id}:{session_key}' 为稳定会话 id，幂等 upsert。"""
    a_id = body.agent_id
    with db() as c:
        ag = c.execute("SELECT name,creator FROM agents WHERE id=? AND deleted=0", (a_id,)).fetchone()
        if not ag:
            raise HTTPException(404, "Agent 不存在")
        sid = "ext:" + a_id + ":" + body.session_key
        ts = now()
        iso = body.isolation or _agent_runtime_meta(a_id)[0]
        r = c.execute("SELECT messages FROM sessions WHERE id=?", (sid,)).fetchone()
        owner = ag["creator"] or DEMO_USER     # 归到创建人名下，确保其在会话 Tab 可见
        if not r:
            title = (body.title or (body.messages[0].get("text", "") if body.messages else "") or "外部会话").strip()[:24] or "外部会话"
            c.execute("INSERT INTO sessions (id,user,agent_ref,title,claude_sid,messages,status,created_at,updated_at,isolation,location,initiator,source) "
                      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (sid, owner, a_id, title, None, json.dumps(body.messages, ensure_ascii=False),
                       "active", ts, ts, iso, "cloud", body.initiator or "external", "gateway"))
        else:
            # 幂等：以回传 messages 为该会话的当前全量（网关侧按 turn 累积回传）；避免重复 append
            c.execute("UPDATE sessions SET messages=?, updated_at=?, isolation=COALESCE(?,isolation) WHERE id=?",
                      (json.dumps(body.messages, ensure_ascii=False), ts, iso, sid))
    return {"ok": True, "session_id": sid}


# ---------------- 旧 copilot 端点：薄适配器（前端不变；内部走统一 Session 层，agent_ref='copilot'）----------------
@app.post("/api/copilot/chat")
def copilot_chat(ws: Optional[str] = None, body: ChatIn = Body(...), x_user: Optional[str] = Header(None, alias="X-User-Id")):
    user = _copilot_user(x_user)
    if ws:
        _ws_guard(ws)
    return _session_event(user, body.session_id, "copilot", ws, body.message, False)


@app.post("/api/copilot/chat/stream")
def copilot_chat_stream(ws: Optional[str] = None, body: ChatIn = Body(...), x_user: Optional[str] = Header(None, alias="X-User-Id")):
    user = _copilot_user(x_user)
    if ws:
        _ws_guard(ws)
    return _session_event(user, body.session_id, "copilot", ws, body.message, True)


@app.get("/api/copilot/sessions")
def copilot_sessions(x_user: Optional[str] = Header(None, alias="X-User-Id")):
    return session_list(agent="copilot", x_user=x_user)


@app.post("/api/copilot/sessions")
def copilot_session_create(x_user: Optional[str] = Header(None, alias="X-User-Id")):
    r = session_create(SessionCreateIn(agent="copilot"), x_user=x_user)
    return {"id": r["id"], "title": r["title"], "messages": [], "claude_sid": None, "updatedAt": r["updatedAt"]}


@app.get("/api/copilot/sessions/{sid}")
def copilot_session_get(sid: str, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    r = session_get(sid, x_user=x_user)
    return {"id": r["id"], "title": r["title"], "claude_sid": None, "messages": r["messages"], "updatedAt": r["updatedAt"]}


@app.put("/api/copilot/sessions/{sid}")
def copilot_session_update(sid: str, body: CopilotSessionIn, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    return session_update(sid, body, x_user=x_user)


@app.delete("/api/copilot/sessions/{sid}")
def copilot_session_delete(sid: str, x_user: Optional[str] = Header(None, alias="X-User-Id")):
    return session_delete(sid, x_user=x_user)


# ---------------- Environment 一等资源（Phase 2：Agent + Environment + Session）----------------
@app.get("/api/environments")
def list_environments():
    """运行环境列表（隔离级别等）。Session/发布绑定其一；默认共享环境(L1)。"""
    with db() as c:
        rows = c.execute("SELECT * FROM environments ORDER BY builtin DESC, created_at").fetchall()
    return [dict(r) for r in rows]


@app.post("/api/environments")
def create_environment(body: EnvironmentIn):
    eid = _slug_id("env", body.name)
    with db() as c:
        c.execute("INSERT INTO environments (id,name,isolation,description,builtin,created_at) VALUES (?,?,?,?,0,?)",
                  (eid, body.name, body.isolation or "L1", body.description or "", now()))
    return {"id": eid, "name": body.name, "isolation": body.isolation or "L1"}


@app.delete("/api/environments/{eid}")
def delete_environment(eid: str):
    with db() as c:
        c.execute("DELETE FROM environments WHERE id=? AND builtin=0", (eid,))   # 内置环境不可删
    return {"ok": True}


@app.get("/api/gateway")
def get_gateway():
    """OpenClaw 共享 Gateway 运行态：地址 + 当前托管的 agent 列表（agents.list）。"""
    if not GATEWAY.get("url"):
        return {"running": False, "agents": []}
    out = {"running": True, **GATEWAY, "agents": []}
    try:
        out["agents"] = _proxy.get(GATEWAY["url"] + "/agents", timeout=5).json()
    except Exception:
        pass
    return out


# ---------------- 技能市场 / MCP 市场 ----------------
# 已加入/注册的技能与 MCP 都**归属某个空间(ws)**，仅在该空间的 Agent 配置中可选。
class SkillInstallIn(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None      # 兼容旧前端：作为 description
    description: Optional[str] = None


class SkillRegisterIn(BaseModel):
    # 对齐 Claude Agent Skill（SKILL.md）规格
    name: str                          # 小写字母/数字/连字符，≤64，不含 anthropic/claude
    description: str                   # 触发器：做什么 + 何时使用（≤1024），决定 Claude 是否调用
    instructions: str = ""             # SKILL.md 正文（给 Claude 的步骤指引）
    allowed_tools: list = []           # 可选：预批工具（Claude Code 用）


class McpRegisterIn(BaseModel):
    name: str
    desc: str = ""
    category: str = "自定义"
    command: str
    args: list = []
    env: list = []
    homepage: str = ""


def _ws_guard(ws: str):
    if not ws:
        raise HTTPException(422, "缺少空间(ws)：技能/MCP 须归属某个空间")
    with db() as c:
        if not c.execute("SELECT 1 FROM workspaces WHERE id=?", (ws,)).fetchone():
            raise HTTPException(404, f"空间不存在：{ws}")


def _slug_id(prefix, name):
    # ASCII 名取可读 slug，否则（如中文名）退化为空——统一追加短唯一后缀，保证 URL 安全且不撞 id
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix}-{base}-{suffix}" if base else f"{prefix}-{suffix}"


# Claude Agent Skill 命名规则：小写字母/数字/连字符，≤64，不含保留词
_SKILL_NAME_RE = re.compile(r"^[a-z0-9-]{1,64}$")


def _validate_skill_name(name):
    n = (name or "").strip()
    if not _SKILL_NAME_RE.match(n):
        raise HTTPException(422, "技能名只能含小写字母、数字、连字符，且不超过 64 字符（如 summarize-changes）")
    if "anthropic" in n or "claude" in n:
        raise HTTPException(422, "技能名不能包含保留词 anthropic / claude")
    return n


def _render_skill_md(name, description, instructions, allowed_tools=None):
    """按 SKILL.md 规格渲染：YAML frontmatter（name/description[/allowed-tools]）+ 正文。"""
    fm = [f"name: {name}", f"description: {description}"]
    if allowed_tools:
        fm.append("allowed-tools: " + ", ".join(allowed_tools))
    return "---\n" + "\n".join(fm) + "\n---\n\n" + (instructions or "")


def _skill_row(r):
    d = dict(r)
    d["allowed_tools"] = json.loads(d.get("allowed_tools") or "[]")
    d["tree"] = json.loads(d.get("tree") or "[]")
    # 兼容前端旧字段：summary 作为 description 的别名
    d["summary"] = d.get("description") or ""
    d["skill_md"] = _render_skill_md(d.get("name"), d.get("description"),
                                     d.get("instructions"), d["allowed_tools"])
    return d


_SKILL_COLS = "(ws_id,id,name,description,instructions,allowed_tools,source,added_at,archive_path,tree,creator)"
_SKILL_VALS = "(?,?,?,?,?,?,?,?,?,?,?)"


@app.get("/api/market/skills")
def market_skills(q: str = "", limit: int = 24):
    """技能市场：代理 clawhub 公共注册表。无 q=最新，有 q=相关性搜索。"""
    return {"available": market.clawhub_available(),
            "items": market.search_skills(q.strip(), limit)}


@app.get("/api/market/skills/{slug}")
def market_skill_detail(slug: str):
    info = market.inspect_skill(slug)
    if not info:
        raise HTTPException(404, "技能不存在或注册表不可用")
    return info


@app.post("/api/market/skills/{slug}/install")
def market_skill_install(slug: str, ws: str, body: Optional[SkillInstallIn] = Body(default=None)):
    """把公共注册表技能加入**当前空间**。slug 即技能名（clawhub 已是小写连字符）。"""
    _ws_guard(ws)
    name = _validate_skill_name(slug)
    b = body or SkillInstallIn()
    info = market.inspect_skill(slug) or {}
    desc = b.description or b.summary or info.get("summary") or info.get("name") or slug
    with db() as c:
        c.execute(f"INSERT OR REPLACE INTO installed_skills {_SKILL_COLS} VALUES {_SKILL_VALS}",
                  (ws, name, b.name or info.get("name") or slug, desc, "", "[]", "clawhub", now(), None, "[]", "我"))
    return {"ok": True, "id": name, "name": b.name or slug}


@app.post("/api/market/skills/register")
def market_skill_register(ws: str, body: SkillRegisterIn):
    """注册自定义技能到当前空间——按 Claude Agent Skill（SKILL.md）规格：name + description + 正文。"""
    _ws_guard(ws)
    name = _validate_skill_name(body.name)
    if not (body.description or "").strip():
        raise HTTPException(422, "description 必填：写清楚“做什么 + 何时使用”，它决定 Claude 何时调用该技能")
    if len(body.description) > 1024:
        raise HTTPException(422, "description 不超过 1024 字符")
    with db() as c:
        c.execute(f"INSERT OR REPLACE INTO installed_skills {_SKILL_COLS} VALUES {_SKILL_VALS}",
                  (ws, name, name, body.description.strip(), body.instructions or "",
                   json.dumps(body.allowed_tools or []), "custom", now(), None, "[]", "我"))
    return {"ok": True, "id": name, "name": name,
            "skill_md": _render_skill_md(name, body.description.strip(), body.instructions, body.allowed_tools)}


@app.post("/api/market/skills/upload")
async def market_skill_upload(ws: str, file: UploadFile = File(...), creator: str = Form("")):
    """上传技能包（tar/zip）：自动解析 SKILL.md 提取 name/description，存档并记录文件树+创建人。"""
    _ws_guard(ws)
    data = await file.read()
    if not data:
        raise HTTPException(422, "空文件")
    try:
        meta = market.find_skill_md(file.filename, data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if not meta:
        raise HTTPException(422, "包内未找到 SKILL.md（应在根目录或某一级子目录下）")
    name = _validate_skill_name(meta.get("name"))      # name 取自 SKILL.md frontmatter，须合规
    desc = (meta.get("description") or "").strip()
    if not desc:
        raise HTTPException(422, "SKILL.md 的 frontmatter 缺少 description（决定 Claude 何时调用该技能）")
    # 存档（保留原扩展名，便于按 zip/tar 复读文件）
    os.makedirs(SKILL_PKG_DIR, exist_ok=True)
    ext = ".zip" if file.filename.lower().endswith(".zip") else (
        ".tar.gz" if file.filename.lower().endswith((".tar.gz", ".tgz")) else ".tar")
    safe = re.sub(r"[^\w.-]", "_", f"{ws}__{name}")
    arch = os.path.join(SKILL_PKG_DIR, safe + ext)
    with open(arch, "wb") as f:
        f.write(data)
    with db() as c:
        c.execute(f"INSERT OR REPLACE INTO installed_skills {_SKILL_COLS} VALUES {_SKILL_VALS}",
                  (ws, name, name, desc, meta.get("body") or "",
                   json.dumps(meta.get("allowed_tools") or []), "upload", now(),
                   arch, json.dumps(meta.get("entries") or []), (creator or "").strip() or "我"))
    return {"ok": True, "id": name, "name": name, "description": desc,
            "skill_path": meta.get("skill_path"), "files": len(meta.get("entries") or [])}


@app.get("/api/skills")
def list_installed_skills(ws: str):
    """某空间可用技能 = 本空间私有 + 平台全局（所有空间可访问），减本空间禁用的全局项。
    每项带 scope（platform/workspace）；平台全局项另带 disabled（是否在本空间被禁用，仅供管理展示）。"""
    _ws_guard(ws)
    with db() as c:
        rows = _effective_rows(c, "installed_skills", "skill", ws, extra_where=" AND deleted=0", drop_disabled=False)
        rows.sort(key=lambda d: (d.get("scope") != "platform", d.get("added_at") or ""))
        return [{**_skill_row(r), "scope": r["scope"], "disabled": r["disabled"]} for r in rows]


@app.get("/api/skills/{slug}/file")
def read_skill_file(slug: str, ws: str, path: str):
    """读取已上传技能包内某个文件的文本内容（详情里点目录树查看）。"""
    with db() as c:
        r = c.execute("SELECT archive_path FROM installed_skills WHERE id=? AND ws_id=? AND deleted=0",
                      (slug, ws)).fetchone()
    if not r or not r["archive_path"] or not os.path.exists(r["archive_path"]):
        raise HTTPException(404, "该技能无可读取的上传包")
    try:
        return {"path": path, "content": market.read_archive_file(r["archive_path"], path)}
    except Exception as e:
        raise HTTPException(400, f"读取失败：{e}")


@app.delete("/api/skills/{slug}")
def remove_installed_skill(slug: str, ws: str):
    """软删除本空间私有技能（标记 deleted=1，保留行/存档可恢复）。
    平台全局技能不可在此删除，只能在本空间禁用（或管理员在平台目录删除）。"""
    with db() as c:
        c.execute("UPDATE installed_skills SET deleted=1 WHERE id=? AND ws_id=? AND scope='workspace'", (slug, ws))
    return {"ok": True}


# ---------------- 在本空间禁用 / 启用某「平台全局」项 ----------------
@app.post("/api/scope/{kind}/{item_id}/disable")
def disable_global(kind: str, item_id: str, ws: str):
    """在当前空间禁用一个平台全局 skill/MCP（不删全局定义，仅本空间不再可用）。kind=skill|mcp。"""
    if kind not in ("skill", "mcp"):
        raise HTTPException(422, "kind 只能是 skill 或 mcp")
    _ws_guard(ws)
    with db() as c:
        c.execute("INSERT OR IGNORE INTO ws_disabled VALUES (?,?,?)", (ws, kind, item_id))
    return {"ok": True, "disabled": True}


@app.post("/api/scope/{kind}/{item_id}/enable")
def enable_global(kind: str, item_id: str, ws: str):
    """在当前空间重新启用之前被禁用的平台全局项。"""
    if kind not in ("skill", "mcp"):
        raise HTTPException(422, "kind 只能是 skill 或 mcp")
    with db() as c:
        c.execute("DELETE FROM ws_disabled WHERE ws_id=? AND kind=? AND id=?", (ws, kind, item_id))
    return {"ok": True, "disabled": False}


# ---------------- 平台全局项管理（管理员；demo 不强校验，UI 侧门控）----------------
@app.get("/api/platform/items")
def list_platform_items():
    """列出全部平台全局 skill / MCP（住系统目录，所有空间可访问）。供平台管理。"""
    with db() as c:
        sk = c.execute("SELECT id,name,description,default_on,source FROM installed_skills "
                       "WHERE scope='platform' AND deleted=0 ORDER BY added_at").fetchall()
        mc = c.execute("SELECT id,name,summary,category,default_on,source FROM installed_mcp "
                       "WHERE scope='platform' ORDER BY added_at").fetchall()
        return {"skills": [dict(r) for r in sk], "mcp": [dict(r) for r in mc]}


@app.post("/api/platform/skills/register")
def platform_skill_register(body: SkillRegisterIn, default_on: int = 0):
    """注册一个平台全局技能（所有空间可见可绑）。default_on=1 则 copilot 默认挂载。"""
    name = _validate_skill_name(body.name)
    if not (body.description or "").strip():
        raise HTTPException(422, "description 必填：决定 Claude 何时调用该技能")
    with db() as c:
        c.execute("INSERT OR REPLACE INTO installed_skills "
                  "(ws_id,id,name,description,instructions,allowed_tools,source,added_at,archive_path,tree,deleted,creator,scope,default_on) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?)",
                  (SYS_WS, name, name, body.description.strip(), body.instructions or "",
                   json.dumps(body.allowed_tools or []), "platform", now(), None, "[]", "平台", "platform", int(default_on)))
    return {"ok": True, "id": name, "scope": "platform", "default_on": int(default_on)}


@app.post("/api/platform/mcp/register")
def platform_mcp_register(body: McpRegisterIn, default_on: int = 0):
    """注册一个平台全局 MCP（所有空间可见可绑）。default_on=1 则 copilot 默认挂载。"""
    mid = _slug_id("platform", body.name)
    _save_mcp(SYS_WS, {"id": mid, "name": body.name, "desc": body.desc, "category": body.category or "平台",
                       "command": body.command, "args": body.args, "env": body.env,
                       "homepage": body.homepage, "source": "platform",
                       "scope": "platform", "default_on": int(default_on)})
    return {"ok": True, "id": mid, "scope": "platform", "default_on": int(default_on)}


@app.delete("/api/platform/skills/{item_id}")
def platform_skill_delete(item_id: str):
    with db() as c:
        c.execute("UPDATE installed_skills SET deleted=1 WHERE id=? AND ws_id=? AND scope='platform'", (item_id, SYS_WS))
    return {"ok": True}


@app.delete("/api/platform/mcp/{item_id}")
def platform_mcp_delete(item_id: str):
    with db() as c:
        c.execute("DELETE FROM installed_mcp WHERE id=? AND ws_id=? AND scope='platform'", (item_id, SYS_WS))
    return {"ok": True}


@app.get("/api/market/mcp")
def market_mcp(q: str = "", category: str = ""):
    """MCP 市场：精选真实 MCP Server 目录（目录全平台共享，加入则归属空间）。"""
    return {"items": market.search_mcp(q.strip(), category.strip()),
            "categories": market.mcp_categories()}


def _save_mcp(ws, m):
    with db() as c:
        c.execute("INSERT OR REPLACE INTO installed_mcp "
                  "(ws_id,id,name,summary,category,command,args,env,homepage,source,added_at,scope,default_on) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (ws, m["id"], m["name"], m["desc"], m["category"], m["command"],
                   json.dumps(m["args"]), json.dumps(m["env"]), m.get("homepage", ""),
                   m.get("source", "catalog"), now(), m.get("scope", "workspace"), int(m.get("default_on", 0))))


@app.post("/api/market/mcp/{mid}/install")
def market_mcp_install(mid: str, ws: str):
    """把目录里的 MCP Server 加入**当前空间**的工具目录。"""
    _ws_guard(ws)
    m = market.get_mcp(mid)
    if not m:
        raise HTTPException(404, "MCP Server 不存在")
    _save_mcp(ws, {**m, "source": "catalog"})
    return {"ok": True, "id": mid, "name": m["name"]}


@app.post("/api/market/mcp/register")
def market_mcp_register(ws: str, body: McpRegisterIn):
    """注册一个**自定义 MCP 接口**到当前空间（自填命令/参数/所需凭证）。"""
    _ws_guard(ws)
    mid = _slug_id("custom", body.name)
    _save_mcp(ws, {"id": mid, "name": body.name, "desc": body.desc, "category": body.category or "自定义",
                   "command": body.command, "args": body.args, "env": body.env,
                   "homepage": body.homepage, "source": "custom"})
    return {"ok": True, "id": mid, "name": body.name}


@app.get("/api/tools")
def list_installed_mcp(ws: str):
    """某空间可用 MCP = 本空间私有 + 平台全局（所有空间可访问），减本空间禁用的全局项。
    每项带 scope（platform/workspace）与 disabled（平台项是否在本空间被禁用）。"""
    _ws_guard(ws)
    with db() as c:
        rows = _effective_rows(c, "installed_mcp", "mcp", ws, drop_disabled=False)
    rows.sort(key=lambda d: (d.get("scope") != "platform", d.get("added_at") or ""))
    out = []
    for d in rows:
        d["args"] = json.loads(d.get("args") or "[]")
        d["env"] = json.loads(d.get("env") or "[]")
        out.append(d)
    return out


@app.delete("/api/tools/{mid}")
def remove_installed_mcp(mid: str, ws: str):
    """删除本空间私有 MCP。平台全局项不可在此删除（只能在本空间禁用，或由管理员在平台目录删除）。"""
    with db() as c:
        c.execute("DELETE FROM installed_mcp WHERE id=? AND ws_id=? AND scope='workspace'", (mid, ws))
    return {"ok": True}


@app.get("/api/health")
def health():
    b = claude_bin()
    return {"ok": True, "claude_code": bool(b), "claude_path": b or ""}


# 建库放在导入期，保证 uvicorn / 测试都已就绪
init_db()
# 启动对账：复活上次落库、仍在运行的 agent 服务（重启后无需懒自愈即可稳定路由）
_reconcile_services()
