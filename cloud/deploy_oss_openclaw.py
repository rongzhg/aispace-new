"""
OpenClaw 单 agent 部署到 AgentRun —— 走 Code 制品 + OSS（绕过 ACR）。
打好的 bundle: cloud/.octmp/oc-code.zip（node_modules + server.js + openclaw.json）。
  DASHSCOPE_API_KEY=... python deploy_oss_openclaw.py
"""
import os
import time

import oss2

from ar import client, M, REGION, _creds

ACCOUNT = "1955898314860872"
WORKSPACE = "e3ce32d7-b88b-585a-822f-305069fd0d6c"
BUCKET = f"aispace-code-{ACCOUNT}"
OBJECT = "openclaw/oc-code.zip"
NAME = "openclaw-agent"
ZIP = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".octmp", "oc-code.zip")


def upload():
    ak, sk = _creds()
    ep = f"https://oss-{REGION}.aliyuncs.com"
    b = oss2.Bucket(oss2.Auth(ak, sk), ep, BUCKET)
    try:
        b.create_bucket(oss2.models.BUCKET_ACL_PRIVATE)
    except Exception:
        pass
    print("uploading", round(os.path.getsize(ZIP) / 1e6, 1), "MB → oss://%s/%s" % (BUCKET, OBJECT))
    b.put_object_from_file(OBJECT, ZIP)
    print("uploaded")


def _find(c):
    for it in (c.list_agent_runtimes(M.ListAgentRuntimesRequest()).body.data.items or []):
        if it.agent_runtime_name == NAME:
            return it.agent_runtime_id
    return None


def deploy():
    c = client()
    env = {"DASHSCOPE_API_KEY": os.environ["DASHSCOPE_API_KEY"], "MODEL_NAME": "qwen-plus",
           "PORT": "9000", "OPENCLAW_CONFIG_PATH": "/code/openclaw.json", "OPENCLAW_STATE_DIR": "/tmp/oc-state"}
    cmd = ["node", "/code/server.js"]
    code = M.CodeConfiguration(language="nodejs22", command=cmd, oss_bucket_name=BUCKET, oss_object_name=OBJECT)
    common = dict(artifact_type="Code", code_configuration=code, cpu=1.0, memory=2048, disk_size=10240, port=9000,
                  environment_variables=env, network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"))
    rid = _find(c)
    if rid:
        c.update_agent_runtime(rid, M.UpdateAgentRuntimeRequest(body=M.UpdateAgentRuntimeInput(**common)))
        print("updated", rid)
    else:
        c.create_agent_runtime(M.CreateAgentRuntimeRequest(
            body=M.CreateAgentRuntimeInput(agent_runtime_name=NAME, workspace_id=WORKSPACE, **common)))
        rid = _find(c)
        print("created", rid)
    while True:
        d = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data
        if d.status in ("READY", "FAILED"):
            break
        time.sleep(6)
    print("runtime:", d.status)
    if d.status != "READY":
        print("reason:", getattr(d, "status_reason", None), getattr(d, "last_error", None))
        return
    ver = c.publish_runtime_version(rid, M.PublishRuntimeVersionRequest(
        body=M.PublishRuntimeVersionInput(description="oss"))).body.data.agent_runtime_version
    eps = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
    if eps:
        c.update_agent_runtime_endpoint(rid, eps[0].agent_runtime_endpoint_id,
            M.UpdateAgentRuntimeEndpointRequest(body=M.UpdateAgentRuntimeEndpointInput(target_version=ver)))
    else:
        c.create_agent_runtime_endpoint(rid, M.CreateAgentRuntimeEndpointRequest(
            body=M.CreateAgentRuntimeEndpointInput(agent_runtime_endpoint_name="ep1", target_version=ver)))
    for _ in range(40):
        its = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
        if its and its[0].status == "READY":
            break
        time.sleep(5)
    print("version:", ver)
    print("invoke:", f"https://{ACCOUNT}.agentrun-data.{REGION}.aliyuncs.com/agent-runtimes/{NAME}/endpoints/ep1/invocations")


if __name__ == "__main__":
    upload()
    deploy()
