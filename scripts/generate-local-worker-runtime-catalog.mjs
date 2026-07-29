import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const stableRuntimeImageIDs = JSON.parse(fs.readFileSync(
  path.join(
    path.dirname(modulePath),
    "../backend/internal/domain/workerruntime/runtime_image_id_registry.json",
  ),
  "utf8",
));

const localRuntimeMetadata = {
  "codex-cli": { slug: "codex-cli-local", name: "Codex CLI (local development)" },
  "video-studio": { slug: "video-studio-local", name: "Video Studio (local development)" },
  "gemini-cli": { slug: "gemini-cli-local", name: "Gemini CLI (local development)" },
  "kimi-code": { slug: "kimi-code-local", name: "Kimi Code (local development)" },
  "minimax-cli": { slug: "minimax-cli-local", name: "MiniMax CLI (local development)" },
  openclaw: { slug: "openclaw-local", name: "OpenClaw (local development)" },
  "do-agent": { slug: "do-agent-local", name: "DoAgent (local development)" },
  "e2e-echo": { slug: "e2e-echo-local", name: "E2E Echo (local development)" },
  aider: { slug: "aider-local", name: "Aider (local development)" },
  "claude-code": { slug: "claude-code-local", name: "Claude Code (local development)" },
  "cursor-cli": { slug: "cursor-cli-local", name: "Cursor CLI (local development)" },
  "grok-build": { slug: "grok-build-local", name: "Grok Build (local development)" },
  hermes: { slug: "hermes-local", name: "Hermes (local development)" },
  loopal: { slug: "loopal-local", name: "Loopal (local development)" },
  opencode: { slug: "opencode-local", name: "OpenCode (local development)" },
};

if (process.argv[1] === modulePath) {
  main(process.argv.slice(2));
}

export function buildLocalRuntimeCatalog({ runtimeImages, inspectImage }) {
  const images = runtimeImages.flatMap(([workerTypeSlug, image]) => {
    const metadata = localRuntimeMetadata[workerTypeSlug];
    if (!metadata) {
      throw new Error(`unsupported local Worker runtime: ${workerTypeSlug}`);
    }
    const digest = inspectImage(image);
    if (!isDigest(digest)) return [];
    const entries = [{
      ...metadata,
      id: runtimeImageID(workerTypeSlug),
      reference: `docker-daemon://${image}@${digest}`,
      digest,
      worker_type_slugs: [workerTypeSlug],
      enabled: true,
    }];
    if (workerTypeSlug === "codex-cli") {
      entries.push({
        ...entries[0],
        id: runtimeImageID("pattern-designer"),
        slug: "pattern-designer-local",
        name: "Pattern Designer (local development)",
        worker_type_slugs: ["pattern-designer"],
      });
    }
    if (workerTypeSlug === "do-agent") {
      entries.push({
        ...entries[0],
        id: runtimeImageID("seedance-expert"),
        slug: "seedance-expert-local",
        name: "Seedance Expert (local development)",
        worker_type_slugs: ["seedance-expert"],
      });
    }
    return entries;
  });

  if (images.length === 0) return undefined;
  return {
    schema_version: 1,
    revision: localCatalogRevision(images),
    images,
  };
}

function runtimeImageID(workerTypeSlug) {
  const id = stableRuntimeImageIDs[workerTypeSlug];
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`missing stable Worker runtime image ID: ${workerTypeSlug}`);
  }
  return id;
}

function localCatalogRevision(images) {
  const identity = images
    .map((image) => ({
      digest: image.digest,
      slug: image.slug,
      worker_type_slugs: image.worker_type_slugs,
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  return `local-dev-${createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")}`;
}

function main(argv) {
  const { output, runtimeImages } = parseArgs(argv);
  const catalog = buildLocalRuntimeCatalog({
    runtimeImages,
    inspectImage: inspectLocalImage,
  });

  if (!catalog) {
    fs.rmSync(output, { force: true });
    console.error("no verified local Worker runtime images are available");
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`wrote local Worker runtime catalog: ${output}`);
}

function parseArgs(values) {
  const parsed = { output: "", runtimeImages: [] };
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key || !value) {
      throw new Error("arguments must be --key value pairs");
    }
    if (key === "--output") {
      if (parsed.output) throw new Error("--output must be specified once");
      parsed.output = value;
      continue;
    }
    if (key === "--runtime") {
      const [workerTypeSlug, image] = value.split("=", 2);
      if (!workerTypeSlug || !image) {
        throw new Error("--runtime must be <worker-type-slug>=<image>");
      }
      parsed.runtimeImages.push([workerTypeSlug, image]);
      continue;
    }
    throw new Error(`unsupported argument: ${key}`);
  }
  if (!parsed.output || parsed.runtimeImages.length === 0) {
    throw new Error(
      "usage: node scripts/generate-local-worker-runtime-catalog.mjs --output <file> --runtime <worker-type-slug>=<image> [...runtime]",
    );
  }
  return parsed;
}

function inspectLocalImage(image) {
  const result = spawnSync("docker", ["image", "inspect", "--format", "{{.Id}}", image], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}
