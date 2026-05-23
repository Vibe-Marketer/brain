import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FUNCTION_SOURCE_PATH = resolve(
  process.cwd(),
  "supabase/functions/polar-create-customer/index.ts",
);
const AUTH_SOURCE_PATH = resolve(
  process.cwd(),
  "supabase/functions/_shared/auth.ts",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("polar-create-customer regression", () => {
  it("shared auth helper returns the authenticated user object", () => {
    const authSource = readSource(AUTH_SOURCE_PATH);

    expect(authSource).toContain("type User");
    expect(authSource).toContain("Promise<{ userId: string; user: User } | Response>");
    expect(authSource).toContain("return { userId: user.id, user };");
  });

  it("passes the authenticated user through before building the Polar customer payload", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).toContain("const { userId, user } = authResult;");
    expect(source).toContain("const displayName = profile?.display_name || user.user_metadata?.display_name;");
    expect(source).toContain("email: user.email!");

    const authIdx = source.indexOf("const { userId, user } = authResult;");
    const nameIdx = source.indexOf("const displayName = profile?.display_name || user.user_metadata?.display_name;");
    const createIdx = source.indexOf("const customer = await polar.customers.create({");

    expect(authIdx).toBeGreaterThan(0);
    expect(nameIdx).toBeGreaterThan(authIdx);
    expect(createIdx).toBeGreaterThan(nameIdx);
  });

  it("does not pass organizationId when using the production Polar org token", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).not.toContain("getPolarOrgId");
    expect(source).not.toContain("organizationId,");
    expect(source).toContain("Organization tokens are already scoped to one organization");
  });

  it("does not regress to the userId-only auth result that caused the upgrade failure", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).not.toContain("const userId = authResult.userId;");
  });
});
