"""
通用 AgentRun 部署器：把「一个目录的 agent 代码」部署成「一个沙箱一个 agent」并暴露 endpoint。
这是平台多框架云部署的核心原语——不同框架=不同代码目录/语言/启动命令，其余流程一致。

  python deployer.py <name> <src_dir> <language> <command...>
  例: python deployer.py node-agent node_agent nodejs20 node server.js
环境变量 DASHSCOPE_API_KEY 会注入到 agent。
"""
import base64
import io
import os
import sys
import time
import zipfile

from ar import client, M, REGION

WORKSPACE = "e3ce32d7-b88b-585a-822f-305069fd0d6c"
ACCOUNT = "1955898314860872"
HERE = os.path.dirname(os.path.abspath(__file__))


def _zip_b64(src_dir):
    base = os.path.join(HERE, src_dir)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(base):
            for fn in files:
                p = os.path.join(root, fn)
                z.write(p, os.path.relpath(p, base))   # 含 node_modules：AgentRun 不在部署时装依赖
    return base64.b64encode(buf.getvalue()).decode()


def _find(c, name):
    for it in (c.list_agent_runtimes(M.ListAgentRuntimesRequest()).body.data.items or []):
        if it.agent_runtime_name == name:
            return it.agent_runtime_id
    return None


def _wait_rt(c, rid):
    while True:
        st = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data.status
        if st in ("READY", "FAILED"):
            return st
        time.sleep(6)


def _wait_ep(c, rid):
    for _ in range(30):
        its = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
        if its and its[0].status == "READY":
            return its[0].agent_runtime_endpoint_id
        time.sleep(5)
    return its[0].agent_runtime_endpoint_id if its else None


def deploy(name, src_dir, language, command):
    c = client()
    env = {"DASHSCOPE_API_KEY": os.environ["DASHSCOPE_API_KEY"], "MODEL_NAME": "qwen-plus", "PORT": "9000"}
    code = M.CodeConfiguration(language=language, command=command, zip_file=_zip_b64(src_dir))
    common = dict(artifact_type="Code", code_configuration=code, cpu=0.5, memory=1024, port=9000,
                  environment_variables=env, network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"))
    rid = _find(c, name)
    if rid:
        c.update_agent_runtime(rid, M.UpdateAgentRuntimeRequest(body=M.UpdateAgentRuntimeInput(**common)))
        print("updated", rid)
    else:
        c.create_agent_runtime(M.CreateAgentRuntimeRequest(
            body=M.CreateAgentRuntimeInput(agent_runtime_name=name, workspace_id=WORKSPACE, **common)))
        rid = _find(c, name)
        print("created", rid)
    st = _wait_rt(c, rid)
    print("runtime:", st)
    if st != "READY":
        d = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data
        print("reason:", getattr(d, "status_reason", None), getattr(d, "last_error", None))
        return
    ver = c.publish_runtime_version(rid, M.PublishRuntimeVersionRequest(
        body=M.PublishRuntimeVersionInput(description="deploy"))).body.data.agent_runtime_version
    eps = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
    if eps:
        c.update_agent_runtime_endpoint(rid, eps[0].agent_runtime_endpoint_id,
            M.UpdateAgentRuntimeEndpointRequest(body=M.UpdateAgentRuntimeEndpointInput(target_version=ver)))
    else:
        c.create_agent_runtime_endpoint(rid, M.CreateAgentRuntimeEndpointRequest(
            body=M.CreateAgentRuntimeEndpointInput(agent_runtime_endpoint_name="ep1", target_version=ver)))
    _wait_ep(c, rid)
    url = f"https://{ACCOUNT}.agentrun-data.{REGION}.aliyuncs.com/agent-runtimes/{name}/endpoints/ep1/invocations"
    print("version:", ver)
    print("invoke:", url)


if __name__ == "__main__":
    name, src_dir, language = sys.argv[1], sys.argv[2], sys.argv[3]
    command = sys.argv[4:]
    deploy(name, src_dir, language, command)
