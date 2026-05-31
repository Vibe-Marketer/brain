import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("public webhook URL wiring", () => {
  it("has Vercel API rewrites for provider webhook receivers", () => {
    const vercel = read("vercel.json");
    expect(vercel).toContain("/api/fireflies-webhook/:path*");
    expect(vercel).toContain("/api/read-ai-webhook/:path*");
    expect(vercel).toContain("/api/grain-webhook/:path*");
    expect(vercel).toContain("/api/webhook");
  });

  it("builds server-generated webhook URLs through the shared public base helper", () => {
    expect(read("supabase/functions/read-ai-webhook-settings/index.ts")).toContain(
      "../_shared/public-webhook-url.ts",
    );
    expect(read("supabase/functions/grain-create-webhooks/index.ts")).toContain(
      "../_shared/public-webhook-url.ts",
    );
    expect(read("supabase/functions/grain-disconnect/index.ts")).toContain(
      "../_shared/public-webhook-url.ts",
    );
    expect(read("supabase/functions/create-fathom-webhook/index.ts")).toContain(
      "../_shared/public-webhook-url.ts",
    );
  });

  it("keeps raw Supabase functions URLs as fallback only", () => {
    const helper = read("supabase/functions/_shared/public-webhook-url.ts");
    expect(helper).toContain("PUBLIC_WEBHOOK_BASE_URL");
    expect(helper).toContain("WEBHOOK_BASE_URL");
    expect(helper).toContain("APP_URL");
    expect(helper).toContain("/functions/v1");

    expect(read("supabase/functions/read-ai-webhook-settings/index.ts")).not.toContain(
      "/functions/v1/read-ai-webhook",
    );
    expect(read("supabase/functions/grain-create-webhooks/index.ts")).not.toContain(
      "/functions/v1/grain-webhook",
    );
  });
});
