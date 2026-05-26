/**
 * Phase 24 — Behavioral + source-regression tests for save-pasted-transcript.
 *
 * The edge function uses Deno-runtime imports (`https://esm.sh/...`,
 * `Deno.serve`, `Deno.env`) so we cannot exercise the handler directly under
 * Node/vitest. Instead we test the source artifact for the load-bearing
 * invariants the requirements depend on, plus we exercise the parser-driven
 * payload construction logic against the SAME parser the edge function
 * imports — which is the actual source of truth for PASTE-02 / PASTE-03 /
 * LEGAL.
 *
 * Pattern matches existing edge-function tests in this codebase
 * (see supabase/functions/youtube-api/__tests__/youtube-api-regression.test.ts).
 *
 * Requirements covered:
 *   - LEGAL    — zero outbound HTTP calls to fathom.video from this function
 *   - PASTE-03 — re-paste of same share URL produces same dedup key, and the
 *                handler uses (organization_id, share_token) as the lookup
 *   - PASTE-02 — raw fallback path is wired to write full_transcript so FTS
 *                still indexes the words even when format is unrecognized
 *   - PASTE-01 — auth + workspace membership gates exist before write
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseFathomCopyFormat,
  extractShareToken,
} from "../../_shared/fathom-transcript-parser";

const SOURCE_PATH = resolve(
  process.cwd(),
  "supabase/functions/save-pasted-transcript/index.ts",
);

function readSource(): string {
  return readFileSync(SOURCE_PATH, "utf8");
}

// ---------------------------------------------------------------------------
// LEGAL — zero outbound HTTP to fathom.video
// ---------------------------------------------------------------------------

describe("LEGAL — zero outbound HTTP to fathom.video", () => {
  it("source contains NO fetch / axios / http call to fathom.video", () => {
    const src = readSource();
    // Strip out comments AND string literals before grepping. We allow
    // fathom.video to appear inside JS comments (// or /* */) and inside
    // string-literal allow-list regexes (e.g. `^https?://(www\\.)?fathom\\.video/`),
    // but never in code that actually executes a network call.
    const stripped = src
      // Block comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Line comments
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
      // String literals (single, double, backtick) — including escapes
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/`(?:\\.|[^`\\])*`/g, "``");

    // After stripping, fathom.video must not appear as live code.
    expect(stripped).not.toMatch(/fathom\.video/);
  });

  it("source does not import any HTTP client targeting fathom.video", () => {
    const src = readSource();
    // No axios, no node-fetch, no Deno fetch wrapper specific to fathom.
    expect(src).not.toMatch(/from\s+['"]axios['"]/);
    expect(src).not.toMatch(/from\s+['"]node-fetch['"]/);
    // The only fetch-equivalent is via the supabase client (via esm.sh import).
    // We assert that explicitly.
    expect(src).toContain(
      'import { createClient } from "https://esm.sh/@supabase/supabase-js@2"',
    );
  });

  it('source contains the explicit "NEVER fetches from fathom.video" notice', () => {
    // This sentinel comment is required by the legal posture; if a future
    // edit removes it, the legal review gate is gone too.
    const src = readSource();
    expect(src).toMatch(/NEVER fetches from fathom\.video/);
  });
});

// ---------------------------------------------------------------------------
// PASTE-01 — auth + workspace membership gates
// ---------------------------------------------------------------------------

describe("PASTE-01 — auth + workspace membership gates exist before write", () => {
  it("delegates Authorization-header rejection to the shared auth helper", () => {
    const src = readSource();
    const authHelper = readFileSync(
      resolve(process.cwd(), "supabase/functions/_shared/auth.ts"),
      "utf8",
    );
    expect(src).toContain(
      'import { authenticateRequest } from "../_shared/auth.ts"',
    );
    expect(src).toContain("authenticateRequest(req, supabase, corsHeaders)");
    expect(authHelper).toContain("req.headers.get('Authorization')");
    expect(authHelper).toMatch(/status:\s*401/);
    expect(authHelper).toMatch(/'No authorization header'/);
  });

  it("verifies JWT via shared auth helper before any DB write", () => {
    const src = readSource();
    const authHelper = readFileSync(
      resolve(process.cwd(), "supabase/functions/_shared/auth.ts"),
      "utf8",
    );
    expect(authHelper).toContain("supabaseClient.auth.getUser(token)");
    // The membership check + the upsert must come AFTER the auth check.
    const authIdx = src.indexOf(
      "authenticateRequest(req, supabase, corsHeaders)",
    );
    const membershipIdx = src.indexOf('from("organization_memberships")');
    const insertIdx = src.indexOf('from("recordings")');
    expect(authIdx).toBeGreaterThan(0);
    expect(membershipIdx).toBeGreaterThan(authIdx);
    expect(insertIdx).toBeGreaterThan(membershipIdx);
  });

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

  it("verifies organization membership before write (T-24-02 mitigation)", () => {
    const src = readSource();
    expect(src).toContain('from("organization_memberships")');
    expect(src).toContain('"Not a member of the requested workspace"');
    expect(src).toMatch(/status:\s*403/);
  });

  it("validates input with Zod before processing", () => {
    const src = readSource();
    expect(src).toMatch(/from\s+['"]https:\/\/esm\.sh\/zod/);
    expect(src).toContain("inputSchema.safeParse");
    expect(src).toMatch(/status:\s*400/);
  });
});

// ---------------------------------------------------------------------------
// PASTE-03 — same share URL → same dedup key, and (org_id, share_token) lookup
// ---------------------------------------------------------------------------

describe("PASTE-03 — re-paste dedup", () => {
  it("parser produces the SAME share_token for the same share URL", () => {
    // This is the dedup key. The handler looks up an existing row by
    // (organization_id, share_token) and updates instead of inserts.
    const url = "https://fathom.video/share/dedup-token-001";
    const t1 = extractShareToken(url);
    const t2 = extractShareToken(url);
    const t3 = extractShareToken(url + "?utm=email");
    expect(t1).toBe("dedup-token-001");
    expect(t2).toBe(t1);
    expect(t3).toBe(t1);
  });

  it("handler looks up by (organization_id, share_token) before deciding insert vs update", () => {
    const src = readSource();
    // The dedup branch must scope by both the org and the parsed share_token.
    expect(src).toContain('.eq("organization_id", organization_id)');
    expect(src).toContain('.eq("share_token", shareToken)');
    // And it must select existing row before write.
    expect(src).toMatch(
      /from\(['"]recordings['"]\)\s*\.\s*select\(['"]id['"]\)/,
    );
    // Both action labels must be reachable.
    expect(src).toContain('action = "updated"');
    expect(src).toContain('action = "created"');
  });

  it("handler populates source_call_id alongside share_token (defense-in-depth dedup)", () => {
    // The existing global unique constraint
    // (organization_id, source_app, source_call_id) is a backstop. The
    // SUMMARY locked this in as a deliberate decision.
    const src = readSource();
    expect(src).toContain("source_call_id: normalized.externalId");
  });

  it("share_token column is the dedup key per the migration", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260507120000_recordings_paste_columns.sql",
    );
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS share_token TEXT");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS transcript_segments JSONB",
    );
    expect(migration).toMatch(/CREATE UNIQUE INDEX[^;]+share_token/);
    expect(migration).toMatch(/WHERE\s+share_token\s+IS\s+NOT\s+NULL/i);
  });
});

// ---------------------------------------------------------------------------
// PASTE-02 — searchable transcript (FTS-friendly storage)
// ---------------------------------------------------------------------------

describe("PASTE-02 — pasted text reaches full_transcript so FTS picks it up", () => {
  it("handler writes pasted content to full_transcript on both parsed AND raw paths", () => {
    const src = readSource();
    // The bracketed-format renderer falls back to raw_transcript when
    // parse_status is not 'parsed' — so user words always reach the FTS
    // index regardless of detection. Search has 5s SLA per PASTE-02.
    expect(src).toContain("full_transcript: normalized.fullTranscript");
    expect(src).toMatch(
      /parsed\.parse_status === ['"]parsed['"]\s*&&\s*parsed\.segments\.length > 0\s*\?/,
    );
    // Raw fallback: original text passes through.
    expect(src).toContain(": rawTranscript");
  });

  it("parser returns raw status (not throw) when format is unrecognized — payload still saves", () => {
    // Behavior contract: even garbage text returns a usable result that
    // the edge function then writes to full_transcript. No data loss.
    const result = parseFathomCopyFormat("this is garbage");
    expect(result.parse_status).toBe("raw");
    expect(result.segments).toEqual([]);
    // Edge fn payload will set transcript_segments=null in this case AND
    // store the original raw_transcript string for FTS. Confirm the
    // handler implements that branch.
    const src = readSource();
    expect(src).toMatch(
      /transcriptSegments:\s*parsed\.parse_status === ['"]parsed['"]\s*\?\s*parsed\.segments\s*:\s*null/,
    );
  });
});

// ---------------------------------------------------------------------------
// T-24-08 — open-redirect mitigation
// ---------------------------------------------------------------------------

describe("T-24-08 — Fathom source links are validated without blocking Zoom links", () => {
  it("handler rejects a non-fathom source link only for Fathom imports", () => {
    const src = readSource();
    expect(src).toContain("FATHOM_URL_RE");
    expect(src).toMatch(/\^https\?:\\\/\\\/\(www\\\.\)\?fathom\\\.video\\\//);
    expect(src).toContain('sourceApp === "fathom-paste"');
    expect(src).toContain("Fathom imports require a fathom.video source link");
    expect(src).toContain("source_url");
  });

  it("routes non-Fathom manual transcripts through the shared connector pipeline", () => {
    const src = readSource();
    expect(src).toContain('import { runPipeline } from "../_shared/connector-pipeline.ts"');
    expect(src).toContain("source_app: sourceApp");
    expect(src).toContain("source_url: sourceUrl ?? null");
    expect(src).toContain("pasteSource: \"zoom-vtt\"");
  });
});
