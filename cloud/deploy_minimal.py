"""
部署最小 agent 到 AgentRun（artifactType=Code）：一沙箱一 agent，验证底座。
需要环境变量 DASHSCOPE_API_KEY。
  python deploy_minimal.py create   # 创建 runtime
  python deploy_minimal.py get      # 查状态
  python deploy_minimal.py delete   # 删除
"""
import base64
import io
import json
import os
import sys
import time
import zipfile

from ar import client, M

WORKSPACE = "e3ce32d7-b88b-585a-822f-305069fd0d6c"
NAME = "aispace-min-1"
CMD = ["python3", "server.py"]   # python3.12 运行时是 python3，不是 python
HERE = os.path.dirname(os.path.abspath(__file__))


def make_zip_b64():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(HERE, "minimal_agent", "server.py"), "server.py")
    return base64.b64encode(buf.getvalue()).decode()


def _find_id(c):
    r = c.list_agent_runtimes(M.ListAgentRuntimesRequest())
    for it in r.body.data.items or []:
        if it.agent_runtime_name == NAME:
            return it.agent_runtime_id
    return None


def create():
    key = os.environ["DASHSCOPE_API_KEY"]
    code = M.CodeConfiguration(language="python3.12", command=CMD, zip_file=make_zip_b64())
    body = M.CreateAgentRuntimeInput(
        agent_runtime_name=NAME,
        artifact_type="Code",
        code_configuration=code,
        cpu=0.5, memory=1024, port=9000,
        environment_variables={"DASHSCOPE_API_KEY": key, "MODEL_NAME": "qwen-plus", "PORT": "9000"},
        network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"),
        workspace_id=WORKSPACE,
    )
    r = client().create_agent_runtime(M.CreateAgentRuntimeRequest(body=body))
    print(json.dumps(r.body.to_map(), ensure_ascii=False, indent=2))


def get():
    c = client()
    rid = _find_id(c)
    if not rid:
        print(json.dumps({"status": "NOT_FOUND"})); return
    r = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest())
    print(json.dumps(r.body.to_map(), ensure_ascii=False, indent=2))


def delete():
    c = client()
    rid = _find_id(c)
    if not rid:
        print("not found"); return
    c.delete_agent_runtime(rid, M.DeleteAgentRuntimeRequest())
    print("deleted", rid)


def endpoint():
    c = client()
    rid = _find_id(c)
    body = M.CreateAgentRuntimeEndpointInput(agent_runtime_endpoint_name="ep1", target_version="1")
    r = c.create_agent_runtime_endpoint(rid, M.CreateAgentRuntimeEndpointRequest(body=body))
    print(json.dumps(r.body.to_map(), ensure_ascii=False, indent=2))


def _wait_ready(c, rid):
    while True:
        st = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data.status
        if st in ("READY", "FAILED"):
            return st
        time.sleep(6)


def _ep_id(c, rid):
    its = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
    return its[0].agent_runtime_endpoint_id if its else None


def redeploy():
    """更新代码/命令 → 等就绪 → 发布新版本 → 把 endpoint 指向新版本。"""
    key = os.environ["DASHSCOPE_API_KEY"]
    c = client()
    rid = _find_id(c)
    code = M.CodeConfiguration(language="python3.12", command=CMD, zip_file=make_zip_b64())
    body = M.UpdateAgentRuntimeInput(
        artifact_type="Code", code_configuration=code, cpu=0.5, memory=1024, port=9000,
        environment_variables={"DASHSCOPE_API_KEY": key, "MODEL_NAME": "qwen-plus", "PORT": "9000"},
        network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"))
    c.update_agent_runtime(rid, M.UpdateAgentRuntimeRequest(body=body))
    print("updated, waiting ready...")
    print("status:", _wait_ready(c, rid))
    ver = c.publish_runtime_version(rid, M.PublishRuntimeVersionRequest(
        body=M.PublishRuntimeVersionInput(description="redeploy"))).body.data.agent_runtime_version
    print("published version:", ver)
    epid = _ep_id(c, rid)
    c.update_agent_runtime_endpoint(rid, epid, M.UpdateAgentRuntimeEndpointRequest(
        body=M.UpdateAgentRuntimeEndpointInput(target_version=ver)))
    print("endpoint repointed to version", ver)


def endpoints():
    c = client()
    rid = _find_id(c)
    r = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest())
    print(json.dumps(r.body.to_map(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    {"create": create, "get": get, "delete": delete, "endpoint": endpoint,
     "endpoints": endpoints, "redeploy": redeploy}[sys.argv[1] if len(sys.argv) > 1 else "create"]()
