# OpenClaw 单 agent 镜像（一沙箱一 agent），模型走百炼 qwen（OpenAI 兼容）。
FROM node:22-slim

# openclaw 及其原生依赖构建需要：git / 证书 / python3 / 编译器
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 固定版本避免偶发解析到占位包 0.0.1（npmjs.org 有该版本；构建经代理出网，推送走 no_proxy 直连 ACR）
RUN npm install -g openclaw@2026.6.10 && openclaw --version

ENV OPENCLAW_CONFIG_PATH=/app/openclaw.json \
    OPENCLAW_STATE_DIR=/app/state \
    PORT=9000

WORKDIR /app
COPY openclaw.json /app/openclaw.json
COPY server.js /app/server.js
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 9000
CMD ["/app/entrypoint.sh"]
