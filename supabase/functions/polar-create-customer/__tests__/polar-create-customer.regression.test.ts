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
    // Pin the basic email-from-user shape (issue #301 removed the unsafe `!`).
    expect(source).toMatch(/email:\s*user\.email[!?]?(\s*\?\?|,)/);

    const authIdx = source.indexOf("const { userId, user } = authResult;");
    const nameMatch = source.match(DISPLAY_NAME_RE);
    const nameIdx = nameMatch ? source.indexOf(nameMatch[0]) : -1;
    const createIdx = source.indexOf("await polar.customers.create({");

    expect(authIdx).toBeGreaterThan(0);
    expect(nameIdx).toBeGreaterThan(authIdx);
    expect(createIdx).toBeGreaterThan(nameIdx);
  });

  it("guards against missing user.email with a 400 before calling Polar (issue #301)", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    // The guard must use a truthy check on user.email and return 400.
    expect(source).toMatch(/if\s*\(\s*!user\.email\s*\)/);
    expect(source).toContain("Email required for Polar customer creation");

    const guardMatch = source.match(/if\s*\(\s*!user\.email\s*\)/);
    const guardIdx = guardMatch ? source.indexOf(guardMatch[0]) : -1;
    const createIdx = source.indexOf("await polar.customers.create({");

    expect(guardIdx).toBeGreaterThan(0);
    expect(createIdx).toBeGreaterThan(guardIdx);

    // The unsafe non-null assertion form must not return.
    expect(source).not.toContain("email: user.email!");
  });

  it("looks up an existing Polar customer by externalId before creating (issue #302)", () => {
    const source = readSource(FUNCTION_SOURCE_PATH);

    // The lookup must call getStateExternal with externalId: userId, inside
    // a try block so a miss falls through to create() without bubbling.
    const lookupIdx = source.indexOf(
      "await polar.customers.getStateExternal({",
    );
    const createIdx = source.indexOf("await polar.customers.create({");

    expect(lookupIdx).toBeGreaterThan(0);
    expect(createIdx).toBeGreaterThan(lookupIdx);
    expect(source).toMatch(/externalId:\s*userId/);

    // The create call must be gated behind a check that no existing customer
    // was found, otherwise the idempotency lookup achieves nothing.
    expect(source).toMatch(/if\s*\(\s*!polarCustomerId\s*\)/);

    // The response customerId must come from the resolved polarCustomerId
    // (works for both the reuse and create branches), not a stale
    // `customer.id` only set on the create branch.
    expect(source).toMatch(/customerId:\s*polarCustomerId/);
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
