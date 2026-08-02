export function renderIndex(workers) {
  const rows = workers
    .map(
      (w) =>
        `| \`${w.slug}\` | ${w.name} | ${w.runtimeAvailable ? "locked_available" : (w.runtimeImage?.availability ?? "missing")} | [spec](./${w.slug}.md) |`,
    )
    .join("\n");
  return `# Worker Type Specs

Generated from \`config/worker-types/*/definition.json\` + AgentFile. Do not edit by hand.

| Slug | Name | Runtime lock | Spec |
| --- | --- | --- | --- |
${rows}

Machine-readable config matrix: [\`CONFIG_PARAMS.json\`](./CONFIG_PARAMS.json).

Oilan online create probe (manual, not regenerated): [\`oilan-online-probe.json\`](./oilan-online-probe.json).
`;
}

export function renderSpec(w) {
  const configRows = w.configFields.length
    ? w.configFields
        .map(
          (f) =>
            `| \`${f.name}\` | ${f.kind} | ${f.options.length ? f.options.map((o) => `\`${o || "(empty)"}\``).join(", ") : "—"} | \`${f.defaultValue}\` |`,
        )
        .join("\n")
    : "| — | — | — | — |";
  const credRows = w.credentialBindings.length
    ? w.credentialBindings
        .map(
          (c) =>
            `| \`${c.id}\` | ${c.sourceKind} | \`${c.sourceRef}\` | \`${c.environmentVariable}\` |`,
        )
        .join("\n")
    : "| — | — | — | — |";
  const envRows = w.envBindings.length
    ? w.envBindings.map((e) => `| \`${e.name}\` | ${e.flags} | \`${e.value}\` |`).join("\n")
    : "| — | — | — |";
  const docs = w.configDocuments.length
    ? w.configDocuments
        .map(
          (d) =>
            `- \`${d.id}\` (${d.format}) → \`${d.target_path}\`${d.required ? " **required**" : ""}`,
        )
        .join("\n")
    : "- none";
  const tools = w.toolModelRequirements.length
    ? w.toolModelRequirements
        .map(
          (t) =>
            `- \`${t.id}\` modality=${t.modality ?? "—"} capability=${t.capability ?? "—"} required=${Boolean(t.required)}`,
        )
        .join("\n")
    : "- none";
  const model = w.modelRequirement
    ? `required=${Boolean(w.modelRequirement.required)}; adapters=${(w.modelRequirement.protocol_adapters ?? []).join(", ") || "—"}`
    : "—";
  const runtime = w.runtimeImage
    ? `\`${w.runtimeImage.slug}\` enabled=${w.runtimeImage.enabled} availability=${w.runtimeImage.availability}\n\n\`${w.runtimeImage.reference}\``
    : "not present in runtime catalog lock";

  return `# ${w.name} (\`${w.slug}\`)

| Field | Value |
| --- | --- |
| Executable | \`${w.executable}\` |
| Adapter | \`${w.adapterId}\` |
| Modes | ${w.interactionModes.map((m) => `\`${m}\``).join(", ")} |
| Model | ${model} |
| Definition | \`config/worker-types/${w.slug}/definition.json\` |
| AgentFile | \`config/worker-types/${w.slug}/AgentFile\` |

## Runtime image

${runtime}

## CONFIG fields

| Name | Kind | Options | Default |
| --- | --- | --- | --- |
${configRows}

## Credential bindings

| ID | Source kind | Source ref | Env |
| --- | --- | --- | --- |
${credRows}

## ENV (AgentFile)

| Name | Flags | Value |
| --- | --- | --- |
${envRows}

## Config documents

${docs}

## Tool model requirements

${tools}
`;
}

export function parseConfigFields(agentFile, slug) {
  return agentFile
    .split("\n")
    .filter((line) => line.startsWith("CONFIG "))
    .map((line) => {
      const match = line.match(/^CONFIG\s+([a-z0-9_]+)\s+(.+?)\s*=\s*(.+)$/i);
      if (!match) throw new Error(`Cannot parse CONFIG for ${slug}: ${line}`);
      const [, name, rawKind, defaultValue] = match;
      const options = rawKind.startsWith("SELECT(")
        ? [...rawKind.matchAll(/"([^"]*)"/g)].map((o) => o[1])
        : [];
      return { name, kind: configKind(rawKind), options, defaultValue };
    });
}

export function parseEnvBindings(agentFile) {
  return agentFile
    .split("\n")
    .filter((line) => line.startsWith("ENV "))
    .map((line) => {
      const body = line.slice(4).trim();
      const eq = body.indexOf("=");
      if (eq === -1) {
        const parts = body.split(/\s+/);
        return { name: parts[0], flags: parts.slice(1).join(" ") || "—", value: "" };
      }
      return {
        name: body.slice(0, eq).trim().split(/\s+/)[0],
        flags: body.slice(0, eq).trim().split(/\s+/).slice(1).join(" ") || "—",
        value: body.slice(eq + 1).trim(),
      };
    });
}

function configKind(rawKind) {
  const kinds = { BOOL: "boolean", STRING: "string", NUMBER: "number", SECRET: "secret" };
  if (rawKind.startsWith("SELECT(")) return "select";
  if (kinds[rawKind]) return kinds[rawKind];
  throw new Error(`Unsupported CONFIG kind: ${rawKind}`);
}

export function displayName(slug) {
  const names = {
    "codex-cli": "Codex CLI",
    "cursor-cli": "Cursor CLI",
    "do-agent": "Do Agent",
    "gemini-cli": "Gemini CLI",
    "grok-build": "Grok Build",
    "minimax-cli": "MiniMax CLI",
    openclaw: "OpenClaw",
    opencode: "OpenCode",
  };
  return names[slug] ?? slug.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}
