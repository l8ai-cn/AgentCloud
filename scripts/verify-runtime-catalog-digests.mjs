import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Release gate: an `enabled` catalog entry whose digest cannot be resolved in
// the registry surfaces as a Pod-creation failure instead of a blocked option,
// so a dangling digest must fail the build rather than reach users.

const MANIFEST_TYPES = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(
  root,
  "backend/internal/domain/workerruntime/runtime_catalog.lock.json",
);
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const probeAll = process.argv.includes("--all");
const evidencePath = argumentValue("--json");
const insecureTLS = process.env.HARBOR_INSECURE_TLS === "true";

const results = [];
for (const image of lock.images) {
  if (!image.enabled && !probeAll) continue;
  const status = await probeReference(image.reference);
  results.push({ slug: image.slug, enabled: image.enabled, ...status });
  console.log(`${image.enabled ? "enabled " : "disabled"} ${image.slug}: ${status.status}`);
}

if (evidencePath) {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      { schema_version: 1, runtime_catalog_revision: lock.revision, probes: results },
      null,
      2,
    ) + "\n",
  );
}

const dangling = results.filter((item) => item.enabled && item.status !== "available");
if (dangling.length > 0) {
  for (const item of dangling) {
    console.error(`enabled runtime image ${item.slug} is not pullable: ${item.detail}`);
  }
  process.exit(1);
}

console.log(`runtime catalog ${lock.revision}: every enabled digest is pullable`);

async function probeReference(reference) {
  const parsed = parseReference(reference);
  if (!parsed) {
    return { status: "invalid", detail: `unparsable reference ${reference}` };
  }
  try {
    let response = await headManifest(parsed);
    if (response.statusCode === 401) {
      const token = await requestToken(response.headers["www-authenticate"]);
      if (token) response = await headManifest(parsed, token);
    }
    if (response.statusCode === 200) return { status: "available", detail: "" };
    if (response.statusCode === 404) {
      return { status: "not_found", detail: `${parsed.repository} returned 404` };
    }
    return {
      status: "unavailable",
      detail: `${parsed.repository} returned ${response.statusCode}`,
    };
  } catch (cause) {
    return { status: "unavailable", detail: String(cause) };
  }
}

function parseReference(reference) {
  const [location, digest] = String(reference).split("@");
  if (!digest || !location.includes("/")) return null;
  const separator = location.indexOf("/");
  return {
    host: location.slice(0, separator),
    repository: location.slice(separator + 1),
    digest,
  };
}

function headManifest({ host, repository, digest }, token) {
  const headers = { accept: MANIFEST_TYPES };
  if (token) headers.authorization = `Bearer ${token}`;
  return request({
    method: "HEAD",
    host,
    pathname: `/v2/${repository}/manifests/${digest}`,
    headers,
  });
}

async function requestToken(challenge) {
  const parameters = parseChallenge(challenge);
  if (!parameters.realm) return null;
  const url = new URL(parameters.realm);
  if (parameters.service) url.searchParams.set("service", parameters.service);
  if (parameters.scope) url.searchParams.set("scope", parameters.scope);
  const headers = {};
  const { HARBOR_USERNAME, HARBOR_PASSWORD } = process.env;
  if (HARBOR_USERNAME && HARBOR_PASSWORD) {
    const credentials = Buffer.from(`${HARBOR_USERNAME}:${HARBOR_PASSWORD}`).toString("base64");
    headers.authorization = `Basic ${credentials}`;
  }
  const response = await request({
    method: "GET",
    host: url.host,
    pathname: `${url.pathname}${url.search}`,
    headers,
    collectBody: true,
  });
  if (response.statusCode !== 200) return null;
  const payload = JSON.parse(response.body || "{}");
  return payload.token ?? payload.access_token ?? null;
}

function parseChallenge(header) {
  const parameters = {};
  for (const part of String(header ?? "").replace(/^Bearer\s+/i, "").split(",")) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    parameters[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
  return parameters;
}

function request({ method, host, pathname, headers, collectBody }) {
  const [hostname, port] = host.split(":");
  return new Promise((resolve, reject) => {
    const call = https.request(
      {
        method,
        hostname,
        port: port ? Number(port) : 443,
        path: pathname,
        headers,
        rejectUnauthorized: !insecureTLS,
        timeout: 30000,
      },
      (response) => {
        if (!collectBody) {
          response.resume();
          response.on("end", () => resolve(response));
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve(Object.assign(response, { body })));
      },
    );
    call.on("timeout", () => call.destroy(new Error(`timeout for ${host}${pathname}`)));
    call.on("error", reject);
    call.end();
  });
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
