import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasAvailableRuntime,
  mapRuntimeCatalogEvidence,
} from "./worker-runtime-catalog-evidence.mjs";
import {
  displayName,
  parseConfigFields,
  parseEnvBindings,
  renderIndex,
  renderSpec,
} from "./worker-type-spec-render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/workers/specs");
const checkOnly = process.argv.includes("--check");

const definitionsRoot = path.join(root, "config/worker-types");
const definitionCatalog = readJson(path.join(definitionsRoot, "catalog.json"));
const runtimeCatalog = readJson(
  path.join(root, "backend/internal/domain/workerruntime/runtime_catalog.lock.json"),
);
const lockProbes = mapByWorkerSlug(
  readJson(
    path.join(
      root,
      "tools/loops/worker-onboarding/catalog-loop/evidence/runtime-lock-probes.json",
    ),
  ).probes,
);

const workers = buildWorkers();
const files = {
  "CONFIG_PARAMS.json": `${JSON.stringify({ schemaVersion: 1, workers }, null, 2)}\n`,
  "README.md": renderIndex(workers),
};
for (const worker of workers) {
  files[`${worker.slug}.md`] = renderSpec(worker);
}

if (checkOnly) {
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(outDir, name);
    if (!fs.existsSync(full) || fs.readFileSync(full, "utf8") !== content) {
      throw new Error(`Worker specs stale (${name}). Run: pnpm run worker-specs:sync`);
    }
  }
} else {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), content);
  }
}

function buildWorkers() {
  return definitionCatalog.worker_types
    .map((entry) => {
      const definition = readJson(path.join(root, entry.definition_path));
      if (definition.internal) return null;
      const agentFile = fs.readFileSync(
        path.join(definitionsRoot, entry.slug, "AgentFile"),
        "utf8",
      );
      const runtimeImage = runtimeCatalog.images.find((image) =>
        image.worker_type_slugs.includes(entry.slug),
      );
      const runtimeEvidence = mapRuntimeCatalogEvidence(
        runtimeCatalog,
        lockProbes,
        entry.slug,
      );
      return {
        slug: entry.slug,
        name: displayName(entry.slug),
        executable: definition.executable,
        adapterId: definition.adapter_id,
        interactionModes: definition.interaction_modes,
        modelRequirement: definition.model_requirement,
        toolModelRequirements: definition.tool_model_requirements ?? [],
        credentialBindings: (definition.credential_bindings ?? []).map((b) => ({
          id: b.id,
          sourceKind: b.source.kind,
          sourceRef: b.source.ref,
          environmentVariable: b.target.name,
        })),
        configFields: parseConfigFields(agentFile, entry.slug),
        envBindings: parseEnvBindings(agentFile),
        configDocuments: definition.config_documents ?? [],
        runtimeImage: runtimeImage
          ? {
              id: runtimeImage.id,
              slug: runtimeImage.slug,
              reference: runtimeImage.reference,
              enabled: runtimeImage.enabled,
              availability: runtimeEvidence.status,
            }
          : null,
        runtimeAvailable: hasAvailableRuntime(runtimeEvidence),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function mapByWorkerSlug(probes) {
  const result = new Map();
  for (const probe of probes) {
    if (result.has(probe.worker_slug)) {
      throw new Error(`runtime lock probes repeat Worker slug: ${probe.worker_slug}`);
    }
    result.set(probe.worker_slug, probe);
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
