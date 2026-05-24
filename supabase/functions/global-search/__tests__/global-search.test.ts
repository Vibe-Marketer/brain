import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_PATH = resolve(
  process.cwd(),
  "supabase/functions/global-search/index.ts",
);

function readSource(): string {
  return readFileSync(SOURCE_PATH, "utf8");
}

describe("FOUND-09 — google_meet excluded", () => {
  it("does not include google_meet in the accepted source app list", () => {
    const src = readSource();
    const validSourceApps = src.match(/const VALID_SOURCE_APPS = \[([^\]]+)\]/);

    expect(validSourceApps?.[1]).toBeTruthy();
    expect(validSourceApps?.[1]).not.toMatch(/['"]google.?meet['"]/i);
  });
});

describe("global-search — Supabase client initialization", () => {
  it("initializes the Supabase client before shared authentication", () => {
    const src = readSource();

    expect(src).toContain('const supabaseUrl = Deno.env.get("SUPABASE_URL")!');
    expect(src).toContain(
      'const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!',
    );
    expect(src).toContain(
      "const supabase = createClient(supabaseUrl, supabaseServiceKey)",
    );

    const initIdx = src.indexOf("const supabase = createClient");
    const authIdx = src.indexOf(
      "authenticateRequest(req, supabase, corsHeaders)",
    );
    expect(initIdx).toBeGreaterThan(0);
    expect(authIdx).toBeGreaterThan(initIdx);
  });
});

describe("global-search — request and error handling", () => {
  it("guards malformed JSON before validation", () => {
    const src = readSource();
    expect(src).toContain("await req.json().catch(() => ({}))");
    expect(src).toContain("globalSearchSchema.safeParse(rawBody)");
  });

  it("does not echo internal errors to clients", () => {
    const src = readSource();
    const outerCatchIdx = src.indexOf("} catch (error) {");
    const outerCatch = src.slice(outerCatchIdx);

    expect(outerCatch).toContain('"Internal server error"');
    expect(outerCatch).not.toContain("error.message");
  });

  it("does not expose RPC error details in the search failure response", () => {
    const src = readSource();
    const rpcErrorIdx = src.indexOf("if (searchError)");
    const rpcErrorBlock = src.slice(rpcErrorIdx, src.indexOf("const grouped"));

    expect(rpcErrorBlock).toContain('"Search failed"');
    expect(rpcErrorBlock).not.toContain("details");
    expect(rpcErrorBlock).not.toContain("searchError.message");
  });
});

describe("global-search — entity type routing", () => {
  it("switch covers all search result entity types and initializes every group", () => {
    const src = readSource();

    ["calls", "participants", "tags", "folders"].forEach((group) => {
      expect(src).toContain(`${group}: []`);
    });

    ["call", "participant", "tag", "folder"].forEach((entityType) => {
      expect(src).toContain(`case "${entityType}":`);
    });
  });
});
