/**
 * Route manifest sync test.
 *
 * Reads `src/App.tsx` source, extracts every `path="..."` literal, and
 * asserts that every static route appears in `APP_ROUTES` from
 * `src/routes.manifest.ts`. This is the guard that stops a new page from
 * being added to the app without QA-crawler coverage being decided for it
 * (crawl: true OR an explicit crawl: false entry).
 *
 * Tolerances:
 * - Dynamic segments (`:id`) and wildcards (`*`) are skipped — the crawler
 *   cannot synthesize IDs/tokens.
 * - Pure redirect routes (element is `<Navigate .../>`) are skipped — they
 *   are not user-facing pages.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { APP_ROUTES } from "@/routes.manifest";

const APP_TSX_PATH = path.resolve(__dirname, "../App.tsx");

interface ExtractedRoute {
  routePath: string;
  isRedirect: boolean;
}

function extractRoutesFromAppSource(source: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  const pattern = /path="([^"]+)"/g;
  const matches: Array<{ value: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    matches.push({ value: match[1], index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    // Inspect the source between this path attribute and the next one (or
    // a bounded window at the end) to detect redirect-only routes.
    const sliceEnd = i + 1 < matches.length ? matches[i + 1].index : Math.min(source.length, current.index + 600);
    const block = source.slice(current.index, sliceEnd);
    routes.push({
      routePath: current.value,
      isRedirect: block.includes("<Navigate"),
    });
  }

  return routes;
}

function isStaticPath(routePath: string): boolean {
  return !routePath.includes(":") && !routePath.includes("*");
}

describe("routes.manifest", () => {
  const source = fs.readFileSync(APP_TSX_PATH, "utf-8");
  const extracted = extractRoutesFromAppSource(source);
  const manifestPaths = new Set(APP_ROUTES.map((r) => r.path));

  it("extracts a sane number of routes from App.tsx", () => {
    // Guard against the regex silently matching nothing after a refactor.
    expect(extracted.length).toBeGreaterThan(10);
  });

  it("covers every static, non-redirect route declared in App.tsx", () => {
    const required = extracted
      .filter((r) => isStaticPath(r.routePath))
      .filter((r) => !r.isRedirect)
      .map((r) => r.routePath);

    const missing = required.filter((p) => !manifestPaths.has(p));

    expect(
      missing,
      `Routes registered in App.tsx but missing from src/routes.manifest.ts: ${missing.join(", ")}. ` +
        `Add each one to APP_ROUTES with an explicit crawl decision.`
    ).toEqual([]);
  });

  it("has no duplicate paths in the manifest", () => {
    expect(manifestPaths.size).toBe(APP_ROUTES.length);
  });

  it("marks dynamic-param and wildcard routes as crawl: false", () => {
    const dynamicButCrawlable = APP_ROUTES.filter(
      (r) => !isStaticPath(r.path) && r.crawl
    ).map((r) => r.path);
    expect(dynamicButCrawlable).toEqual([]);
  });

  it("never marks a destructive route as crawlable", () => {
    const bad = APP_ROUTES.filter((r) => r.destructive && r.crawl).map((r) => r.path);
    expect(bad).toEqual([]);
  });
});
