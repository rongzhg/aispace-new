// 第二个框架/运行时的 agent：Node.js + openai SDK（指向百炼 OpenAI 兼容端点）。
// 同时验证 AgentRun 的 nodejs Code 是否在部署时自动 npm install（决定 OpenClaw 走 Code 还是镜像）。
// 监听 0.0.0.0:$PORT，POST /chat {message}。
const http = require("http");
const OpenAI = require("openai");

const KEY = process.env.DASHSCOPE_API_KEY || "";
const MODEL = process.env.MODEL_NAME || "qwen-plus";
const PORT = parseInt(process.env.PORT || "9000", 10);

const oai = new OpenAI({
  apiKey: KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

function send(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": b.length });
  res.end(b);
}

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    if (req.url === "/health") return send(res, 200, { ok: true, model: MODEL, runtime: "nodejs" });
    if (req.url === "/chat") {
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch (e) {}
      try {
        const r = await oai.chat.completions.create({
          model: MODEL,
          messages: [{ role: "user", content: data.message || "" }],
        });
        return send(res, 200, { reply: r.choices[0].message.content, engine: "qwen-node", model: MODEL });
      } catch (e) {
        return send(res, 500, { error: String(e).slice(0, 400), engine: "error" });
      }
    }
    send(res, 404, { error: "not found" });
  });
});

server.listen(PORT, "0.0.0.0", () => console.log("listening on " + PORT));
