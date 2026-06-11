/**
 * QA Crawler (report-only).
 *
 * Playwright-based reliability sweep of the authenticated app. Signs in
 * with the standard test account, visits every `crawl: true` route from
 * `src/routes.manifest.ts`, captures console errors / page errors / HTTP
 * >= 400 responses, exercises safe interactive controls with real clicks,
 * fingerprints every finding, and writes everything to `qa-report.json`.
 *
 * This port is REPORT-ONLY: it never writes to the database and never
 * files tickets. Triage the JSON report by hand.
 *
 * Usage:
 *   npx tsx scripts/qa/qa-crawler.ts                 # full crawl
 *   npx tsx scripts/qa/qa-crawler.ts --route /rules  # one route
 *   npx tsx scripts/qa/qa-crawler.ts --max-routes 10
 *   npx tsx scripts/qa/qa-crawler.ts --headed        # visible browser
 *
 * Environment (.env.local preferred, .env fallback):
 *   CALLVAULTAI_LOGIN / CALLVAULTAI_LOGIN_PASSWORD  test-account credentials
 *   QA_APP_URL or APP_URL                            default http://localhost:3001
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import { createHash } from "crypto";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { APP_ROUTES } from "../../src/routes.manifest";

// dotenv never overrides already-set vars, so .env.local wins over .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

// ── CLI flags ───────────────────────────────────────────────────────────

interface CliOptions {
  route: string | null;
  maxRoutes: number | null;
  headed: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { route: null, maxRoutes: null, headed: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--route":
        opts.route = argv[++i] ?? null;
        break;
      case "--max-routes": {
        const n = parseInt(argv[++i] ?? "", 10);
        if (!Number.isNaN(n) && n > 0) opts.maxRoutes = n;
        break;
      }
      case "--headed":
        opts.headed = true;
        break;
    }
  }
  return opts;
}

const cli = parseArgs(process.argv.slice(2));

// QA_APP_URL wins so the crawler can target the dev server even when the
// shared APP_URL env points at production.
const APP_URL = (process.env.QA_APP_URL || process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
const DEFAULT_MAX_ROUTES = 50;
const MAX_CONTROLS_PER_ROUTE = 25;

// Controls whose accessible text matches this are never clicked.
const DENY_PATTERN = /delete|remove|leave|billing|upgrade|subscribe|sign out|log ?out|disconnect|revoke/i;

// ── Findings ────────────────────────────────────────────────────────────

type FindingType = "console" | "network" | "interaction";
type Severity = "low" | "medium" | "high" | "critical";

interface Finding {
  route: string;
  selector: string;
  type: FindingType;
  message: string;
  severity: Severity;
  fingerprint: string;
}

/** Strip volatile fragments so repeat findings fingerprint identically. */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/\?[^\s"']*/g, "<query>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function fingerprintFinding(route: string, type: FindingType, message: string): string {
  return createHash("sha256")
    .update(`${route}|${type}|${normalizeMessage(message)}`)
    .digest("hex");
}

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isSameOriginApi(rawUrl: string): boolean {
  const url = safeParseUrl(rawUrl);
  if (!url) return false;
  const app = safeParseUrl(APP_URL);
  const supabase = safeParseUrl(process.env.VITE_SUPABASE_URL || "");
  return (
    (app !== null && url.origin === app.origin) ||
    (supabase !== null && url.origin === supabase.origin)
  );
}

// ── Crawl mechanics ─────────────────────────────────────────────────────

interface CrawlState {
  currentRoute: string;
  currentSelector: string;
  findings: Finding[];
}

function recordFinding(
  state: CrawlState,
  type: FindingType,
  message: string,
  severity: Severity
): void {
  state.findings.push({
    route: state.currentRoute,
    selector: state.currentSelector,
    type,
    message: message.slice(0, 2000),
    severity,
    fingerprint: fingerprintFinding(state.currentRoute, type, message),
  });
}

function attachListeners(page: Page, state: CrawlState): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      recordFinding(state, "console", msg.text(), "high");
    }
  });

  page.on("pageerror", (err) => {
    recordFinding(state, "console", `Uncaught page error: ${err.message}`, "critical");
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    const severity: Severity =
      status >= 500 ? "critical" : isSameOriginApi(url) ? "high" : "medium";
    recordFinding(state, "network", `HTTP ${status} on ${url}`, severity);
  });

  page.on("requestfailed", (request) => {
    recordFinding(
      state,
      "network",
      `Request failed: ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`,
      "medium"
    );
  });
}

async function login(page: Page): Promise<void> {
  const email = process.env.CALLVAULTAI_LOGIN;
  const password = process.env.CALLVAULTAI_LOGIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing CALLVAULTAI_LOGIN or CALLVAULTAI_LOGIN_PASSWORD in environment");
  }

  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 20000 });
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 30000 });
  console.log(`Signed in as ${email}`);
}

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${APP_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Allow async data loads to surface their errors; networkidle may never
  // fire on pages with realtime subscriptions, so cap it.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
}

const CONTROL_SELECTOR = 'button, [role="button"], [role="tab"], [role="menuitem"]';

/** True when the control lives inside a link that leaves the app. */
async function isExternalTarget(page: Page, index: number): Promise<boolean> {
  return page
    .locator(CONTROL_SELECTOR)
    .nth(index)
    .evaluate((node, appOrigin) => {
      const anchor = (node as HTMLElement).closest("a");
      if (!anchor) return false;
      if (anchor.target === "_blank") return true;
      const href = anchor.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return false;
      try {
        return new URL(href).origin !== appOrigin;
      } catch {
        return true;
      }
    }, new URL(APP_URL).origin)
    .catch(() => true); // unresolvable control — treat as unsafe to click
}

async function exerciseControls(page: Page, route: string, state: CrawlState): Promise<number> {
  let clicked = 0;
  const total = await page.locator(CONTROL_SELECTOR).count();
  const limit = Math.min(total, MAX_CONTROLS_PER_ROUTE);

  for (let i = 0; i < limit; i++) {
    const control = page.locator(CONTROL_SELECTOR).nth(i);

    let accessibleText = "";
    try {
      const [text, ariaLabel] = await Promise.all([
        control.innerText({ timeout: 1500 }).catch(() => ""),
        control.getAttribute("aria-label").catch(() => null),
      ]);
      accessibleText = `${text} ${ariaLabel ?? ""}`.trim();
    } catch {
      continue;
    }

    if (DENY_PATTERN.test(accessibleText)) continue;
    if (await isExternalTarget(page, i)) continue;

    const visible = await control.isVisible().catch(() => false);
    const enabled = await control.isEnabled().catch(() => false);
    if (!visible || !enabled) continue;

    const selectorLabel = `${CONTROL_SELECTOR} >> nth=${i} (“${accessibleText.slice(0, 80) || "unlabeled"}”)`;
    state.currentSelector = selectorLabel;

    try {
      await control.click({ timeout: 3000 }); // real click, not trial
      clicked++;
      await page.waitForTimeout(600); // let triggered errors surface
    } catch (e) {
      recordFinding(
        state,
        "interaction",
        `Click failed on ${selectorLabel}: ${(e as Error).message.split("\n")[0]}`,
        "medium"
      );
    }

    // Reset state after every click: close any dialog, then reload route.
    state.currentSelector = "";
    await page.keyboard.press("Escape").catch(() => undefined);
    try {
      await gotoRoute(page, route);
    } catch {
      recordFinding(state, "interaction", `Route failed to reload after interaction on ${route}`, "high");
      break;
    }
  }

  return clicked;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`QA crawler starting (report-only) — app: ${APP_URL}`);
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(APP_URL)) {
    console.warn(
      `WARNING: crawl target is not localhost (${APP_URL}). Real clicks will run against that environment. ` +
        `Set QA_APP_URL=http://localhost:3001 to target the dev server.`
    );
  }

  // Route selection: explicit --route wins, then crawl:true manifest routes
  // capped by --max-routes or the built-in default.
  let routes = APP_ROUTES.filter((r) => r.crawl).map((r) => r.path);
  if (cli.route) {
    routes = [cli.route];
  } else {
    routes = routes.slice(0, cli.maxRoutes ?? DEFAULT_MAX_ROUTES);
  }

  console.log(`Routes to crawl (${routes.length}): ${routes.join(", ")}`);

  const state: CrawlState = { currentRoute: "", currentSelector: "", findings: [] };
  let routesCrawled = 0;
  let controlsClicked = 0;
  let browser: Browser | null = null;
  let crawlError: Error | null = null;

  try {
    browser = await chromium.launch({ headless: !cli.headed });
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();
    attachListeners(page, state);

    state.currentRoute = "/login";
    await login(page);

    for (const route of routes) {
      console.log(`Crawling ${route} ...`);
      state.currentRoute = route;
      state.currentSelector = "";
      try {
        await gotoRoute(page, route);
        const clicks = await exerciseControls(page, route, state);
        controlsClicked += clicks;
        routesCrawled++;
        console.log(`  done — ${clicks} controls exercised`);
      } catch (e) {
        recordFinding(state, "interaction", `Route failed to load: ${(e as Error).message.split("\n")[0]}`, "critical");
      }
    }
  } catch (e) {
    crawlError = e as Error;
    console.error(`Crawl crashed: ${crawlError.message}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }

  // Dedupe findings inside this run by fingerprint (keep occurrence count).
  const byFingerprint = new Map<string, Finding & { occurrences: number }>();
  for (const f of state.findings) {
    const existing = byFingerprint.get(f.fingerprint);
    if (existing) {
      existing.occurrences++;
    } else {
      byFingerprint.set(f.fingerprint, { ...f, occurrences: 1 });
    }
  }
  const deduped = Array.from(byFingerprint.values());
  const criticalCount = deduped.filter((f) => f.severity === "critical").length;

  const report = {
    app_url: APP_URL,
    started_at: new Date().toISOString(),
    routes_requested: routes,
    routes_crawled: routesCrawled,
    controls_clicked: controlsClicked,
    findings_count: deduped.length,
    critical_count: criticalCount,
    findings: deduped,
  };
  fs.writeFileSync("qa-report.json", JSON.stringify(report, null, 2));
  console.log(
    `Report written to qa-report.json — ${deduped.length} findings (${criticalCount} critical), ` +
      `${routesCrawled} routes, ${controlsClicked} controls clicked.`
  );

  if (crawlError) {
    process.exitCode = 1;
  }
}

// Force exit: Playwright can leave live handles (sockets/subprocess pipes)
// that keep the event loop alive after the report is written, hanging the
// process indefinitely. The report is already flushed via writeFileSync.
main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
