import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("grain function config", () => {
  it("registers Grain webhook lifecycle functions with JWT disabled at the gateway", () => {
    expect(config).toMatch(/\[functions\.grain-create-webhooks\]\s+verify_jwt = false/);
    expect(config).toMatch(/\[functions\.grain-webhook\]\s+(?:#[^\n]*\n)?verify_jwt = false/);
  });
});
