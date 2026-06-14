/**
 * sentry-resolve integration wrapper.
 *
 * Runs the Deno Edge Function handler tests with a mocked outbound Sentry
 * endpoint. This suite never calls the live ai-simple Sentry org.
 *
 * Run: npm run test:integration -- sentry-resolve
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("[phase-21-02 sentry-resolve] mocked handler integration", () => {
  it("passes the Deno handler suite with mocked Sentry fetch", () => {
    const output = execFileSync(
      "deno",
      [
        "test",
        "supabase/functions/sentry-resolve/__tests__/sentry-resolve.handler.deno.test.ts",
      ],
      {
        cwd: resolve(__dirname, "../../../.."),
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
      },
    );

    expect(output).toContain("ok |");
    expect(output).toContain("0 failed");
  });

  it("keeps sentry-resolve gateway JWT verification enabled", () => {
    const config = readFileSync(
      resolve(__dirname, "../../../config.toml"),
      "utf8",
    );
    const stanza = config.match(
      /\[functions\.sentry-resolve\]([\s\S]*?)(?=\n\[functions\.|\n# ---|$)/,
    )?.[1] ?? "";

    expect(stanza).toContain("verify_jwt = true");
    expect(stanza).not.toMatch(/verify_jwt\s*=\s*false/);
  });
});
