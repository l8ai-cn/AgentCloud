#!/usr/bin/env bash
# Point agents.zjcm.edu.cn at nginx-ingress masters so traffic bypasses the
# campus WAF VIP (172.16.99.247) which returns HTTP 488 for unregistered hosts.
set -euo pipefail

NS=dns-system
CM=zheyin-bind-config
python3 - <<'PY'
import json, subprocess, pathlib, re, datetime

cm = json.loads(subprocess.check_output(
    ["kubectl", "-n", "dns-system", "get", "cm", "zheyin-bind-config", "-o", "json"]
))
zone = cm["data"]["db.zjcm.edu.cn.default"]
if re.search(r"(?m)^agents\s+IN\s+A\s+", zone):
    print("agents A record already present")
    for line in zone.splitlines():
        if line.startswith("agents"):
            print(line)
    raise SystemExit(0)

serial_match = re.search(r"IN SOA[^\n]*\n\s*(\d+)", zone)
cur = int(serial_match.group(1)) if serial_match else 0
today = int(datetime.datetime.utcnow().strftime("%Y%m%d") + "01")
new_serial = today if today > cur else cur + 1
zone = re.sub(
    r"(IN SOA[^\n]*\n\s*)\d+",
    lambda m: f"{m.group(1)}{new_serial}",
    zone,
    count=1,
)

anchor = "*                     IN A     172.16.99.247"
if anchor not in zone:
    raise SystemExit("wildcard A record not found; aborting")
insert = (
    f"{anchor}\n"
    "agents                 IN A     172.16.99.80\n"
    "agents                 IN A     172.16.99.81"
)
zone = zone.replace(anchor, insert, 1)

patch = {"data": {"db.zjcm.edu.cn.default": zone}}
subprocess.check_call(
    [
        "kubectl",
        "-n",
        "dns-system",
        "patch",
        "cm",
        "zheyin-bind-config",
        "--type",
        "merge",
        "-p",
        json.dumps(patch),
    ]
)
print(f"patched SOA serial -> {new_serial}")
for line in zone.splitlines():
    if line.startswith("agents") or "IN SOA" in line:
        print(line)
PY

kubectl -n dns-system rollout restart daemonset/zheyin-bind
kubectl -n dns-system rollout status daemonset/zheyin-bind --timeout=120s
sleep 2
echo "== resolve =="
getent ahostsv4 agents.zjcm.edu.cn | head -5 || true
# query bind pods directly
for p in $(kubectl -n dns-system get pod -l app=zheyin-bind -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
  echo "pod $p"
done
echo "== curl =="
curl -sk -o /tmp/agents-health.txt -w "code=%{http_code} ip=%{remote_ip}\n" \
  --connect-timeout 10 --max-time 20 https://agents.zjcm.edu.cn/health || true
head -c 200 /tmp/agents-health.txt; echo
curl -skI --connect-timeout 10 --max-time 20 https://agents.zjcm.edu.cn/ | head -12
