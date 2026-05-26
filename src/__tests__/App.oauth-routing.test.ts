import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchPath } from "react-router-dom";

const source = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

describe("App OAuth routing", () => {
  it("mounts OAuthCallback once behind a wildcard callback route", () => {
    expect(source).toMatch(/path="\/oauth\/callback\/\*"/);
    expect(source).not.toMatch(/path="\/oauth\/callback\/zoom"/);
    expect(source).not.toMatch(/path="\/oauth\/callback\/read-ai"/);
    expect(source).not.toMatch(/path="\/oauth\/callback\/grain"/);
  });

  it.each([
    "/oauth/callback",
    "/oauth/callback/zoom",
    "/oauth/callback/read-ai",
    "/oauth/callback/grain",
  ])("matches %s", (pathname) => {
    expect(matchPath("/oauth/callback/*", pathname)).not.toBeNull();
  });
});
