#!/usr/bin/env bash
# One-shot oilan migration: agentsmesh → agentcloud (same node, local-path PVs).
# Keeps physical DB/MinIO identity (user/db/bucket = agentsmesh) so data mounts
# without rename; only Kubernetes names move to agentcloud.
#
#   DOOPS_SESSION=im-review bash migrate_namespace_to_agentcloud.sh
set -euo pipefail

OLD=agentsmesh
NEW=agentcloud
TARGET="${DOOPS_TARGET:-gw-oilan-node}"
SESSION="${DOOPS_SESSION:?set DOOPS_SESSION}"
WS="/root/ws/${SESSION}/ns-migrate"
PVCS=(postgres-data minio-data gitea-data redis-data)
SECRETS=(agentsmesh-secrets agentsmesh-pki-ca agentsmesh-access-token agentsmesh-regcred agentsmesh-gitea)
TLS_SECRETS=(l8ai-wildcard-tls aiedulab-wildcard-tls l8an-wildcard-tls)

dexec() { doops -session "${SESSION}" exec --target "${TARGET}" --cmd "$1"; }

echo "==> session ${SESSION} workspace ${WS}"

dexec "mkdir -p ${WS}/backup ${WS}/manifests"

echo "==> backup postgres + resource dump"
dexec "
set -euo pipefail
cd ${WS}
kubectl -n ${OLD} exec deploy/postgres -- \
  pg_dump -U agentsmesh -d agentsmesh -Fc -f /tmp/agentsmesh.dump
kubectl -n ${OLD} cp \$(kubectl -n ${OLD} get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}'):/tmp/agentsmesh.dump \
  ${WS}/backup/agentsmesh.dump
kubectl -n ${OLD} get secret,cm,sa,role,rolebinding,svc,deploy,ingress,pvc -o yaml \
  > ${WS}/backup/all-resources.yaml
sha256sum ${WS}/backup/agentsmesh.dump | tee ${WS}/backup/agentsmesh.dump.sha256
ls -lah ${WS}/backup/
"

echo "==> patch PVs to Retain"
dexec "
set -euo pipefail
for pvc in ${PVCS[*]}; do
  pv=\$(kubectl -n ${OLD} get pvc \$pvc -o jsonpath='{.spec.volumeName}')
  echo \"\$pvc -> \$pv\"
  kubectl patch pv \$pv -p '{\"spec\":{\"persistentVolumeReclaimPolicy\":\"Retain\"}}'
done
"

echo "==> create ${NEW} namespace"
dexec "kubectl create ns ${NEW} --dry-run=client -o yaml | kubectl apply -f -"

echo "==> scale down ${OLD} (write freeze)"
dexec "
set -euo pipefail
kubectl -n ${OLD} delete ds --all --ignore-not-found
kubectl -n ${OLD} scale deploy --all --replicas=0
# Wait until no running pods remain (ignore Succeeded/Failed jobs).
for i in \$(seq 1 60); do
  left=\$(kubectl -n ${OLD} get pods --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
  echo \"running pods: \$left\"
  [[ \"\$left\" == \"0\" ]] && break
  sleep 5
done
left=\$(kubectl -n ${OLD} get pods --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
[[ \"\$left\" == \"0\" ]] || { echo 'pods still running'; kubectl -n ${OLD} get pods; exit 1; }
"

echo "==> delete PVCs in ${OLD} (PVs retained)"
dexec "kubectl -n ${OLD} delete pvc ${PVCS[*]} --wait=true"

echo "==> rebind PVs into ${NEW}"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess, os

old, new = '${OLD}', '${NEW}'
pvcs = '${PVCS[*]}'.split()
for pvc in pvcs:
    # Find Released PV that used to belong to this claim
    out = subprocess.check_output(['kubectl','get','pv','-o','json'], text=True)
    items = json.loads(out)['items']
    match = None
    for pv in items:
        ref = pv.get('spec',{}).get('claimRef') or {}
        if ref.get('namespace') == old and ref.get('name') == pvc:
            match = pv
            break
        # after claimRef cleared we tag by name suffix
        if pvc in pv['metadata']['name'] and pv['status'].get('phase') in ('Released','Available'):
            match = pv
    if not match:
        # fallback: path contains _old_pvc
        for pv in items:
            path = (pv.get('spec',{}).get('local') or {}).get('path','')
            if f'_{old}_{pvc}' in path:
                match = pv
                break
    if not match:
        raise SystemExit(f'no PV for {pvc}')
    name = match['metadata']['name']
    path = match['spec']['local']['path']
    size = match['spec']['capacity']['storage']
    print(f'rebind {pvc} <- {name} ({path}) {size}')
    # clear claimRef
    subprocess.check_call([
        'kubectl','patch','pv',name,'--type','json',
        '-p','[{\"op\":\"remove\",\"path\":\"/spec/claimRef\"}]'
    ])
    pvc_doc = {
      'apiVersion': 'v1',
      'kind': 'PersistentVolumeClaim',
      'metadata': {'name': pvc, 'namespace': new},
      'spec': {
        'accessModes': ['ReadWriteOnce'],
        'resources': {'requests': {'storage': size}},
        'volumeName': name,
        'storageClassName': match['spec'].get('storageClassName') or 'local-path',
      },
    }
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(pvc_doc),
                   text=True, check=True)
print('pvc rebind done')
PY
kubectl -n ${NEW} get pvc
"

echo "==> copy secrets + TLS"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess

old, new = '${OLD}', '${NEW}'
names = '''${SECRETS[*]} ${TLS_SECRETS[*]}'''.split()
for name in names:
    try:
        raw = subprocess.check_output(['kubectl','-n',old,'get','secret',name,'-o','json'], text=True)
    except subprocess.CalledProcessError:
        print('skip missing', name)
        continue
    obj = json.loads(raw)
    new_name = name.replace(old, new) if name.startswith(old) else name
    md = {'name': new_name, 'namespace': new}
    if 'labels' in obj['metadata']:
        md['labels'] = obj['metadata']['labels']
    if 'annotations' in obj['metadata']:
        # drop last-applied / helm ownership; re-adopt later
        ann = {k:v for k,v in obj['metadata']['annotations'].items()
               if not k.startswith('kubectl.kubernetes.io/') and not k.startswith('meta.helm.sh/')}
        if ann:
            md['annotations'] = ann
    out = {
        'apiVersion': 'v1',
        'kind': 'Secret',
        'metadata': md,
        'type': obj.get('type', 'Opaque'),
        'data': obj.get('data', {}),
    }
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(out), text=True, check=True)
    print('secret', new_name)
PY
"

echo "==> copy configmap (k8s names → agentcloud, keep DB/bucket physical ids)"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess, re
old, new = '${OLD}', '${NEW}'
raw = subprocess.check_output(['kubectl','-n',old,'get','cm',f'{old}-config','-o','json'], text=True)
obj = json.loads(raw)
data = dict(obj['data'])
# Rewrite in-cluster DNS only. Keep DB_USER/DB_NAME/STORAGE_BUCKET/token audiences
# as the physical agentsmesh identifiers that live on the retained volumes.
for k,v in list(data.items()):
    data[k] = v.replace(f'{old}.svc', f'{new}.svc').replace(f'{old}.svc.cluster.local', f'{new}.svc.cluster.local')
out = {
  'apiVersion': 'v1',
  'kind': 'ConfigMap',
  'metadata': {'name': f'{new}-config', 'namespace': new},
  'data': data,
}
subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(out), text=True, check=True)
# seed if present
try:
    raw = subprocess.check_output(['kubectl','-n',old,'get','cm',f'{old}-seed','-o','json'], text=True)
    seed = json.loads(raw)
    sout = {
      'apiVersion': 'v1', 'kind': 'ConfigMap',
      'metadata': {'name': f'{new}-seed', 'namespace': new},
      'data': seed.get('data', {}),
    }
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(sout), text=True, check=True)
except subprocess.CalledProcessError:
    pass
print('config copied')
print('PRIMARY_DOMAIN=', data.get('PRIMARY_DOMAIN'))
print('DB_USER=', data.get('DB_USER'), 'DB_NAME=', data.get('DB_NAME'))
PY
"

echo "==> copy SA/Role/RoleBinding + Deployments/Services (rewrite names)"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess, copy

old, new = '${OLD}', '${NEW}'

def clean_meta(md, name=None, ns=None):
    keep = {}
    keep['name'] = name or md['name'].replace(old, new)
    keep['namespace'] = ns or new
    for k in ('labels', 'annotations'):
        if k in md:
            val = md[k]
            if k == 'annotations':
                val = {a:b for a,b in val.items()
                       if not a.startswith('kubectl.kubernetes.io/')
                       and not a.startswith('deployment.kubernetes.io/')
                       and not a.startswith('meta.helm.sh/')
                       and a != 'kubectl.kubernetes.io/last-applied-configuration'}
            # rewrite label values
            val = {a: (b.replace(old, new) if isinstance(b, str) else b) for a,b in val.items()}
            if val:
                keep[k] = val
    return keep

# Only rewrite Kubernetes *resource* references. Physical ids on retained
# volumes (POSTGRES_USER, DB_NAME, STORAGE_BUCKET, Harbor project path,
# token audiences) must stay agentsmesh.
RESOURCE_KEYS = {
    'name', 'namespace', 'serviceAccountName', 'serviceAccount',
    'secretName', 'configMapName', 'claimName',
}

def rewrite_obj(o):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in ('image',) and isinstance(v, str):
                out[k] = v  # harbor …/agentsmesh/… untouched
            elif k in ('value', 'key') and isinstance(v, str):
                out[k] = v  # env values / secret keys untouched
            elif k in RESOURCE_KEYS and isinstance(v, str):
                if v == old:
                    out[k] = new
                elif v.startswith(old + '-'):
                    out[k] = new + v[len(old):]
                else:
                    out[k] = v
            elif k == 'name' and isinstance(v, str) and v.startswith(old + '-'):
                out[k] = new + v[len(old):]
            else:
                out[k] = rewrite_obj(v)
        return out
    if isinstance(o, list):
        return [rewrite_obj(x) for x in o]
    return o

def rewrite(obj):
    return rewrite_obj(obj)

kinds = [
  ('sa', 'ServiceAccount'),
  ('role', 'Role'),
  ('rolebinding', 'RoleBinding'),
  ('svc', 'Service'),
  ('deploy', 'Deployment'),
]
for kn, kind in kinds:
    out = subprocess.check_output(['kubectl','-n',old,'get',kn,'-o','json'], text=True)
    items = json.loads(out)['items']
    for item in items:
        name = item['metadata']['name']
        if name == 'default' and kn == 'sa':
            continue
        item = rewrite(item)
        item['metadata'] = clean_meta(item['metadata'])
        item.pop('status', None)
        if kn == 'deploy':
            item['spec']['replicas'] = 1
            # clear fields that block apply
            item['spec'].pop('progressDeadlineSeconds', None)
            tpl = item['spec']['template']['metadata']
            tpl.pop('creationTimestamp', None)
        if kn == 'svc':
            item['spec'].pop('clusterIP', None)
            item['spec'].pop('clusterIPs', None)
            item['spec'].pop('healthCheckNodePort', None)
            item['spec'].pop('ipFamilies', None)
            item['spec'].pop('ipFamilyPolicy', None)
        body = {'apiVersion': item['apiVersion'], 'kind': item['kind'],
                'metadata': item['metadata'], 'spec': item.get('spec', {})}
        if kn == 'sa':
            body = {'apiVersion': 'v1', 'kind': 'ServiceAccount', 'metadata': item['metadata']}
            if 'secrets' in item:  # legacy
                pass
        if kn in ('role', 'rolebinding'):
            body = {k: item[k] for k in item if k in ('apiVersion','kind','metadata','rules','roleRef','subjects')}
            if 'subjects' in body:
                for sub in body['subjects']:
                    if sub.get('namespace') == old:
                        sub['namespace'] = new
        subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(body), text=True, check=True)
        print(kn, body['metadata']['name'])
print('workloads applied')
PY
"

echo "==> switch ingress (delete old, create new)"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
raw = subprocess.check_output(['kubectl','-n',old,'get','ingress','-o','json'], text=True)
items = json.loads(raw)['items']
# Delete old first — same hosts cannot be held by two namespaces.
for item in items:
    subprocess.check_call(['kubectl','-n',old,'delete','ingress',item['metadata']['name'],'--wait=true'])
    print('deleted', item['metadata']['name'])

for item in items:
    name = item['metadata']['name'].replace(old, new)
    md = {'name': name, 'namespace': new}
    ann = item['metadata'].get('annotations') or {}
    ann = {k:v for k,v in ann.items()
           if not k.startswith('kubectl.kubernetes.io/') and not k.startswith('meta.helm.sh/')}
    if ann:
        md['annotations'] = ann
    body = {
      'apiVersion': 'networking.k8s.io/v1',
      'kind': 'Ingress',
      'metadata': md,
      'spec': item['spec'],
    }
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(body), text=True, check=True)
    print('created', name)
PY
"

echo "==> wait for core rollouts"
dexec "
set -euo pipefail
for d in postgres redis minio gitea backend relay web; do
  kubectl -n ${NEW} rollout status deploy/\$d --timeout=300s
done
kubectl -n ${NEW} get deploy,pods,ingress
kubectl -n ${NEW} exec deploy/postgres -- sh -c 'psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tAc \"select version, dirty from schema_migrations\"'
"

echo "==> pin IM-capable backend/web images"
dexec "
set -euo pipefail
kubectl -n ${NEW} set image deploy/backend backend=repo.aiedulab.cn:8443/agentsmesh/backend:im-locale-bindings
kubectl -n ${NEW} set image deploy/web web=repo.aiedulab.cn:8443/agentsmesh/web:im-locale-bindings
kubectl -n ${NEW} set env deploy/web PRIMARY_DOMAIN=agents.l8ai.cn
kubectl -n ${NEW} set env deploy/relay PRIMARY_DOMAIN=agents.l8ai.cn
kubectl -n ${NEW} rollout status deploy/backend --timeout=300s
kubectl -n ${NEW} rollout status deploy/web --timeout=300s
kubectl -n ${NEW} rollout status deploy/relay --timeout=300s
"

echo "==> migration complete. DO NOT delete ${OLD} for 48h."
echo "    Verify https://agents.l8ai.cn/health then observe."
