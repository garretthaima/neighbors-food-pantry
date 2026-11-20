{{/*
Common labels. Components add app.kubernetes.io/component alongside.
*/}}
{{- define "pantry.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "pantry.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels (stable: never add anything volatile here).
*/}}
{{- define "pantry.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
App non-secret env: computed service wiring, overridable by .Values.app.env.
PGPASSWORD, EDIT_PIN, SESSION_SECRET and VIEW_PIN come from the Secret.
*/}}
{{- define "pantry.appEnv" -}}
{{- $computed := dict
      "PORT" (toString .Values.app.port)
      "PGHOST" "postgres"
      "PGPORT" "5432"
      "PGDATABASE" .Values.database.name
      "PGUSER" .Values.database.owner
-}}
{{- range $k, $v := mergeOverwrite $computed (deepCopy (.Values.app.env | default dict)) }}
- name: {{ $k }}
  value: {{ $v | toString | quote }}
{{- end }}
{{- end }}
