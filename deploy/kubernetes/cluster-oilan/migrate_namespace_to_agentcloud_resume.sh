#!/usr/bin/env bash
# Resume after scale-down: PVCs still in agentsmesh, agentcloud ns empty.
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

echo "==> ensure no running pods in ${OLD}"
dexec "
kubectl -n ${OLD} delete ds --all --ignore-not-found
for i in \$(seq 1 36); do
  left=\$(kubectl -n ${OLD} get pods --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
  echo running=\$left
  [[ \"\$left\" == \"0\" ]] && break
  sleep 5
done
left=\$(kubectl -n ${OLD} get pods --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
[[ \"\$left\" == \"0\" ]] || { kubectl -n ${OLD} get pods; exit 1; }
"

echo "==> patch PVs Retain + delete PVCs"
dexec "
set -euo pipefail
for pvc in ${PVCS[*]}; do
  pv=\$(kubectl -n ${OLD} get pvc \$pvc -o jsonpath='{.spec.volumeName}')
  kubectl patch pv \$pv -p '{\"spec\":{\"persistentVolumeReclaimPolicy\":\"Retain\"}}'
done
kubectl -n ${OLD} delete pvc ${PVCS[*]} --wait=true
"

echo "==> rebind PVs into ${NEW}"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
pvcs = '${PVCS[*]}'.split()
out = subprocess.check_output(['kubectl','get','pv','-o','json'], text=True)
items = json.loads(out)['items']
for pvc in pvcs:
    match = None
    for pv in items:
        ref = pv.get('spec',{}).get('claimRef') or {}
        path = (pv.get('spec',{}).get('local') or {}).get('path','')
        if ref.get('namespace') == old and ref.get('name') == pvc:
            match = pv
            break
        if f'_{old}_{pvc}' in path:
            match = pv
    if not match:
        raise SystemExit(f'no PV for {pvc}')
    name = match['metadata']['name']
    size = match['spec']['capacity']['storage']
    sc = match['spec'].get('storageClassName') or 'local-path'
    print(f'rebind {pvc} <- {name} {size}')
    subprocess.check_call(['kubectl','patch','pv',name,'--type','json','-p','[{\"op\":\"remove\",\"path\":\"/spec/claimRef\"}]'])
    doc = {
      'apiVersion':'v1','kind':'PersistentVolumeClaim',
      'metadata':{'name':pvc,'namespace':new},
      'spec':{
        'accessModes':['ReadWriteOnce'],
        'resources':{'requests':{'storage':size}},
        'volumeName':name,
        'storageClassName':sc,
      },
    }
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(doc), text=True, check=True)
print('ok')
PY
kubectl -n ${NEW} get pvc
"

echo "==> secrets"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
for name in '''${SECRETS[*]} ${TLS_SECRETS[*]}'''.split():
    try:
        raw = subprocess.check_output(['kubectl','-n',old,'get','secret',name,'-o','json'], text=True)
    except subprocess.CalledProcessError:
        print('skip', name); continue
    obj = json.loads(raw)
    new_name = name.replace(old, new) if name.startswith(old) else name
    md = {'name': new_name, 'namespace': new}
    out = {'apiVersion':'v1','kind':'Secret','metadata':md,'type':obj.get('type','Opaque'),'data':obj.get('data',{})}
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(out), text=True, check=True)
    print(new_name)
PY
"

echo "==> configmap"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
raw = subprocess.check_output(['kubectl','-n',old,'get','cm',f'{old}-config','-o','json'], text=True)
obj = json.loads(raw)
data = {k: v.replace(f'{old}.svc', f'{new}.svc') for k,v in obj['data'].items()}
out = {'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':f'{new}-config','namespace':new},'data':data}
subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(out), text=True, check=True)
try:
    seed = json.loads(subprocess.check_output(['kubectl','-n',old,'get','cm',f'{old}-seed','-o','json'], text=True))
    sout = {'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':f'{new}-seed','namespace':new},'data':seed.get('data',{})}
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(sout), text=True, check=True)
except subprocess.CalledProcessError:
    pass
print('PRIMARY', data.get('PRIMARY_DOMAIN'), 'DB', data.get('DB_USER'), data.get('DB_NAME'))
PY
"

echo "==> workloads"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
RESOURCE_KEYS = {
    'name', 'namespace', 'serviceAccountName', 'serviceAccount',
    'secretName', 'configMapName', 'claimName',
}

def rewrite_obj(o):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k == 'image' and isinstance(v, str):
                out[k] = v
            elif k in ('value', 'key') and isinstance(v, str):
                out[k] = v
            elif k in RESOURCE_KEYS and isinstance(v, str):
                if v == old:
                    out[k] = new
                elif v.startswith(old + '-'):
                    out[k] = new + v[len(old):]
                else:
                    out[k] = v
            else:
                out[k] = rewrite_obj(v)
        return out
    if isinstance(o, list):
        return [rewrite_obj(x) for x in o]
    return o

def clean_meta(md):
    keep = {'name': md['name'].replace(old, new) if md['name'].startswith(old+'-') or md['name']==old else md['name'],
            'namespace': new}
    # name already rewritten by rewrite_obj for resource names starting with old-
    keep['name'] = md['name']
    keep['namespace'] = new
    labels = md.get('labels') or {}
    labels = {a: (b.replace(old, new) if isinstance(b,str) else b) for a,b in labels.items()}
    if labels:
        keep['labels'] = labels
    return keep

for kn in ('sa','role','rolebinding','svc','deploy'):
    items = json.loads(subprocess.check_output(['kubectl','-n',old,'get',kn,'-o','json'], text=True))['items']
    for item in items:
        if kn=='sa' and item['metadata']['name']=='default':
            continue
        item = rewrite_obj(item)
        item['metadata'] = clean_meta(item['metadata'])
        item.pop('status', None)
        if kn == 'deploy':
            item['spec']['replicas'] = 1
            item['spec']['template']['metadata'].pop('creationTimestamp', None)
        if kn == 'svc':
            for f in ('clusterIP','clusterIPs','healthCheckNodePort','ipFamilies','ipFamilyPolicy'):
                item['spec'].pop(f, None)
        if kn == 'sa':
            body = {'apiVersion':'v1','kind':'ServiceAccount','metadata':item['metadata']}
        elif kn in ('role','rolebinding'):
            body = {k: item[k] for k in item if k in ('apiVersion','kind','metadata','rules','roleRef','subjects')}
            for sub in body.get('subjects') or []:
                if sub.get('namespace') == old:
                    sub['namespace'] = new
        else:
            body = {'apiVersion': item['apiVersion'], 'kind': item['kind'],
                    'metadata': item['metadata'], 'spec': item['spec']}
        subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(body), text=True, check=True)
        print(kn, body['metadata']['name'])
print('workloads ok')
PY
"

echo "==> switch ingress"
dexec "
set -euo pipefail
python3 - <<'PY'
import json, subprocess
old, new = '${OLD}', '${NEW}'
items = json.loads(subprocess.check_output(['kubectl','-n',old,'get','ingress','-o','json'], text=True))['items']
for item in items:
    subprocess.check_call(['kubectl','-n',old,'delete','ingress',item['metadata']['name'],'--wait=true'])
    print('del', item['metadata']['name'])
for item in items:
    name = item['metadata']['name'].replace(old, new)
    ann = {k:v for k,v in (item['metadata'].get('annotations') or {}).items()
           if not k.startswith('kubectl.kubernetes.io/') and not k.startswith('meta.helm.sh/')}
    md = {'name': name, 'namespace': new}
    if ann: md['annotations'] = ann
    body = {'apiVersion':'networking.k8s.io/v1','kind':'Ingress','metadata':md,'spec':item['spec']}
    subprocess.run(['kubectl','apply','-f','-'], input=json.dumps(body), text=True, check=True)
    print('add', name)
PY
"

echo "==> rollout + pin IM images"
dexec "
set -euo pipefail
for d in postgres redis minio backend relay web; do
  kubectl -n ${NEW} rollout status deploy/\$d --timeout=360s
done
kubectl -n ${NEW} set image deploy/backend backend=repo.aiedulab.cn:8443/agentsmesh/backend:im-locale-bindings
kubectl -n ${NEW} set image deploy/web web=repo.aiedulab.cn:8443/agentsmesh/web:im-locale-bindings
kubectl -n ${NEW} set env deploy/web PRIMARY_DOMAIN=agents.l8ai.cn
kubectl -n ${NEW} set env deploy/relay PRIMARY_DOMAIN=agents.l8ai.cn
kubectl -n ${NEW} rollout status deploy/backend --timeout=300s
kubectl -n ${NEW} rollout status deploy/web --timeout=300s
kubectl -n ${NEW} rollout status deploy/relay --timeout=300s
kubectl -n ${NEW} exec deploy/postgres -- sh -c 'psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tAc \"select version, dirty from schema_migrations\"'
kubectl -n ${NEW} get deploy,ingress
"

echo DONE
