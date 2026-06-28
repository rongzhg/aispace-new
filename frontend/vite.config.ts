import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 公网 demo 用的 Basic Auth 闸门：仅当设了 DEMO_AUTH="用户名:密码" 时启用，
// 不设则完全不影响本地开发。中间件挂在最前面，同时保护前端页面与 /api 代理。
function basicAuth() {
  const cred = process.env.DEMO_AUTH;
  return {
    name: "demo-basic-auth",
    configureServer(server: any) {
      if (!cred) return;
      const expected = "Basic " + Buffer.from(cred).toString("base64");
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.headers.authorization === expected) return next();
        res.statusCode = 401;
        res.setHeader("WWW-Authenticate", 'Basic realm="AISpace Demo"');
        res.end("需要认证 / Authentication required");
      });
    },
  };
}

// 开发时 /api 代理到本机后端（发布/服务/对话）。生产由部署侧反代。
export default defineConfig({
  plugins: [react(), basicAuth()],
  server: {
    port: 5173,
    // 经隧道（cloudflared）访问时，请求 Host 是随机域名，需放行；本地开发不受影响。
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
