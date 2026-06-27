"""
ACR 个人版助手：用账号 AK/SK 换临时 docker 登录令牌 + 确保命名空间存在。
（个人版 SDK 的 create 方法是坏的，这里用通用 OpenAPI 客户端直发 ROA 请求。）

  python acr.py login                 # docker login 到 registry（用临时令牌，不需固定密码）
  python acr.py ensure-ns <namespace> # 确保命名空间存在（不存在则创建）
"""
import base64
import json
import os
import subprocess
import sys

from alibabacloud_tea_openapi.client import Client as OpenApiClient
from alibabacloud_tea_openapi import models as om
from alibabacloud_tea_util import models as um

from ar import _creds, REGION

ENDPOINT = f"cr.{REGION}.aliyuncs.com"
REGISTRY = f"registry.{REGION}.aliyuncs.com"


def _cli():
    ak, sk = _creds()
    cfg = om.Config(access_key_id=ak, access_key_secret=sk, region_id=REGION, endpoint=ENDPOINT)
    return OpenApiClient(cfg)


def _call(action, method, pathname, body=None):
    params = om.Params(action=action, version="2016-06-07", protocol="HTTPS", method=method,
                       auth_type="AK", style="ROA", pathname=pathname,
                       req_body_type="json", body_type="json")
    req = om.OpenApiRequest(body=body) if body is not None else om.OpenApiRequest()
    return _cli().call_api(params, req, um.RuntimeOptions())


def get_token():
    d = _call("GetAuthorizationToken", "GET", "/tokens").get("body", {}).get("data", {})
    return d["tempUserName"], d["authorizationToken"]


def login():
    user, token = get_token()
    p = subprocess.run(["docker", "login", REGISTRY, "-u", user, "--password-stdin"],
                       input=token.encode(), capture_output=True)
    print((p.stdout + p.stderr).decode().strip())
    return p.returncode


def write_docker_auth():
    """直接把临时令牌写进 ~/.docker/config.json，绕过个人版 ACR 在 /v2/ ping 上的 403。
    docker push 用 repo 级 token，仍可成功。"""
    user, token = get_token()
    path = os.path.expanduser("~/.docker/config.json")
    cfg = {}
    if os.path.exists(path):
        try:
            cfg = json.load(open(path))
        except Exception:
            cfg = {}
    cfg.setdefault("auths", {})[REGISTRY] = {
        "auth": base64.b64encode(f"{user}:{token}".encode()).decode()}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(cfg, open(path, "w"))
    print("docker auth 已写入", REGISTRY, "（user:", user, "）")


def list_ns():
    return [n["namespace"] for n in
            _call("GetNamespaceList", "GET", "/namespace").get("body", {}).get("data", {}).get("namespaces", [])]


def ensure_ns(ns):
    existing = list_ns()
    if ns in existing:
        print(f"namespace '{ns}' 已存在")
        return
    _call("CreateNamespace", "PUT", "/namespace",
          {"Namespace": {"Namespace": ns, "AutoCreate": True, "DefaultVisibility": "PUBLIC"}})
    print(f"namespace '{ns}' 已创建（之前: {existing}）")


def set_ns_private(ns):
    _call("UpdateNamespace", "POST", f"/namespace/{ns}",
          {"Namespace": {"DefaultVisibility": "PRIVATE", "AutoCreate": True}})
    print(f"namespace '{ns}' 设为 PRIVATE")


def ensure_repo_private(ns, repo):
    body = {"Repo": {"RepoNamespace": ns, "RepoName": repo, "RepoType": "PRIVATE",
                     "Summary": "openclaw agent image", "Detail": "OpenClaw single-agent on bailian"}}
    try:
        _call("CreateRepo", "PUT", "/repos", body)
        print(f"repo '{ns}/{repo}' 已创建（PRIVATE）")
    except Exception as e:
        msg = str(e)
        if "EXIST" in msg.upper():
            _call("UpdateRepo", "POST", f"/repos/{ns}/{repo}", {"Repo": {"RepoType": "PRIVATE", "Summary": "openclaw", "Detail": "openclaw"}})
            print(f"repo '{ns}/{repo}' 已设为 PRIVATE")
        else:
            print("repo:", msg[:160])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "login"
    if cmd == "login":
        sys.exit(login())
    elif cmd == "write-auth":
        write_docker_auth()
    elif cmd == "ensure-ns":
        ensure_ns(sys.argv[2])
    elif cmd == "list-ns":
        print(list_ns())
    elif cmd == "private":
        set_ns_private(sys.argv[2])
        ensure_repo_private(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "openclaw")
