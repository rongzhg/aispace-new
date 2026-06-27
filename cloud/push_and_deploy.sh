#!/usr/bin/env bash
# 一条龙：构建 linux/amd64 的 OpenClaw 镜像 → 推 ACR → 部署成 AgentRun 容器 agent。
# 用法：
#   ACR_USER=<用户名> ACR_PWD=<密码> DASHSCOPE_API_KEY=<key> \
#   bash push_and_deploy.sh [namespace=aispace] [repo=openclaw] [region=cn-hangzhou]
set -euo pipefail

NS="${1:-aispace}"
REPO="${2:-openclaw}"
REGION="${3:-cn-hangzhou}"
REG="registry.${REGION}.aliyuncs.com"
IMAGE="${REG}/${NS}/${REPO}:latest"
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${HERE}/../backend/.venv/bin/python"

: "${ACR_USER:?需要 ACR_USER}"; : "${ACR_PWD:?需要 ACR_PWD}"; : "${DASHSCOPE_API_KEY:?需要 DASHSCOPE_API_KEY}"

echo "== docker login ${REG} =="
echo "$ACR_PWD" | docker login "$REG" -u "$ACR_USER" --password-stdin

echo "== buildx 构建并推送 linux/amd64 → ${IMAGE} =="
docker buildx build --platform linux/amd64 -t "$IMAGE" --push "${HERE}/openclaw_agent"

echo "== 部署到 AgentRun（artifactType=Container）=="
"$PY" "${HERE}/deploy_container.py" openclaw-agent "$IMAGE" "$ACR_USER" "$ACR_PWD" ACR_PERSONAL

echo "== 验证 =="
URL="https://1955898314860872.agentrun-data.${REGION}.aliyuncs.com/agent-runtimes/openclaw-agent/endpoints/ep1/invocations/chat"
sleep 5
curl -s --max-time 120 -X POST "$URL" -H 'content-type: application/json' \
  -H 'X-AgentRun-Session-ID: oc1' -d '{"message":"用一句话介绍你自己"}' -w '\n[http %{http_code}]\n'
