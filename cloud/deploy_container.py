"""
把一个 ACR 容器镜像部署成 AgentRun 的「一沙箱一 agent」（artifactType=Container）。
用于 OpenClaw 等重框架（含 native 依赖、需镜像）。

  DASHSCOPE_API_KEY=... python deploy_container.py <name> <image> <acr_user> <acr_password> [registry_type]
  例: ... deploy_container.py openclaw-agent registry.cn-hangzhou.aliyuncs.com/aispace/openclaw:latest <user> <pwd>

<acr_user>/<acr_password> 给 AgentRun 用于私有镜像拉取（registry_config.auth_config）。
若镜像仓库设为公开，可不传（用 '-' 占位）。
"""
import os
import sys
import time

from ar import client, M, REGION

WORKSPACE = "e3ce32d7-b88b-585a-822f-305069fd0d6c"
ACCOUNT = "1955898314860872"


def _find(c, name):
    for it in (c.list_agent_runtimes(M.ListAgentRuntimesRequest()).body.data.items or []):
        if it.agent_runtime_name == name:
            return it.agent_runtime_id
    return None


def _wait_rt(c, rid):
    while True:
        d = c.get_agent_runtime(rid, M.GetAgentRuntimeRequest()).body.data
        if d.status in ("READY", "FAILED"):
            return d
        time.sleep(6)


def _wait_ep(c, rid):
    for _ in range(40):
        its = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
        if its and its[0].status == "READY":
            return
        time.sleep(5)


def deploy(name, image, user, password, registry_type):
    c = client()
    env = {"DASHSCOPE_API_KEY": os.environ["DASHSCOPE_API_KEY"], "MODEL_NAME": "qwen-plus", "PORT": "9000"}
    cc = M.ContainerConfiguration(image=image, port=9000, image_registry_type=registry_type)
    if user and user != "-" and password and password != "-":
        cc.registry_config = M.RegistryConfig(
            auth_config=M.RegistryAuthConfig(user_name=user, password=password))
    common = dict(artifact_type="Container", container_configuration=cc,
                  cpu=1.0, memory=2048, port=9000, environment_variables=env,
                  network_configuration=M.NetworkConfiguration(network_mode="PUBLIC"))
    rid = _find(c, name)
    if rid:
        c.update_agent_runtime(rid, M.UpdateAgentRuntimeRequest(body=M.UpdateAgentRuntimeInput(**common)))
        print("updated", rid)
    else:
        c.create_agent_runtime(M.CreateAgentRuntimeRequest(
            body=M.CreateAgentRuntimeInput(agent_runtime_name=name, workspace_id=WORKSPACE, **common)))
        rid = _find(c, name)
        print("created", rid)
    d = _wait_rt(c, rid)
    print("runtime:", d.status)
    if d.status != "READY":
        print("reason:", getattr(d, "status_reason", None), getattr(d, "last_error", None))
        return
    ver = c.publish_runtime_version(rid, M.PublishRuntimeVersionRequest(
        body=M.PublishRuntimeVersionInput(description="container"))).body.data.agent_runtime_version
    eps = c.list_agent_runtime_endpoints(rid, M.ListAgentRuntimeEndpointsRequest()).body.data.items or []
    if eps:
        c.update_agent_runtime_endpoint(rid, eps[0].agent_runtime_endpoint_id,
            M.UpdateAgentRuntimeEndpointRequest(body=M.UpdateAgentRuntimeEndpointInput(target_version=ver)))
    else:
        c.create_agent_runtime_endpoint(rid, M.CreateAgentRuntimeEndpointRequest(
            body=M.CreateAgentRuntimeEndpointInput(agent_runtime_endpoint_name="ep1", target_version=ver)))
    _wait_ep(c, rid)
    print("version:", ver)
    print("invoke:", f"https://{ACCOUNT}.agentrun-data.{REGION}.aliyuncs.com/agent-runtimes/{name}/endpoints/ep1/invocations")


if __name__ == "__main__":
    name, image, user, password = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    registry_type = sys.argv[5] if len(sys.argv) > 5 else "ACR_PERSONAL"
    deploy(name, image, user, password, registry_type)
