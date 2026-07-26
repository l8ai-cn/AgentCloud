{{- define "agentcloud.labels" -}}
app.kubernetes.io/name: agentcloud
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end }}

{{- define "agentcloud.image" -}}
{{- $repo := required "image.repository is required" .repository -}}
{{- $tag := required "image.tag is required" .tag -}}
{{ printf "%s:%s" $repo $tag }}
{{- end }}
