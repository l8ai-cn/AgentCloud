import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { devUrl } from "./dev-runtime-env.mjs";

const OUT = join(process.cwd(), "output", "browser-integration");
mkdirSync(OUT, { recursive: true });

const WEB = devUrl("WEB_URL", "http://127.0.0.1:10007");
const TRAEFIK_API = devUrl("TRAEFIK_API_URL", "http://127.0.0.1:10000");
const API_DIRECT = devUrl("SESSION_COMPAT_API_URL", "http://localhost:10015");
const ORG = "dev-org";
const USER = { username: "devuser", password: "AdminAb123456" };

function authKey(baseUrl) {
  const u = new URL(baseUrl);
  const port = u.port ? `_${u.port}` : "";
  const raw = `${u.protocol.replace(":", "")}_${u.hostname.toLowerCase()}${port}`;
  return `agent-cloud-auth/${raw.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 64)}/session`;
}

async function login() {
  for (const base of [TRAEFIK_API, API_DIRECT]) {
    const res = await fetch(`${base}/proto.auth.v1.AuthService/Login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify(USER),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        token: data.token,
        refreshToken: data.refreshToken ?? data.refresh_token ?? "",
        expiresAt: Math.floor(Date.now() / 1000) + Number(data.expiresIn ?? data.expires_in ?? 3600),
      };
    }
  }
  throw new Error("login failed on traefik and backend direct");
}

async function injectSession(context, storageBaseUrl, { token, refreshToken, expiresAt }, orgSlug) {
  const key = authKey(storageBaseUrl);
  await context.addInitScript(
    ({ key, blob }) => localStorage.setItem(key, JSON.stringify(blob)),
    {
      key,
      blob: {
        access_token: token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        base_url: storageBaseUrl,
        current_org_slug: orgSlug,
        schema_version: 1,
      },
    },
  );
}

async function listAgents(token) {
  const res = await fetch(`${API_DIRECT}/v1/agents`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Organization-Slug": ORG,
    },
  });
  const body = await res.json();
  return body.data ?? [];
}

const report = { steps: [], errors: [] };

function step(name, ok, detail = "") {
  report.steps.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function part1AgentCloud(browser, auth) {
  const ctx = await browser.newContext();
  await injectSession(ctx, WEB, auth, ORG);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);

  await page.goto(`${WEB}/${ORG}/workspace`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(OUT, "01-web-workspace.png"), fullPage: true });

  const newPodBtn = page.getByRole("button", { name: /new pod/i }).last();
  await newPodBtn.waitFor({ state: "visible", timeout: 30_000 });
  await newPodBtn.click();

  await page.waitForTimeout(3000);
  if (page.url().includes("/workers/new")) {
    const body = await page.locator("body").innerText();
    if (!/Create Worker|Worker template|Plan & diff/i.test(body)) {
      throw new Error("Resource-native worker creation entry opened an unexpected page");
    }
    step("Agent Cloud: resource-native create entry opens", true);
    await ctx.close();
    return "e2e-echo";
  }

  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('[role="dialog"] .animate-spin').waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, "02-web-create-pod-dialog.png") });

  const noAgents = await page
    .locator("text=/does not support any agents|暂不支持任何智能体|no online runners/i")
    .isVisible()
    .catch(() => false);
  if (noAgents) throw new Error("create pod dialog: no agents available");

  const agentSelect = dialog.locator("select#agent-select");
  await agentSelect.waitFor({ state: "visible", timeout: 90_000 });

  const agents = await listAgents(auth.token);
  const agent =
    agents.find((a) => a.id === "e2e-echo")?.id ??
    agents.find((a) => a.builtin)?.id ??
    agents[0]?.id;
  if (!agent) throw new Error("no agents from /v1/agents");
  await agentSelect.selectOption(agent);

  const prompt = dialog.locator("textarea").first();
  if (await prompt.isVisible().catch(() => false)) {
    await prompt.fill("Browser integration smoke — say hello briefly.");
  }

  await page.screenshot({ path: join(OUT, "02-web-create-pod-dialog.png") });
  const submit = dialog.getByRole("button", { name: /create|创建/i }).last();
  await submit.click();
  await dialog.waitFor({ state: "hidden", timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT, "03-web-pod-created.png"), fullPage: true });

  step("Agent Cloud: create pod via browser", true, `agent=${agent}`);
  await ctx.close();
  return agent;
}

async function main() {
  const auth = await login();
  step("API login", true);

  const browser = await chromium.launch({ headless: true });
  try {
    await part1AgentCloud(browser, auth);
  } catch (err) {
    report.errors.push(`part1: ${String(err?.stack ?? err)}`);
    step("Agent Cloud: create pod via browser", false, String(err).split("\n")[0]);
  } finally {
    await browser.close();
    writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  }

  const failed = report.steps.some((s) => !s.ok);
  if (failed) process.exit(1);
}

main();
