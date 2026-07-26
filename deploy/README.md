# AgentCloud Deployment (AMP-aligned)

- **CI (CNB):** `.cnb.yml` builds `backend` / `relay` / `web` as
  `docker.cnb.cool/l8ai/doworker/<service>:release-YYYYMMDD`
- **Version SSOT:** `deploy/release-version.txt` (`release-YYYYMMDD`)
- **Helm chart:** `deploy/helm/agentcloud/` (backend / web / relay / `agents.l8ai.cn` ingress)
- **Environment values:** `deploy/environments/<env>/values.yaml`
- **Live namespace:** `agentcloud` (Harbor image project still `agentsmesh` until retagged)
- **CD (DoOps):** `scripts/release/doops_helm_deploy.sh`
- **Canonical entry:** https://agents.l8ai.cn (`dowork.l8ai.cn` kept as alias)

## Release flow

```bash
# 1. bump daily version (updates release-version.txt + oilan values imageTag)
bash scripts/release/set_release_version.sh release-20260726

# 2. push to main / release-* → CNB builds and pushes images

# 3. sync CNB → Harbor, then helm upgrade on oilan via doOps
bash scripts/release/doops_helm_deploy.sh oilan
```

Image sync plan (pre-Helm):

```bash
python3 deploy/tools/render_image_sync_plan.py oilan --format pairs
```

Private-registry environments must sync images before `helm upgrade --install`.
The chart must not render registry-sync Jobs.
