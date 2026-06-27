"""
技能市场 + MCP 市场的数据源。

- 技能市场：代理 `clawhub` CLI（公共 skill 注册表，无需登录）。search/explore/inspect 输出是文本，
  本模块解析成结构化 JSON。换注册表 = 换这里的实现。
- MCP 市场：精选的真实 MCP Server 目录（官方 modelcontextprotocol/servers 及主流社区 server），
  每条含安装命令/参数/所需环境变量，可直接写进 Agent 的 .mcp.json。
"""
import io
import re
import shutil
import subprocess
import tarfile
import zipfile

# ---------------- 技能市场：clawhub 代理 ----------------
_NOISE = re.compile(r"fetching|searching|^\s*$", re.I)
_SPLIT = re.compile(r"\s{2,}")          # clawhub 用 2+ 空格分列
_SCORE = re.compile(r"\s*\(([\d.]+)\)\s*$")


def clawhub_available():
    return shutil.which("clawhub") is not None


def _run(args, timeout=25):
    p = subprocess.run(["clawhub", *args], capture_output=True, text=True, timeout=timeout)
    return [l for l in (p.stdout or "").splitlines() if not _NOISE.search(l)]


def search_skills(q="", limit=24):
    """有 q 走 search（带相关性分），否则 explore（最新）。统一返回 [{slug,name,desc,version,score}]。"""
    if not clawhub_available():
        return []
    if q:
        out = []
        for line in _run(["search", q, "--limit", str(limit)]):
            m = _SCORE.search(line)
            score = float(m.group(1)) if m else None
            body = _SCORE.sub("", line)
            parts = _SPLIT.split(body.strip())
            slug = parts[0]
            name = parts[1] if len(parts) > 1 else slug
            out.append({"slug": slug, "name": name, "desc": "", "version": "", "score": score})
        return out
    out = []
    for line in _run(["explore", "--limit", str(limit)]):
        parts = _SPLIT.split(line.strip())
        if not parts or parts[0].startswith("-"):
            continue
        slug = parts[0]
        version = next((p for p in parts[1:] if re.match(r"v?\d+\.\d", p)), "")
        desc = parts[-1] if len(parts) >= 3 else ""
        out.append({"slug": slug, "name": slug, "desc": desc.rstrip("…"),
                    "version": version, "score": None})
    return out


def inspect_skill(slug):
    """详情：解析 inspect 的 key: value 文本。返回 {slug,name,summary,owner,latest,license,...}。"""
    if not clawhub_available():
        return None
    lines = _run(["inspect", slug])
    if not lines:
        return None
    head = _SPLIT.split(lines[0].strip())
    info = {"slug": head[0], "name": head[1] if len(head) > 1 else head[0]}
    keymap = {"Summary": "summary", "Owner": "owner", "Created": "created",
              "Updated": "updated", "Latest": "latest", "License": "license", "Tags": "tags"}
    for l in lines[1:]:
        if ":" in l:
            k, _, v = l.partition(":")
            if k.strip() in keymap:
                info[keymap[k.strip()]] = v.strip()
    return info


# ---------------- MCP 市场：精选真实目录 ----------------
# 字段：id / name / desc / category / command / args(模板) / env(所需环境变量) / homepage / official
MCP_CATALOG = [
    {"id": "filesystem", "name": "Filesystem", "category": "文件/系统", "official": True,
     "desc": "在受限目录内读写本地文件——读、写、列目录、搜索。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "<允许访问的目录>"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem"},
    {"id": "git", "name": "Git", "category": "开发", "official": True,
     "desc": "读取/查询/操作本地 Git 仓库：状态、diff、提交、分支。",
     "command": "uvx", "args": ["mcp-server-git", "--repository", "<仓库路径>"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/git"},
    {"id": "github", "name": "GitHub", "category": "开发", "official": True,
     "desc": "GitHub 仓库、Issue、PR、代码搜索读写。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"],
     "env": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/github"},
    {"id": "postgres", "name": "PostgreSQL", "category": "数据库", "official": True,
     "desc": "只读连接 PostgreSQL，执行查询并读取表结构。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "<连接串>"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres"},
    {"id": "sqlite", "name": "SQLite", "category": "数据库", "official": True,
     "desc": "查询/写入本地 SQLite 数据库，含表结构内省。",
     "command": "uvx", "args": ["mcp-server-sqlite", "--db-path", "<db 路径>"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite"},
    {"id": "fetch", "name": "Fetch（网页抓取）", "category": "网络", "official": True,
     "desc": "抓取 URL 并转成适合模型阅读的 Markdown/文本。",
     "command": "uvx", "args": ["mcp-server-fetch"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch"},
    {"id": "brave-search", "name": "Brave Search", "category": "网络", "official": True,
     "desc": "用 Brave Search API 做联网搜索（网页 + 本地）。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-brave-search"],
     "env": ["BRAVE_API_KEY"],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search"},
    {"id": "puppeteer", "name": "Puppeteer（浏览器）", "category": "网络", "official": True,
     "desc": "无头浏览器自动化：访问页面、截图、抓取动态内容。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer"},
    {"id": "memory", "name": "Memory（知识图谱）", "category": "记忆", "official": True,
     "desc": "基于知识图谱的长期记忆，跨会话保存实体与关系。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/memory"},
    {"id": "slack", "name": "Slack", "category": "协作", "official": True,
     "desc": "读取频道、发消息、查用户——Slack 工作区集成。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-slack"],
     "env": ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/slack"},
    {"id": "google-maps", "name": "Google Maps", "category": "数据", "official": True,
     "desc": "地理编码、地点检索、路线规划。",
     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-google-maps"],
     "env": ["GOOGLE_MAPS_API_KEY"],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps"},
    {"id": "sentry", "name": "Sentry", "category": "开发", "official": True,
     "desc": "拉取并分析 Sentry 上的错误与问题详情。",
     "command": "uvx", "args": ["mcp-server-sentry", "--auth-token", "<token>"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/sentry"},
    {"id": "notion", "name": "Notion", "category": "协作", "official": False,
     "desc": "读写 Notion 页面与数据库（官方 Notion MCP）。",
     "command": "npx", "args": ["-y", "@notionhq/notion-mcp-server"],
     "env": ["NOTION_TOKEN"], "homepage": "https://github.com/makenotion/notion-mcp-server"},
    {"id": "playwright", "name": "Playwright（浏览器）", "category": "网络", "official": False,
     "desc": "微软官方 Playwright MCP：可靠的浏览器自动化与网页操作。",
     "command": "npx", "args": ["-y", "@playwright/mcp@latest"], "env": [],
     "homepage": "https://github.com/microsoft/playwright-mcp"},
    {"id": "context7", "name": "Context7（文档）", "category": "开发", "official": False,
     "desc": "按需注入主流库的最新官方文档与示例代码。",
     "command": "npx", "args": ["-y", "@upstash/context7-mcp"], "env": [],
     "homepage": "https://github.com/upstash/context7"},
    {"id": "time", "name": "Time（时间/时区）", "category": "工具", "official": True,
     "desc": "当前时间查询与时区换算。",
     "command": "uvx", "args": ["mcp-server-time"], "env": [],
     "homepage": "https://github.com/modelcontextprotocol/servers/tree/main/src/time"},
]
_MCP_BY_ID = {m["id"]: m for m in MCP_CATALOG}


def search_mcp(q="", category=""):
    items = MCP_CATALOG
    if category:
        items = [m for m in items if m["category"] == category]
    if q:
        ql = q.lower()
        items = [m for m in items
                 if ql in m["name"].lower() or ql in m["desc"].lower() or ql in m["id"].lower()]
    return items


def mcp_categories():
    seen = []
    for m in MCP_CATALOG:
        if m["category"] not in seen:
            seen.append(m["category"])
    return seen


def get_mcp(mid):
    return _MCP_BY_ID.get(mid)


# ---------------- 技能包（tar/zip）解析 ----------------
_SKILL_FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)


def parse_skill_frontmatter(text):
    """从 SKILL.md 文本解析 YAML frontmatter（简单解析，无需 pyyaml）+ 正文。
    返回 {name, description, allowed_tools(list), body}。"""
    m = _SKILL_FRONT.match(text or "")
    if not m:
        return {"name": "", "description": "", "allowed_tools": [], "body": (text or "").strip()}
    fm, body = m.group(1), m.group(2)
    meta = {}
    for line in fm.splitlines():
        if ":" in line and not line.strip().startswith("#"):
            k, _, v = line.partition(":")
            meta[k.strip().lower()] = v.strip().strip('"').strip("'")
    tools = meta.get("allowed-tools", "")
    return {
        "name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "allowed_tools": [t.strip() for t in re.split(r"[,\s]+", tools) if t.strip()],
        "body": (body or "").strip(),
    }


def _is_zip(data):
    return zipfile.is_zipfile(io.BytesIO(data))


def _is_tar(data):
    try:
        return tarfile.is_tarfile(io.BytesIO(data))
    except Exception:
        return False


def archive_entries(filename, data):
    """列出包内条目，返回 [{path, size, dir}]（跳过 __MACOSX/.DS_Store 噪声）。"""
    out = []
    def keep(p):
        base = p.rsplit("/", 1)[-1] if p else ""
        return p and "__MACOSX" not in p and base != ".DS_Store" and not base.startswith("._")
    if _is_zip(data):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for i in z.infolist():
                if keep(i.filename):
                    out.append({"path": i.filename, "size": i.file_size, "dir": i.is_dir()})
    elif _is_tar(data):
        with tarfile.open(fileobj=io.BytesIO(data)) as t:
            for mb in t.getmembers():
                if keep(mb.name):
                    out.append({"path": mb.name.rstrip("/"), "size": mb.size, "dir": mb.isdir()})
    else:
        raise ValueError("无法识别的压缩包（仅支持 .zip / .tar / .tar.gz）")
    return out


def _read_member(filename, data, inner):
    if _is_zip(data):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return z.read(inner)
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        f = t.extractfile(inner)
        return f.read() if f else b""


def find_skill_md(filename, data):
    """在包内找最浅的 SKILL.md，解析返回 {**frontmatter, entries, skill_path}；找不到返回 None。"""
    entries = archive_entries(filename, data)
    cands = [e["path"] for e in entries
             if not e["dir"] and e["path"].rsplit("/", 1)[-1].lower() == "skill.md"]
    if not cands:
        return None
    skill_path = min(cands, key=lambda p: (p.count("/"), len(p)))
    raw = _read_member(filename, data, skill_path)
    meta = parse_skill_frontmatter(raw.decode("utf-8", "replace"))
    meta["entries"] = entries
    meta["skill_path"] = skill_path
    return meta


def read_archive_file(path_on_disk, inner, max_bytes=200_000):
    """读取磁盘上已存档包里的某个文件文本（用于详情里点开查看）。"""
    with open(path_on_disk, "rb") as f:
        data = f.read()
    raw = _read_member(path_on_disk, data, inner)
    if len(raw) > max_bytes:
        return raw[:max_bytes].decode("utf-8", "replace") + "\n…（已截断）"
    return raw.decode("utf-8", "replace")
