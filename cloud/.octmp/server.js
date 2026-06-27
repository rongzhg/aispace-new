// OpenClaw 单 agent 云服务（AgentRun Code 制品）。一个共享 bundle，靠环境变量起出各自人设/模型/技能的 agent。
// env: DASHSCOPE_API_KEY, MODEL_ID(默认 qwen-plus), PERSONA_ROLE/PERSONA_AGENT/PERSONA_USER(base64,可选),
//      SKILLS_JSON(base64 的 {slug:{relpath:content}}，物化到 <ws>/skills/<slug>/，openclaw 自动发现), PORT
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, execFileSync } = require("child_process");

const PORT = parseInt(process.env.PORT || "9000", 10);
const NODE = "/code/bin/node";               // 运行时自带 node 偏旧，用打包的 22.23 跑 openclaw
const ENTRY = "/code/node_modules/openclaw/openclaw.mjs";
const MODEL_ID = process.env.MODEL_ID || "qwen-plus";
const CFG = "/tmp/openclaw.json";            // /code 只读，配置写 /tmp
const WS = "/tmp/oc-state/ws";
const b64 = (v) => { try { return v ? Buffer.from(v, "base64").toString("utf8") : ""; } catch (e) { return ""; } };

// 子进程统一用 /tmp 配置 + 状态
const ENV = { ...process.env, OPENCLAW_CONFIG_PATH: CFG, OPENCLAW_STATE_DIR: "/tmp/oc-state" };

function init() {
  // 1) 写 openclaw.json（自定义 OpenAI 兼容 provider 指向百炼，模型来自 env）
  const cfg = {
    agents: { defaults: { model: { primary: `qwen-compatible/${MODEL_ID}` },
                          models: { [`qwen-compatible/${MODEL_ID}`]: { alias: "qwen" } } } },
    models: { mode: "merge", providers: { "qwen-compatible": {
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "${DASHSCOPE_API_KEY}", api: "openai-completions", timeoutSeconds: 300,
      models: [{ id: MODEL_ID, name: MODEL_ID, reasoning: false, input: ["text"], contextWindow: 200000, maxTokens: 8192 }] } } },
  };
  fs.writeFileSync(CFG, JSON.stringify(cfg));
  // 2) 先建默认 agent（会在 workspace 里铺默认 SOUL/AGENTS/USER）
  fs.mkdirSync(WS, { recursive: true });
  try {
    execFileSync(NODE, [ENTRY, "agents", "add", "platform", "--workspace", WS, "--non-interactive", "--json"],
      { env: ENV, stdio: "ignore", timeout: 120000, cwd: "/code" });
  } catch (e) { /* 已存在则忽略 */ }
  // 3) 再用平台人设覆盖 scaffold：role+agent → SOUL.md，user → USER.md（顺序关键，必须在 agents add 之后）
  const soul = [b64(process.env.PERSONA_ROLE), b64(process.env.PERSONA_AGENT)].filter(Boolean).join("\n\n");
  if (soul) fs.writeFileSync(`${WS}/SOUL.md`, soul + "\n");
  const user = b64(process.env.PERSONA_USER);
  if (user) fs.writeFileSync(`${WS}/USER.md`, user);
  // 4) 物化平台技能：SKILLS_JSON(base64 的 {slug:{relpath:content}}) → <ws>/skills/<slug>/，openclaw 自动发现为 workspace skill
  try {
    const raw = b64(process.env.SKILLS_JSON);
    if (raw) {
      const skills = JSON.parse(raw);
      for (const slug of Object.keys(skills)) {
        const files = skills[slug] || {};
        for (const rel of Object.keys(files)) {
          const safe = path.posix.normalize(rel).replace(/^(\.\.(\/|$))+/, "");
          const dest = path.join(WS, "skills", slug, safe);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, String(files[rel]));
        }
        console.log("skill materialized:", slug);
      }
    }
  } catch (e) { console.log("SKILLS_JSON error:", String(e).slice(0, 200)); }
}

function ocChat(message, sid) {
  return new Promise((resolve) => {
    const a = ["agent", "--local", "--agent", "platform", "-m", message, "--json"];
    if (sid) a.push("--session-id", sid);
    execFile(NODE, [ENTRY, ...a], { maxBuffer: 16 * 1024 * 1024, env: ENV, timeout: 280000, cwd: "/code" },
      (err, stdout, stderr) => {
        const s = stdout || ""; const i = s.indexOf("{"), j = s.lastIndexOf("}");
        let reply = "", session = sid, model = "";
        try {
          let d = JSON.parse(s.slice(i, j + 1)); d = d.result || d;
          reply = (d.payloads && d.payloads[0] && d.payloads[0].text) || (d.meta && d.meta.finalAssistantVisibleText) || "";
          session = (d.meta && d.meta.agentMeta && d.meta.agentMeta.sessionId) || sid;
          model = (d.meta && d.meta.executionTrace && d.meta.executionTrace.winnerModel) || "";
        } catch (e) { reply = err ? ("error: " + String(stderr || err).slice(0, 400)) : s.slice(0, 400); }
        resolve({ reply, session_id: session, engine: (err && !reply) ? "error" : "openclaw", model });
      });
  });
}

init();
const server = http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", async () => {
    const send = (c, o) => { const x = Buffer.from(JSON.stringify(o)); res.writeHead(c, { "Content-Type": "application/json", "Content-Length": x.length }); res.end(x); };
    if (req.url === "/health") return send(200, { ok: true, framework: "OPENCLAW", engine: "openclaw", model: MODEL_ID });
    if (req.url === "/chat") { let d = {}; try { d = JSON.parse(b || "{}"); } catch (e) {} const r = await ocChat(d.message || "", d.session_id); return send(r.engine === "error" ? 500 : 200, r); }
    send(404, { error: "not found" });
  });
});
server.listen(PORT, "0.0.0.0", () => console.log("openclaw cloud agent on " + PORT + " model=" + MODEL_ID));
