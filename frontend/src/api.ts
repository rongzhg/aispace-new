// 后端接入层。开发用 Vite /api 代理到本机后端；连得上走真实 API，否则前端 mock。
// API_ON 用 ES 模块的 live binding 导出：detectApi/setApiOn 改它，import 方读到最新值。
export let API_ON = false;
export const API_BASE = ""; // 走 /api 代理（vite.config.ts）；生产由部署侧反代

export function setApiOn(v: boolean) {
  API_ON = v;
}

export async function apiCall(path: string, opts: RequestInit = {}) {
  const r = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export async function detectApi() {
  try {
    const r = await fetch(API_BASE + "/api/health");
    setApiOn(r.ok);
  } catch {
    setApiOn(false);
  }
  return API_ON;
}
