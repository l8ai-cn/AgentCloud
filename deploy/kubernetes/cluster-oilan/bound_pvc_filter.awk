# Skip PersistentVolumeClaim documents when the claim already exists.
# Bound PVC.spec.volumeName is immutable; re-applying empty volumeName fails.
# Usage: awk -v ns=NAMESPACE -f bound_pvc_filter.awk manifest.yaml
BEGIN { doc = ""; kind = ""; name = ""; emitted = 0 }
function flush(    cmd) {
  if (doc == "") return
  if (kind == "PersistentVolumeClaim" && name != "") {
    cmd = "kubectl -n " ns " get pvc " name " >/dev/null 2>&1"
    if (system(cmd) == 0) { doc = ""; kind = ""; name = ""; return }
  }
  if (emitted) printf "---\n"
  printf "%s", doc
  emitted = 1
  doc = ""; kind = ""; name = ""
}
/^---[[:space:]]*$/ { flush(); next }
/^kind:[[:space:]]*/ { kind = $2 }
/^[[:space:]]+name:[[:space:]]*/ && name == "" { name = $2 }
{ doc = doc $0 "\n" }
END { flush() }
