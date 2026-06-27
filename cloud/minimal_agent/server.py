"""
最小 agent：一个无依赖(stdlib)的 HTTP 服务，跑在 AgentRun 沙箱里，调百炼(通义千问)回话。
用于验证「一沙箱一 agent + 会话隔离 + 对外 endpoint」的底座打通。
监听 0.0.0.0:$PORT，提供 GET /health、POST /chat {message}。
环境变量：DASHSCOPE_API_KEY、MODEL_NAME(默认 qwen-plus)、PORT(默认 9000)。
"""
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KEY = os.environ.get("DASHSCOPE_API_KEY", "")
MODEL = os.environ.get("MODEL_NAME", "qwen-plus")
EP = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


def qwen(message):
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": message}]}).encode()
    req = urllib.request.Request(
        EP, data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read())
    return d["choices"][0]["message"]["content"]


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True, "model": MODEL, "hasKey": bool(KEY)})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        ln = int(self.headers.get("Content-Length", "0") or 0)
        try:
            data = json.loads(self.rfile.read(ln) or b"{}")
        except Exception:
            data = {}
        if self.path == "/chat":
            msg = data.get("message", "")
            try:
                self._send(200, {"reply": qwen(msg), "engine": "qwen", "model": MODEL})
            except Exception as e:
                self._send(500, {"error": str(e)[:400], "engine": "error"})
        else:
            self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9000"))
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
