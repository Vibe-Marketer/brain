import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/OAuthCallback.tsx"), "utf8");

describe("OAuthCallback routing", () => {
  it("routes OAuth callbacks through the shared callback route table", () => {
    expect(source).toMatch(/resolveOAuthCallbackRoute\(location\.pathname\)/);
    expect(source).toMatch(/route\.completeOAuth\(code,\s*stateParam\)/);
    expect(source).toMatch(/sourceParam = route\.sourceApp/);
    expect(source).not.toMatch(/isZoomCallback/);
    expect(source).not.toMatch(/isReadAiCallback/);
    expect(source).not.toMatch(/isGrainCallback/);
  });

  it("appends connection params with URLSearchParams instead of raw string concatenation", () => {
    expect(source).toMatch(/function appendConnectionParams/);
    expect(source).toMatch(/url\.searchParams\.set\("source", params\.source\)/);
    expect(source).toMatch(/url\.searchParams\.set\("connected", "true"\)/);
    expect(source).not.toMatch(/`\$\{safeReturnTo\}\$\{queryString\}`/);
  });
});
