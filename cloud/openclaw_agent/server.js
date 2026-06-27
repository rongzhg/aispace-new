// OpenClaw 单 agent 容器服务：跑在 AgentRun 沙箱里，经 OpenClaw(--local embedded) 用百炼 qwen 回话。
// POST /chat {message, session_id?} → {reply, session_id, engine, model}；GET/POST /health。
const http = require("http");
const { execFile } = require("child_process");

const PORT = parseInt(process.env.PORT || "9000", 10);

function ocChat(message, sessionId) {
  return new Promise((resolve) => {
    const args = ["agent", "--local", "--agent", "main", "-m", message, "--json"];
    if (sessionId) args.push("--session-id", sessionId);
    execFile("openclaw", args, { maxBuffer: 16 * 1024 * 1024, env: process.env, timeout: 280000 },
      (err, stdout, stderr) => {
        const s = stdout || "";
        const i = s.indexOf("{"), j = s.lastIndexOf("}");
        let reply = "", sid = sessionId, model = "";
        try {
          let d = JSON.parse(s.slice(i, j + 1));
          d = d.result || d;
          reply = (d.payloads && d.payloads[0] && d.payloads[0].text)
            || (d.meta && d.meta.finalAssistantVisibleText) || "";
          sid = (d.meta && d.meta.agentMeta && d.meta.agentMeta.sessionId) || sessionId;
          model = (d.meta && d.meta.executionTrace && d.meta.executionTrace.winnerModel) || "";
        } catch (e) {
          reply = err ? ("error: " + String(stderr || err).slice(0, 400)) : s.slice(0, 400);
        }
        resolve({ reply, session_id: sid, engine: (err && !reply) ? "error" : "openclaw", model });
      });
  });
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const send = (code, obj) => {
      const b = Buffer.from(JSON.stringify(obj));
      res.writeHead(code, { "Content-Type": "application/json", "Content-Length": b.length });
      res.end(b);
    };
    if (req.url === "/health") return send(200, { ok: true, framework: "OPENCLAW", engine: "openclaw" });
    if (req.url === "/chat") {
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch (e) {}
      const r = await ocChat(data.message || "", data.session_id);
      return send(r.engine === "error" ? 500 : 200, r);
    }
    send(404, { error: "not found" });
  });
});
server.listen(PORT, "0.0.0.0", () => console.log("openclaw agent server on " + PORT));
