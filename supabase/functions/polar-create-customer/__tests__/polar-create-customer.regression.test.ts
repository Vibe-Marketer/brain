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
    expect(authSource).toContain(
      "Promise<{ userId: string; user: User } | Response>",
    );
    expect(authSource).toContain("return { userId: user.id, user };");
  });

  it("passes the authenticated user through before building the Polar customer payload", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).toContain("const { userId, user } = authResult;");
    // Use a regex so a `prettier` line-wrap of the displayName declaration
    // doesn't break the test.
    const DISPLAY_NAME_RE =
      /const\s+displayName\s*=\s*[\s\S]*?profile\?\.display_name\s*\|\|\s*user\.user_metadata\?\.display_name\s*;/;
    expect(source).toMatch(DISPLAY_NAME_RE);
    // Pin the basic email-from-user shape without locking in the unsafe `!`
    // form. Allows future safety improvements (`user.email?`, `user.email ?? fallback`)
    // to preserve the contract without breaking this test.
    expect(source).toMatch(/email:\s*user\.email[!?]?(\s*\?\?|,)/);

    const authIdx = source.indexOf("const { userId, user } = authResult;");
    const nameMatch = source.match(DISPLAY_NAME_RE);
    const nameIdx = nameMatch ? source.indexOf(nameMatch[0]) : -1;
    const createIdx = source.indexOf(
      "const customer = await polar.customers.create({",
    );

    expect(authIdx).toBeGreaterThan(0);
    expect(nameIdx).toBeGreaterThan(authIdx);
    expect(createIdx).toBeGreaterThan(nameIdx);
  });

  it("does not pass organizationId when using the production Polar org token", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).not.toContain("getPolarOrgId");
    expect(source).not.toContain("organizationId,");
    expect(source).toContain(
      "Organization tokens are already scoped to one organization",
    );
  });

  it("does not regress to the userId-only auth result that caused the upgrade failure", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    expect(source).not.toContain("const userId = authResult.userId;");
  });

  it("sibling Polar functions also do not pass organizationId to Polar SDK calls", () => {
    // Guard against re-introducing the same wiring bug in sibling Polar
    // functions. Org-scoped tokens reject `organizationId`, so no Polar SDK
    // call in these files should pass it. Comments referencing organizationId
    // are allowed (the rationale comment in polar-create-customer is the
    // canonical example) but actual payload keys are not.
    const siblings = [
      "supabase/functions/polar-checkout/index.ts",
      "supabase/functions/polar-customer-state/index.ts",
      "supabase/functions/polar-cancel/index.ts",
    ];

    for (const rel of siblings) {
      const src = readSource(resolve(process.cwd(), rel));
      expect(
        src,
        `${rel} must not pass organizationId as a payload key`,
      ).not.toMatch(/organizationId\s*[:,]/);
    }
  });
});
