"""
AgentRun (阿里云函数计算 · AgentRuntime) 客户端封装。
凭证从本地 aliyun CLI 配置读取（~/.aliyun/config.json 的 profile，默认 aispace），不在仓库里硬编码密钥。

用法：
  python ar.py list                 # 列出 agent runtime（只读，验证连通）
  from ar import client, M          # 在其他脚本里复用
"""
import json
import os
import sys

from alibabacloud_agentrun20250910.client import Client
from alibabacloud_agentrun20250910 import models as M
from alibabacloud_tea_openapi import models as open_api_models

REGION = os.environ.get("ALIYUN_REGION", "cn-hangzhou")
PROFILE = os.environ.get("ALIYUN_PROFILE", "aispace")
ENDPOINT = f"agentrun.{REGION}.aliyuncs.com"


def _creds():
    p = os.path.expanduser("~/.aliyun/config.json")
    d = json.load(open(p))
    prof = next(x for x in d.get("profiles", []) if x.get("name") == PROFILE)
    return prof["access_key_id"], prof["access_key_secret"]


def client():
    ak, sk = _creds()
    cfg = open_api_models.Config(access_key_id=ak, access_key_secret=sk, region_id=REGION)
    cfg.endpoint = ENDPOINT
    return Client(cfg)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    c = client()
    if cmd == "list":
        r = c.list_agent_runtimes(M.ListAgentRuntimesRequest())
        print(json.dumps(r.body.to_map(), ensure_ascii=False, indent=2))
    else:
        print("usage: python ar.py list")
