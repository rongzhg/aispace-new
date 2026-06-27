# AISpace 前端（正式项目）

Vite + React 18 + TypeScript + Ant Design 5。由原 `demo/`（单 HTML + CDN）正式化而来，逻辑复用。

## 开发
```bash
npm install
npm run dev      # http://localhost:5173 ，/api 自动代理到本机后端 :8000
```
连得上后端走真实 API（创建/版本/发布/对话/服务）；连不上回退前端 mock。

## 构建
```bash
npm run build    # 产物 dist/
npm run preview
```

## 结构
- `src/api.ts` — 后端接入层（`apiCall`、`API_ON` live binding、`detectApi`）。`/api` 走 Vite 代理（生产由部署侧反代）。
- `src/config.*` / `src/App.tsx` — 配置常量 + 全部页面/组件（Root、AgentBuilder、AgentDetail、Playground、ChatPanel 等）。当前集中在 `App.tsx`，后续可按组件继续拆分。
- `src/main.tsx` — 入口（先探活后端再渲染）。

## 运行环境与云端状态
发布时选**运行环境**：共享环境(L1)=本地；**独立环境(L2)/即用即弃(L3)=云端独立沙箱**（异步部署）。
列表与详情的「运行服务」会显示：`本地 / ☁ 云端` + `部署中 / ● 运行中 / ✕ 失败`；有服务在「部署中」时每 5s 自动轮询刷新。

> 后端 API 契约见 ../技术文档/接口契约.md；云端部署见 ../技术文档/阿里云AgentRun部署.md。
