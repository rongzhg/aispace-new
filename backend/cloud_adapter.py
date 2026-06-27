"""
云端运行适配器（可插拔）。平台「发布到独立环境/即用即弃」时把 Agent 部署成云端独立沙箱服务。

- CloudRuntimeAdapter：抽象接口（deploy / stop / chat / endpoint_url）。换云厂商=换一个实现。
- AgentRunCloudAdapter：阿里云函数计算 AgentRun 实现——每个 Agent = 一个独立 AgentRuntime（沙箱），
  用一份**共享 OSS bundle**（OpenClaw 运行时）+ 每 Agent 环境变量（模型 + 人设）起出各自的 agent；
  后端只调 API、不构建镜像。本机未配凭证/SDK 时优雅报错。

凭证：阿里云读本地 `~/.aliyun/config.json`（profile 默认 aispace）；模型出网用 DASHSCOPE_API_KEY（env）。
"""
import base64
import json
import os
import re

import httpx

REGION = os.environ.get("ALIYUN_REGION", "cn-hangzhou")
PROFILE = os.environ.get("ALIYUN_PROFILE", "aispace")
ACCOUNT = os.environ.get("ALIYUN_ACCOUNT_ID", "1955898314860872")
WORKSPACE = os.environ.get("AGENTRUN_WORKSPACE_ID", "e3ce32d7-b88b-585a-822f-305069fd0d6c")
BUNDLE_BUCKET = os.environ.get("AGENTRUN_BUNDLE_BUCKET", f"aispace-code-{ACCOUNT}")
BUNDLE_OBJECT = os.environ.get("AGENTRUN_BUNDLE_OBJECT", "openclaw/oc-code.zip")

_QWEN_DEFAULT = "qwen3.6-plus"   # 云端默认模型（百炼 3.6 系列）


def _b64(s):
    return base64.b64encode((s or "").encode("utf-8")).decode()


class CloudRuntimeAdapter:
    """云端运行适配器接口。"""
    available = False

    def deploy(self, agent_id, name, framework, model, files, isolation):
        raise NotImplementedError

    def stop(self, agent_id):
        raise NotImplementedError

    def chat(self, agent_id, message, session_id=None):
        raise NotImplementedError


class AgentRunCloudAdapter(CloudRuntimeAdapter):
    def __init__(self):
        self.available = False
        self._err = None
        try:
            from alibabacloud_agentrun20250910.client import Client
            from alibabacloud_agentrun20250910 import models as M
            from alibabacloud_tea_openapi import models as open_api_models
            ak, sk = self._creds()
            cfg = open_api_models.Config(access_key_id=ak, access_key_secret=sk, region_id=REGION)
            cfg.endpoint = f"agentrun.{REGION}.aliyuncs.com"
            self._c = Client(cfg)
            self._M = M
            self._http = httpx.Client(timeout=300, trust_env=False)
            self.available = True
        except Exception as e:
            self._err = str(e)

    @staticmethod
    def _creds():
        p = os.path.expanduser("~/.aliyun/config.json")
        d = json.load(open(p))
        prof = next(x for x in d.get("profiles", []) if x.get("name") == PROFILE)
        return prof["access_key_id"], prof["access_key_secret"]

    @staticmethod
    def _rt_name(agent_id):
        return "as-" + re.sub(r"[^a-z0-9-]", "-", str(agent_id).lower()).strip("-")

    @staticmethod
    def _map_model(model):
        # 百炼(qwen) 模型原样透传；非 qwen（如 claude）→ 云端默认 3.6（百炼-only 云端跑不了 anthropic）
        m = (model or "").strip().lower()
        return m if m.startswith("qwen") else _QWEN_DEFAULT

    def endpoint_url(self, agent_id):
        return (f"https://{ACCOUNT}.agentrun-data.{REGION}.aliyuncs.com"
                f"/agent-runtimes/{self._rt_name(agent_id)}/endpoints/ep1/invocations")

    def _find(self, name):
        M = self._M
        for it in (self._c.list_agent_runtimes(M.ListAgentRuntimesRequest()).body.data.items or []):
            if it.agent_runtime_name == name:
                return it.agent_runtime_id
        return None

    def deploy(self, agent_id, name, framework, model, files, isolation, skills=None):
        """同步部署（建/更 runtime → 发版本 → endpoint → 等就绪）。建议由调用方放后台线程跑。
        skills: {slug: {relpath: content}}，随部署经 SKILLS_JSON env 下发，沙箱 init 物化到 <ws>/skills/。"""
        if not self.available:
            raise RuntimeError(f"云适配器不可用：{self._err}")
        if framework != "OPENCLAW":
            # 当前云实现基于 OpenClaw on 百炼 的共享 bundle；其它框架需各自 bundle（后续）
            raise RuntimeError(f"云端独立环境当前仅支持 OpenClaw（百炼）；framework={framework} 暂走本地或后续支持")
        dash = os.environ.get("DASHSCOPE_API_KEY")
        if not dash:
            raise RuntimeError("缺少 DASHSCOPE_API_KEY（云端模型出网凭证）")
        import time
        M = self._M
        rid = self._find(self._rt_name(agent_id))
        env = {
            "DASHSCOPE_API_KEY": dash,
            "MODEL_ID": self._map_model(model),
            "PERSONA_ROLE": _b64((files or {}).get("role.md", "")),
            "PERSONA_AGENT": _b64((files or {}).get("agent.md", "")),
            "PERSONA_USER": _b64((files or {}).get("user.md", "")),
            "PORT": "9000",
        }
        if skills:
            env["SKILLS_JSON"] = _b64(json.dumps(skills, ensure_ascii=False))
        code = M.CodeConfiguration(language="nodejs22", command=["node", "/code/server.js"],
                                   oss_bucket_name=BUNDLE_BUCKET, oss_object_name=BUNDLE_OBJECT)
        common = dict(artifact_type="Code", code_configuration=code, cpu=1.0, memory=2048,
                      disk_size=10240, port=9000, environment_variables=env,
                      network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"))
        # L3 即用即弃 → 每会话隔离；L2 独立环境 → 每 agent 一沙箱（默认）
        if isolation == "L3":
            common.update(enable_session_isolation=True, session_affinity_type="HEADER_FIELD",
                          header_field_name="X-AgentRun-Session-ID", session_idle_timeout_seconds=900)
        if rid:
            self._c.update_agent_runtime(rid, M.UpdateAgentRuntimeRequest(body=M.UpdateAgentRuntimeInput(**common)))
        else:
            self._c.create_agent_runtime(M.CreateAgentRuntimeRequest(
                body=M.CreateAgentRuntimeInput(agent_runtime_name=self._rt_name(agent_id),
                                               workspace_id=WORKSPACE, **common)))
            rid = self._find(self._rt_name(agent_id))
        # 等运行时就绪
        for _ in range(60):
            st = self._c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data.status
            if st in ("READY", "FAILED"):
                break
            time.sleep(6)
        if st != "READY":
            raise RuntimeError(f"云端 runtime 状态 {st}")
        ver = self._c.publish_runtime_version(rid, M.PublishRuntimeVersionRequest(
            body=M.PublishRuntimeVersionInput(description="publish"))).body.data.agent_runtime_version
        eps = self._c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
        if eps:
            self._c.update_agent_runtime_endpoint(rid, eps[0].agent_runtime_endpoint_id,
                M.UpdateAgentRuntimeEndpointRequest(body=M.UpdateAgentRuntimeEndpointInput(target_version=ver)))
        else:
            self._c.create_agent_runtime_endpoint(rid, M.CreateAgentRuntimeEndpointRequest(
                body=M.CreateAgentRuntimeEndpointInput(agent_runtime_endpoint_name="ep1", target_version=ver)))
        for _ in range(40):
            its = self._c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
            if its and its[0].status == "READY":
                break
            time.sleep(5)
        return {"runtime_id": rid, "version": ver, "url": self.endpoint_url(agent_id),
                "model": self._map_model(model)}

    def stop(self, agent_id):
        if not self.available:
            return
        M = self._M
        rid = self._find(self._rt_name(agent_id))
        if rid:
            try:
                self._c.delete_agent_runtime(rid)
            except Exception:
                pass

    def chat(self, agent_id, message, session_id=None):
        url = self.endpoint_url(agent_id) + "/chat"
        headers = {"Content-Type": "application/json",
                   "X-AgentRun-Session-ID": session_id or f"s-{agent_id}"}
        r = self._http.post(url, headers=headers, json={"message": message, "session_id": session_id})
        return r.json()
